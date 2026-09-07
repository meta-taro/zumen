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
use std::path::{Path, PathBuf};

/// 図を読む。**握り潰さない** — 読めなければ理由をそのまま返す。
#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|error| format!("{path}: {error}"))
}

/// 図を書く。**上書きする場所は、人がダイアログで選んだところだけ。**
///
/// ## 途中で落ちても正本を壊さない
///
/// 直に上書きすると、**書き込みの途中で落ちたとき正本が壊れる。**
/// この製品では正本が唯一の記録なので、壊れると図だけでなく
/// **手直しの履歴ごと失う。**
///
/// そこで隣に一時ファイルを書き、**書き終えてから置き換える**。
/// 置き換えは OS が不可分に行うので、途中の状態がディスクに残らない。
/// 自動保存を入れると書き込みの回数が増えるので、ここは先に固める。
#[tauri::command]
fn write_text(path: String, contents: String) -> Result<(), String> {
    let target = Path::new(&path);
    let temp = temp_beside(target);

    fs::write(&temp, contents).map_err(|error| format!("{}: {error}", temp.display()))?;

    // 置き換えに失敗したら、一時ファイルを残さない。
    if let Err(error) = fs::rename(&temp, target) {
        let _ = fs::remove_file(&temp);
        return Err(format!("{path}: {error}"));
    }
    Ok(())
}

/// 同じ場所に一時ファイルの道を作る。
///
/// **別の場所（/tmp 等）に書かない。** 別の装置だと置き換えが不可分にならない。
fn temp_beside(target: &Path) -> PathBuf {
    let name = target
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "zumen".to_string());
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    target.with_file_name(format!(".{name}.{stamp}.tmp"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_text, write_text])
        .run(tauri::generate_context!())
        .expect("zumen を起動できませんでした");
}
