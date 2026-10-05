/**
 * footer-offset.js
 * .site-footer は position:absolute; bottom:0 で常にページの一番下に固定している。
 * そのままだと本文（.content）と重なってしまうため、フッターの実際の高さを
 * 測って --footer-h に反映し、.content の padding-bottom でその分の余白を確保する。
 * （フォントの読み込みや画面幅の変化で高さが変わっても、その都度measureし直す）
 */
(function () {
  const footer = document.querySelector('.site-footer');
  if (!footer) return;

  function setFooterHeightVar() {
    const h = footer.offsetHeight;
    document.documentElement.style.setProperty('--footer-h', h + 'px');
  }

  setFooterHeightVar();

  if ('ResizeObserver' in window) {
    new ResizeObserver(setFooterHeightVar).observe(footer);
  } else {
    window.addEventListener('resize', setFooterHeightVar);
  }

  // Webフォントの読み込みが後から完了して高さが変わるケースに備える
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(setFooterHeightVar);
  }
})();
