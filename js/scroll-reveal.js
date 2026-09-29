/**
 * Scroll Reveal
 * class="reveal" を付けた要素が画面に入ってきたら、下から滑らかに
 * 立ち上がってくる（フェード＋わずかに上へ移動）。
 * 動きの中身（速さ・イージング）はすべて CSS の .reveal / .is-visible 側で決める。
 * 一度立ち上がった要素は、そのまま表示され続ける（スクロールで戻しても消えない）。
 */
(function () {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  // 動きを減らす設定の人には、アニメーションさせず最初から表示する
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  // IntersectionObserver が使えない古い環境向けのフォールバック
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target); // 一度出たら監視をやめる（何度も動かさない）
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -10% 0px', // 画面の少し手前で早めに反応させる
    }
  );

  items.forEach((el) => io.observe(el));
})();
