(function () {
  const $ = id => document.getElementById(id);
  const state = { units: [], branches: [], cat: '', branch: '', q: '', sort: 'new' };
  const peso = n => '₱' + Number(n).toLocaleString('en-PH', { maximumFractionDigits: 0 });
  const ICON = {
    phone: '<rect x="16" y="6" width="32" height="52" rx="6"/><line x1="28" y1="52" x2="36" y2="52"/>',
    laptop: '<rect x="10" y="14" width="44" height="30" rx="3"/><line x1="4" y1="52" x2="60" y2="52"/>',
    printer: '<rect x="14" y="10" width="36" height="14"/><rect x="8" y="24" width="48" height="22" rx="3"/><rect x="18" y="38" width="28" height="16"/>',
    accessory: '<circle cx="32" cy="32" r="18"/><path d="M26 32h12M32 26v12"/>'
  };
  const iconFor = c => ICON[c === 'iphone' || c === 'android' ? 'phone' : c] || ICON.accessory;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function card(u) {
    const b = state.branches.find(x => x.id === u.branch_id);
    const c = el('article', 'card');
    const ph = el('div', 'ph');
    if (u.photo_url) {
      const im = document.createElement('img');
      im.src = u.photo_url; im.alt = u.brand + ' ' + u.model; im.loading = 'lazy';
      ph.appendChild(im);
    } else {
      ph.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true">' + iconFor(u.category) + '</svg>';
    }
    ph.appendChild(el('span', 'tag', u.condition === 'sealed' ? 'Brand new' : 'Pre-owned'));
    if (u.is_sample) ph.appendChild(el('span', 'tag s', 'SAMPLE'));
    c.appendChild(ph);
    const body = el('div', 'body');
    body.appendChild(el('h3', null, u.brand + ' ' + u.model));
    const spec = [u.storage, u.color, u.battery_pct ? 'Battery ' + u.battery_pct + '%' : null].filter(Boolean).join(' · ');
    if (spec) body.appendChild(el('div', 'meta', spec));
    body.appendChild(el('div', 'meta', '📍 ' + (b ? b.name : '')));
    body.appendChild(el('div', 'price', peso(u.price)));
    const btn = el('button', 'btn', u.status === 'available' ? 'Reserve' : 'Reserved');
    btn.type = 'button';
    if (u.status !== 'available') btn.disabled = true;
    else btn.addEventListener('click', () => openReserve(u));
    body.appendChild(btn);
    c.appendChild(body);
    return c;
  }

  function render() {
    let list = state.units.filter(u =>
      (!state.cat || u.category === state.cat) &&
      (!state.branch || u.branch_id === state.branch) &&
      (!state.q || (u.brand + ' ' + u.model + ' ' + (u.storage || '') + ' ' + (u.color || '')).toLowerCase().includes(state.q)));
    if (state.sort === 'asc') list.sort((a, b) => a.price - b.price);
    else if (state.sort === 'desc') list.sort((a, b) => b.price - a.price);
    const g = $('grid');
    g.replaceChildren(...list.map(card));
    $('empty').hidden = list.length > 0;
    $('count').textContent = list.length + ' item' + (list.length === 1 ? '' : 's');
  }

  let current = null;
  function openReserve(u) {
    current = u;
    $('rtitle').textContent = 'Reserve ' + u.brand + ' ' + u.model;
    $('rerr').textContent = '';
    $('rform').classList.remove('done');
    $('rgo').disabled = false;
    $('dlg').showModal();
  }
  const FRIENDLY = [
    [/no longer available/i, 'Sorry, someone just reserved this unit.'],
    [/Invalid mobile/i, 'Please enter a valid PH mobile number, e.g. 0917 123 4567.'],
    [/Consent/i, 'Please tick the agreement box.'],
    [/Too many/i, 'Too many reservations from this number today. Please visit the branch.'],
    [/name/i, 'Please enter your name.']
  ];
  async function submitReserve(e) {
    e.preventDefault();
    $('rerr').textContent = '';
    $('rgo').disabled = true;
    try {
      await api.reserve(current.id, $('rname').value, $('rmobile').value, $('rconsent').checked);
      $('rerr').className = 'ok';
      $('rerr').textContent = 'Reserved! Please visit the branch within 24 hours.';
      load();
    } catch (err) {
      $('rerr').className = 'err';
      const f = FRIENDLY.find(x => x[0].test(err.message));
      $('rerr').textContent = f ? f[1] : 'Something went wrong. Please try again.';
      $('rgo').disabled = false;
    }
  }

  function renderStatic(settings, lenders) {
    if (settings.tagline) $('tagline').textContent = settings.tagline;
    if (settings.slogan) $('slogan').textContent = settings.slogan;
    if (settings.promo_enabled && settings.promo_line) {
      $('promo').textContent = settings.promo_line;
      $('promo').hidden = false;
    }
    const parts = [settings.contact_phone && 'Call ' + settings.contact_phone, settings.whatsapp && 'WhatsApp ' + settings.whatsapp, settings.contact_email];
    $('contact').textContent = parts.filter(Boolean).join(' · ');
    const links = [['Facebook', settings.facebook_url], ['TikTok', settings.tiktok_url]].filter(x => x[1]);
    links.forEach(([n, h]) => {
      const a = el('a', null, n); a.href = h; a.rel = 'noopener'; a.target = '_blank';
      $('contact').append(' · ', a);
    });
    $('lenders').replaceChildren(...lenders.map(l => {
      const d = el('div', 'box');
      d.appendChild(el('h3', null, l.name));
      d.appendChild(el('div', 'meta', l.requirements));
      return d;
    }));
  }

  function renderBranches() {
    $('branchList').replaceChildren(...state.branches.map(b => {
      const d = el('div', 'box' + (b.status === 'coming_soon' ? ' soon' : ''));
      d.appendChild(el('h3', null, b.name));
      d.appendChild(el('div', 'meta', b.address));
      d.appendChild(el('div', 'meta', '🕒 ' + b.hours));
      if (!b.address_confirmed) d.appendChild(el('div', 'warn', 'Address to be confirmed'));
      if (b.maps_url) {
        const a = el('a', null, 'Open in Google Maps'); a.href = b.maps_url; a.target = '_blank'; a.rel = 'noopener';
        d.appendChild(a);
      }
      return d;
    }));
    const sel = $('branch');
    state.branches.filter(b => b.status === 'open').forEach(b => {
      const o = document.createElement('option'); o.value = b.id; o.textContent = b.name; sel.appendChild(o);
    });
  }

  async function load() {
    try {
      state.units = await api.listUnits();
      $('sampleNote').hidden = !state.units.some(u => u.is_sample);
      render();
    } catch (e) {
      $('loadErr').textContent = 'Could not load stock. Please refresh.';
      $('grid').replaceChildren();
    }
  }

  async function init() {
    $('cats').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      state.cat = b.dataset.c;
      document.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      render();
    });
    let t;
    $('q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim().toLowerCase(); render(); }, 150); });
    $('branch').addEventListener('change', e => { state.branch = e.target.value; render(); });
    $('sort').addEventListener('change', e => { state.sort = e.target.value; render(); });
    $('rform').addEventListener('submit', submitReserve);
    $('rcancel').addEventListener('click', () => $('dlg').close());
    try {
      const [branches, settings, lenders] = await Promise.all([api.listBranches(), api.getSettings(), api.listLenders()]);
      state.branches = branches;
      renderBranches();
      renderStatic(settings, lenders);
    } catch (e) { $('loadErr').textContent = 'Could not load branch info. Please refresh.'; }
    await load();
  }
  init();
})();
