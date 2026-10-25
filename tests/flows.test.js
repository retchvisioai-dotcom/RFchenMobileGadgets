// Browser tests for the apply form and the staff POS. Auth/upload/sale endpoints are mocked so no real accounts or files are created.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SITE = path.join(__dirname, '..'), PORT = 8792, BASE = 'http://localhost:' + PORT;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!path.extname(p)) p += '.html';
  const f = path.join(SITE, p); if (!fs.existsSync(f)) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': mime[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(s); });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const J = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
(async () => {
  await new Promise(r => srv.listen(PORT, r));
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 800 } });
  const calls = [];
  let unitId = null;
  await ctx.route('**/*', async route => {
    const rq = route.request(), u = new URL(rq.url());
    if (u.hostname === 'localhost') return route.continue();
    if (!u.hostname.endsWith('supabase.co')) return route.abort();
    if (rq.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const p = u.pathname; calls.push(rq.method() + ' ' + p);
    if (p.startsWith('/auth/v1/token')) {
      const b = JSON.parse(rq.postData() || '{}');
      if (b.password !== 'good-password-1') return J(route, { error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
      return J(route, { access_token: 'tok', refresh_token: 'ref', expires_in: 3600, user: { id: 'u-1', email: 'staff@x.test' } });
    }
    if (p === '/rest/v1/mch_profiles') return J(route, [{ user_id: 'u-1', role: 'staff', branch_id: 'B1', display_name: 'Silay Staff', frozen: false }]);
    if (p === '/rest/v1/mch_branches') return J(route, [{ id: 'B1', name: 'Silay', status: 'open' }, { id: 'B2', name: 'Kabankalan', status: 'open' }]);
    if (p === '/rest/v1/rpc/mch_pos_units') return J(route, [{ id: 'U1', branch_id: 'B1', brand: 'Apple', model: 'iPhone 16', storage: '128GB', color: 'Black', condition: 'sealed', price: 50000, imei: '356789012345678', status: 'available', is_sample: true }]);
    if (p === '/rest/v1/rpc/mch_record_sale') return J(route, 'sale-1');
    if (p.startsWith('/storage/v1/object/mch-ids/id/')) return J(route, { Key: 'x' });
    if (p === '/rest/v1/rpc/mch_submit_application') return J(route, 'app-1');
    // everything else (units, lenders, settings) goes to the real database
    const h = { ...rq.headers() }; delete h.host; delete h['content-length'];
    const r = await fetch(rq.url(), { method: rq.method(), headers: h, body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
    const rh = {}; r.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k)) rh[k] = v; });
    rh['access-control-allow-origin'] = '*';
    return route.fulfill({ status: r.status, headers: rh, body: Buffer.from(await r.arrayBuffer()) });
  });
  const page = await ctx.newPage();

  // ---- Apply form ----
  await page.goto(BASE + '/');
  await page.waitForSelector('#grid .card');
  const href = await page.locator('a:has-text("Apply for installment")').first().getAttribute('href');
  ok(/^apply\.html\?unit=/.test(href), 'storefront links to apply form');
  await page.goto(BASE + '/' + href);
  await page.waitForSelector('#f:not([hidden])');
  ok((await page.locator('#lender option').count()) === 4, 'lenders listed');
  ok(/not guaranteed/i.test(await page.locator('#f').innerText()), 'says approval not guaranteed');
  await page.fill('#name', 'Ana Reyes'); await page.fill('#mobile', '09171234567'); await page.fill('#income', 'Employed');
  await page.setInputFiles('#idfile', { name: 'id.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71]) });
  await page.click('#go'); await page.waitForTimeout(500);
  ok(/agreement/i.test(await page.locator('#err').innerText()), 'blocks without consent');
  await page.check('#consent'); await page.click('#go'); await page.waitForSelector('#done:not([hidden])');
  ok(calls.some(c => c.startsWith('POST /storage/v1/object/mch-ids/id/')) && calls.includes('POST /rest/v1/rpc/mch_submit_application'), 'uploads ID then submits');
  await page.goto(BASE + '/' + href);
  await page.waitForSelector('#f:not([hidden])');
  await page.setInputFiles('#idfile', { name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(6 * 1024 * 1024) });
  await page.fill('#name', 'Ana Reyes'); await page.fill('#mobile', '09171234567'); await page.fill('#income', 'Employed'); await page.check('#consent');
  await page.click('#go'); await page.waitForTimeout(500);
  ok(/too large/i.test(await page.locator('#err').innerText()), 'rejects >5MB photo in browser');

  // ---- Warranty/repair page ----
  await page.goto(BASE + '/check');
  await page.fill('#imei', '000000000000000'); await page.click('#wf button'); await page.waitForTimeout(1200);
  ok(/No warranty found/.test(await page.locator('#wr').innerText()), 'warranty: unknown IMEI handled');
  await page.fill('#code', 'R-NOPE00'); await page.click('#rf button'); await page.waitForTimeout(1200);
  ok(/No repair found/.test(await page.locator('#rr').innerText()), 'repair: unknown code handled');

  // ---- POS ----
  await page.goto(BASE + '/pos/');
  ok(await page.locator('#app').isHidden(), 'POS hidden before login');
  await page.fill('#em', 'staff@x.test'); await page.fill('#pw', 'wrong'); await page.click('#lgo'); await page.waitForTimeout(500);
  ok(/Wrong email or password/.test(await page.locator('#lerr').innerText()), 'wrong password message');
  await page.fill('#pw', 'good-password-1'); await page.click('#lgo');
  await page.waitForSelector('#view .row');
  ok(/Silay Staff/.test(await page.locator('#who').innerText()), 'shows staff and branch');
  ok(/SAMPLE/.test(await page.locator('#view').innerText()), 'stock row shows SAMPLE');
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'POS: no horizontal scroll');
  await page.getByRole('button', { name: 'Sell', exact: true }).click();
  await page.click('dialog button:has-text("Complete sale")');
  await page.waitForSelector('#receipt');
  ok(/Total ₱50,000/.test(await page.locator('#receipt').innerText()), 'receipt shows total');
  ok(calls.includes('POST /rest/v1/rpc/mch_record_sale'), 'sale RPC called');
  await page.click('dialog button:has-text("Done")');
  await page.click('#tabs [data-t=apps]'); await page.waitForTimeout(800);
  await page.reload(); await page.waitForSelector('#view .row, #app:not([hidden])');
  ok(await page.locator('#app').isVisible(), 'session survives reload (same tab)');
  await page.click('#out'); await page.waitForSelector('#login');
  ok(await page.locator('#login').isVisible() && await page.locator('#app').isHidden(), 'sign out returns to login');
  await br.close(); srv.close();
  console.log(fails ? 'FAILED ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
