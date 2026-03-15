import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: [
    'react-native',
    'expo',
    'expo-file-system',
    'expo-crypto',
    'react-native-safe-area-context',
    'react-native',
    /^react-native-/,
    '@tauri-apps/api',
    '@tauri-apps/api/**',
    '@tauri-apps/plugin-fs',
    '@tauri-apps/plugin-fs/**',
  ],
});
