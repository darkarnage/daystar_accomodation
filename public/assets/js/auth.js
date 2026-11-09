// Login and registration.
// The forms talk to the server (/api/auth/...), which checks the password and sets an HttpOnly cookie.
// Students and the admin use different endpoints, so an admin account cannot log in on the student form or the other way round.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+254|0)[17]\d{2}[\s-]?\d{3}[\s-]?\d{3}$/;

// Show or clear an error under a field.
function setErr(form, name, text) {
  const field = form.elements[name].closest('.field');
  field.classList.toggle('invalid', !!text);
  $('.err', field).textContent = text || '';
  return !text;
}
// Show the errors the server sent back ({ field: message }). Returns true if it showed any.
function showServerErrors(form, errors) {
  const names = Object.keys(errors || {}).filter(n => form.elements[n]);
  names.forEach(n => setErr(form, n, errors[n]));
  return names.length > 0;
}
function goNext(user) {
  const next = safeNext(new URLSearchParams(location.search).get('next'));
  location.href = next === '/' && user.role === 'admin' ? '/admin/dashboard.html' : next;
}
function finish(form, user) {
  write('cn_user', user);
  goNext(user);
}
// POST JSON and return { status, data }. A network failure becomes status 0.
async function postJson(url, body) {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { status: 0, data: {} };
  }
}
const busy = (button, on) => { button.disabled = on; button.classList.toggle('is-loading', on); };

const msg = new URLSearchParams(location.search).get('msg');
if (msg === 'fav' && $('#msg')) $('#msg').innerHTML = '<div class="alert">Log in as a student to save favourites.</div>';

// Demo quick-fill buttons
$$('[data-demo]').forEach(b => b.addEventListener('click', () => {
  const f = $('form');
  f.elements.email.value = DEMO_USERS[b.dataset.demo].email;
  f.elements.password.value = 'demo-password';   // the demo student is created by db/seed.js (development only)
  b.classList.add('is-loading');
  f.requestSubmit();
}));

// ----- student login (real) -----
$('#login-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, button = $('button[type=submit]', f);
  const email = f.elements.email.value.trim();
  const ok = [
    setErr(f, 'email', EMAIL_RE.test(email) ? '' : 'Enter a valid email address.'),
    setErr(f, 'password', f.elements.password.value ? '' : 'Enter your password.'),
  ].every(Boolean);
  if (!ok) { $$('[data-demo]').forEach(b => b.classList.remove('is-loading')); return; }
  busy(button, true);
  const { status, data } = await postJson('/api/auth/login', { email, password: f.elements.password.value });
  busy(button, false); $$('[data-demo]').forEach(b => b.classList.remove('is-loading'));
  if (status === 200) return finish(f, data.user);
  setErr(f, 'password',
    status === 401 ? 'Incorrect email or password.' :
    status === 429 ? 'Too many failed attempts. Please wait 15 minutes and try again.' :
    status === 0 ? 'Cannot reach the server. Please try again.' : 'Something went wrong. Please try again.');
});

// ----- student registration (real) -----
$('#register-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, button = $('button[type=submit]', f);
  const v = n => f.elements[n].value.trim();
  const ok = [
    setErr(f, 'name', v('name').length >= 2 ? '' : 'Enter your full name.'),
    setErr(f, 'email', EMAIL_RE.test(v('email')) ? '' : 'Enter a valid email address.'),
    setErr(f, 'phone', PHONE_RE.test(v('phone')) ? '' : 'Enter a Kenyan number like 0712 345 678.'),
    setErr(f, 'password', f.elements.password.value.length >= 8 ? '' : 'Use at least 8 characters.'),
    setErr(f, 'confirm', f.elements.confirm.value === f.elements.password.value ? '' : 'Passwords do not match.'),
  ].every(Boolean);
  if (!ok) return;
  busy(button, true);
  const { status, data } = await postJson('/api/auth/register', {
    name: v('name'), email: v('email'), phone: v('phone'), password: f.elements.password.value });
  busy(button, false);
  if (status === 201) return finish(f, data.user);
  if (!showServerErrors(f, data.errors)) {
    setErr(f, 'confirm', status === 0 ? 'Cannot reach the server. Please try again.' : 'Something went wrong. Please try again.');
  }
});

// ----- admin login (real) -----
$('#admin-login-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, button = $('button[type=submit]', f);
  const email = f.elements.email.value.trim();
  const ok = [
    setErr(f, 'email', EMAIL_RE.test(email) ? '' : 'Enter a valid email address.'),
    setErr(f, 'password', f.elements.password.value ? '' : 'Enter your password.'),
  ].every(Boolean);
  if (!ok) return;
  busy(button, true);
  const { status, data } = await postJson('/api/auth/admin/login', { email, password: f.elements.password.value });
  busy(button, false);
  if (status === 200) return finish(f, data.user);
  setErr(f, 'password',
    status === 401 ? 'Incorrect email or password.' :
    status === 429 ? 'Too many failed attempts. Please wait 15 minutes and try again.' :
    status === 0 ? 'Cannot reach the server. Please try again.' : 'Something went wrong. Please try again.');
});
