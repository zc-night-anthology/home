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
  // 窓は大・中・小の3つ。画面を2つの帯に分け、片側の全面に「大」、反対側に「中」と「小」を不均等に並べる。
  // 帯の分け方は縦割り（左右）・横割り（上下）のどちらもランダム。大は常に画面の端のどこかに接し、中心付近も必ず含む。
  const HORIZONTAL = Math.random() < 0.5;         // true: 上下に分ける／false: 左右に分ける
  const BIG_FIRST = Math.random() < 0.5;          // 大が左（上）側か、右（下）側か
  const BIG_EDGE = Math.floor(Math.random() * 3); // 0:帯の外側の端 1:一方の長辺側 2:もう一方の長辺側
  const MED_FIRST = Math.random() < 0.5;          // 中が前（上／左）側か後ろ側か
  const R = () => Math.random();
  const FILL_W = 0.85 + R() * 0.15, FILL_H = 0.85 + R() * 0.15; // 大・中の埋まり具合
  const SMALL_W = 0.72 + R() * 0.1, SMALL_H = 0.72 + R() * 0.1; // 小さい窓は一回り小さく
  const SEEDS = Array.from({ length: 3 }, () => ({ rx: R(), ry: R() }));

  // 「左右に分ける」基準の配置を cols×rows で作る（上下に分けるときは縦横を入れ替えて呼び、結果を転置する）
  function layoutBase(cols, rows) {
    const mc = Math.floor(cols / 2), mr = Math.floor(rows / 2);
    const pick = (seed, xMin, xMax, yMin, yMax, fw = FILL_W, fh = FILL_H) => {
      const sw = xMax - xMin, sh = yMax - yMin;
      const w = Math.max(2, Math.min(sw, Math.round(sw * fw)));
      const h = Math.max(2, Math.min(sh, Math.round(sh * fh)));
      const x0 = xMin + Math.floor(seed.rx * (sw - w + 1));
      const y0 = yMin + Math.floor(seed.ry * (sh - h + 1));
      return [x0, y0, x0 + w, y0 + h];
    };
    const bigX = BIG_FIRST ? [1, mc - 1] : [mc + 2, cols - 1];
    const smallX = BIG_FIRST ? [mc + 2, cols - 1] : [1, mc - 2];
    const big = pick(SEEDS[0], bigX[0], bigX[1], 1, rows - 1);
    // 人物の顔が見えるよう、画面の中心付近は必ず大の中に入れる（中心をまたぐまで広げる）
    big[0] = Math.min(big[0], mc - 1); big[2] = Math.max(big[2], mc + 1);
    big[1] = Math.min(big[1], mr - 1); big[3] = Math.max(big[3], mr + 1);
    // 大は必ず画面の端に接する（見切れる）
    if (BIG_EDGE === 0) { if (BIG_FIRST) big[0] = 0; else big[2] = Infinity; }
    else if (BIG_EDGE === 1) big[1] = 0;
    else big[3] = Infinity;
    // 反対側は「中」と「小」に不均等に分ける（中が約60%、小が約40%の帯）
    const sr = Math.round(rows * 0.6);
    const medY = MED_FIRST ? [1, sr - 1] : [rows - sr + 1, rows - 1];
    const smlY = MED_FIRST ? [sr + 1, rows - 1] : [1, rows - sr - 1];
    const med = pick(SEEDS[1], smallX[0], smallX[1], medY[0], medY[1]);
    const sml = pick(SEEDS[2], smallX[0], smallX[1], smlY[0], smlY[1], SMALL_W, SMALL_H);
    return [big, med, sml];
  }
  // 窓の位置・大きさを、背景グリッド（間隔 U、原点 0,0）の交点に吸着させて返す
  function layoutCells(W, H, U) {
    const cols = Math.max(8, Math.floor(W / U));
    const rows = Math.max(8, Math.floor(H / U));
    if (!HORIZONTAL) return layoutBase(cols, rows);
    return layoutBase(rows, cols).map(([x0, y0, x1, y1]) => [y0, x0, y1, x1]);
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
