const { withAndroidStyles, withMainActivity, withAndroidColors, withAppDelegate } = require('@expo/config-plugins')

function ensureStyle(resources, styleName, parent, item) {
  const styles = resources.style ?? []
  const filtered = styles.filter(s => s?.$?.name !== styleName)
  filtered.push({
    $: { name: styleName, parent },
    item,
  })
  resources.style = filtered
}

function withFirstFrameThemeStyles(config) {
  return withAndroidStyles(config, cfg => {
    const resources = cfg.modResults.resources

    ensureStyle(resources, 'BootThemeLight', 'BootTheme', [
      { $: { name: 'bootSplashBackground' }, _: '@color/bootsplash_background_light' },
    ])

    ensureStyle(resources, 'BootThemeDark', 'BootTheme', [
      { $: { name: 'bootSplashBackground' }, _: '@color/bootsplash_background_dark' },
    ])

    return cfg
  })
}

function withFirstFrameThemeColors(config) {
  return withAndroidColors(config, cfg => {
    const colors = cfg.modResults.resources.color ?? []
    const filtered = colors.filter(c => {
      const name = c?.$?.name
      return name !== 'bootsplash_background_light' && name !== 'bootsplash_background_dark'
    })

    filtered.push(
      { $: { name: 'bootsplash_background_light' }, _: '#FFF5EB' },
      { $: { name: 'bootsplash_background_dark' }, _: '#212124' }
    )

    cfg.modResults.resources.color = filtered
    return cfg
  })
}

function withFirstFrameThemeMainActivity(config) {
  return withMainActivity(config, cfg => {
    let src = cfg.modResults.contents

    if (!src.includes('org.json.JSONObject')) {
      src = src.replace(/(import\s+android\.os\.Bundle\s*)/, "$1\nimport org.json.JSONObject\n")
    }

    src = src.replace(/^\s*import\s+com\.tencent\.mmkv\.MMKV\s*\n?/m, '')

    const initBlock = [
      '    val storedThemeMode = try {',
      '      val mmkvClass = Class.forName("com.tencent.mmkv.MMKV")',
      '      val initialize = mmkvClass.getMethod("initialize", android.content.Context::class.java)',
      '      initialize.invoke(null, this)',
      '      val mmkvWithID = mmkvClass.getMethod("mmkvWithID", String::class.java)',
      '      val kv = mmkvWithID.invoke(null, "mosaic-storage")',
      '      val decodeString = mmkvClass.getMethod("decodeString", String::class.java)',
      '      val storedThemeRaw = decodeString.invoke(kv, "mosaic-theme-storage") as? String',
      '      JSONObject(storedThemeRaw ?: "{}").optJSONObject("state")?.optString("themeMode", null)',
      '    } catch (_: Exception) {',
      '      null',
      '    }',
      '    val splashTheme = if (storedThemeMode == "dark") R.style.BootThemeDark else R.style.BootThemeLight',
      '    setTheme(splashTheme)',
      '    RNBootSplash.init(this, splashTheme)',
    ].join('\n')

    if (src.includes('RNBootSplash.init(this, R.style.BootTheme)')) {
      src = src.replace('RNBootSplash.init(this, R.style.BootTheme)', initBlock)
    } else if (!src.includes('val splashTheme = if (storedThemeMode == "dark")')) {
      src = src.replace(/super\.onCreate\((null|savedInstanceState)\)/, `${initBlock}\n    super.onCreate($1)`)
    }

    cfg.modResults.contents = src
    return cfg
  })
}

function withFirstFrameThemeAppDelegate(config) {
  return withAppDelegate(config, cfg => {
    const { modResults } = cfg

    if (modResults.language !== 'swift') {
      return cfg
    }

    let src = modResults.contents

    if (!src.includes('import MMKV')) {
      src = src.replace(/import RNBootSplash/, 'import RNBootSplash\nimport MMKV')
    }

    const bootSplashCall = 'RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)'
    if (src.includes(bootSplashCall) && !src.includes('let storedThemeMode: String? = {')) {
      const injected = [
        'super.customize(rootView)',
        '    let storedThemeMode: String? = {',
        '      MMKV.initialize(rootDir: nil)',
        '      guard let kv = MMKV(mmapID: "mosaic-storage"),',
        '            let raw = kv.string(forKey: "mosaic-theme-storage"),',
        '            let data = raw.data(using: .utf8),',
        '            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],',
        '            let state = object["state"] as? [String: Any],',
        '            let mode = state["themeMode"] as? String',
        '      else {',
        '        return nil',
        '      }',
        '      return mode',
        '    }()',
        '',
        '    if storedThemeMode == "dark" {',
        '      rootView.overrideUserInterfaceStyle = .dark',
        '    } else if storedThemeMode == "light" {',
        '      rootView.overrideUserInterfaceStyle = .light',
        '    }',
        `    ${bootSplashCall}`,
      ].join('\n    ')

      src = src.replace(
        /super\.customize\(rootView\)\s*\n\s*RNBootSplash\.initWithStoryboard\("BootSplash", rootView: rootView\)/,
        injected
      )
    }

    cfg.modResults.contents = src
    return cfg
  })
}

module.exports = function withFirstFrameTheme(config) {
  config = withFirstFrameThemeColors(config)
  config = withFirstFrameThemeStyles(config)
  config = withFirstFrameThemeMainActivity(config)
  config = withFirstFrameThemeAppDelegate(config)
  return config
}
