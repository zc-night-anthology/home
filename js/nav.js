/**
 * Site Menu
 * MENUボタンで全画面メニューを開閉する。
 * - 開くとき：中央のスライスが右→左に走る → 上下のシャッターが開く → 項目が立ち上がる
 * - 閉じるとき：その逆再生（項目が沈む → シャッターが閉じる → スライスが左→右に走る）
 *   ※ 開閉の向き・タイミングは css/nav.css 側の transition（delay込み）だけで
 *     成立しているので、JS側にタイマーは不要（class の付け外しのみ）。
 * - Escキー／メニュー内のリンクをクリックで閉じる
 * - 開いている間は背面（.hero / .content）を操作不可にし、スクロールも止める
 * - 開くとき最初のリンクへ、閉じるときボタンへフォーカスを戻す
 */
(function () {
  const root = document.documentElement;
  const btn  = document.getElementById('menu-toggle');
  const menu = document.getElementById('site-menu');
  if (!btn || !menu) return;

  const background = document.querySelectorAll('.hero, .content');
  const OPEN_LABEL = 'メニューを開く';
  const CLOSE_LABEL = 'メニューを閉じる';
  let isOpen = false;

  function setOpen(next, returnFocus) {
    if (next === isOpen) return;
    isOpen = next;
    root.classList.toggle('is-menu-open', next);
    btn.setAttribute('aria-expanded', String(next));
    btn.setAttribute('aria-label', next ? CLOSE_LABEL : OPEN_LABEL);
    menu.inert = !next;
    background.forEach((el) => { el.inert = next; });

    if (next) {
      requestAnimationFrame(() => {
        const first = menu.querySelector('a');
        if (first) first.focus({ preventScroll: true });
      });
    } else if (returnFocus) {
      btn.focus({ preventScroll: true });
    }
  }

  menu.inert = true;
  btn.addEventListener('click', () => setOpen(!isOpen, true));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) setOpen(false, true);
  });

  // メニュー内のリンク：ページ内リンクなら閉じてからスクロール
  menu.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.charAt(0) === '#') {
      setOpen(false, false);
    }
  });

  // ブラウザの「戻る」で復元されたときは閉じた状態にする
  window.addEventListener('pageshow', (e) => { if (e.persisted) setOpen(false, false); });
})();
