use tauri_plugin_global_shortcut::{Code, Modifiers};

pub(crate) struct ParsedShortcut {
    pub modifiers: Modifiers,
    pub code: Code,
}

pub(crate) fn parse_shortcut(shortcut: &str) -> Result<ParsedShortcut, String> {
    let parts: Vec<&str> = shortcut.split('+').map(|s| s.trim()).collect();
    let mut modifiers = Modifiers::empty();
    let mut code = None;

    for part in parts {
        match part.to_lowercase().as_str() {
            "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
            "alt" => modifiers |= Modifiers::ALT,
            "shift" => modifiers |= Modifiers::SHIFT,
            "meta" | "cmd" | "command" => modifiers |= Modifiers::META,
            key => {
                code = Some(match key.to_uppercase().as_str() {
                    "A" => Code::KeyA,
                    "B" => Code::KeyB,
                    "C" => Code::KeyC,
                    "D" => Code::KeyD,
                    "E" => Code::KeyE,
                    "F" => Code::KeyF,
                    "G" => Code::KeyG,
                    "H" => Code::KeyH,
                    "I" => Code::KeyI,
                    "J" => Code::KeyJ,
                    "K" => Code::KeyK,
                    "L" => Code::KeyL,
                    "M" => Code::KeyM,
                    "N" => Code::KeyN,
                    "O" => Code::KeyO,
                    "P" => Code::KeyP,
                    "Q" => Code::KeyQ,
                    "R" => Code::KeyR,
                    "S" => Code::KeyS,
                    "T" => Code::KeyT,
                    "U" => Code::KeyU,
                    "V" => Code::KeyV,
                    "W" => Code::KeyW,
                    "X" => Code::KeyX,
                    "Y" => Code::KeyY,
                    "Z" => Code::KeyZ,
                    "SPACE" => Code::Space,
                    "ENTER" => Code::Enter,
                    "ESCAPE" | "ESC" => Code::Escape,
                    "F1" => Code::F1,
                    "F2" => Code::F2,
                    "F3" => Code::F3,
                    "F4" => Code::F4,
                    "F5" => Code::F5,
                    "F6" => Code::F6,
                    "F7" => Code::F7,
                    "F8" => Code::F8,
                    "F9" => Code::F9,
                    "F10" => Code::F10,
                    "F11" => Code::F11,
                    "F12" => Code::F12,
                    _ => return Err(format!("Unsupported key: {}", key)),
                });
            }
        }
    }

    let code = code.ok_or_else(|| "No key code found in shortcut".to_string())?;

    Ok(ParsedShortcut { modifiers, code })
}
