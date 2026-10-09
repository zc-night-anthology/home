/**
 * header-logo.js
 * スクロールし始めたらヘッダーのロゴを隠す（先頭に戻ると再び表示）。
 * メニューを開いている間は表示したままにする（CSS側で制御）。
 */
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;
  function update() {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
})();
