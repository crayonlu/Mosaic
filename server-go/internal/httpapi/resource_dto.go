package httpapi

// Request and response bodies for the resource endpoints. Field names are part
// of the wire contract with installed clients.

type createResourceRequest struct {
	MemoID   *string        `json:"memoId"`
	Filename string         `json:"filename"`
	MimeType string         `json:"mimeType"`
	FileSize int64          `json:"fileSize"`
	Metadata map[string]any `json:"metadata"`
}

type confirmUploadRequest struct {
	ResourceID string `json:"resourceId" validate:"required"`
}

type uploadedResourceResponse struct {
	ID            string         `json:"id"`
	MemoID        *string        `json:"memoId"`
	Filename      string         `json:"filename"`
	ResourceType  string         `json:"resourceType"`
	MimeType      string         `json:"mimeType"`
	FileSize      int64          `json:"fileSize"`
	StorageType   string         `json:"storageType"`
	URL           string         `json:"url"`
	ThumbnailURL  *string        `json:"thumbnailUrl"`
	Metadata      map[string]any `json:"metadata"`
	AIDescription *string        `json:"aiDescription"`
	CreatedAt     int64          `json:"createdAt"`
}

type presignedUploadResponse struct {
	UploadURL   string `json:"uploadUrl"`
	ResourceID  string `json:"resourceId"`
	StoragePath string `json:"storagePath"`
}

type listResourcesResponse struct {
	Items    []uploadedResourceResponse `json:"items"`
	Total    int64                      `json:"total"`
	Page     int64                      `json:"page"`
	PageSize int64                      `json:"pageSize"`
}
