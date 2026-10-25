// Tiny REST client for Supabase PostgREST (no library, keeps pages fast on cheap phones).
(function () {
  const { url, key } = window.MCH;
  const H = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };

  async function call(path, opts) {
    const r = await fetch(url + path, Object.assign({ headers: H }, opts));
    const body = await r.text();
    let data = null;
    try { data = body ? JSON.parse(body) : null; } catch (e) { /* non-JSON */ }
    if (!r.ok) {
      const err = new Error((data && (data.message || data.error)) || 'Request failed');
      err.status = r.status;
      throw err;
    }
    return data;
  }

  window.api = {
    listBranches: () => call('/rest/v1/mch_branches?select=*&order=sort'),
    getSettings: () => call('/rest/v1/mch_settings?select=*&id=eq.1').then(r => r[0] || {}),
    listLenders: () => call('/rest/v1/mch_lenders?select=id,name,requirements,sort&order=sort'),
    listUnits: () => call('/rest/v1/mch_public_units?select=*&order=created_at.desc&limit=500'),
    reserve: (unit, name, mobile, consent) =>
      call('/rest/v1/rpc/mch_reserve_unit', {
        method: 'POST',
        body: JSON.stringify({ p_unit: unit, p_name: name, p_mobile: mobile, p_consent: consent })
      })
  };
})();
