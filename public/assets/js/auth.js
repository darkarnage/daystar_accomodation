// Login, register and admin login (demo: checks the form, then stores a fake session in localStorage).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+254|0)[17]\d{2}[\s-]?\d{3}[\s-]?\d{3}$/;

// Show or clear an error under a field.
function setErr(form, name, text) {
  const field = form.elements[name].closest('.field');
  field.classList.toggle('invalid', !!text);
  $('.err', field).textContent = text || '';
  return !text;
}
function finish(form, user) {
  write('cn_user', user);
  const next = safeNext(new URLSearchParams(location.search).get('next'));
  location.href = next === '/' && user.role === 'admin' ? '/admin/dashboard.html' : next;
}
function lookup(email) {
  const e = email.toLowerCase();
  // Registered accounts are students (older saved landlord accounts are ignored).
  return [...Object.values(DEMO_USERS), ...read('cn_users', []).filter(u => u.role === 'student')].find(u => u.email.toLowerCase() === e);
}

const msg = new URLSearchParams(location.search).get('msg');
if (msg === 'fav' && $('#msg')) $('#msg').innerHTML = '<div class="alert">Log in as a student to save favourites.</div>';

// Demo quick-fill buttons
$$('[data-demo]').forEach(b => b.addEventListener('click', () => {
  const f = $('form');
  f.elements.email.value = DEMO_USERS[b.dataset.demo].email;
  f.elements.password.value = 'demo-password';
  b.classList.add('is-loading');
  f.requestSubmit();
}));

function loginHandler(requiredRole) {
  return e => {
    e.preventDefault();
    const f = e.target;
    const email = f.elements.email.value.trim();
    const ok = [
      setErr(f, 'email', EMAIL_RE.test(email) ? '' : 'Enter a valid email address.'),
      setErr(f, 'password', f.elements.password.value ? '' : 'Enter your password.'),
    ].every(Boolean);
    if (!ok) return;
    const user = lookup(email);
    if (!user || (requiredRole ? user.role !== requiredRole : user.role === 'admin')) {
      setErr(f, 'email', requiredRole ? 'That is not an admin account.' : 'No account with that email. Sign up first, or use a demo account.');
      return;
    }
    finish(f, user);
  };
}
$('#login-form')?.addEventListener('submit', loginHandler());
$('#admin-login-form')?.addEventListener('submit', loginHandler('admin'));

$('#register-form')?.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const v = n => f.elements[n].value.trim();
  const ok = [
    setErr(f, 'name', v('name').length >= 2 ? '' : 'Enter your full name.'),
    setErr(f, 'email', !EMAIL_RE.test(v('email')) ? 'Enter a valid email address.' : lookup(v('email')) ? 'That email is already registered.' : ''),
    setErr(f, 'phone', PHONE_RE.test(v('phone')) ? '' : 'Enter a Kenyan number like 0712 345 678.'),
    setErr(f, 'password', f.elements.password.value.length >= 8 ? '' : 'Use at least 8 characters.'),
    setErr(f, 'confirm', f.elements.confirm.value === f.elements.password.value ? '' : 'Passwords do not match.'),
  ].every(Boolean);
  if (!ok) return;
  // Demo only: the password is never stored.
  const users = read('cn_users', []);
  const user = { id: 100 + users.length, name: v('name'), email: v('email'), phone: v('phone'), role: 'student' };
  write('cn_users', [...users, user]);
  finish(f, user);
});
