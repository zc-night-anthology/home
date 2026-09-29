/**
 * Hero Glass
 * ヒーロー写真の上に、格子に揃えた「大きさ違いの正方形」を敷き詰め、
 * その一部にだけすりガラス効果（.glass）を付ける。
 *
 * スクロールに応じて起きること：
 * - 写真（.hero__photo）：中心を軸にゆっくり拡大（ズーム）していく
 * - すりガラスの正方形（.hero__glass）と格子線（.hero__lines）：
 *   同じ量だけ上に動く（写真とは別レイヤーとして、少し速く動くことで奥行きを出す）
 * - どちらも、スクロール位置に直接ではなく、毎フレーム少しずつ近づける（lerp）
 *   ことで、慣性のかかった滑らかな動きにする
 *
 * 依存：warp-grid-background.js（CONFIG.spacing を読むため、先に読み込むこと）
 */
(function () {
  const hero  = document.getElementById('hero');
  const photo = document.getElementById('hero-photo');
  const layer = document.getElementById('hero-glass');
  const lines = document.getElementById('hero-lines');
  if (!hero || !photo || !layer || !lines) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- 調整用 ---
  const GLASS_RATIO_DESKTOP = 0.34;         // すりガラスになるマスの割合（0〜1）
  const GLASS_RATIO_MOBILE  = 0.25;         // スマホは描画負荷を下げるため少なめ
  const MAX_SIZE_DESKTOP = 4;               // 正方形の最大サイズ（マス数）
  const MAX_SIZE_MOBILE  = 3;
  const MOBILE_WIDTH     = 700;             // これ未満をモバイル扱い
  const PARALLAX_SPEED   = 0.9;             // グリッド＋すりガラス層の動く速さ
  const PARALLAX_RANGE   = 1.4;             // ヒーロー高さの何倍スクロールするまで効かせるか
  const PARALLAX_EASE    = 0.07;            // 目標値への近づき方（小さいほどゆっくり・滑らか）
  const PHOTO_ZOOM       = 0.8;             // 写真がヒーロー内で最大どれだけ拡大するか（0.8 = 80%）

  // 格子の間隔は歪みグリッドと必ず同じ値にする（画面幅に応じて CONFIG.spacing が変わる）
  function getU() {
    if (typeof applyWarpBreakpoint === 'function') applyWarpBreakpoint();
    return (typeof CONFIG !== 'undefined' && CONFIG.spacing) ? CONFIG.spacing : 96;
  }
  let U = getU();
  let bufferRows = 0; // すりガラス層の上に足しておく「見えない予備の行」の数

  let targetY = 0;   // スクロール位置から求めた「目標」の進み具合
  let currentY = 0;  // 実際に描画に使う、少し遅れて追いつく値
  let rafId = null;

  function render(y) {
    const maxY = hero.offsetHeight * PARALLAX_RANGE;
    const t = maxY > 0 ? Math.min(y / maxY, 1) : 0; // 0〜1の進み具合

    // 写真：中心を軸にゆっくり拡大
    photo.style.transform = `scale(${(1 + t * PHOTO_ZOOM).toFixed(4)})`;

    // すりガラスの正方形：transformで層ごと動かす（あらかじめ足した予備の行で隙間を防ぐ）
    const glassOffset = bufferRows * U - y * PARALLAX_SPEED;
    layer.style.transform = `translate3d(0, ${glassOffset.toFixed(1)}px, 0)`;

    // 格子線：繰り返し背景なので、位置をずらすだけで隙間なく同じ量だけ動かせる
    lines.style.backgroundPosition = `0 ${(-y * PARALLAX_SPEED).toFixed(1)}px`;
  }

  function tick() {
    currentY += (targetY - currentY) * PARALLAX_EASE;
    render(currentY);
    if (Math.abs(targetY - currentY) > 0.05) {
      rafId = requestAnimationFrame(tick);
    } else {
      currentY = targetY;
      render(currentY);
      rafId = null;
    }
  }

  function requestTick() {
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  function setTarget() {
    const maxY = hero.offsetHeight * PARALLAX_RANGE;
    targetY = Math.min(window.scrollY, maxY);
    if (reduceMotion) {
      currentY = targetY;
      render(currentY);
    } else {
      requestTick();
    }
  }

  function build() {
    U = getU();
    hero.style.setProperty('--u', U + 'px');
    const W = hero.clientWidth;
    const vw = window.innerWidth;
    const cols = Math.ceil(W / U);
    const visibleRows = Math.ceil(window.innerHeight / U);
    const isMobile = vw < MOBILE_WIDTH;
    const maxS = isMobile ? MAX_SIZE_MOBILE : MAX_SIZE_DESKTOP;
    const ratio = isMobile ? GLASS_RATIO_MOBILE : GLASS_RATIO_DESKTOP;

    hero.style.height = visibleRows * U + 'px'; // 格子線とぴったり揃える

    // すりガラス層は、動かしても上端・下端に隙間が出ないよう、
    // 見える範囲より上に予備の行を足しておく
    const maxShift = hero.offsetHeight * PARALLAX_RANGE * PARALLAX_SPEED;
    bufferRows = Math.ceil(maxShift / U) + 1;
    const rows = visibleRows + bufferRows;

    layer.style.top = -(bufferRows * U) + 'px';
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

    setTarget(); // 高さが変わった直後も、今のスクロール位置に合わせておく
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

  window.addEventListener('scroll', setTarget, { passive: true });
})();
