/**
 * head-width.js
 * 各セクションの見出し列の幅を、いちばん長い見出し（MEMBER）の幅に揃える。
 * 見出しの文字幅を測って --head-w に反映し、本文の開始位置をセクション間で揃える。
 */
(function () {
  function measure() {
    var max = 0;
    document.querySelectorAll('.section-grid__head').forEach(function (head) {
      var w = 0;
      head.querySelectorAll('h2, .section-sub, .section-label').forEach(function (el) {
        var r = document.createRange();
        r.selectNodeContents(el);
        w = Math.max(w, r.getBoundingClientRect().width);
      });
      max = Math.max(max, w);
    });
    if (max > 0) document.documentElement.style.setProperty('--head-w', Math.ceil(max) + 'px');
  }
  measure();
  window.addEventListener('resize', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  window.addEventListener('load', measure);
})();
