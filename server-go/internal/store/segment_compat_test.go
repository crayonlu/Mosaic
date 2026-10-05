package store

import "github.com/crayonlu/mosaic/server-go/internal/service"

// Compile-time proof that the SQL stores satisfy the interfaces the services
// consume. The router wires these concrete types, so a signature drift here
// would otherwise surface only at the composition root.
var (
	_ service.DiaryStore        = (*DiaryStore)(nil)
	_ service.StatsStore        = (*StatsStore)(nil)
	_ service.AppSettingsStore  = (*AppSettingsStore)(nil)
	_ service.UserAIConfigStore = (*UserAIConfigStore)(nil)
)
