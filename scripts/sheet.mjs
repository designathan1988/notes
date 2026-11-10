// Contact sheet: node scripts/sheet.mjs <out.png> <cols> <cellWidth> <img...>
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import { basename } from 'node:path';
const [out, cols, w, ...imgs] = process.argv.slice(2);
const html = out.replace(/\.png$/, '.html');
writeFileSync(
  html,
  `<body style="margin:8px;background:#888;display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px;font:12px sans-serif">${imgs.map((i) => `<figure style="margin:0"><img src="${pathToFileURL(i)}" style="width:100%;display:block"><figcaption style="color:#fff">${basename(i)}</figcaption></figure>`).join('')}</body>`,
);
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: cols * w + 16, height: 800 } });
await p.goto(pathToFileURL(html).href);
await p.waitForLoadState('networkidle');
await p.screenshot({ path: out, fullPage: true });
await b.close();
