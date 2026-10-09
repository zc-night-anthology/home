/**
 * Warp Grid Background
 * ---------------------
 * ダークトーンの青系ノイズグラデーション背景 + 下に行くほど
 * ランダムな方向に歪む格子線。
 *
 * 使い方:
 *   <canvas id="warp-bg-base"></canvas>
 *   <canvas id="warp-grid-bg"></canvas>
 *   <script src="warp-grid-background.js"></script>
 *
 * CSSで両canvasを position:absolute; top:0; left:0; z-index:-1; にしておくこと
 * （ページと一緒にスクロールさせるため。fixed だと歪みが見えません）。
 *
 * 調整したい値はすべて CONFIG にまとめてあります。
 */

const CONFIG = {
  // --- グリッドの歪み ---
  spacing: 44,         // 格子の間隔(px)
  maxAmp: 108,         // 歪みの最大幅(px)。マス目のサイズに合わせて調整
  growth: 0.04,        // 歪みが強まっていく速さ(開始位置からの距離に対する係数)
  startScreens: 2,     // 何画面分(vh)歪ませずに平らなままにするか
  sub: 7,              // 1マスあたりの分割数(線の滑らかさ)
  noiseFeatureSize: 282, // 歪みの向きのうねりの大きさ(px)。マス目のサイズに合わせて調整
  lineColor: 'rgba(200, 205, 235, 0.1)', // 格子線の色

  // --- 背景のノイズグラデーション ---
  bgCellSize: 6,        // 背景を塗る際の粗さ(小さいほど精細だが重い)
  bgColorFeature: 260,  // 色の塊の大きさ
  bgWarpFeature: 160,   // 色の境界を渦状に歪ませるノイズのスケール
  bgWarpStrength: 70,   // 渦の強さ
  bgSharpness: 2.4,     // 色の混ざり方の鋭さ(大きいほど塊がはっきり)
  grainAlpha: 0.05,     // 粒状グレインの強さ

  // パレット: [R, G, B] の配列。targetShare の合計は 1.0 になるようにする
  // キービジュアル（告知画像）の色味に合わせた、少し紫がかった濃いインディゴブルー
  palette: [
    { rgb: [0x1A, 0x21, 0x40], share: 0.55 }, // 最も暗い濃紺(インディゴ)
    { rgb: [0x26, 0x2F, 0x5C], share: 0.28 }, // ダークインディゴブルー
    { rgb: [0x48, 0x56, 0x8F], share: 0.14 }, // 中間の青紫
    { rgb: [0x7C, 0x8F, 0xC9], share: 0.03 }, // 明るい青紫(控えめ)
  ],
};

// --- 画面幅ごとの設定（CSSのブレークポイントと合わせてある: 699px / 1023px）---
// 上記 CONFIG の値が PC 用。狭い画面では、格子・歪み幅・ノイズの大きさを小さくする。
// （デスクトップ側を1.2倍にしたのに合わせて、こちらも同じ比率で拡大してある）
const WARP_BREAKPOINTS = [
  { maxWidth: 699,  spacing: 26,  maxAmp: 54, noiseFeatureSize: 180, bgCellSize: 8 }, // スマホ
  { maxWidth: 1023, spacing: 35,  maxAmp: 84, noiseFeatureSize: 240, bgCellSize: 6 }, // タブレット
];
const WARP_DESKTOP = {
  spacing: CONFIG.spacing, maxAmp: CONFIG.maxAmp,
  noiseFeatureSize: CONFIG.noiseFeatureSize, bgCellSize: CONFIG.bgCellSize,
};
function applyWarpBreakpoint() {
  const bp = WARP_BREAKPOINTS.find(b => window.innerWidth <= b.maxWidth) || {};
  const { maxWidth, ...values } = bp;
  Object.assign(CONFIG, WARP_DESKTOP, values);
}
applyWarpBreakpoint();

// canvasが大きすぎると（特にiOS Safari）描画に失敗するため、面積の上限に収まるよう解像度を下げる
const MAX_CANVAS_PIXELS = 12000000;
function safeDpr(w, h) {
  const dpr = window.devicePixelRatio || 1;
  return Math.min(dpr, Math.sqrt(MAX_CANVAS_PIXELS / (w * h)));
}

// ============================================================
// 以下、実装本体(通常は変更不要)
// ============================================================

