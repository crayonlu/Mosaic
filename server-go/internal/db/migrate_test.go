package db

import (
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

// The Go tree carries a goose-annotated copy of every migration the Rust tree
// holds. These paths are relative to this package directory.
const (
	goMigrationsDir   = "../../migrations"
	rustMigrationsDir = "../../../server/migrations"
)

const gooseUp = "-- +goose Up\n"

// TestMigrationsMatchPreviousServer guards against the two copies drifting
// apart while the rewrite is in flight. The Rust files must stay byte-identical
// to what sqlx already applied, so the annotation lives only on the Go side.
//
// The comparison needs the previous server's tree beside this one, so it is
// skipped where only the Go server has been deployed.
func TestMigrationsMatchPreviousServer(t *testing.T) {
	if _, err := os.Stat(rustMigrationsDir); errors.Is(err, os.ErrNotExist) {
		t.Skipf("%s is not present; this guard only applies inside the monorepo",
			rustMigrationsDir)
	}

	rustFiles := sqlFiles(t, rustMigrationsDir)
	if len(rustFiles) == 0 {
		t.Fatal("no migrations found in the previous server's directory")
	}

	for _, name := range rustFiles {
		t.Run(name, func(t *testing.T) {
			rustBody, err := os.ReadFile(filepath.Join(rustMigrationsDir, name))
			if err != nil {
				t.Fatalf("reading previous server's migration: %v", err)
			}

			goPath := filepath.Join(goMigrationsDir, name)
			goContents, err := os.ReadFile(goPath)
			if err != nil {
				t.Fatalf("migration is missing from the Go tree: %v", err)
			}

			if got := string(goContents[:len(gooseUp)]); got != gooseUp {
				t.Fatalf("migration does not start with %q", gooseUp)
			}

			body := goContents[len(gooseUp):]
			if string(body) != string(rustBody) {
				t.Error("migration body differs from the previous server's copy")
			}
		})
	}
}

// TestMigrationsParseWithGoose proves goose accepts every migration file. The
// provider only reads the filesystem here; no database connection is made.
func TestMigrationsParseWithGoose(t *testing.T) {
	sqlDB, err := sql.Open("pgx", "postgres://user:password@127.0.0.1:1/none")
	if err != nil {
		t.Fatalf("opening lazy handle: %v", err)
	}
	defer sqlDB.Close()

	provider, err := goose.NewProvider(goose.DialectPostgres, sqlDB, os.DirFS(goMigrationsDir))
	if err != nil {
		t.Fatalf("goose rejected the migration set: %v", err)
	}

	sources := provider.ListSources()
	if want := len(sqlFiles(t, goMigrationsDir)); len(sources) != want {
		t.Errorf("goose parsed %d migrations, want %d", len(sources), want)
	}

	seen := make(map[int64]string, len(sources))
	for _, source := range sources {
		if previous, ok := seen[source.Version]; ok {
			t.Fatalf("version %d appears in both %s and %s",
				source.Version, previous, source.Path)
		}
		seen[source.Version] = source.Path
	}
}

func sqlFiles(t *testing.T, dir string) []string {
	t.Helper()

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("reading %s: %v", dir, err)
	}

	var names []string
	for _, entry := range entries {
		if !entry.IsDir() && filepath.Ext(entry.Name()) == ".sql" {
			names = append(names, entry.Name())
		}
	}
	return names
}
