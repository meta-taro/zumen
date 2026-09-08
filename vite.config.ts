/**
 * 画面の組み立て（D12。Tauri + Svelte）。
 *
 * **中核（`src/`）は画面を知らない。** ここから `src/` を呼ぶ向きだけにする。
 * 逆向きの import が生まれたら、GUI を捨てられなくなる（ベースルール §9）。
 */
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'app',
  plugins: [svelte()],
  build: { outDir: '../app-dist', emptyOutDir: true },
  /**
   * Tauri は固定の口を見に来る。開発中も同じにしておく。
   *
   * **わざと `strictPort` にしている。** 空きへ逃がすと `pnpm app` が
   * 別の口を見に行き、**黙って白い窓になる**（繋がらないことが画面に出ない）。
   *
   * 5173 が埋まっている機械では、画面だけなら別の口で立てられる（Issue #7）。
   *
   *     pnpm exec vite --port 5180
   *
   * **ただし、そのとき `pnpm app` は繋がらない。** 殻ごと動かすなら、
   * 5173 を使っているものを止めるほうが早い。
   */
  server: { port: 5173, strictPort: true },
});
