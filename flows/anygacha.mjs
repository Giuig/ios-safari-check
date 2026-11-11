// Flow for a daily-drop page: load, open the drop, turn every item, view one large, share, then the other pages.
// Writes screenshots to out/ and prints a short report. Never point it at a site where opening a drop is permanent.
import { remote } from 'webdriverio';
import { mkdirSync, writeFileSync } from 'node:fs';

const { URL, UDID, DEVICE, IOS } = process.env;
mkdirSync('out', { recursive: true });
const report = [];
const say = (s) => { console.log(s); report.push(s); };

const b = await remote({
  hostname: '127.0.0.1', port: 4723, logLevel: 'warn',
  connectionRetryTimeout: 900000, connectionRetryCount: 0, // the first session builds WebDriverAgent: one long wait, no restarts
  capabilities: {
    platformName: 'iOS', browserName: 'Safari',
    'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:deviceName': DEVICE, 'appium:platformVersion': IOS,
    'appium:showSafariConsoleLog': true, 'appium:safariInitialUrl': 'about:blank',
    'appium:newCommandTimeout': 300, 'appium:wdaLaunchTimeout': 600000, 'appium:wdaConnectionTimeout': 600000,
  },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const shot = async (name) => { const f = `out/${String(++n).padStart(2, '0')}-${name}.png`; await b.saveScreenshot(f); };
const js = (fn, ...a) => b.execute(fn, ...a);
const step = async (name, fn) => { try { const r = await fn(); say(`ok   ${name}${r !== undefined ? ' ' + (typeof r === 'string' ? r : JSON.stringify(r)) : ''}`); } catch (e) { say(`FAIL ${name}: ${String(e.message || e).split('\n')[0]}`); } };
const tap = async (sel) => { const e = await b.$(sel); await e.waitForDisplayed({ timeout: 15000 }); await e.scrollIntoView({ block: 'center' }); await e.click(); };

try {
  await step('load', async () => { await b.url(URL); await (await b.$('#tapopen')).waitForExist({ timeout: 40000 }); await sleep(2000); await shot('home'); });
  await step('env', () => js(() => {
    const c = document.createElement('canvas'); const g = c.getContext('webgl');
    const d = g && g.getExtension('WEBGL_debug_renderer_info');
    const big = document.querySelector('h1'); const cs = big && getComputedStyle(big);
    return { ua: navigator.userAgent.slice(0, 90), vw: innerWidth, dpr: devicePixelRatio, webgl: !!g, gpu: d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : null,
      share: !!navigator.share, canShareFiles: !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.png', { type: 'image/png' })] })), vibrate: !!navigator.vibrate,
      h1Font: cs && cs.fontFamily.slice(0, 40), h1Weight: cs && cs.fontWeight, h1Width: big && Math.round(big.getBoundingClientRect().width),
      fonts: [...document.fonts].filter((f) => /Big/.test(f.family)).map((f) => `${f.weight}:${f.status}`).join(' '), docW: document.documentElement.scrollWidth };
  }));
  await step('open drop', async () => { await tap('#tapopen'); await sleep(3500); await shot('opened'); });
  await step('turn all', async () => { if (await (await b.$('#rest')).isExisting()) await tap('#rest'); else await js(() => document.querySelectorAll('#reveal .item:not(.up)').forEach((x) => x.click())); await sleep(8000); await shot('reveal'); return js(() => document.querySelectorAll('#reveal .item.up').length + ' turned'); });
  await step('large view', async () => {
    await tap('#reveal canvas'); await sleep(3000);
    const r = await js(() => new Promise((res) => { const box = document.querySelector('.lookbox'); let f = 0; const t0 = performance.now(); const k = (t) => { f++; if (t - t0 < 2000) requestAnimationFrame(k); else res({ open: !!box, canvas: !!(box && box.querySelector('canvas')), fps: Math.round(f / 2) }); }; requestAnimationFrame(k); }));
    await shot('large'); if (await (await b.$('.lookclose')).isExisting()) await tap('.lookclose'); await sleep(800); return r;
  });
  await step('share', async () => {
    await js(() => { window.__share = []; const real = navigator.share && navigator.share.bind(navigator); navigator.share = async (d) => { window.__share.push({ files: (d.files || []).map((f) => f.type + ' ' + Math.round(f.size / 1024) + 'KB'), text: (d.text || '').slice(0, 60) }); }; });
    await tap('#shareimg'); await sleep(4000); return js(() => ({ calls: window.__share, msg: (document.querySelector('#msg') || {}).textContent }));
  });
  for (const v of ['binder', 'rarity', 'log']) {
    await step(v, async () => { await js((x) => nav(x), v); await sleep(v === 'binder' ? 6000 : 3000); await js(() => scrollTo(0, 0)); await sleep(500); await shot(v); return js(() => document.documentElement.scrollWidth + '/' + innerWidth); });
  }
  await step('band', async () => { await js(() => nav('open')); await sleep(3000); await js(() => { const e = document.querySelector('.band'); if (e) e.scrollIntoView({ block: 'center' }); }); await sleep(1500); await shot('band'); });
  await step('reload keeps collection', async () => { await b.refresh(); await sleep(6000); return js(() => (window.state ? state.owned.length : 'no state') + ' owned'); });
  try { const logs = await b.getLogs('safariConsole'); const errs = logs.filter((l) => /error|warn/i.test(l.level || '')).map((l) => `${l.level}: ${String(l.message).slice(0, 200)}`); say('console: ' + (errs.length ? '\n  ' + errs.join('\n  ') : 'no errors')); } catch (e) { say('console: not available (' + String(e.message).split('\n')[0] + ')'); }
} finally {
  writeFileSync('out/report.txt', report.join('\n') + '\n');
  await b.deleteSession().catch(() => {});
}
