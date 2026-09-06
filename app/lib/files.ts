/**
 * ファイルの読み書き（D11 の操作 1）。
 *
 * **殻（Tauri）が無くても動く形にしておく。**
 * ベースルール §3 は「開発者の手元で完結して起動・テストできること」を求めている。
 * Tauri を立てないと何も見られない作りにすると、そこで止まる。
 *
 * 優先順は 2 段。
 *
 * 1. **File System Access API**（Chrome 系）— 開いた場所へそのまま上書きできる
 * 2. `<input type="file">` と、ダウンロードでの保存 — どこでも動くが、保存先は選び直しになる
 *
 * Tauri の口はここへ 3 段目として足す。**呼ぶ側は変えない。**
 */

export interface Opened {
  text: string;
  name: string;
  /** 上書き保存に使う手掛かり。無ければ保存はダウンロードになる。 */
  handle: unknown;
}

interface PickerWindow {
  showOpenFilePicker?: (options: unknown) => Promise<FileSystemHandleLike[]>;
  showSaveFilePicker?: (options: unknown) => Promise<FileSystemHandleLike>;
}

interface FileSystemHandleLike {
  name: string;
  getFile: () => Promise<{ text: () => Promise<string> }>;
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
}

const TYPES = [
  {
    description: 'zumen の図',
    accept: { 'application/yaml': ['.yaml', '.yml'], 'text/plain': ['.yaml', '.yml'] },
  },
];

function picker(): PickerWindow {
  return globalThis as unknown as PickerWindow;
}

export function canWriteInPlace(): boolean {
  return typeof picker().showOpenFilePicker === 'function';
}

export async function openDiagram(): Promise<Opened | null> {
  const show = picker().showOpenFilePicker;
  if (show !== undefined) {
    const [handle] = await show({ types: TYPES, multiple: false });
    if (handle === undefined) return null;
    const file = await handle.getFile();
    return { text: await file.text(), name: handle.name, handle };
  }
  return openWithInput();
}

/**
 * 保存する。
 *
 * **上書きできるならそのまま上書きする。** できない環境では
 * ダウンロードになり、保存先は人が選び直すことになる。
 */
export async function saveDiagram(
  text: string,
  name: string,
  handle: unknown,
): Promise<unknown> {
  const known = handle as FileSystemHandleLike | null;
  if (known !== null && typeof known?.createWritable === 'function') {
    const writable = await known.createWritable();
    await writable.write(text);
    await writable.close();
    return known;
  }

  const show = picker().showSaveFilePicker;
  if (show !== undefined) {
    const next = await show({ suggestedName: name, types: TYPES });
    const writable = await next.createWritable();
    await writable.write(text);
    await writable.close();
    return next;
  }

  download(text, name);
  return null;
}

/** 選ぶだけの口。返り値が無い（キャンセル）ことがある。 */
function openWithInput(): Promise<Opened | null> {
  return new Promise((done) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file === undefined) {
        done(null);
        return;
      }
      void file.text().then((text) => done({ text, name: file.name, handle: null }));
    });
    // 選ばずに閉じた場合、change は来ない。**待ち続けない**ため一度で捨てる。
    input.addEventListener('cancel', () => done(null));
    input.click();
  });
}

function download(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/yaml' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** 提案を読み込む。**正本ではないので、開き方を分けて取り違えを防ぐ。** */
export async function openProposal(): Promise<string | null> {
  const opened = await openDiagram();
  return opened?.text ?? null;
}
