// Safe DOM helper: text is always set as text, never as HTML.
window.h = function (tag, attrs) {
  const e = document.createElement(tag);
  if (typeof attrs === 'string') attrs = { class: attrs }; // h('div', 'row', ...) shorthand
  for (const k in (attrs || {})) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (let i = 2; i < arguments.length; i++) {
    const c = arguments[i];
    if (c == null || c === false) continue;
    if (Array.isArray(c)) { c.forEach(x => x != null && x !== false && e.append(x.nodeType ? x : document.createTextNode(String(x)))); continue; }
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
};
window.peso = n => '₱' + Number(n).toLocaleString('en-PH', { maximumFractionDigits: 0 });
window.friendly = function (err, extra) {
  const m = (err && err.message) || '';
  const map = [
    [/already sold|no longer available|unavailable/i, 'Sorry, this unit is no longer available.'],
    [/Invalid mobile/i, 'Please enter a valid PH mobile number, e.g. 0917 123 4567.'],
    [/Consent/i, 'Please tick the agreement box.'],
    [/Too many/i, 'Too many requests from this number today. Please visit a branch.'],
    [/Not allowed|permission denied/i, 'You are not allowed to do that.'],
    [/Invalid login|invalid_grant|Invalid email or password/i, 'Wrong email or password.'],
    [/too large|JPG, PNG/i, m],
    [/ID photo not found/i, 'The photo did not upload. Please try again.']
  ].concat(extra || []);
  const f = map.find(x => x[0].test(m));
  return f ? f[1] : 'Something went wrong. Please try again.';
};
