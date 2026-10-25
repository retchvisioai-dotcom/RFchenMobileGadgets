const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SITE = path.join(__dirname, '..'), PORT = 8791, BASE = 'http://localhost:' + PORT;
const mime = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml' };
const srv = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p==='/') p='/index.html'; if(!path.extname(p)) p+='.html';
  const f = path.join(SITE,p); if(!fs.existsSync(f)){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'text/plain'}); fs.createReadStream(f).pipe(s); });
let fails = 0; const ok = (c, m) => { console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
(async () => {
  await new Promise(r => srv.listen(PORT, r));
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost') return route.continue();
    if (u.hostname.endsWith('supabase.co')) {
      const rq = route.request(); const h = { ...rq.headers() }; delete h.host; delete h['content-length'];
      const r = await fetch(rq.url(), { method: rq.method(), headers: h, body: ['GET','HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
      const rh = {}; r.headers.forEach((v,k)=>{ if(!['content-encoding','content-length','transfer-encoding','connection'].includes(k)) rh[k]=v; });
      rh['access-control-allow-origin']='*'; rh['access-control-allow-headers']='*'; rh['access-control-allow-methods']='*';
      return route.fulfill({ status: r.status, headers: rh, body: Buffer.from(await r.arrayBuffer()) });
    }
    return route.abort();
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  await page.waitForSelector('#grid .card', { timeout: 30000 });
  ok(await page.locator('#grid .card').count() === 24, '24 sample cards load');
  ok(await page.locator('.tag.s').first().innerText() === 'SAMPLE', 'SAMPLE badge visible');
  ok(await page.locator('#promo').isHidden(), 'no promo while disabled');
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal scroll at 390px');
  await page.selectOption('#branch', { label: 'Silay' });
  ok(await page.locator('#grid .card').count() === 5, 'Silay filter -> 5');
  await page.selectOption('#branch', '');
  await page.click('.chip[data-c=iphone]');
  const n = await page.locator('#grid .card').count(); ok(n === 9, 'iPhone filter -> '+n);
  await page.selectOption('#sort', 'asc');
  const prices = (await page.locator('.price').allInnerTexts()).map(t => +t.replace(/[^\d]/g,''));
  ok(prices.every((p,i)=>i===0||p>=prices[i-1]), 'price ascending');
  await page.fill('#q', 'iphone 14'); await page.waitForTimeout(400);
  ok(await page.locator('#grid .card').count() === 2, 'search "iphone 14" -> 2');
  await page.fill('#q', 'zzzz'); await page.waitForTimeout(300);
  ok(await page.locator('#empty').isVisible(), 'empty state');
  await page.fill('#q', ''); await page.click('.chip[data-c=""]'); await page.waitForTimeout(300);
  ok(await page.locator('#branchList .box').count() === 7, '7 branches listed');
  ok(await page.locator('#lenders .box').count() === 4, '4 lenders listed');
  // reserve without consent -> friendly error; then bad mobile
  await page.locator('#grid .card .btn').first().click();
  await page.fill('#rname', 'Test'); await page.fill('#rmobile', '09171234567');
  await page.click('#rgo'); await page.waitForTimeout(1200);
  ok(/agreement/i.test(await page.locator('#rerr').innerText()), 'consent required message');
  await page.fill('#rmobile', '123'); await page.check('#rconsent'); await page.click('#rgo'); await page.waitForTimeout(1200);
  ok(/valid PH mobile/i.test(await page.locator('#rerr').innerText()), 'bad mobile message');
  await br.close(); srv.close();
  console.log(fails ? 'FAILED '+fails : 'ALL PASS'); process.exit(fails?1:0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
