// Tests for safeNext() in public/assets/js/main.js: the check on the ?next= address used after login.
// The function is cut out of the real source file and run on its own, so this always tests the code the site uses.
// It needs no server or database.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ORIGIN = 'http://localhost:3000';
const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'js', 'main.js'), 'utf8');
const match = source.match(/function safeNext\(raw\) \{[\s\S]*?\n\}\n/);
assert.ok(match, 'safeNext was not found in main.js');
const sandbox = { location: { origin: ORIGIN }, URL };
vm.createContext(sandbox);
vm.runInContext(match[0], sandbox);
const safeNext = sandbox.safeNext;

// What a visitor's ?next=... turns into after the page reads it (percent-encoding is decoded here).
const fromQuery = (query) => new URLSearchParams('next=' + query).get('next');

test('normal internal paths are kept', () => {
  for (const p of ['/', '/browse.html', '/favourites.html', '/admin/dashboard.html', '/admin/listings.html?status=pending',
    '/browse.html?type=bedsit&maxRent=8000&sort=rent', '/property.html?id=3', '/property.html?id=3#contact', '/search?q=a%20b']) {
    assert.strictEqual(safeNext(p), p, p);
  }
  assert.strictEqual(safeNext(fromQuery('%2Fproperty.html%3Fid%3D3')), '/property.html?id=3', 'an encoded path from the address bar');
  assert.strictEqual(safeNext('/a/../browse.html'), '/a/../browse.html', 'dot segments stay on this site, so the text is kept as it is');
});

test('protocol-relative URLs (//host) are refused', () => {
  for (const p of ['//example.com', '//example.com/path', '///example.com', '////example.com', '//localhost:3000.evil.com', '//evil.com/%2e%2e/']) {
    assert.strictEqual(safeNext(p), '/', p);
  }
});

test('backslash variants are refused', () => {
  for (const p of ['/\\example.com', '/\\/example.com', '/\\\\example.com', '\\\\example.com', '\\example.com', '/\\evil.com/path',
    '/path\\..\\..\\x', '/a\\b']) {
    assert.strictEqual(safeNext(p), '/', JSON.stringify(p));
  }
  // an encoded backslash is decoded by the page before safeNext sees it
  assert.strictEqual(safeNext(fromQuery('/%5Cexample.com')), '/', '/%5Cexample.com');
  assert.strictEqual(safeNext(fromQuery('%2F%5Cexample.com')), '/', '%2F%5Cexample.com');
  assert.strictEqual(safeNext(fromQuery('/%5C%5Cexample.com')), '/', '/%5C%5Cexample.com');
});

test('tabs, line breaks and other control characters are refused (browsers ignore them inside addresses)', () => {
  for (const p of ['/\t/example.com', '/\n/example.com', '/\r/example.com', '\t//example.com', '/\u0000/example.com', '/\u001f/x', '/\u007f/x', '/ok\n']) {
    assert.strictEqual(safeNext(p), '/', JSON.stringify(p));
  }
  assert.strictEqual(safeNext(fromQuery('/%09/example.com')), '/', 'encoded tab');
  assert.strictEqual(safeNext(fromQuery('/%0a/example.com')), '/', 'encoded newline');
});

test('absolute external URLs and other schemes are refused', () => {
  for (const p of ['https://example.com', 'http://example.com/path', 'HTTPS://EXAMPLE.COM', ' https://example.com', 'example.com', 'www.example.com',
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,hi', 'mailto:a@example.com', 'ftp://example.com', 'file:///etc/passwd',
    ORIGIN + '/browse.html', 'browse.html', '?x=1', '#top', '..']) {
    assert.strictEqual(safeNext(p), '/', p);
  }
});

test('missing or non-text values fall back to the home page', () => {
  for (const v of [null, undefined, '', 0, 42, true, ['/browse.html'], { toString: () => '/browse.html' }]) {
    assert.strictEqual(safeNext(v), '/', String(typeof v));
  }
});

test('whatever comes back always stays on this site', () => {
  const nasty = ['/.//a.com', '/a/..//a.com', '/a/../\\a.com', '/././/a.com', '/', '/a', '//a', '/\\a', '/\t/a', 'https://a.com', '/%2F/a.com', '/%5C/a.com', '/./\\a.com', '/@a.com', '/:@a.com', '/a@b.com',
    '/?next=//a.com', '/#//a.com', '/.//a.com', '/%00', '/／a.com', '/。a.com'];
  for (const raw of nasty) {
    const out = safeNext(raw);
    const url = new URL(out, ORIGIN);
    assert.strictEqual(url.origin, ORIGIN, `${JSON.stringify(raw)} -> ${out}`);
    assert.ok(out.startsWith('/') && !out.startsWith('//') && !out.includes('\\'), `${JSON.stringify(raw)} -> ${out}`);
  }
});
