package storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// defaultS3Region is used when no region is configured. Cloudflare R2 accepts
// "auto".
const defaultS3Region = "auto"

// S3Config configures the S3-compatible backend. Every value is required.
type S3Config struct {
	Endpoint        string
	Bucket          string
	Region          string
	AccessKeyID     string
	SecretAccessKey string
}

// S3Storage stores blobs in an S3-compatible bucket. It addresses the bucket in
// path style, matching how the previous server configured opendal S3.
type S3Storage struct {
	client *s3.Client
	bucket string
}

// NewS3Storage builds a client pinned to Endpoint with static credentials.
func NewS3Storage(cfg S3Config) (*S3Storage, error) {
	if missing := firstMissing(cfg); missing != "" {
		return nil, domain.InvalidInputf("s3 storage: %s is not set", missing)
	}
	region := cfg.Region
	if region == "" {
		region = defaultS3Region
	}
	client := s3.New(s3.Options{
		Region: region,
		Credentials: credentials.NewStaticCredentialsProvider(
			cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		// BaseEndpoint pins every request to the configured endpoint; path-style
		// addressing keeps the bucket in the request path.
		BaseEndpoint: aws.String(cfg.Endpoint),
		UsePathStyle: true,
	})
	return &S3Storage{client: client, bucket: cfg.Bucket}, nil
}

// Put writes data to path, recording mimeType as the object's content type.
func (s *S3Storage) Put(ctx context.Context, path string, data []byte, mimeType string) error {
	input := &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(path),
		Body:          bytes.NewReader(data),
		ContentLength: aws.Int64(int64(len(data))),
	}
	if mimeType != "" {
		input.ContentType = aws.String(mimeType)
	}
	if _, err := s.client.PutObject(ctx, input); err != nil {
		return s3Error("putting blob", err)
	}
	return nil
}

// Get reads the blob at path.
func (s *S3Storage) Get(ctx context.Context, path string) ([]byte, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(path),
	})
	if err != nil {
		return nil, s3Error("getting blob", err)
	}
	defer out.Body.Close()

	data, err := io.ReadAll(out.Body)
	if err != nil {
		return nil, domain.Internal(fmt.Errorf("reading blob: %w", err))
	}
	return data, nil
}

// Delete removes the blob at path.
func (s *S3Storage) Delete(ctx context.Context, path string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(path),
	})
	if err != nil {
		return s3Error("deleting blob", err)
	}
	return nil
}

// Exists reports whether a blob is present. A missing object reports
// (false, nil); a backend failure reports an error.
func (s *S3Storage) Exists(ctx context.Context, path string) (bool, error) {
	_, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(path),
	})
	if err != nil {
		if isNotFound(err) {
			return false, nil
		}
		return false, s3Error("checking blob", err)
	}
	return true, nil
}

// PresignedGetURL returns a time-limited download URL for path.
func (s *S3Storage) PresignedGetURL(ctx context.Context, path string, expires time.Duration) (string, error) {
	req, err := s3.NewPresignClient(s.client).PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(path),
	}, s3.WithPresignExpires(expires))
	if err != nil {
		return "", domain.Internal(fmt.Errorf("presigning download URL: %w", err))
	}
	return req.URL, nil
}

// PresignedPutURL returns a time-limited upload URL for path.
func (s *S3Storage) PresignedPutURL(ctx context.Context, path string, expires time.Duration) (string, error) {
	req, err := s3.NewPresignClient(s.client).PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(path),
	}, s3.WithPresignExpires(expires))
	if err != nil {
		return "", domain.Internal(fmt.Errorf("presigning upload URL: %w", err))
	}
	return req.URL, nil
}

// s3Error maps a service failure onto a domain error, translating a missing
// object or bucket into a not-found result.
func s3Error(action string, err error) *domain.Error {
	if isNotFound(err) {
		return domain.ResourceNotFound()
	}
	return domain.Internal(fmt.Errorf("%s: %w", action, err))
}

// isNotFound reports whether err names a missing object or bucket. HeadObject
// returns a bare 404 that the SDK surfaces as a generic API error, so both the
// typed errors and the error codes are checked.
func isNotFound(err error) bool {
	var noSuchKey *types.NoSuchKey
	var noSuchBucket *types.NoSuchBucket
	var notFound *types.NotFound
	if errors.As(err, &noSuchKey) || errors.As(err, &noSuchBucket) || errors.As(err, &notFound) {
		return true
	}
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		switch apiErr.ErrorCode() {
		case "NotFound", "NoSuchKey", "NoSuchBucket":
			return true
		}
	}
	return false
}

// firstMissing returns the first required field that is empty, or "" when the
// configuration is complete.
func firstMissing(cfg S3Config) string {
	for _, field := range []struct{ name, value string }{
		{"endpoint", cfg.Endpoint},
		{"bucket", cfg.Bucket},
		{"access key id", cfg.AccessKeyID},
		{"secret access key", cfg.SecretAccessKey},
	} {
		if field.value == "" {
			return field.name
		}
	}
	return ""
}
