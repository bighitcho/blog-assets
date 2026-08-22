/*
 클라우드 한글 썸네일 생성기 — PIL/윈도우폰트 불필요. HTML+구글웹폰트 → 헤드리스 크로미움 캡처.
 사용: node cloud_thumb.cjs spec.json
 spec.json = {
   "out": "/abs/path.png", "w":1200, "h":630,
   "kicker":"MYDOOBA · 생활비 리포트", "title":"주유비 절약, 같은 기름인데\n리터당 121원 싼 이유",
   "brand":"mydooba.com", "template": 0~2 (생략시 title 해시로 자동), "palette": 0~5 (생략시 자동)
 }
 매일·매글 다른 디자인: template/palette 를 날짜+제목 기반으로 자동 회전.
*/
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const GF = "https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Gowun+Dodum&family=Do+Hyeon&family=Noto+Sans+KR:wght@400;500;700;900&family=Jua&display=swap";

// 6개 팔레트 (블로그 무드에 무난, 매일 회전)
const PALETTES = [
  { bg: "linear-gradient(135deg,#0f3d3e 0%,#164e4a 55%,#1f6f5c 100%)", fg: "#ffffff", accent: "#ffd166", kicker: "#8fe3c8" },
  { bg: "linear-gradient(135deg,#1a2a6c 0%,#24308a 55%,#3a41b0 100%)", fg: "#ffffff", accent: "#ffd166", kicker: "#a9c0ff" },
  { bg: "linear-gradient(135deg,#3a1c40 0%,#5a2a54 55%,#7d3a63 100%)", fg: "#fff5fb", accent: "#ffcf5c", kicker: "#f2b8dd" },
  { bg: "linear-gradient(135deg,#7a2f1d 0%,#9c3f22 55%,#c25a2a 100%)", fg: "#fff7f0", accent: "#ffe08a", kicker: "#ffc6a3" },
  { bg: "linear-gradient(135deg,#12343b 0%,#1d4e5a 55%,#2e6f7d 100%)", fg: "#f2fbfd", accent: "#ffd166", kicker: "#a6e4ef" },
  { bg: "#f5f2ea", fg: "#20242b", accent: "#e0402b", kicker: "#6b7280", light: true },
];
const DISPLAY = ["'Black Han Sans'", "'Do Hyeon'", "'Jua'"]; // 표시용 굵은 한글 폰트 3종

function pick(spec, key, mod) {
  if (Number.isInteger(spec[key])) return spec[key] % mod;
  const s = (spec.title || "") + (spec.brand || "") + (new Date().toISOString().slice(0,10));
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % mod;
}

function fontFor(rawTitle) {
  // 가장 긴 줄 기준으로 가로 넘침 방지 (가용 폭 ~1030px). 44~84px 사이 자동.
  const lines = (rawTitle || "").split("\n");
  const maxLen = Math.max(1, ...lines.map(l => l.length));
  return Math.max(44, Math.min(84, Math.floor(1030 / maxLen)));
}

function buildHtml(spec) {
  const w = spec.w || 1200, h = spec.h || 630;
  const pi = pick(spec, "palette", PALETTES.length);
  const ti = pick(spec, "template", 3);
  const P = PALETTES[pi];
  const disp = DISPLAY[(pi + ti) % DISPLAY.length];
  const FS = fontFor(spec.title || "");
  const title = (spec.title || "").replace(/\n/g, "<br>");
  const kicker = spec.kicker || "";
  const brand = spec.brand || "";
  const shadow = P.light ? "none" : "0 2px 18px rgba(0,0,0,.25)";

  // 3개 레이아웃
  let layout;
  if (ti === 0) { // editorial: 좌측 정렬, 상단 kicker, 하단 accent bar
    layout = `
     .wrap{padding:84px;display:flex;flex-direction:column;justify-content:center;height:100%}
     .kicker{font:700 30px 'Noto Sans KR';color:${P.kicker};letter-spacing:2px;margin-bottom:26px}
     h1{font:normal ${FS}px ${disp},'Noto Sans KR';line-height:1.2;letter-spacing:-1px;text-shadow:${shadow}}
     .bar{width:130px;height:11px;background:${P.accent};border-radius:6px;margin-top:40px}
     .brand{position:absolute;bottom:56px;right:84px;font:700 26px 'Noto Sans KR';opacity:.85}`;
    return baseDoc(w,h,P,`<div class="wrap"><div class="kicker">${kicker}</div><h1>${title}</h1><div class="bar"></div></div><div class="brand">${brand}</div>`, layout, disp);
  } else if (ti === 1) { // band: 상단 컬러밴드 + 중앙 큰 제목 카드
    layout = `
     .band{height:150px;background:${P.accent};display:flex;align-items:center;padding:0 84px}
     .band .k{font:900 34px 'Noto Sans KR';color:#1b1b1b;letter-spacing:1px}
     .body{flex:1;display:flex;flex-direction:column;justify-content:center;padding:56px 84px}
     h1{font:normal ${FS}px ${disp},'Noto Sans KR';line-height:1.22;letter-spacing:-1px;text-shadow:${shadow}}
     .brand{margin-top:36px;font:700 27px 'Noto Sans KR';color:${P.kicker}}`;
    return baseDoc(w,h,P,`<div style="display:flex;flex-direction:column;height:100%"><div class="band"><div class="k">${kicker}</div></div><div class="body"><h1>${title}</h1><div class="brand">${brand}</div></div></div>`, layout, disp);
  } else { // center: 중앙 정렬 + 위아래 라인
    layout = `
     .wrap{padding:80px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;height:100%}
     .kicker{font:700 28px 'Noto Sans KR';color:${P.kicker};letter-spacing:3px;margin-bottom:30px;
        padding-bottom:16px;border-bottom:4px solid ${P.accent}}
     h1{font:normal ${FS}px ${disp},'Noto Sans KR';line-height:1.2;letter-spacing:-1px;text-shadow:${shadow}}
     .brand{position:absolute;bottom:52px;left:0;right:0;text-align:center;font:700 25px 'Noto Sans KR';opacity:.8}`;
    return baseDoc(w,h,P,`<div class="wrap"><div class="kicker">${kicker}</div><h1>${title}</h1></div><div class="brand">${brand}</div>`, layout, disp);
  }
}

function baseDoc(w,h,P,inner,layout,disp){
  return `<!doctype html><html><head><meta charset="utf-8">
  <link href="${GF}" rel="stylesheet">
  <style>*{margin:0;padding:0;box-sizing:border-box}
   html,body{width:${w}px;height:${h}px;overflow:hidden}
   body{position:relative;background:${P.bg};color:${P.fg};font-family:'Noto Sans KR',sans-serif;-webkit-font-smoothing:antialiased}
   ${layout}</style></head><body>${inner}</body></html>`;
}

(async () => {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));
  const w = spec.w || 1200, h = spec.h || 630;
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.setContent(buildHtml(spec), { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(700);
  await p.screenshot({ path: spec.out });
  await b.close();
  console.log("OK " + spec.out);
})().catch(e => { console.error("ERR " + e.message); process.exit(1); });
