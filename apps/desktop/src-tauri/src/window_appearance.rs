use crate::{protocol::{allowed, string}, HostError};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, Theme};
use windows_sys::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_CAPTION_COLOR, DWMWA_TEXT_COLOR};

fn colorref(value: &str) -> Result<u32, HostError> {
    let hex = value.strip_prefix('#').filter(|value| value.len() == 6 && value.bytes().all(|byte| byte.is_ascii_hexdigit()))
        .ok_or_else(|| HostError::new("INVALID_ARGUMENT", "窗口颜色需为六位 HEX 色值"))?;
    let rgb = u32::from_str_radix(hex, 16).map_err(|_| HostError::new("INVALID_ARGUMENT", "窗口颜色无效"))?;
    Ok((rgb & 0xff) << 16 | rgb & 0xff00 | rgb >> 16)
}

pub async fn sync(app: &AppHandle, params: &Value) -> Result<Value, HostError> {
    allowed(params, &["background", "text"])?;
    let background = colorref(string(params, "background")?)?;
    let text = colorref(string(params, "text")?)?;
    let window = app.get_webview_window("main").ok_or_else(|| HostError::new("NOT_FOUND", "主窗口已关闭"))?;
    let target = window.clone();
    let (send, receive) = tokio::sync::oneshot::channel();
    window.run_on_main_thread(move || {
        let result = (|| {
            // Some palettes have a dark base even in their nominal light variant.
            let brightness = (background & 0xff) * 299 + ((background >> 8) & 0xff) * 587 + ((background >> 16) & 0xff) * 114;
            target.set_theme(Some(if brightness < 128_000 { Theme::Dark } else { Theme::Light }))
                .map_err(|error| HostError::new("IO_ERROR", error.to_string()))?;
            let hwnd = target.hwnd().map_err(|error| HostError::new("IO_ERROR", error.to_string()))?;
            let mut custom_colors = true;
            for (attribute, color) in [(DWMWA_CAPTION_COLOR, background), (DWMWA_TEXT_COLOR, text)] {
                let result = unsafe {
                    DwmSetWindowAttribute(hwnd.0 as _, attribute as u32, (&color as *const u32).cast(), std::mem::size_of::<u32>() as u32)
                };
                // Windows 10 retains the matching native light/dark caption.
                if result == 0x80070057u32 as i32 { custom_colors = false; }
                else if result < 0 { return Err(HostError::new("IO_ERROR", format!("同步窗口标题栏颜色失败：{result:#x}"))); }
            }
            Ok(json!({"updated":true,"customColors":custom_colors}))
        })();
        let _ = send.send(result);
    }).map_err(|error| HostError::new("IO_ERROR", error.to_string()))?;
    receive.await.map_err(|_| HostError::new("IO_ERROR", "窗口外观同步未完成"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn caption_colors_use_windows_bgr_order() {
        assert_eq!(colorref("#123456").unwrap(), 0x563412);
        assert_eq!(colorref("#AABBCC").unwrap(), 0xccbbaa);
        for value in ["#123", "#GG0000", "123456", "#12345678", "#é1234"] {
            assert!(colorref(value).is_err(), "{value}");
        }
    }
}
