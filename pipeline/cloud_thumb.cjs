/*
 클라우드 한글 썸네일 생성기 v2 — 떡상형(고대비·큰 훅·배지). PIL/윈도우폰트 불필요.
 사용: node cloud_thumb.cjs spec.json
 spec.json = {
   "out": "/abs/path.png", "w":1200, "h":630,
   "kicker": "생활비 · 정부지원",
   "title": "온누리상품권 10% 할인\n**120만원** 사면 얼마 아끼나",   // **강조** 가능, \n 줄바꿈
   "hook":  "9월 16일부터",           // (선택) 큰 훅 배지 — 숫자·날짜·핵심어 한 줄
   "brand": "mydooba.com",
   "template": 0~3 (생략시 자동 회전), "palette": 0~5 (생략시 자동 회전)
 }
 원칙: 흐린 배경·작은 글씨 금지. 첫눈에 숫자/핵심어가 읽혀야 한다.
*/
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const GF = "https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Do+Hyeon&family=Jua&family=Anton&family=Noto+Sans+KR:wght@500;700;900&display=swap";

// 6 팔레트 — 전부 진한 배경 + 강한 강조색 (연한 크림 배경 없음)
const PALETTES = [
  { bg: "linear-gradient(120deg,#0b1f3a 0%,#123a6b 60%,#1b5aa6 100%)", fg: "#ffffff", accent: "#ffd60a", accent2: "#ff7a1a", kicker: "#9fd3ff" },
  { bg: "linear-gradient(120deg,#0f3d2e 0%,#0d5c3f 60%,#12865a 100%)", fg: "#ffffff", accent: "#ffe45c", accent2: "#7dffb0", kicker: "#a8f0cc" },
  { bg: "linear-gradient(120deg,#3b0d3f 0%,#6a1b6e 60%,#a12a8b 100%)", fg: "#fff6fb", accent: "#ffd23f", accent2: "#ff5c8a", kicker: "#f5b3e6" },
  { bg: "linear-gradient(120deg,#6b1414 0%,#a31d1d 60%,#d63a2a 100%)", fg: "#fff8f2", accent: "#ffe94d", accent2: "#ffb34d", kicker: "#ffc7b8" },
  { bg: "linear-gradient(120deg,#111827 0%,#1f2937 60%,#374151 100%)", fg: "#ffffff", accent: "#34d399", accent2: "#fbbf24", kicker: "#9ca3af" },
  { bg: "linear-gradient(120deg,#0e3b5e 0%,#0b6a8f 60%,#0aa3b8 100%)", fg: "#ffffff", accent: "#ffd60a", accent2: "#ff8f6b", kicker: "#b6f0ff" },
];
const DISPLAY = ["'Black Han Sans'", "'Do Hyeon'", "'Jua'"];

function pick(spec, key, mod) {
  if (Number.isInteger(spec[key])) return spec[key] % mod;
  const s = (spec.title || "") + (spec.brand || "") + (new Date().toISOString().slice(0,10));
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % mod;
}
function fontFor(rawTitle, availPx) {
  const clean = (rawTitle || "").replace(/\*\*/g, "");
  const lines = clean.split("\n");
  const latin = /^[\x00-\x7F\u2013\u2014\u2018\u2019\u201C\u201D\u00B7]*$/.test(clean);
  const maxLen = Math.max(1, ...lines.map(l => l.length));
  const perChar = latin ? availPx / (maxLen * 0.55) : availPx / maxLen; // 라틴은 글자폭이 좁다
  const cap = lines.length <= 2 ? (latin ? 132 : 104) : 92;
  return Math.max(48, Math.min(cap, Math.floor(perChar)));
}
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function titleHtml(raw){ return esc(raw || "").replace(/\*\*(.+?)\*\*/g, "<em>$1</em>").replace(/\n/g, "<br>"); }

function deco(P){
  return `
   .c1,.c2{position:absolute;border-radius:50%;pointer-events:none}
   .c1{width:520px;height:520px;right:-140px;top:-180px;background:radial-gradient(circle at 30% 30%,${P.accent}33,transparent 62%)}
   .c2{width:420px;height:420px;left:-160px;bottom:-200px;background:radial-gradient(circle at 60% 40%,${P.accent2}2e,transparent 62%)}
   .stripe{position:absolute;right:-60px;bottom:-40px;width:260px;height:14px;background:${P.accent};transform:rotate(-28deg);opacity:.9}
   .stripe2{position:absolute;right:-30px;bottom:6px;width:180px;height:14px;background:${P.accent2};transform:rotate(-28deg);opacity:.9}`;
}

