/** `?raw` で読む同梱ファイル（vite の作法）。 */
declare module '*?raw' {
  const content: string;
  export default content;
}

/** vite が入れる印。開発中だけの取っ手に使う。 */
interface ImportMetaEnv {
  readonly DEV: boolean;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