// --- 軽量な2Dバリューノイズ ---
function hash(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
  return ((n & 0xfffffff) / 0xfffffff) * 2 - 1;
}
function smoothstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function valueNoise(x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = x0 + 1, y1 = y0 + 1;
  const sx = smoothstep(x - x0), sy = smoothstep(y - y0);
  const n00 = hash(x0, y0), n10 = hash(x1, y0), n01 = hash(x0, y1), n11 = hash(x1, y1);
  const ix0 = n00 + sx * (n10 - n00);
  const ix1 = n01 + sx * (n11 - n01);
  return ix0 + sy * (ix1 - ix0);
}

// --- パレットのブレンド(重み付き平均。順番補間ではないので境界線が出ない) ---
const paletteOffsets = CONFIG.palette.map((_, i) => [i * 53.7 + 11, i * 91.3 + 29]);

function blendColor(x, y) {
  const raw = CONFIG.palette.map((entry, i) => {
    const n = valueNoise(
      x / CONFIG.bgColorFeature + paletteOffsets[i][0],
      y / CONFIG.bgColorFeature + paletteOffsets[i][1]
    );
    return Math.pow(Math.max(0, (n + 1) / 2), CONFIG.bgSharpness) * entry.share;
  });
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < CONFIG.palette.length; i++) {
    const w = raw[i] / sum;
    r += CONFIG.palette[i].rgb[0] * w;
    g += CONFIG.palette[i].rgb[1] * w;
    b += CONFIG.palette[i].rgb[2] * w;
  }
  return [Math.round(r), Math.round(g), Math.round(b)];
}

// --- グレイン(粒状)パターン ---
function makeGrainPattern(ctxRef) {
  const tile = document.createElement('canvas');
  tile.width = 128;
  tile.height = 128;
  const tctx = tile.getContext('2d');
  const imgData = tctx.createImageData(128, 128);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    imgData.data[i] = v;
    imgData.data[i + 1] = v;
    imgData.data[i + 2] = v;
    imgData.data[i + 3] = 255;
  }
  tctx.putImageData(imgData, 0, 0);
  return ctxRef.createPattern(tile, 'repeat');
}

// --- 背景描画 ---
function drawBackground(bgCanvas, bgCtx, w, h) {
  const dpr = safeDpr(w, h);
  bgCanvas.width = w * dpr;
  bgCanvas.height = h * dpr;
  bgCanvas.style.width = w + 'px';
  bgCanvas.style.height = h + 'px';
  bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cell = CONFIG.bgCellSize;

  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      const wx = valueNoise(x / CONFIG.bgWarpFeature, y / CONFIG.bgWarpFeature) * CONFIG.bgWarpStrength;
      const wy = valueNoise(x / CONFIG.bgWarpFeature + 55, y / CONFIG.bgWarpFeature + 130) * CONFIG.bgWarpStrength;
      const [r, g, b] = blendColor(x + wx, y + wy);
      bgCtx.fillStyle = `rgb(${r},${g},${b})`;
      bgCtx.fillRect(x, y, cell, cell);
    }
  }

  bgCtx.globalAlpha = CONFIG.grainAlpha;
  bgCtx.fillStyle = makeGrainPattern(bgCtx);
  bgCtx.fillRect(0, 0, w, h);
  bgCtx.globalAlpha = 1;
}

