const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const body = fs.readFileSync(process.argv[2], 'utf-8');
const title = process.argv[3] || '';
const out = process.argv[4];
const doc = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
<style>
 body{margin:0;background:#eceff1;font-family:'Noto Sans KR',sans-serif}
 .page{max-width:760px;margin:0 auto;background:#fff;padding:40px 44px 56px}
 h1.post{font-size:34px;line-height:1.3;margin:0 0 8px;color:#191919}
 .meta{color:#8a8f98;font-size:15px;border-bottom:1px solid #eee;padding-bottom:18px;margin-bottom:24px}
 .post-body{font-size:18px;line-height:1.85;color:#242830}
 .post-body h2{font-size:25px;margin:34px 0 12px;color:#141414}
 .post-body h3{font-size:20px;margin:22px 0 8px;color:#1f1f1f}
 .post-body p{margin:0 0 16px}
 .post-body img{border-radius:8px}
 .post-body table{font-size:15.5px}
</style></head><body><div class="page">
 <h1 class="post">${title}</h1>
 <div class="meta">골든포레스트 · 2026. 8. 22. · 초안(미리보기)</div>
 <div class="post-body">${body}</div>
</div></body></html>`;
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args:['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 800, height: 1200 }, deviceScaleFactor: 1 });
  await p.setContent(doc, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(700);
  await p.screenshot({ path: out, fullPage: true });
  await b.close();
  console.log("OK " + out);
})().catch(e => { console.error("ERR " + e.message); process.exit(1); });
