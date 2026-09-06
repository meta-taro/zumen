//! zumen の殻（D12）。
//!
//! **ここに判断を置かない。** 図の読み書き・レイアウト・マージ・検証は
//! すべて TypeScript 側（`src/`）にあり、この殻がやるのは
//! **ファイルを読む・書く**ことと、窓を出すことだけ。
//!
//! ## fs プラグインを「使わない」
//!
//! `tauri-plugin-fs` は `tauri-plugin-dialog` の依存として**ビルドには入る**が、
//! **登録しないし、権限も与えていない**（`capabilities/default.json` は
//! `dialog:allow-open` と `dialog:allow-save` だけ）。
//!
//! 図を 1 つ読んで書き戻すだけなので、汎用のファイル操作を丸ごと開ける必要が無い。
//! **開ける口は狭いほうがよい**（ベースルール §21）。
//! 通るのは、ダイアログで人が選んだ道だけ。

use std::fs;

/// 図を読む。**握り潰さない** — 読めなければ理由をそのまま返す。
#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|error| format!("{path}: {error}"))
}

/// 図を書く。**上書きする場所は、人がダイアログで選んだところだけ。**
#[tauri::command]
fn write_text(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|error| format!("{path}: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_text, write_text])
        .run(tauri::generate_context!())
        .expect("zumen を起動できませんでした");
}
