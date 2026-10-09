/**
 * back-to-top.js
 * ヒーロー表示中は「scroll」表示と重なるため、ページ先頭に戻るボタンを隠す。
 * ヒーローをほぼ抜けたら表示する。
 */
(function () {
  var btn = document.querySelector('.back-to-top');
  var hero = document.getElementById('hero');
  if (!btn || !hero) return;
  function update() {
    btn.classList.toggle('is-visible', window.scrollY > hero.offsetHeight * 0.8);
  }
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
})();
