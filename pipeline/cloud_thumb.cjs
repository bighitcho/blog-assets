/*
 클라우드 한글 썸네일 생성기 v3 — 주제 이미지 배경 + 블러/어둡게 + 텍스트 강조.
 사용: node cloud_thumb.cjs spec.json
 spec.json = {
   "out": "/abs/path.png", "w":1200, "h":630,
   "bg": "/abs/background.jpg",          // 주제에 맞는 생성 이미지(필수 권장). 없으면 그라디언트 폴백
   "blur": 5, "dim": 0.55,               // (선택) 배경 블러 px, 어둡기 0~1
   "kicker": "생활비 · 정부지원",
   "title": "온누리상품권 10% 할인\n**120만원** 사면 얼마 아끼나",   // **강조**, \n 줄바꿈
   "hook":  "9/16~20",                   // (선택) 큰 훅 배지 — 숫자·날짜 한 줄
   "brand": "mydooba.com",
   "template": 0~2 (생략시 자동), "palette": 0~5 (강조색만 사용)
 }
 원칙: PPT 느낌 금지. 사진이 깔리고 그 위에 글자가 '박히는' 느낌. 글자는 크고 대비 강하게.
*/
const fs = require('fs');
const path = require('path');
// 실행 환경 자동 감지: 클라우드 컨테이너(/opt/...) 또는 GitHub Actions(npm playwright)
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch { ({ chromium } = require('playwright')); }
const CHROME = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;
const GF = "https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Do+Hyeon&family=Jua&family=Noto+Sans+KR:wght@500;700;900&display=swap";

const ACCENTS = [
  { accent: "#ffd60a", accent2: "#ff7a1a" },
  { accent: "#ffe45c", accent2: "#7dffb0" },
  { accent: "#ffd23f", accent2: "#ff5c8a" },
  { accent: "#ffe94d", accent2: "#ffb34d" },
  { accent: "#34d399", accent2: "#fbbf24" },
  { accent: "#ffd60a", accent2: "#ff8f6b" },
];
const FALLBACK_BG = [
  "linear-gradient(120deg,#0b1f3a 0%,#123a6b 60%,#1b5aa6 100%)",
  "linear-gradient(120deg,#0f3d2e 0%,#0d5c3f 60%,#12865a 100%)",
  "linear-gradient(120deg,#3b0d3f 0%,#6a1b6e 60%,#a12a8b 100%)",
  "linear-gradient(120deg,#6b1414 0%,#a31d1d 60%,#d63a2a 100%)",
  "linear-gradient(120deg,#111827 0%,#1f2937 60%,#374151 100%)",
  "linear-gradient(120deg,#0e3b5e 0%,#0b6a8f 60%,#0aa3b8 100%)",
];
const DISPLAY = ["'Black Han Sans'", "'Do Hyeon'", "'Jua'"];
const LATIN = "'Liberation Sans','DejaVu Sans',Arial,sans-serif";

