const { withAppBuildGradle } = require('@expo/config-plugins')

module.exports = function withNinjaLongPaths(config) {
  return withAppBuildGradle(config, config => {
    const cmakeArguments = ['"-DCMAKE_OBJECT_PATH_MAX=1024"']

    if (process.platform === 'win32') {
      cmakeArguments.unshift('"-DCMAKE_MAKE_PROGRAM=C:\\\\ninja-win\\\\ninja.exe"')
    }

    const ninjaConfig = `
          externalNativeBuild {
              cmake {
                  arguments ${cmakeArguments.join(', ')}
              }
          }`

    if (!config.modResults.contents.includes('DCMAKE_MAKE_PROGRAM')) {
      config.modResults.contents = config.modResults.contents.replace(
        /(defaultConfig\s*\{[\s\S]*?)(    \})/,
        `$1${ninjaConfig}\n$2`
      )
    }
    return config
  })
}
