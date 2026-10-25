(function () {
  const $ = id => document.getElementById(id);
  const S = { me: null, branches: [], tab: 'overview' };
  const bname = id => (S.branches.find(b => b.id === id) || {}).name || '';
  const say = (t, ok) => { $('msg').className = ok ? 'ok' : 'err'; $('msg').textContent = t || ''; };
  const EXTRA = [[/Enter your PIN/i, 'Your PIN session ended. Please sign in again to enter your PIN.'], [/already in stock/i, 'That IMEI is already in stock.'], [/cannot freeze your own/i, 'You cannot freeze your own account.'], [/too long/i, 'That text is too long.']];
  const msg = e => friendly(e, EXTRA);
  const guard = fn => async (...a) => { say(''); try { await fn(...a); } catch (e) { say(msg(e)); } };
  const inp = (label, value, attrs) => h('label', { style: 'display:block;margin-top:8px;font-weight:600;font-size:14px' }, label, h('input', Object.assign({ type: 'text', value: value == null ? '' : value }, attrs || {})));
  const sel = (label, opts, value) => h('label', { style: 'display:block;margin-top:8px;font-weight:600;font-size:14px' }, label, h('select', null, ...opts.map(o => h('option', { value: o[0], selected: o[0] === value }, o[1]))));
  const val = l => l.querySelector('input,select,textarea');

  // ---------- Overview ----------
  async function overview() {
    const to = new Date(), from = new Date(Date.now() - 29 * 864e5);
    const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    const [sales, pipe] = await Promise.all([api.rpc('mch_sales_summary', { p_from: iso(from), p_to: iso(to) }), api.rpc('mch_pipeline')]);
    const byBranch = {};
    sales.forEach(s => { const b = byBranch[s.branch_id] = byBranch[s.branch_id] || { n: 0, t: 0 }; b.n += Number(s.sales_count); b.t += Number(s.total); });
    const total = Object.values(byBranch).reduce((a, b) => a + b.t, 0);
    const group = k => pipe.filter(p => p.kind === k).map(p => p.label + ': ' + p.n).join(' · ') || 'none';
    $('view').replaceChildren(
      h('div', 'box', h('h3', null, 'Last 30 days'), h('div', 'price', peso(total)), ...Object.keys(byBranch).map(id => h('div', 'meta', bname(id) + ': ' + byBranch[id].n + ' sales, ' + peso(byBranch[id].t))), !sales.length ? h('div', 'meta', 'No sales yet.') : null),
      h('div', { class: 'box', style: 'margin-top:10px' }, h('h3', null, 'Installment applications'), h('div', 'meta', group('application'))),
      h('div', { class: 'box', style: 'margin-top:10px' }, h('h3', null, 'Reservations waiting'), h('div', 'meta', group('reservation'))),
      h('div', { class: 'box', style: 'margin-top:10px' }, h('h3', null, 'Stock'), h('div', 'meta', group('stock'))),
      sales.length ? h('div', { class: 'box', style: 'margin-top:10px' }, h('h3', null, 'By day'), ...sales.slice(0, 40).map(s => h('div', 'meta', s.day + ' · ' + bname(s.branch_id) + ' · ' + s.sales_count + ' sale(s) · ' + peso(s.total)))) : null);
  }

  // ---------- Stock ----------
  async function stock() {
    const open = S.branches.filter(b => b.status === 'open');
    const f = {
      branch: sel('Branch', open.map(b => [b.id, b.name])), cat: sel('Category', [['iphone', 'iPhone'], ['android', 'Android'], ['laptop', 'Laptop'], ['printer', 'Printer'], ['accessory', 'Accessory']]),
      brand: inp('Brand', ''), model: inp('Model', ''), storage: inp('Storage', ''), color: inp('Color', ''), cond: sel('Condition', [['sealed', 'Brand new (sealed)'], ['pre-owned', 'Pre-owned']]),
      bat: inp('Battery % (pre-owned)', '', { inputmode: 'numeric' }), price: inp('Selling price (₱)', '', { inputmode: 'decimal' }), cost: inp('Your cost (₱, private)', '', { inputmode: 'decimal' }), imei: inp('IMEI', '', { inputmode: 'numeric' }), notes: inp('Notes', '')
    };
    const form = h('form', { class: 'box', onsubmit: guard(async e => {
      e.preventDefault();
      const num = x => String(val(x).value).replace(/[^\d.]/g, '');
      await api.rpc('mch_add_unit', { p: { branch_id: val(f.branch).value, category: val(f.cat).value, brand: val(f.brand).value, model: val(f.model).value, storage: val(f.storage).value, color: val(f.color).value, condition: val(f.cond).value, battery_pct: num(f.bat), price: num(f.price), cost: num(f.cost), imei: val(f.imei).value, notes: val(f.notes).value } });
      say('Unit added. It now shows on the storefront.', true); stock();
    }) }, h('h3', null, 'Add a unit'), ...Object.values(f), h('button', { class: 'btn', type: 'submit', style: 'margin-top:10px' }, 'Add to stock'));
    const rows = await api.rpc('mch_owner_units');
    const list = rows.map(u => h('div', 'row', h('div', 'grow', h('b', null, u.brand + ' ' + u.model), u.is_sample ? h('span', 'pill', 'SAMPLE') : null, h('div', 'meta', [u.storage, u.color, bname(u.branch_id), u.status].filter(Boolean).join(' · ')), h('div', 'meta', 'IMEI ' + (u.imei || '-') + ' · cost ' + (u.cost == null ? '-' : peso(u.cost)))),
      h('div', 'price', peso(u.price)),
      h('button', { class: 'btn alt sm', onclick: guard(async () => { const p = prompt('New selling price (₱)', u.price); if (p == null) return; const c = prompt('Your cost (₱)', u.cost == null ? '' : u.cost); await api.rpc('mch_update_unit', { p_id: u.id, p: { price: String(p).replace(/[^\d.]/g, ''), cost: c == null ? undefined : String(c).replace(/[^\d.]/g, '') } }); stock(); }) }, 'Edit price')));
    $('view').replaceChildren(form, h('h3', { style: 'margin-top:14px' }, rows.length + ' units in stock'), ...list);
  }

  // ---------- People ----------
  async function people() {
    const users = await api.rpc('mch_list_users');
    const email = inp('Email', '', { type: 'email', autocomplete: 'off' }), pass = inp('Starting password (min 10 characters)', '', { type: 'text', autocomplete: 'off' }), name = inp('Name', '');
    const role = sel('Role', [['staff', 'Branch staff'], ['reseller', 'Reseller']]), br = sel('Branch (staff only)', S.branches.filter(b => b.status === 'open').map(b => [b.id, b.name]));
    const form = h('form', { class: 'box', onsubmit: guard(async e => {
      e.preventDefault();
      await api.call('/functions/v1/mch-create-user', { method: 'POST', body: JSON.stringify({ email: val(email).value, password: val(pass).value, role: val(role).value, branch_id: val(br).value, display_name: val(name).value }) });
      say('Account created. Give them the email and password in person.', true); people();
    }) }, h('h3', null, 'Create an account'), name, email, pass, role, br, h('button', { class: 'btn', type: 'submit', style: 'margin-top:10px' }, 'Create'));
    const list = users.map(u => h('div', 'row', h('div', 'grow', h('b', null, u.display_name || u.email), h('span', 'pill', u.role + (u.frozen ? ' · FROZEN' : '')), h('div', 'meta', u.email + (u.branch_id ? ' · ' + bname(u.branch_id) : ''))),
      u.user_id === auth.user().id ? null : h('button', { class: 'btn alt sm', onclick: guard(async () => { await api.rpc('mch_freeze_user', { p_user: u.user_id, p_frozen: !u.frozen }); people(); }) }, u.frozen ? 'Unfreeze' : 'Freeze')));
    $('view').replaceChildren(form, h('h3', { style: 'margin-top:14px' }, 'Accounts'), ...list);
  }

  // ---------- Settings ----------
  async function settings() {
    const st = await api.getSettings();
    const promoOn = h('input', { type: 'checkbox', checked: st.promo_enabled });
    const fields = { promo_line: inp('Promo line (shown at the top of the storefront)', st.promo_line, { maxlength: 160 }), tagline: inp('Tagline', st.tagline), slogan: inp('Slogan', st.slogan), contact_phone: inp('Phone', st.contact_phone), whatsapp: inp('WhatsApp', st.whatsapp), contact_email: inp('Email', st.contact_email), facebook_url: inp('Facebook page link', st.facebook_url), tiktok_url: inp('TikTok link', st.tiktok_url) };
    const main = h('form', { class: 'box', onsubmit: guard(async e => {
      e.preventDefault();
      const p = { promo_enabled: promoOn.checked }; Object.keys(fields).forEach(k => { p[k] = val(fields[k]).value; });
      await api.rpc('mch_save_settings', { p }); say('Saved.', true);
    }) }, h('h3', null, 'Storefront'), h('label', 'chk', promoOn, h('span', null, 'Show the promo line. Only turn this on for offers MC really honors (for example approval or downpayment claims).')), ...Object.values(fields), h('button', { class: 'btn', type: 'submit', style: 'margin-top:10px' }, 'Save'));

    const branches = await api.listBranches(); S.branches = branches;
    const bform = b => {
      const f = { name: inp('Name', b.name), address: inp('Address', b.address), hours: inp('Hours', b.hours), maps_url: inp('Google Maps link', b.maps_url || ''), phone: inp('Phone', b.phone || ''), status: sel('Status', [['open', 'Open'], ['coming_soon', 'Coming soon']], b.status) };
      const conf = h('input', { type: 'checkbox', checked: b.address_confirmed });
      return h('form', { class: 'box', style: 'margin-bottom:10px', onsubmit: guard(async e => {
        e.preventDefault();
        const p = {}; Object.keys(f).forEach(k => { p[k] = val(f[k]).value; }); p.address_confirmed = conf.checked;
        await api.rpc('mch_save_branch', { p_id: b.id, p }); say('Branch saved.', true);
      }) }, ...Object.values(f), h('label', 'chk', conf, h('span', null, 'Address is confirmed')), h('button', { class: 'btn sm', type: 'submit' }, 'Save branch'));
    };
    const lenders = await api.listLenders();
    const lform = l => {
      const f = { name: inp('Lender', l.name), requirements: inp('Requirements', l.requirements) };
      return h('form', { class: 'box', style: 'margin-bottom:10px', onsubmit: guard(async e => { e.preventDefault(); await api.rpc('mch_save_lender', { p_id: l.id, p: { name: val(f.name).value, requirements: val(f.requirements).value } }); say('Lender saved.', true); }) },
        ...Object.values(f), h('button', { class: 'btn sm', type: 'submit', style: 'margin-top:8px' }, 'Save lender'));
    };
    const addB = h('button', { class: 'btn alt', onclick: guard(async () => { await api.rpc('mch_save_branch', { p_id: null, p: { name: 'New branch', status: 'coming_soon' } }); settings(); }) }, '+ Add branch');
    const addL = h('button', { class: 'btn alt', onclick: guard(async () => { await api.rpc('mch_save_lender', { p_id: null, p: { name: 'New lender' } }); settings(); }) }, '+ Add lender');
    const clean = h('button', { class: 'btn alt', onclick: guard(async () => { const r = await api.call('/functions/v1/mch-purge-ids', { method: 'POST', body: '{}' }); say('Cleanup done. Old IDs removed: ' + r.expired + ', unused uploads removed: ' + r.orphans, true); }) }, 'Delete old ID photos now');
    const pw = h('button', { class: 'btn alt', onclick: guard(async () => { const o = prompt('Current PIN'); if (o == null) return; const n = prompt('New 6-digit PIN'); if (n == null) return; const r = await api.rpc('mch_set_pin', { p_old: o, p_new: n }); say(r === 'ok' ? 'PIN changed.' : 'Wrong PIN or locked. Try again later.', r === 'ok'); }) }, 'Change PIN');
    $('view').replaceChildren(main, h('h3', { style: 'margin-top:14px' }, 'Branches'), ...branches.map(bform), addB, h('h3', { style: 'margin-top:14px' }, 'Installment lenders'), ...lenders.map(lform), addL,
      h('h3', { style: 'margin-top:14px' }, 'Privacy & security'), h('p', 'meta', 'IDs of declined or withdrawn applications are deleted 30 days after the decision. This also runs automatically each time you open the Vault.'), h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, clean, pw));
  }

  const TABS = { overview, stock, people, settings };
  async function show(t) {
    S.tab = t; say('');
    document.querySelectorAll('#tabs .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === t ? 'true' : 'false'));
    try { await auth.ensure(); await TABS[t](); } catch (e) { say(msg(e)); }
  }

  // ---------- Entry: sign in -> PIN -> tabs ----------
  function pinScreen(state) {
    $('login').hidden = true; $('app').hidden = true; $('pinbox').hidden = false; $('perr').textContent = ''; $('pin').value = ''; $('pin2').value = '';
    $('pin2wrap').hidden = state !== 'unset';
    $('pintitle').textContent = state === 'unset' ? 'Create your PIN' : 'Enter your PIN';
    $('pinhelp').textContent = state === 'unset' ? 'Choose a 6-digit PIN. You will need it every time you open the Vault. Do not share it.' : state === 'locked' ? 'Too many wrong tries. Please wait 15 minutes.' : 'Your PIN protects prices, costs, staff and settings.';
    $('pgo').disabled = state === 'locked';
    S.pinState = state; $('pin').focus();
  }
  async function enter() {
    const u = auth.user();
    const p = await api.call('/rest/v1/mch_profiles?select=*&user_id=eq.' + u.id).then(r => r[0]);
    if (!p || p.frozen || p.role !== 'owner') { auth.logout(); $('lerr').textContent = 'This account is not the owner account.'; $('login').hidden = false; return; }
    S.me = p; S.branches = await api.listBranches();
    $('who').textContent = (p.display_name || u.email) + ' · Owner';
    $('out').hidden = false;
    const st = await api.rpc('mch_pin_state');
    if (st === 'unlocked') return start();
    pinScreen(st === 'needs_pin' ? 'needs_pin' : st);
  }
  function start() {
    $('login').hidden = true; $('pinbox').hidden = true; $('app').hidden = false;
    api.call('/functions/v1/mch-purge-ids', { method: 'POST', body: '{}' }).catch(() => { /* cleanup is best-effort */ });
    show('overview');
  }
  $('pinbox').addEventListener('submit', async e => {
    e.preventDefault(); $('perr').textContent = ''; $('pgo').disabled = true;
    try {
      const pin = $('pin').value;
      if (!/^\d{6}$/.test(pin)) throw new Error('PIN must be 6 digits');
      if (S.pinState === 'unset') {
        if (pin !== $('pin2').value) throw new Error('The two PINs do not match');
        await api.rpc('mch_set_pin', { p_old: null, p_new: pin });
      }
      const r = await api.rpc('mch_unlock', { p_pin: pin });
      if (r === 'ok') return start();
      $('perr').textContent = r === 'locked' ? 'Too many wrong tries. Please wait 15 minutes.' : 'Wrong PIN.';
      if (r === 'locked') return pinScreen('locked');
    } catch (er) { $('perr').textContent = /6 digits|match/.test(er.message) ? er.message : msg(er); }
    $('pgo').disabled = false;
  });
  $('login').addEventListener('submit', async e => {
    e.preventDefault(); $('lerr').textContent = ''; $('lgo').disabled = true;
    try { await auth.login($('em').value.trim(), $('pw').value); $('pw').value = ''; await enter(); } catch (er) { $('lerr').textContent = msg(er); }
    $('lgo').disabled = false;
  });
  $('out').addEventListener('click', () => { auth.logout(); location.reload(); });
  $('tabs').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) show(b.dataset.t); });
  auth.restore().then(s => { if (s) enter().catch(() => auth.logout()); });
})();
