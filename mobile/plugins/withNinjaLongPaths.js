const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withNinjaLongPaths(config) {
  return withAppBuildGradle(config, (config) => {
    const ninjaConfig = `
        externalNativeBuild {
            cmake {
                arguments "-DCMAKE_MAKE_PROGRAM=C:\\\\ninja-win\\\\ninja.exe", "-DCMAKE_OBJECT_PATH_MAX=1024"
            }
        }`;
    
    if (!config.modResults.contents.includes('DCMAKE_MAKE_PROGRAM')) {
      config.modResults.contents = config.modResults.contents.replace(
        /(defaultConfig\s*\{[\s\S]*?)(    \})/,
        `$1${ninjaConfig}\n$2`
      );
    }
    return config;
  });
};
