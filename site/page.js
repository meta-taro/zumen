/**
 * DL ページの動き（拡大と絞り込み）。**日本語と英語のページで同じものを使う。**
 */
  // **押すと全体に出す。** 縦長の図は並べると読めないので、拡大の口を用意する。
  // `<dialog>` の既定の挙動（Esc で閉じる・背後を覆う）をそのまま使う。
  const zoom = document.getElementById('zoom');
  const big = zoom.querySelector('img');
  for (const img of document.querySelectorAll('.gallery img, .hero img')) {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      // **いま出ている方**を拡大する（<picture> でテーマごとに差し替わるため、
      // `src` 属性ではなく `currentSrc` を見る）。
      big.src = img.currentSrc || img.src;
      big.alt = img.alt;
      zoom.showModal();
    });
  }

  // **種類で絞り込む。** 見本が 93 件になり、全部並べると
  // 自分に関係する 1 枚が沈む。**数を減らすのではなく、選べるようにする。**
  //
  // 2026-09-14 に分類と並びを直した。それまでは**足した順**に近く、
  // 路線図が 3 か所に散っていた（25 / 45 / 52〜54 / 71 / 78〜83）。
  // **同じものは同じ所に置く** —— 探すときは「鉄道の図」を探すのであって、
  // 「78 番」を探すのではない。
  const filters = document.querySelector('.filters');
  if (filters) {
    filters.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-pick]');
      if (button === null) return;
      const pick = button.dataset.pick;
      for (const other of filters.querySelectorAll('button')) {
        other.setAttribute('aria-pressed', String(other === button));
      }
      for (const figure of document.querySelectorAll('.gallery figure')) {
        figure.hidden = pick !== 'all' && figure.dataset.cat !== pick;
      }
      // **見出しも一緒に隠す。** 残さないと、1 枚も無い区切りが並ぶ。
      for (const heading of document.querySelectorAll('.gallery h3.cat')) {
        heading.hidden = pick !== 'all' && heading.dataset.cat !== pick;
      }
    });
  }

  zoom.addEventListener('click', () => zoom.close());
