(function () {
  const $ = id => document.getElementById(id);
  const S = { me: null, branches: [], tab: 'stock', q: '' };
  const bname = id => (S.branches.find(b => b.id === id) || {}).name || '';
  const say = (t, ok) => { $('msg').className = ok ? 'ok' : 'err'; $('msg').textContent = t || ''; };
  const guard = fn => async (...a) => { say(''); try { await fn(...a); } catch (e) { say(friendly(e)); if (e.status === 401) location.reload(); } };

  function dialog(title, bodyNodes) {
    const d = $('dlg');
    d.replaceChildren(h('h2', null, title), ...bodyNodes, h('div', { style: 'margin-top:10px' }, h('button', { class: 'btn alt', type: 'button', onclick: () => d.close() }, 'Close')));
    if (!d.open) d.showModal();
    return d;
  }
  const field = (label, input) => h('label', { style: 'display:block;margin-top:8px;font-weight:600;font-size:14px' }, label, input);

  // ---------- Stock & sell ----------
  async function stock() {
    const v = $('view');
    const search = h('input', { type: 'search', placeholder: 'IMEI or model', value: S.q, 'aria-label': 'Search stock' });
    const list = h('div');
    async function load() {
      S.q = search.value.trim();
      const looksImei = /^\d{8,}$/.test(S.q);
      const rows = await api.rpc('mch_pos_units', looksImei ? { p_imei: S.q } : {});
      const f = looksImei ? rows : rows.filter(u => (u.brand + ' ' + u.model + ' ' + (u.imei || '')).toLowerCase().includes(S.q.toLowerCase()));
      list.replaceChildren(...(f.length ? f.map(unitRow) : [h('div', 'empty', 'No units found.')]));
    }
    const scan = h('button', { class: 'btn alt', type: 'button', onclick: guard(scanDialog(s => { search.value = s; load(); })) }, 'Scan IMEI');
    search.addEventListener('input', guard(() => { clearTimeout(search._t); search._t = setTimeout(guard(load), 250); }));
    v.replaceChildren(h('div', { style: 'display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:10px' }, search, scan), list);
    await load();
  }
  function unitRow(u) {
    return h('div', 'row',
      h('div', 'grow', h('b', null, u.brand + ' ' + u.model), u.is_sample ? h('span', 'pill', 'SAMPLE') : null,
        h('div', 'meta', [u.storage, u.color, u.condition === 'sealed' ? 'Brand new' : 'Pre-owned' + (u.battery_pct ? ' ' + u.battery_pct + '%' : '')].filter(Boolean).join(' · ')),
        h('div', 'meta', 'IMEI ' + (u.imei || '-') + ' · ' + bname(u.branch_id) + ' · ' + u.status)),
      h('div', { class: 'price' }, peso(u.price)),
      h('div', 'acts', u.status === 'transfer' ? h('span', 'pill', 'In transfer') : [
        h('button', { class: 'btn sm', onclick: () => sellDialog(u) }, 'Sell'),
        h('button', { class: 'btn alt sm', onclick: () => transferDialog(u) }, 'Transfer')]));
  }
  function sellDialog(u) {
    const price = h('input', { type: 'text', inputmode: 'decimal', value: u.price });
    const method = h('select', null, ...['cash', 'gcash', 'card', 'installment'].map(m => h('option', { value: m }, m === 'gcash' ? 'GCash' : m[0].toUpperCase() + m.slice(1))));
    const name = h('input', { type: 'text', autocomplete: 'off' }), mobile = h('input', { type: 'tel', inputmode: 'tel' });
    const consent = h('input', { type: 'checkbox' });
    const err = h('div', 'err'); const go = h('button', { class: 'btn', type: 'button' }, 'Complete sale');
    go.addEventListener('click', async () => {
      err.textContent = ''; go.disabled = true;
      try {
        const p = Number(String(price.value).replace(/[^\d.]/g, ''));
        await api.rpc('mch_record_sale', { p_unit: u.id, p_method: method.value, p_price: p, p_name: name.value, p_mobile: mobile.value, p_release_consent: consent.checked });
        receipt(u, p, method.value, name.value); stock();
      } catch (e) { err.textContent = friendly(e); go.disabled = false; }
    });
    dialog('Sell ' + u.brand + ' ' + u.model, [h('div', 'meta', 'IMEI ' + (u.imei || '-')), field('Price (₱)', price), field('Payment', method), field('Customer name (optional)', name), field('Customer mobile (optional)', mobile),
      h('label', 'chk', consent, h('span', null, 'Customer agrees to appear on the "Released today" wall (first initial and unit only).')), err, go]);
  }
  function receipt(u, price, method, name) {
    const d = $('dlg');
    d.replaceChildren(h('div', { id: 'receipt' }, h('h2', null, 'MC GADGETS'), h('div', null, new Date().toLocaleString('en-PH')), h('div', null, bname(u.branch_id)),
      h('hr'), h('div', null, u.brand + ' ' + u.model + (u.storage ? ' ' + u.storage : '')), h('div', null, 'IMEI ' + (u.imei || '-')), h('div', null, 'Paid by: ' + method), h('b', null, 'Total ' + peso(price)),
      name ? h('div', null, 'Customer: ' + name) : null, h('p', 'meta', '30-day warranty from today. Keep this receipt.')),
      h('div', { style: 'margin-top:10px;display:flex;gap:8px' }, h('button', { class: 'btn', onclick: () => window.print() }, 'Print'), h('button', { class: 'btn alt', onclick: () => d.close() }, 'Done')));
    if (!d.open) d.showModal();
  }
  function transferDialog(u) {
    const sel = h('select', null, ...S.branches.filter(b => b.status === 'open' && b.id !== u.branch_id).map(b => h('option', { value: b.id }, b.name)));
    const err = h('div', 'err'); const go = h('button', { class: 'btn', type: 'button' }, 'Send to branch');
    go.addEventListener('click', async () => { try { await api.rpc('mch_request_transfer', { p_unit: u.id, p_to: sel.value }); $('dlg').close(); stock(); say('Transfer started. The other branch must confirm receipt.', true); } catch (e) { err.textContent = friendly(e); } });
    dialog('Transfer ' + u.brand + ' ' + u.model, [field('Destination', sel), err, go]);
  }
  // Camera barcode scan with typed fallback
  function scanDialog(onCode) {
    return async () => {
      const box = h('div', { id: 'reader' }); const err = h('div', 'err');
      const d = dialog('Scan IMEI barcode', [box, err, h('p', 'meta', 'Point the camera at the barcode on the phone box. Or close this and type the IMEI.')]);
      let sc = null;
      const stop = async () => { try { if (sc) { await sc.stop(); sc.clear(); } } catch (e) { /* already stopped */ } sc = null; };
      d.addEventListener('close', stop, { once: true });
      try {
        sc = new Html5Qrcode('reader');
        await sc.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 120 } }, async txt => { const c = txt.replace(/\D/g, ''); if (c.length >= 8) { await stop(); d.close(); onCode(c); } });
      } catch (e) { err.textContent = 'Camera not available. Please type the IMEI instead.'; }
    };
  }

  // ---------- Applications ----------
  async function apps() {
    const rows = await api.call('/rest/v1/mch_applications?select=*,mch_lenders(name),mch_units(brand,model)&order=created_at.desc&limit=100');
    const set = (a, st) => guard(async () => {
      let notes = null;
      if (st === 'declined') notes = prompt('Reason (optional)') || null;
      await api.rpc('mch_set_application_status', { p_id: a.id, p_status: st, p_notes: notes }); apps();
    });
    const viewId = a => guard(async () => { const link = await auth.signedIdUrl(a.id_path); window.open(link, '_blank', 'noopener'); });
    $('view').replaceChildren(...(rows.length ? rows.map(a => h('div', 'row',
      h('div', 'grow', h('b', null, a.name), h('span', 'pill', a.status),
        h('div', 'meta', a.mch_units ? a.mch_units.brand + ' ' + a.mch_units.model : ''), h('div', 'meta', (a.mch_lenders ? a.mch_lenders.name : '') + ' · ' + a.income_source),
        h('div', 'meta', bname(a.branch_id) + ' · ' + new Date(a.created_at).toLocaleDateString('en-PH')), a.notes ? h('div', 'meta', 'Note: ' + a.notes) : null,
        h('a', { href: 'tel:' + a.mobile }, a.mobile)),
      h('div', 'acts', h('button', { class: 'btn alt sm', onclick: viewId(a) }, 'View ID'), h('button', { class: 'btn alt sm', onclick: set(a, 'reviewing') }, 'Reviewing'),
        h('button', { class: 'btn sm', onclick: set(a, 'approved') }, 'Approved'), h('button', { class: 'btn alt sm', onclick: set(a, 'declined') }, 'Declined')))) : [h('div', 'empty', 'No applications yet.')]));
  }

  // ---------- Repairs ----------
  async function repairs() {
    const device = h('input', { type: 'text', placeholder: 'Device, e.g. iPhone 11' }), issue = h('input', { type: 'text', placeholder: 'Issue' }), name = h('input', { type: 'text', placeholder: 'Customer name' }), mobile = h('input', { type: 'tel', placeholder: 'Mobile' });
    const out = h('div', 'ok');
    const form = h('form', { class: 'box', onsubmit: guard(async e => { e.preventDefault(); const c = await api.rpc('mch_log_repair', { p_device: device.value, p_issue: issue.value, p_name: name.value, p_mobile: mobile.value }); out.textContent = 'Repair logged. Give the customer this code: ' + c; repairs(); }) },
      h('h3', null, 'Log a repair'), device, issue, name, mobile, h('button', { class: 'btn', type: 'submit', style: 'margin-top:8px' }, 'Save'), out);
    const rows = await api.call('/rest/v1/mch_repairs?select=*&order=updated_at.desc&limit=100');
    const ST = ['received', 'diagnosing', 'repairing', 'ready', 'picked_up'];
    $('view').replaceChildren(form, h('div', { style: 'margin-top:12px' }, ...rows.map(r => h('div', 'row',
      h('div', 'grow', h('b', null, r.code + ' · ' + r.device), h('div', 'meta', r.issue), h('div', 'meta', [r.customer_name, r.customer_mobile, bname(r.branch_id)].filter(Boolean).join(' · '))),
      h('select', { onchange: guard(async e => { await api.rpc('mch_set_repair_status', { p_id: r.id, p_status: e.target.value }); }) }, ...ST.map(s => h('option', { value: s, selected: s === r.status }, s.replace('_', ' '))))))));
  }

  // ---------- Transfers ----------
  async function transfers() {
    const rows = await api.call('/rest/v1/mch_transfers?select=*,mch_units(brand,model)&order=created_at.desc&limit=100');
    $('view').replaceChildren(...(rows.length ? rows.map(t => h('div', 'row',
      h('div', 'grow', h('b', null, t.mch_units ? t.mch_units.brand + ' ' + t.mch_units.model : 'Unit'), h('div', 'meta', bname(t.from_branch) + ' → ' + bname(t.to_branch)), h('span', 'pill', t.status.replace('_', ' '))),
      t.status === 'in_transit' && (S.me.role === 'owner' || S.me.branch_id === t.to_branch) ? h('button', { class: 'btn sm', onclick: guard(async () => { await api.rpc('mch_receive_transfer', { p_id: t.id }); transfers(); }) }, 'Received') : null)) : [h('div', 'empty', 'No transfers.')]));
  }

  const TABS = { stock, apps, repairs, transfers };
  async function show(t) {
    S.tab = t; say('');
    document.querySelectorAll('#tabs .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === t ? 'true' : 'false'));
    try { await auth.ensure(); await TABS[t](); } catch (e) { say(friendly(e)); }
  }

  async function enter() {
    const u = auth.user();
    const p = await api.call('/rest/v1/mch_profiles?select=*&user_id=eq.' + u.id).then(r => r[0]);
    if (!p || p.frozen || !['staff', 'owner'].includes(p.role)) { auth.logout(); $('lerr').textContent = 'This account has no access to the MC POS.'; $('login').hidden = false; return; }
    S.me = p; S.branches = await api.listBranches();
    $('who').textContent = (p.display_name || u.email) + ' · ' + (p.role === 'owner' ? 'Owner' : bname(p.branch_id));
    $('login').hidden = true; $('app').hidden = false; $('out').hidden = false;
    show('stock');
  }

  $('login').addEventListener('submit', async e => {
    e.preventDefault(); $('lerr').textContent = ''; $('lgo').disabled = true;
    try { await auth.login($('em').value.trim(), $('pw').value); $('pw').value = ''; await enter(); } catch (er) { $('lerr').textContent = friendly(er); }
    $('lgo').disabled = false;
  });
  $('out').addEventListener('click', () => { auth.logout(); location.reload(); });
  $('tabs').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) show(b.dataset.t); });
  auth.restore().then(s => { if (s) enter().catch(() => { auth.logout(); }); });
})();
