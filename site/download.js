/**
 * **ダウンロードと過去の版**（2026-11-09。姉妹の tadori の作りに揃えた）。
 *
 * - 見ている PC の OS と CPU を読んで「この PC」の印を付ける
 * - ボタンと過去の版の一覧は、**ブラウザが GitHub のリリースから読んで作る**
 *   （版を出すたびにサイトを直さない。版数をページに書かない）
 * - GitHub から読んだ字は HTML に入れない（textContent で入れる）
 * - 読めなければ、GitHub のリリースのページへの道だけ残す（壊れずに、狭くなるだけ）
 */
(() => {
  const REPO = 'meta-taro/zumen';
  const API = `https://api.github.com/repos/${REPO}/releases?per_page=50`;
  const ja = document.documentElement.lang === 'ja';
  const T = ja
    ? {
        mine: 'この PC', loading: '最新の版を GitHub から読んでいます…', latest: '最新の版',
        none: 'この版には入っていません', fail: 'GitHub から読めませんでした', go: 'GitHub のリリースのページから選んでください',
        empty: 'まだ公開した版はありません。', notes: 'この版の説明（GitHub）', pre: '試し版',
        portable: '置いてそのまま起動（おすすめ）', dmg: 'ディスクイメージ（.dmg）', msi: 'インストーラー（.msi）', setup: 'セットアップ（.exe）',
        date: 'ja-JP',
      }
    : {
        mine: 'This PC', loading: 'Reading the latest release from GitHub…', latest: 'Latest release',
        none: 'Not in this release', fail: 'Could not read from GitHub', go: 'Please pick from the releases page on GitHub',
        empty: 'Nothing has been released yet.', notes: 'Release notes (GitHub)', pre: 'Pre-release',
        portable: 'Run without installing (recommended)', dmg: 'Disk image (.dmg)', msi: 'Installer (.msi)', setup: 'Setup (.exe)',
        date: 'en-GB',
      };

  /**
   * **配布物の名前は Tauri と release.yml が付ける形。**
   * mac は v0.7.0 まで Apple シリコン用（aarch64）だけで、次の版から 1 本で両方に入る（universal）。
   * universal の版では、Intel の欄にも同じ物を出す。
   */
  const KINDS = [
    { id: 'mac-arm', label: ja ? 'macOS（Apple シリコン）' : 'macOS (Apple silicon)', test: (n, uni) => (uni ? /universal\.dmg$/i : /aarch64\.dmg$/i).test(n) || /^zumen-macos-app\.tar\.gz$/i.test(n) },
    { id: 'mac-intel', label: ja ? 'macOS（Intel）' : 'macOS (Intel)', test: (n, uni) => uni && (/universal\.dmg$/i.test(n) || /^zumen-macos-app\.tar\.gz$/i.test(n)) },
    { id: 'win-x64', label: ja ? 'Windows（x64・Intel / AMD）' : 'Windows (x64, Intel / AMD)', test: (n) => /^zumen-windows-x64\.exe$/i.test(n) || /_x64(-setup\.exe|_[a-z-]+\.msi)$/i.test(n) },
    { id: 'win-arm', label: ja ? 'Windows（ARM）' : 'Windows (ARM)', test: (n) => /^zumen-windows-arm64\.exe$/i.test(n) || /_arm64(-setup\.exe|_[a-z-]+\.msi)$/i.test(n) },
  ];
  const universal = (release) => release.assets.some((a) => /universal\.dmg$/i.test(a.name));
  const assetsOf = (release, kind) => {
    const uni = universal(release);
    // **置いてそのまま起動できる物を先に。** 署名していないので、インストーラより確実。
    const rank = (n) => (/^zumen-/.test(n) ? 0 : /\.dmg$/.test(n) ? 1 : /setup\.exe$/.test(n) ? 2 : 3);
    return release.assets.filter((a) => kind.test(a.name, uni)).sort((a, b) => rank(a.name) - rank(b.name));
  };
  const formatOf = (n) => (/^zumen-/.test(n) ? T.portable : /\.dmg$/i.test(n) ? T.dmg : /\.msi$/i.test(n) ? T.msi : T.setup);
  const sizeOf = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  const dateOf = (iso) => new Date(iso).toLocaleDateString(T.date, { year: 'numeric', month: 'long', day: 'numeric' });
  const el = (tag, props = {}, kids = []) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
  };

  /** 見ている PC。CPU は Chromium 系だけが教えてくれる。分からない Mac は、いま売られている Apple シリコンを先に示す。 */
  async function detect() {
    const ua = navigator.userAgent;
    const os = /Mac/i.test(ua) && !/iPhone|iPad/i.test(ua) ? 'mac' : /Windows/i.test(ua) ? 'win' : null;
    let arch = null;
    try {
      const data = await navigator.userAgentData?.getHighEntropyValues(['architecture']);
      if (data?.architecture) arch = data.architecture === 'arm' ? 'arm' : 'x86';
    } catch {
      // 教えてもらえなければ、OS だけで決める。
    }
    if (os === 'win') return arch === 'arm' ? 'win-arm' : 'win-x64';
    if (os === 'mac') return arch === 'x86' ? 'mac-intel' : 'mac-arm';
    return null;
  }

  /** 読めなかったら null。**ブラウザの言い分（Failed to fetch）はそのまま出さない。** */
  async function releases() {
    try {
      const res = await fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) return null;
      return (await res.json()).filter((r) => !r.draft);
    } catch {
      // 網が切れている・GitHub の回数制限。リリースのページへの道を残して終える。
      return null;
    }
  }
  /** 読めなかったときの文。GitHub のリリースのページへの道を必ず付ける。 */
  const failed = () => el('span', {}, [`${T.fail}${ja ? '。' : '. '}`, el('a', { href: `https://github.com/${REPO}/releases`, textContent: T.go })]);

  const button = (asset, primary) =>
    el('a', { className: `btn${primary ? ' primary' : ''}`, href: asset.browser_download_url }, [
      el('span', { textContent: formatOf(asset.name) }),
      el('small', { textContent: ` ${sizeOf(asset.size)}` }),
    ]);

  async function downloads(root) {
    const mine = await detect();
    const card = mine ? root.querySelector(`[data-kind="${mine}"]`) : null;
    if (card) {
      card.classList.add('mine');
      card.querySelector('h3')?.append(el('span', { className: 'badge', textContent: T.mine }));
    }
    const status = root.querySelector('[data-release-status]');
    const list = await releases();
    if (list === null) {
      status.replaceChildren(failed());
      return;
    }
    const latest = list.find((r) => !r.prerelease);
    if (!latest) {
      status.textContent = T.empty;
      return;
    }
    const name = latest.name || latest.tag_name;
    status.textContent = ja ? `${T.latest}：${name}（${dateOf(latest.published_at)}）` : `${T.latest}: ${name} (${dateOf(latest.published_at)})`;
    for (const kind of KINDS) {
      const box = root.querySelector(`[data-kind="${kind.id}"] .files`);
      if (!box) continue;
      const found = assetsOf(latest, kind);
      box.replaceChildren(...(found.length ? found.map((a, i) => button(a, i === 0)) : [el('p', { className: 'muted', textContent: T.none })]));
    }
  }

  async function archive(root) {
    const list = await releases();
    if (list === null) {
      root.replaceChildren(el('p', { className: 'note' }, [failed()]));
      return;
    }
    if (!list.length) {
      root.replaceChildren(el('p', { className: 'note', textContent: T.empty }));
      return;
    }
    root.replaceChildren(...list.map((release) => {
      const head = el('header', {}, [
        el('h3', { textContent: release.name || release.tag_name }),
        el('time', { textContent: dateOf(release.published_at), dateTime: release.published_at }),
      ]);
      if (release.prerelease) head.append(el('span', { className: 'badge', textContent: T.pre }));
      const files = el('div', { className: 'files' });
      for (const kind of KINDS) {
        for (const asset of assetsOf(release, kind)) {
          const link = button(asset, false);
          link.prepend(el('b', { textContent: `${kind.label} ` }));
          files.append(link);
        }
      }
      return el('article', { className: 'release' }, [head, files, el('a', { href: release.html_url, textContent: T.notes })]);
    }));
  }

  /** 入口の「ダウンロード」に、見ている PC の名前を添える。 */
  async function label(link) {
    const id = await detect();
    const mine = KINDS.find((k) => k.id === id);
    const small = link.querySelector('small');
    if (mine && small) small.textContent = mine.label;
  }

  const dl = document.querySelector('[data-downloads]');
  if (dl) downloads(dl);
  const ar = document.querySelector('[data-archive]');
  if (ar) archive(ar);
  document.querySelectorAll('[data-hero-download]').forEach(label);
})();
