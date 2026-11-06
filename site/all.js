/**
 * **一覧の絞り込み**（`/all/`。2026-09-24）。
 *
 * 個別ページから次の見本へ渡り歩く道が無い、という指摘から。
 *
 * **JS が無くても一覧は読める。** ここが足すのは絞り込みだけで、
 * 344 枚は最初から HTML に並んでいる（検索エンジンも、JS を切った人も、全部読める）。
 *
 * 照合するのは `data-name`（番号・題・英題・分野）。**空白で区切ると AND**。
 *
 * **図の中の字でも当たる**（2026-11-06）。正本がテキストなので、ラベル・注記・出典の字を
 * `search.json` に索引として書き出してある。重いので**打ち始めたときに 1 回だけ読む**。
 * 読めなければ、題と分野だけで絞る（壊れずに、狭くなるだけ）。
 */
(() => {
  const box = document.getElementById('q');
  const hit = document.getElementById('hit');
  if (box === null || hit === null) return;

  const cards = [...document.querySelectorAll('.cards > li[data-name]')];
  const fields = [...document.querySelectorAll('.field')];
  const total = cards.length;
  const unit = hit.textContent.replace(/^\d+\s*/, '');
  let inside = {};
  let asked = false;
  const load = () => {
    if (asked || !box.dataset.index) return;
    asked = true;
    fetch(box.dataset.index)
      .then((res) => (res.ok ? res.json() : {}))
      .then((index) => {
        inside = index;
        if (box.value !== '') sift();
      })
      .catch(() => {
        // 索引が無くても一覧は使える。題と分野だけで絞り続ける。
      });
  };

  const sift = () => {
    const words = box.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const card of cards) {
      const hay = `${card.dataset.name.toLowerCase()}\n${inside[card.dataset.no] ?? ''}`;
      const ok = words.every((w) => hay.includes(w));
      card.hidden = !ok;
      if (ok) shown += 1;
    }
    for (const field of fields) {
      const live = [...field.querySelectorAll('li[data-name]')].filter((one) => !one.hidden);
      // **空になった分野は、見出しごと隠す。** 見出しだけ残ると、数と合わなくて読めない。
      field.hidden = live.length === 0;
      // **見出しの数も絞った数にする。** 6 枚しか出ていないのに「23」と出ていた。
      const count = field.querySelector('h2 small');
      if (count !== null) count.textContent = String(live.length);
    }
    hit.textContent = `${shown}${unit}`;
  };

  box.addEventListener('focus', load);
  box.addEventListener('input', () => {
    load();
    sift();
  });
  // 戻ってきたときに、入っていた字で絞り直す（ブラウザが値を戻すため）。
  if (box.value !== '') {
    load();
    sift();
  }
})();