// --- グリッド(歪み)描画 ---
function drawGrid(gridCanvas, ctx, w, h, vh) {
  const dpr = safeDpr(w, h);
  gridCanvas.width = w * dpr;
  gridCanvas.height = h * dpr;
  gridCanvas.style.width = w + 'px';
  gridCanvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const { spacing, maxAmp, growth, sub, noiseFeatureSize, lineColor, startScreens } = CONFIG;
  const freq = 1 / noiseFeatureSize;

  function noiseDX(x, y) { return valueNoise(x * freq, y * freq); }
  function noiseDY(x, y) { return valueNoise(x * freq + 41.3, y * freq + 97.1); }

  // 歪みは ABOUT セクションの上端あたりからスタートする（見つからなければ従来どおり startScreens 画面ぶん下から）
  const aboutEl = document.getElementById('about');
  const warpStartY = aboutEl ? aboutEl.getBoundingClientRect().top + window.scrollY : vh * startScreens;

  function ampAt(y) {
    const startY = warpStartY;
    if (y <= startY) return 0;
    // 歪みは平らな区間の終わりから、ページの一番下（フッター付近）で最大になるよう直線的に強める
    return maxAmp * Math.min(1, (y - startY) / Math.max(1, h - startY));
  }

  function disp(x, y) {
    const amp = ampAt(y);
    const dx = noiseDX(x, y) * amp;
    const dy = noiseDY(x, y) * amp;
    return [x + dx, y + dy];
  }

  ctx.clearRect(0, 0, w, h);

  // キャンバス範囲でクリップし、余分に描いた線が端できれいに切れるようにする
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  ctx.translate(0.5, 0.5); // 1px線をピクセルにぴったり重ねる（heroの白線と同じ位置）
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1;

  const margin = maxAmp * 3;
  const startCol = -Math.ceil(margin / spacing);
  const endCol = Math.ceil((w + margin) / spacing) + 1;
  const rows = Math.ceil(h / spacing) + 1;

  // 横線: 画面外まで余分に描いてからクリップで切る(端で途切れないように)
  for (let r = 0; r <= rows; r++) {
    const y = r * spacing;
    ctx.beginPath();
    let first = true;
    for (let c = startCol; c < endCol; c++) {
      const x0 = c * spacing;
      for (let s = 0; s <= sub; s++) {
        const x = x0 + (spacing * s) / sub;
        const [dx, dy] = disp(x, y);
        if (first) { ctx.moveTo(dx, dy); first = false; } else { ctx.lineTo(dx, dy); }
      }
    }
    ctx.stroke();
  }

  // 縦線
  const cols = Math.ceil(w / spacing) + 1;
  for (let c = 0; c <= cols; c++) {
    const x = c * spacing;
    ctx.beginPath();
    for (let r = 0; r < rows; r++) {
      const y0 = r * spacing;
      for (let s = 0; s <= sub; s++) {
        const y = y0 + (spacing * s) / sub;
        const [dx, dy] = disp(x, y);
        if (r === 0 && s === 0) ctx.moveTo(dx, dy); else ctx.lineTo(dx, dy);
      }
    }
    ctx.stroke();
  }

  ctx.restore();
}

// --- 初期化 ---
function initWarpGridBackground() {
  const bgCanvas = document.getElementById('warp-bg-base');
  const gridCanvas = document.getElementById('warp-grid-bg');
  if (!bgCanvas || !gridCanvas) {
    console.warn('warp-grid-background: #warp-bg-base または #warp-grid-bg が見つかりません');
    return;
  }
  const bgCtx = bgCanvas.getContext('2d');
  const ctx = gridCanvas.getContext('2d');

  // ページ全体の高さは document.documentElement.scrollHeight ではなく、
  // .content（このキャンバス自身とは無関係な、通常フローの要素）の下端から求める。
  // scrollHeight を使うと「絶対配置のキャンバス自身の高さ」も測定対象に含まれてしまい、
  // 一度キャンバスが実際より少し高く描画されると、以降は常にキャンバス自身の高さを
  // 測り続けてしまって縮まらなくなる（＝フッターの下に謎の余白が残り続ける）ため。
  function getPageHeight() {
    const contentEl = document.querySelector('.content');
    if (!contentEl) return document.documentElement.scrollHeight;
    const rect = contentEl.getBoundingClientRect();
    return Math.ceil(rect.bottom + window.scrollY);
  }

  function redraw() {
    applyWarpBreakpoint();
    const w = window.innerWidth;
    const h = getPageHeight();
    const vh = window.innerHeight;
    drawBackground(bgCanvas, bgCtx, w, h);
    drawGrid(gridCanvas, ctx, w, h, vh);
  }

  redraw();

  // リサイズ時は再計算(デバウンス)。幅が変わらない場合（スマホのアドレスバー伸縮など）は再描画しない
  let resizeTimer;
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      redraw();
    }, 150);
  });

  // ページ内容が動的に増減する場合に備えて、高さの変化も監視
  let lastHeight = getPageHeight();
  const resizeObserver = new ResizeObserver(() => {
    const newHeight = getPageHeight();
    if (Math.abs(newHeight - lastHeight) > 10) {
      lastHeight = newHeight;
      redraw();
    }
  });
  resizeObserver.observe(document.body);

  // Webフォントの読み込みが初回描画より後に完了し、文字の高さが変わって
  // 実際のページ内容よりキャンバスが長いまま残る（＝フッターの下に余白ができる）
  // ことがあるため、フォント確定後にもう一度サイズを合わせ直す
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      lastHeight = getPageHeight();
      redraw();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWarpGridBackground);
} else {
  initWarpGridBackground();
}
