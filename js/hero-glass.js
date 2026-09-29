/**
 * Hero Glass
 * ヒーロー写真の上に、80px格子に揃えた「大きさ違いの正方形」を敷き詰め、
 * その一部にだけすりガラス効果（.glass）を付ける。写真だけ緩くパララックス。
 *
 * 依存：warp-grid-background.js（CONFIG.spacing を読むため、先に読み込むこと）
 */
(function () {
  const hero  = document.getElementById('hero');
  const photo = document.getElementById('hero-photo');
  const layer = document.getElementById('hero-glass');
  if (!hero || !photo || !layer) return;

  // --- 調整用 ---
  const GLASS_RATIO_DESKTOP = 0.34;         // すりガラスになるマスの割合（0〜1）
  const GLASS_RATIO_MOBILE  = 0.25;         // スマホは描画負荷を下げるため少なめ
  const MAX_SIZE_DESKTOP = 4;               // 正方形の最大サイズ（マス数）
  const MAX_SIZE_MOBILE  = 3;
  const MOBILE_WIDTH     = 700;             // これ未満をモバイル扱い
  const PARALLAX_SPEED   = 0.35;            // 写真の動き（0で固定、1でページと同じ）

  // 格子の間隔は歪みグリッドと必ず同じ値にする（画面幅に応じて CONFIG.spacing が変わる）
  function getU() {
    if (typeof applyWarpBreakpoint === 'function') applyWarpBreakpoint();
    return (typeof CONFIG !== 'undefined' && CONFIG.spacing) ? CONFIG.spacing : 80;
  }
  let U = getU();

  function build() {
    U = getU();
    hero.style.setProperty('--u', U + 'px');
    const W = hero.clientWidth;
    const vw = window.innerWidth;
    const cols = Math.ceil(W / U);
    const rows = Math.ceil(window.innerHeight / U);
    const isMobile = vw < MOBILE_WIDTH;
    const maxS = isMobile ? MAX_SIZE_MOBILE : MAX_SIZE_DESKTOP;
    const ratio = isMobile ? GLASS_RATIO_MOBILE : GLASS_RATIO_DESKTOP;

    hero.style.height = rows * U + 'px'; // 格子線とぴったり揃える
    layer.style.gridTemplateColumns = `repeat(${cols}, ${U}px)`;
    layer.style.gridTemplateRows = `repeat(${rows}, ${U}px)`;
    layer.textContent = '';

    const occ = Array.from({ length: rows }, () => Array(cols).fill(false));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (occ[r][c]) continue;

        // ここに置ける最大の正方形サイズ
        let m = 1;
        while (m < maxS && c + m < cols && r + m < rows) {
          let ok = true;
          for (let i = 0; i <= m; i++) {
            if (occ[r + m][c + i] || occ[r + i][c + m]) { ok = false; break; }
          }
          if (!ok) break;
          m++;
        }

        // 小さいサイズほど出やすい抽選
        const pool = [];
        for (let s = 1; s <= m; s++) for (let k = 0; k <= maxS - s; k++) pool.push(s);
        const size = pool[Math.floor(Math.random() * pool.length)];

        for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) occ[r + i][c + j] = true;

        if (Math.random() < ratio) {
          const el = document.createElement('div');
          el.className = 'glass';
          el.style.gridArea = `${r + 1} / ${c + 1} / span ${size} / span ${size}`;
          layer.appendChild(el);
        }
      }
    }
  }

  build();

  // 幅が変わったときだけ作り直す（モバイルのアドレスバー伸縮では作り直さない）
  let lastW = hero.clientWidth, timer;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (hero.clientWidth !== lastW) { lastW = hero.clientWidth; build(); }
    }, 200);
  });

  // 写真のパララックス
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < hero.offsetHeight * 1.2) {
          photo.style.transform = `translate3d(0, ${(y * PARALLAX_SPEED).toFixed(1)}px, 0)`;
        }
        ticking = false;
      });
    }, { passive: true });
  }
})();
