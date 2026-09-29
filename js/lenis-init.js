/**
 * Lenis Smooth Scroll
 * ページ全体のスクロールに慣性をつけ、なめらかに減速しながら止まる動きにする。
 * （参考: https://www.takeshita-sekkei.co.jp/ のスクロール感）
 * 依存：lenis.min.js（このスクリプトより先に読み込むこと）
 * 動きを減らす設定の人には適用せず、ブラウザ標準のスクロールのままにする。
 */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof Lenis === 'undefined') return;

  const lenis = new Lenis({
    duration: 1.2,               // 慣性の効く長さ（秒）。参考サイトの2秒より少し軽快に
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // 参考サイトと同じ減速カーブ
    smoothWheel: true,
    touchMultiplier: 1.4,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // 他のスクリプト（メニューのアンカー移動など）から使えるように公開しておく
  window.lenis = lenis;
})();
