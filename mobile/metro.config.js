const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')
const projectNodeModules = path.resolve(projectRoot, 'node_modules')
const bunStore = path.resolve(workspaceRoot, 'node_modules', '.bun')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [
  path.resolve(workspaceRoot, 'packages'),
  bunStore,
]

config.resolver.nodeModulesPaths = [projectNodeModules, path.resolve(workspaceRoot, 'node_modules')]
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  react: path.resolve(projectNodeModules, 'react'),
  'react-dom': path.resolve(projectNodeModules, 'react-dom'),
  'react-native': path.resolve(projectNodeModules, 'react-native'),
}

config.resolver.unstable_enableSymlinks = true
config.resolver.unstable_enablePackageExports = true

config.resolver.blockList = [
  /[/\\]server[/\\]target[/\\]/,
  /[/\\]desktop[/\\]src-tauri[/\\]target[/\\]/,
  /[/\\]desktop[/\\]node_modules[/\\]/,
  /[/\\]\.git[/\\]/,
]

module.exports = config
