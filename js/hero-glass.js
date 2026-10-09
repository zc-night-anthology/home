/**
 * Hero Glass
 * ヒーロー写真の上に、格子に揃えた「大きさ違いの正方形」を敷き詰め、
 * その一部にだけすりガラス効果（.glass）を付ける。
 *
 * スクロールに応じて起きること：
 * - 写真（.hero__photo）：中心を軸に大きくズームしていく
 * - すりガラスの正方形（.hero__glass）と格子線（.hero__lines）：
 *   位置は固定のまま、動かさない（視差効果なし）
 * - 写真のズームは、スクロール位置に直接ではなく、毎フレーム少しずつ近づける（lerp）
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
  const PARALLAX_RANGE   = 1.0;             // ヒーロー高さの何倍スクロールするまでズームさせるか
  const PARALLAX_EASE    = 0.07;            // 目標値への近づき方（小さいほどゆっくり・滑らか）
  const LIGHT = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const PHOTO_ZOOM       = 0.2;             // 写真がヒーロー内で最大どれだけ拡大するか（0.2 = 120%。視差効果程度のわずかな動き）

  // くっきり見せる「窓」を、読み込みごとにランダムに決める。
  // ここでは 0〜1 の乱数だけを持ち、実際のマス数への変換は build() で行う（マスの間隔 U は画面幅で変わるため）
  // 窓は大・中・小の3つ。
  //  ・大：細い側の長さが画面の約4分の1。画面の中心付近を必ず含み、端に接して伸びる（縦長か横長かはランダム）
  //  ・中・小：大の左右どちらか（縦割り＝同じ側に上下に並ぶ）か、大の両側に1つずつ（横割り）に置く。
  // 大は中の約2.5倍の面積になるようにする
  const HORIZONTAL = Math.random() < 0.5;         // true: 大を横長（高さが画面の約1/4、左右の端に接する）にする／false: 縦長
  const SAME_SIDE = Math.random() < 0.5;          // true: 中と小が大の同じ側に上下に並ぶ／false: 大の両側に1つずつ
  const BIG_FIRST = Math.random() < 0.5;          // 中（と小）が大の左側か右側か（SAME_SIDE のとき）／中が左か右か
  const BIG_TOP = Math.random() < 0.5;            // 大が上端に接するか、下端に接するか
  const MED_FIRST = Math.random() < 0.5;          // 中が上か下か（SAME_SIDE のとき）
  const R = () => Math.random();
  const BIG_H = 0.72 + R() * 0.28;                // 大の高さ（画面の高さに対する割合）
  const BIG_SHIFT = R();                          // 大を中心に対して左右どちらへずらすか
  const MED_W = 0.5 + R() * 0.1, MED_H = 0.78 + R() * 0.12;
  const SML_W = 0.4 + R() * 0.1, SML_H = 0.65 + R() * 0.1;
  const SEEDS = Array.from({ length: 4 }, () => ({ rx: R(), ry: R() }));

  // 窓の位置・大きさを、背景グリッド（間隔 U、原点 0,0）の交点に吸着させて返す
  // 縦長の配置を cols×rows で作る（横長のときは縦横を入れ替えて呼び、結果を転置する）
  function layoutBase(cols, rows, fxr, fyr, extra) {
    const mc = Math.floor(cols / 2), mr = Math.floor(rows / 2);
    // 顔の位置（hero.png の目のあたり。横 約55%・縦 約33%）。中心と顔の両方を大の中に入れる
    const fc = Math.round(cols * fxr), fr = Math.round(rows * fyr);
    const cLo = Math.min(mc, fc), cHi = Math.max(mc, fc), rLo = Math.min(mr, fr), rHi = Math.max(mr, fr);
    const pick = (seed, xMin, xMax, yMin, yMax, fw, fh) => {
      const sw = Math.max(2, xMax - xMin), sh = Math.max(2, yMax - yMin);
      const w = Math.max(2, Math.min(sw, Math.round(sw * fw)));
      const h = Math.max(2, Math.min(sh, Math.round(sh * fh)));
      const x0 = xMin + Math.floor(seed.rx * (sw - w + 1));
      const y0 = yMin + Math.floor(seed.ry * (sh - h + 1));
      return [x0, y0, x0 + w, y0 + h];
    };
    // 大：幅は画面幅の約1/4。中心（mc, mr）を必ず含める
    const bw = Math.max(3, Math.round(cols / 4), cHi - cLo + 3);
    const lo = Math.max(1, cHi + 1 - bw), hi = Math.min(cols - 1 - bw, cLo - 1);
    const bx0 = hi >= lo ? Math.round(lo + BIG_SHIFT * (hi - lo)) : Math.max(1, Math.min(cols - 1 - bw, cLo - 1));
    const bh = Math.max(Math.round(rows * BIG_H), rHi + 2);
    const big = BIG_TOP ? [bx0, 0, bx0 + bw, Math.min(bh, rows - 1)] : [bx0, Math.max(1, Math.min(rows - bh, rLo - 1)), bx0 + bw, Infinity];
    const L = [1, big[0] - 1], Rt = [big[2] + 1, cols - 1]; // 大の左側・右側の空き
    let med, sml;
    if (SAME_SIDE) {
      const side = BIG_FIRST ? L : Rt;
      const sr = Math.round(rows * 0.6);
      const medY = MED_FIRST ? [1, sr - 1] : [rows - sr + 1, rows - 1];
      const smlY = MED_FIRST ? [sr + 1, rows - 1] : [1, rows - sr - 1];
      med = pick(SEEDS[1], side[0], side[1], medY[0], medY[1], MED_W + 0.15, MED_H - 0.05);
      sml = pick(SEEDS[2], side[0], side[1], smlY[0], smlY[1], SML_W + 0.15, SML_H - 0.05);
    } else {
      med = pick(SEEDS[1], (BIG_FIRST ? L : Rt)[0], (BIG_FIRST ? L : Rt)[1], 1, rows - 1, MED_W, MED_H - 0.2);
      sml = pick(SEEDS[2], (BIG_FIRST ? Rt : L)[0], (BIG_FIRST ? Rt : L)[1], 1, rows - 1, SML_W, SML_H - 0.2);
    }
    const cells = [big, med, sml]; // 大・中・小
    if (extra) {
      // スマホ用の4つ目：大の左右どちらかの空いている縦の隙間で、いちばん広いところに小さめの窓を置く
      const f = (v, d) => (isFinite(v) ? v : d);
      let best = null;
      [L, Rt].forEach(side => {
        const ys = cells.slice(1).filter(c => c[0] <= side[1] && c[2] >= side[0]).map(c => [c[1], c[3]]).sort((a, b) => a[0] - b[0]);
        let cur = 1;
        const gaps = [];
        ys.forEach(([a, b]) => { if (a - 1 - cur >= 2) gaps.push([cur, a - 1]); cur = Math.max(cur, b + 1); });
        if (rows - 1 - cur >= 2) gaps.push([cur, rows - 1]);
        gaps.forEach(g => { if (side[1] - side[0] >= 2 && (!best || g[1] - g[0] > best.g[1] - best.g[0])) best = { side, g }; });
      });
      if (best) cells.push(pick(SEEDS[3], best.side[0], best.side[1], best.g[0], best.g[1], SML_W + 0.2, SML_H));
    }
    return cells;
  }
  function layoutCells(W, H, U) {
    const cols = Math.max(8, Math.floor(W / U));
    const rows = Math.max(8, Math.floor(H / U));
    const extra = true; // 窓は4つ（大・中・小・小）
    if (!HORIZONTAL) return layoutBase(cols, rows, 0.55, 0.33, extra);
    return layoutBase(rows, cols, 0.33, 0.55, extra).map(([x0, y0, x1, y1]) => [y0, x0, y1, x1]);
  }

  // 格子の間隔は歪みグリッドと必ず同じ値にする（画面幅に応じて CONFIG.spacing が変わる）
  function getU() {
    if (typeof applyWarpBreakpoint === 'function') applyWarpBreakpoint();
    return (typeof CONFIG !== 'undefined' && CONFIG.spacing) ? CONFIG.spacing : 96;
  }
  let U = getU();
  let LINES_X = [], LINES_Y = [];

  let targetY = 0;   // スクロール位置から求めた「目標」の進み具合
  let currentY = 0;  // 実際に描画に使う、少し遅れて追いつく値
  let rafId = null;

  function render(y) {
    const maxY = hero.offsetHeight * PARALLAX_RANGE;
    const t = maxY > 0 ? Math.min(y / maxY, 1) : 0; // 0〜1の進み具合

    // 写真：中心を軸に大きくズーム
    // タッチ端末（iPhone等）は、ぼかしの再計算がスクロールのたびに走ってちらつくため、拡大を止める
    if (LIGHT) return;
    photo.style.transform = `scale(${(1 + t * PHOTO_ZOOM).toFixed(4)})`;

    // すりガラス・格子線：視差効果なし（固定表示のため、ここでは何もしない）
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
    hero.style.height = ''; // CSSの高さ（100svh）に任せる。格子には揃えない
    const W = hero.clientWidth;
    const H = hero.clientHeight;

    // 背景：コンテンツエリアと同じグラデーションを、ページ最上部と同じ座標で描く（つなぎ目が出ない）
    const bg = document.getElementById('hero-bg');
    if (bg && typeof drawBackground === 'function') drawBackground(bg, bg.getContext('2d'), W, H);

    // すりガラスは1枚の全面レイヤー。長方形の「窓」だけをマスクで抜き、
    // そこだけ写真をくっきり見せる。細い白線は画面の端から端まで通す
    // 線・穴・窓の縁は、すべて同じ整数ピクセルの値から計算する（1pxのずれを出さない）。
    // 穴は [x0, x1) × [y0, y1)、線はその外側ちょうど1pxに置く
    // 窓の縁は背景グリッドの線と同じ位置（k×U）。線は [k×U, k×U+1] の1px（背景側も同じ位置に描く）。
    // 穴は始点側が線の内側（k×U+1）、終点側が線の手前（k×U）から始まる／終わる
    U = getU();
    const cells = layoutCells(W, H, U);
    LINES_X = []; LINES_Y = [];
    const rects = cells.map(([cx0, cy0, cx1, cy1]) => {
      // 0 や Infinity は「画面の端まで」。端の窓は穴を端まで広げ、その辺には線を引かない
      const X0 = cx0 <= 0 ? 0 : cx0 * U + 1, X1 = isFinite(cx1) ? cx1 * U : W;
      const Y0 = cy0 <= 0 ? 0 : cy0 * U + 1, Y1 = isFinite(cy1) ? cy1 * U : H;
      if (cx0 > 0) LINES_X.push(cx0 * U);
      if (isFinite(cx1)) LINES_X.push(cx1 * U);
      if (cy0 > 0) LINES_Y.push(cy0 * U);
      if (isFinite(cy1)) LINES_Y.push(cy1 * U);
      return { x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0 };
    });
    const holes = rects.map(r => `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}z`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
      `<path shape-rendering="crispEdges" fill-rule="evenodd" fill="#000" d="M0 0H${W}V${H}H0Z${holes}"/></svg>`;
    const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    layer.style.webkitMaskImage = url;
    layer.style.maskImage = url;
    layer.style.webkitMaskSize = '100% 100%';
    layer.style.maskSize = '100% 100%';
    layer.style.transform = 'none';
    layer.textContent = '';

    lines.textContent = '';
    const add = (css) => {
      const el = document.createElement('div');
      el.className = 'hero__line';
      el.style.cssText = css;
      lines.appendChild(el);
    };
    LINES_X.forEach(x => add(`left:${x}px;top:0;width:1px;height:100%`));
    LINES_Y.forEach(y => add(`top:${y}px;left:0;height:1px;width:100%`));

    setTarget(); // 高さが変わった直後も、今のスクロール位置に合わせておく
  }

  build();

  // ヒーローの実際の大きさが変わったら作り直す。
  // （ローディング後にスクロールバーが出て幅が変わる／アドレスバーで高さが変わる場合は
  //   window の resize が発火しないため、要素自体の大きさを監視する。
  //   線・穴を同じピクセル値で作り直さないと、窓と線がずれる）
  let lastW = hero.clientWidth, lastH = hero.clientHeight, raf = 0;
  function rebuildIfResized() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (hero.clientWidth !== lastW || hero.clientHeight !== lastH) {
        lastW = hero.clientWidth; lastH = hero.clientHeight; build();
      }
    });
  }
  if ('ResizeObserver' in window) new ResizeObserver(rebuildIfResized).observe(hero);
  window.addEventListener('resize', rebuildIfResized);
  window.addEventListener('load', rebuildIfResized);

  window.addEventListener('scroll', setTarget, { passive: true });
})();
