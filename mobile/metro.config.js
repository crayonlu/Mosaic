const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')
const workspacePackages = path.resolve(workspaceRoot, 'packages')
const projectNodeModules = path.resolve(projectRoot, 'node_modules')
const workspaceNodeModules = path.resolve(workspaceRoot, 'node_modules')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspacePackages, workspaceNodeModules]
config.resolver.nodeModulesPaths = [projectNodeModules, workspaceNodeModules]
config.resolver.unstable_enableSymlinks = true
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  react: path.resolve(projectNodeModules, 'react'),
  'react-dom': path.resolve(projectNodeModules, 'react-dom'),
  'react-native': path.resolve(projectNodeModules, 'react-native'),
}

module.exports = config
