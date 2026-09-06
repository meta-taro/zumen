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
  // Tauri は固定の口を見に来る。開発中も同じにしておく。
  server: { port: 5173, strictPort: true },
});
