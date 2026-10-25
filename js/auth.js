// Staff sign-in (email + password). The session lives only in this browser tab.
(function () {
  const { url, key } = window.MCH;
  const KEY = 'mch_session';
  let session = null;

  function save(s) {
    session = s;
    try { s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY); } catch (e) { /* storage blocked */ }
    api.setToken(s ? s.access_token : null);
  }
  async function token(body, grant) {
    const r = await fetch(url + '/auth/v1/token?grant_type=' + grant, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error_description || d.msg || d.message || 'Invalid login');
    d.expires_at_ms = Date.now() + (d.expires_in - 60) * 1000;
    return d;
  }
  window.auth = {
    async login(email, password) { save(await token({ email, password }, 'password')); return session; },
    logout() { save(null); },
    async restore() {
      try { const s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (s) save(s); } catch (e) { /* ignore */ }
      return this.ensure();
    },
    // Refresh the token shortly before it expires; returns null if signed out.
    async ensure() {
      if (!session) return null;
      if (Date.now() > session.expires_at_ms) {
        try { save(await token({ refresh_token: session.refresh_token }, 'refresh_token')); } catch (e) { save(null); return null; }
      }
      return session;
    },
    user: () => session && session.user,
    // Short-lived link to a private ID photo (staff of that branch / owner only).
    async signedIdUrl(path) {
      const d = await api.call('/storage/v1/object/sign/mch-ids/' + path, { method: 'POST', body: JSON.stringify({ expiresIn: 120 }) });
      return url + '/storage/v1' + d.signedURL;
    }
  };
})();
