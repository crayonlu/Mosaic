const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')
const projectNodeModules = path.resolve(projectRoot, 'node_modules')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [projectNodeModules, path.resolve(workspaceRoot, 'node_modules')]
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  react: path.resolve(projectNodeModules, 'react'),
  'react-dom': path.resolve(projectNodeModules, 'react-dom'),
  'react-native': path.resolve(projectNodeModules, 'react-native'),
}

module.exports = config
