// Tiny REST client for Supabase (no library, keeps pages fast on cheap phones).
(function () {
  const { url, key } = window.MCH;
  let token = null; // staff access token, set by auth.js

  async function call(path, opts) {
    opts = opts || {};
    const headers = Object.assign({ apikey: key, Authorization: 'Bearer ' + (token || key) }, opts.raw ? {} : { 'Content-Type': 'application/json' }, opts.headers || {});
    const r = await fetch(url + path, Object.assign({}, opts, { headers }));
    const body = await r.text();
    let data = null;
    try { data = body ? JSON.parse(body) : null; } catch (e) { /* non-JSON */ }
    if (!r.ok) {
      const err = new Error((data && (data.message || data.error || data.msg || data.error_description)) || 'Request failed');
      err.status = r.status;
      throw err;
    }
    return data;
  }
  const rpc = (name, args) => call('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) });
  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

  window.api = {
    call, rpc,
    setToken: t => { token = t; },
    listBranches: () => call('/rest/v1/mch_branches?select=*&order=sort'),
    getSettings: () => call('/rest/v1/mch_settings?select=*&id=eq.1').then(r => r[0] || {}),
    listLenders: () => call('/rest/v1/mch_lenders?select=id,name,requirements,sort&order=sort'),
    listUnits: () => call('/rest/v1/mch_public_units?select=*&order=created_at.desc&limit=500'),
    getUnit: id => call('/rest/v1/mch_public_units?select=*&id=eq.' + encodeURIComponent(id)).then(r => r[0] || null),
    reserve: (unit, name, mobile, consent) => rpc('mch_reserve_unit', { p_unit: unit, p_name: name, p_mobile: mobile, p_consent: consent }),
    warranty: imei => rpc('mch_warranty_lookup', { p_imei: imei }).then(r => r[0] || null),
    repairStatus: code => rpc('mch_repair_status', { p_code: code }).then(r => r[0] || null),
    // Customer ID photo goes to a private bucket under a random name; returns the stored path.
    async uploadId(file) {
      const ext = EXT[file.type];
      if (!ext) throw new Error('Please choose a JPG, PNG or WebP photo.');
      if (file.size > 5 * 1024 * 1024) throw new Error('Photo is too large (max 5 MB).');
      const path = 'id/' + crypto.randomUUID() + '.' + ext;
      await call('/storage/v1/object/mch-ids/' + path, { method: 'POST', raw: true, body: file, headers: { 'Content-Type': file.type, 'x-upsert': 'false' } });
      return path;
    },
    apply: (a) => rpc('mch_submit_application', a)
  };
})();
