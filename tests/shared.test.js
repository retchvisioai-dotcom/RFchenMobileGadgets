const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');

const context = {};
runInNewContext(readFileSync('assets/js/shared.js', 'utf8'), context);
const shared = context.RFGShared;

test('date helpers preserve the app locale and Manila timezone formatting', () => {
  const timestamp = '2025-03-12T17:45:00.000Z';

  assert.equal(shared.fmt(timestamp), new Date(timestamp).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila'
  }));
  assert.equal(shared.fdate(timestamp), new Date(timestamp).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila'
  }));
  assert.equal(shared.ftime(timestamp), new Date(timestamp).toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila'
  }));
  assert.equal(shared.dayOf(timestamp), new Date(timestamp).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Manila'
  }));
});

test('common value helpers preserve escaping and numeric formatting', () => {
  assert.equal(shared.peso(1234), '₱' + Number(1234).toLocaleString('en-PH'));
  assert.equal(shared.num('12'), 12);
  assert.equal(shared.esc(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
});

test('CSV helper quotes fields and neutralizes spreadsheet formulas', () => {
  assert.equal(shared.csv([['a,b', 'say "hi"', '=1+1', -42, null]]), '"a,b","say ""hi""","\'=1+1","\'-42",""');
});
