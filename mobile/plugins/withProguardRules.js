const { withDangerousMod } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

/**
 * Expo config plugin that appends custom ProGuard/R8 keep rules
 * to android/app/proguard-rules.pro during prebuild.
 */
function withProguardRules(config) {
  return withDangerousMod(config, [
    'android',
    config => {
      const proguardPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro'
      )

      const customRules = `
# expo-modules-core (required by expo-intent-launcher, expo-file-system, etc.)
-keep class expo.modules.kotlin.** { *; }
-keep class expo.modules.intentlauncher.** { *; }
`

      if (fs.existsSync(proguardPath)) {
        const existing = fs.readFileSync(proguardPath, 'utf8')
        if (!existing.includes('expo.modules.kotlin')) {
          fs.appendFileSync(proguardPath, customRules)
        }
      }

      return config
    },
  ])
}

module.exports = withProguardRules