function pick(spec, key, mod) {
  if (Number.isInteger(spec[key])) return spec[key] % mod;
  const s = (spec.title || "") + (spec.brand || "") + (new Date().toISOString().slice(0,10));
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % mod;
}
const isLatinStr = s => /^[\x00-\x7F–—‘’“”·]*$/.test(s);
function fontFor(rawTitle, availPx) {
  const clean = (rawTitle || "").replace(/\*\*/g, "");
  const lines = clean.split("\n");
  const latin = isLatinStr(clean);
  const maxLen = Math.max(1, ...lines.map(l => l.length));
  const perChar = latin ? availPx / (maxLen * 0.55) : availPx / maxLen;
  const cap = lines.length <= 2 ? (latin ? 136 : 108) : 94;
  return Math.max(50, Math.min(cap, Math.floor(perChar)));
}
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function titleHtml(raw){ return esc(raw || "").replace(/\*\*(.+?)\*\*/g, "<em>$1</em>").replace(/\n/g, "<br>"); }
function bgDataUrl(p){
  if (!p) return null;
  const buf = fs.readFileSync(p);
  const ext = path.extname(p).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function buildHtml(spec) {
  const w = spec.w || 1200, h = spec.h || 630;
  const pi = pick(spec, "palette", ACCENTS.length);
  const ti = pick(spec, "template", 3);
  const A = ACCENTS[pi];
  const cleanT = (spec.title || "").replace(/\*\*/g, "");
  const latin = isLatinStr(cleanT);
  const disp = latin ? LATIN : DISPLAY[(pi + ti) % DISPLAY.length];
  const wt = latin ? "900" : "normal";
  const kicker = esc(spec.kicker || ""), brand = esc(spec.brand || ""), hook = esc(spec.hook || "");
  const title = titleHtml(spec.title || "");
  const blur = Number.isFinite(spec.blur) ? spec.blur : 5;
  const dim = Number.isFinite(spec.dim) ? spec.dim : 0.55;
  const bg = bgDataUrl(spec.bg);
  const shadow = "0 4px 26px rgba(0,0,0,.55), 0 1px 2px rgba(0,0,0,.6)";

  // 배경: 사진(블러+어둡게) 또는 폴백 그라디언트
  const bgCss = bg
    ? `.bg{position:absolute;inset:-${blur*3}px;background:url("${bg}") center/cover no-repeat;filter:blur(${blur}px) brightness(${(1-dim).toFixed(2)}) saturate(1.15);transform:scale(1.04)}`
    : `.bg{position:absolute;inset:0;background:${FALLBACK_BG[pi]}}`;

  const common = `
   em{font-style:normal;color:${A.accent}}
   .bg{z-index:0}
   .ov{position:absolute;inset:0;z-index:1}
   .ct{position:absolute;inset:0;z-index:2}
   .kick{display:inline-block;font:900 26px 'Noto Sans KR',${LATIN};color:#111;background:${A.accent};padding:8px 18px;border-radius:999px;letter-spacing:1px}
   .hook{display:inline-block;font:${wt} 62px ${disp},'Noto Sans KR';color:#111;background:${A.accent};padding:6px 28px;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.45);line-height:1.15}
   .brand{position:absolute;font:900 26px 'Noto Sans KR',${LATIN};color:#fff;opacity:.92;text-shadow:0 2px 8px rgba(0,0,0,.6)}
   h1{color:#fff;text-shadow:${shadow};letter-spacing:-1px}`;

  let layout, inner;
  if (ti === 0) {
    // A. 좌측 정렬 + 좌→우 어두운 그라디언트 (사진은 오른쪽에 살아있음)
    const FS = fontFor(spec.title, 900);
    layout = `${common}
     .ov{background:linear-gradient(90deg,rgba(0,0,0,.78) 0%,rgba(0,0,0,.55) 45%,rgba(0,0,0,.08) 100%)}
     .wrap{position:absolute;left:80px;top:78px;right:120px}
     h1{font:${wt} ${FS}px ${disp},'Noto Sans KR';line-height:1.16;margin-top:26px}
     .hk{position:absolute;left:80px;bottom:60px}
     .brand{right:80px;bottom:56px}`;
    inner = `<div class="wrap"><span class="kick">${kicker}</span><h1>${title}</h1></div>${hook?`<div class="hk"><span class="hook">${hook}</span></div>`:""}<div class="brand">${brand}</div>`;
  } else if (ti === 1) {
    // B. 하단 앵커 + 아래→위 그라디언트 (사진 상단이 넓게 보임)
    const FS = fontFor(spec.title, 1000);
    layout = `${common}
     .ov{background:linear-gradient(180deg,rgba(0,0,0,.10) 0%,rgba(0,0,0,.45) 45%,rgba(0,0,0,.85) 100%)}
     .wrap{position:absolute;left:80px;right:80px;bottom:120px}
     h1{font:${wt} ${FS}px ${disp},'Noto Sans KR';line-height:1.14;margin-top:22px}
     .hk{position:absolute;right:80px;top:70px}
     .brand{left:80px;bottom:52px}`;
    inner = `<div class="wrap"><span class="kick">${kicker}</span><h1>${title}</h1></div>${hook?`<div class="hk"><span class="hook">${hook}</span></div>`:""}<div class="brand">${brand}</div>`;
  } else {
    // C. 중앙 + 가운데 어두운 패널(반투명) — 사진은 테두리에서 보임
    const FS = fontFor(spec.title, 920);
    layout = `${common}
     .ov{background:radial-gradient(ellipse at center,rgba(0,0,0,.72) 0%,rgba(0,0,0,.55) 55%,rgba(0,0,0,.25) 100%)}
     .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px 90px}
     h1{font:${wt} ${FS}px ${disp},'Noto Sans KR';line-height:1.14;margin:24px 0 28px}
     .brand{left:0;right:0;bottom:44px;text-align:center}`;
    inner = `<div class="wrap"><span class="kick">${kicker}</span><h1>${title}</h1>${hook?`<span class="hook">${hook}</span>`:""}</div><div class="brand">${brand}</div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><link href="${GF}" rel="stylesheet">
  <style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:${w}px;height:${h}px;overflow:hidden}
  body{position:relative;background:#000;font-family:'Noto Sans KR',${LATIN};-webkit-font-smoothing:antialiased}
  ${bgCss}${layout}</style></head><body><div class="bg"></div><div class="ov"></div><div class="ct">${inner}</div></body></html>`;
}

(async () => {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));
  if (spec.bg && !fs.existsSync(spec.bg)) { console.error("ERR bg not found: " + spec.bg); process.exit(1); }
  const w = spec.w || 1200, h = spec.h || 630;
  const b = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.setContent(buildHtml(spec), { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: spec.out });
  await b.close();
  console.log("OK " + spec.out + (spec.bg ? "" : "  (no bg — gradient fallback)"));
})().catch(e => { console.error("ERR " + e.message); process.exit(1); });