function buildHtml(spec) {
  const w = spec.w || 1200, h = spec.h || 630;
  const pi = pick(spec, "palette", PALETTES.length);
  const ti = pick(spec, "template", 4);
  const P = PALETTES[pi];
  const cleanT = (spec.title || "").replace(/\*\*/g, "");
  const isLatin = /^[\x00-\x7F\u2013\u2014\u2018\u2019\u201C\u201D\u00B7]*$/.test(cleanT);
  const disp = isLatin ? "'Liberation Sans','DejaVu Sans',Arial,sans-serif" : DISPLAY[(pi + ti) % DISPLAY.length];
  const wt = isLatin ? "900" : "normal";
  const kicker = esc(spec.kicker || "");
  const brand = esc(spec.brand || "");
  const hook = esc(spec.hook || "");
  const title = titleHtml(spec.title || "");
  const shadow = "0 3px 22px rgba(0,0,0,.35)";
  const common = `
   em{font-style:normal;color:${P.accent}}
   .brand{position:absolute;bottom:44px;left:80px;font:900 26px 'Noto Sans KR','Liberation Sans','DejaVu Sans',sans-serif;letter-spacing:1px;opacity:.9}
   .kick{display:inline-block;font:900 26px 'Noto Sans KR','Liberation Sans','DejaVu Sans',sans-serif;color:#111;background:${P.accent};padding:8px 18px;border-radius:999px;letter-spacing:1px}
   .hook{display:inline-block;font:${wt} 64px ${disp},'Noto Sans KR';color:#111;background:${P.accent};padding:6px 28px;border-radius:18px;box-shadow:${shadow};line-height:1.15}
   ${deco(P)}`;

  let layout, inner;
  if (ti === 0) {
    const FS = fontFor(spec.title, 980);
    layout = `${common}
     .wrap{position:absolute;left:80px;top:74px;right:80px}
     h1{font:${wt} ${FS}px ${disp},'Noto Sans KR';line-height:1.18;letter-spacing:-1px;text-shadow:${shadow};margin-top:26px}
     .hk{position:absolute;right:80px;bottom:44px}`;
    inner = `<div class="c1"></div><div class="c2"></div><div class="wrap"><span class="kick">${kicker}</span><h1>${title}</h1></div>${hook?`<div class="hk"><span class="hook">${hook}</span></div>`:""}<div class="brand">${brand}</div>`;
  } else if (ti === 1) {
    const FS = fontFor(spec.title, 640);
    const bigPx = hook.length<=4?150:hook.length<=6?110:76;
    layout = `${common}
     .grid{position:absolute;inset:0;display:grid;grid-template-columns:62% 38%}
     .l{padding:70px 40px 70px 80px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
     h1{font:${wt} ${FS}px ${disp},'Noto Sans KR';line-height:1.18;letter-spacing:-1px;text-shadow:${shadow};margin-top:22px}
     .r{display:flex;align-items:center;justify-content:center;padding:40px 60px 40px 10px}
     .big{font:${wt} ${bigPx}px ${disp},'Noto Sans KR';color:${P.accent};text-shadow:${shadow};text-align:center;line-height:1.05;transform:rotate(-4deg)}`;
    inner = `<div class="c1"></div><div class="c2"></div><div class="grid"><div class="l"><span class="kick">${kicker}</span><h1>${title}</h1></div><div class="r">${hook?`<div class="big">${hook}</div>`:""}</div></div><div class="brand">${brand}</div>`;
  } else if (ti === 2) {
    const FS = fontFor(spec.title, 1000);
    layout = `${common}
     .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px 80px}
     h1{font:${wt} ${FS}px ${disp},'Noto Sans KR';line-height:1.16;letter-spacing:-1px;text-shadow:${shadow};margin:26px 0}
     .brand{left:0;right:0;text-align:center}`;
    inner = `<div class="c1"></div><div class="c2"></div><div class="stripe"></div><div class="stripe2"></div><div class="wrap"><span class="kick">${kicker}</span><h1>${title}</h1>${hook?`<span class="hook">${hook}</span>`:""}</div><div class="brand">${brand}</div>`;
  } else {
    const FS = fontFor(spec.title, 900);
    layout = `${common}
     .card{position:absolute;left:64px;top:64px;right:64px;bottom:64px;background:rgba(0,0,0,.28);border:2px solid rgba(255,255,255,.14);border-radius:28px;padding:56px 64px 56px 80px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
     .card:before{content:"";position:absolute;left:0;top:64px;bottom:64px;width:14px;background:${P.accent};border-radius:0 8px 8px 0}
     h1{font:${wt} ${FS}px ${disp},'Noto Sans KR';line-height:1.18;letter-spacing:-1px;text-shadow:${shadow};margin-top:22px}
     .hk{margin-top:30px}
     .brand{left:auto;right:100px;bottom:92px}`;
    inner = `<div class="c1"></div><div class="c2"></div><div class="card"><span class="kick">${kicker}</span><h1>${title}</h1>${hook?`<div class="hk"><span class="hook">${hook}</span></div>`:""}</div><div class="brand">${brand}</div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><link href="${GF}" rel="stylesheet">
  <style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:${w}px;height:${h}px;overflow:hidden}
  body{position:relative;background:${P.bg};color:${P.fg};font-family:'Noto Sans KR',sans-serif;-webkit-font-smoothing:antialiased}
  ${layout}</style></head><body>${inner}</body></html>`;
}

(async () => {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));
  const w = spec.w || 1200, h = spec.h || 630;
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.setContent(buildHtml(spec), { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: spec.out });
  await b.close();
  console.log("OK " + spec.out);
})().catch(e => { console.error("ERR " + e.message); process.exit(1); });
