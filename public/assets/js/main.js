// Shared frontend code: demo data, "session", favourites, navbar/footer, card renderer.
// DEMO MODE: everything lives in localStorage. The real backend will replace the CN.* data helpers.

const ROOM_TYPES = { single: 'Single room', bedsit: 'Bedsit', one_bedroom: 'One bedroom', shared: 'Shared room', hostel: 'Hostel' };
const AMENITIES = ['Wi-Fi', 'Water 24/7', 'Security guard', 'Fenced compound', 'Parking', 'Furnished', 'Own bathroom', 'Kitchen', 'Backup power', 'Near matatu stage'];

// Fake people. Phones/emails are placeholders.
const DEMO_USERS = {
  student: { id: 1, name: 'Faith Wanjiru', email: 'faith@student.daystar.ac.ke', phone: '0700 000 001', role: 'student' },
  landlord: { id: 11, name: 'Mama Njeri Properties', email: 'njeri@example.com', phone: '0700 000 011', role: 'landlord' },
  admin: { id: 99, name: 'Site Admin', email: 'admin@campusnest.test', phone: '0700 000 099', role: 'admin' },
};
const LANDLORDS = {
  11: { name: 'Mama Njeri Properties', phone: '0700 000 011', email: 'njeri@example.com' },
  12: { name: 'Mr. Kamau Ochieng', phone: '0700 000 012', email: 'kamau@example.com' },
  13: { name: 'Savannah Court Ltd', phone: '0700 000 013', email: 'savannah@example.com' },
  14: { name: 'Mrs. Achieng Otieno', phone: '0700 000 014', email: 'achieng@example.com' },
};

// [id, landlord, title, type, rent, location, km, availability, status, amenity indexes, description, rejection]
const DEMO_ROWS = [
  [1, 11, 'Sunrise Bedsit near Daystar Gate', 'bedsit', 7500, 'Daystar Gate, Athi River', 0.4, 'available', 'approved', [0, 1, 2, 3, 6], 'A bright self-contained bedsit a five-minute walk from the main gate. Tiled floor, own bathroom and a small cooking corner. Quiet compound with a night guard, popular with final-year students.'],
  [2, 12, 'Budget Single Room, Kapiti Road', 'single', 4500, 'Kapiti Road, Athi River', 1.2, 'available', 'approved', [1, 3, 9], 'Simple, clean single room with shared bathrooms. Water is reliable and the matatu stage is 2 minutes away. Best value for first-years on a tight budget.'],
  [3, 13, 'Savannah Court One Bedroom', 'one_bedroom', 16000, 'Mlolongo', 5.8, 'available', 'approved', [0, 1, 2, 3, 4, 5, 6, 7, 8], 'Modern furnished one-bedroom with a full kitchen, fast fibre Wi-Fi and backup power. Gated compound with parking. Ideal if you want a calm place to study or to share with a friend.'],
  [4, 14, 'Athi Hostel (Women only)', 'hostel', 5500, 'Athi River Town', 2.1, 'available', 'approved', [0, 1, 2, 3, 7], 'Women-only hostel with shared kitchen and a study lounge. Security guard on duty day and night. Rent includes water and Wi-Fi.'],
  [5, 11, 'Cosy Shared Room, Two Sharing', 'shared', 3500, 'Stoni Athi', 3.4, 'available', 'approved', [1, 3, 9], 'Two students share a spacious room with double-decker beds and lockers. Cheapest option in the area. Bring your own mattress cover.'],
  [6, 12, 'Kitengela Single with Own Bathroom', 'single', 8500, 'Kitengela', 7.9, 'available', 'approved', [0, 1, 2, 3, 4, 6], 'Single room with an en-suite bathroom in a modern block. Further from campus but on the main road with frequent matatus.'],
  [7, 13, 'Syokimau Executive Bedsit', 'bedsit', 11000, 'Syokimau', 9.3, 'taken', 'approved', [0, 1, 2, 3, 5, 6, 8], 'Furnished bedsit near the Syokimau railway station. Currently fully occupied; check back next semester.'],
  [8, 14, 'Lukenya View Single Room', 'single', 5000, 'Lukenya', 6.5, 'available', 'approved', [1, 3, 8], 'Peaceful single room with a view of the hills. Water tank and backup power. Short boda-boda ride to campus.'],
  [9, 11, 'Mavoko Student Bedsit', 'bedsit', 6800, 'Mavoko', 1.8, 'available', 'approved', [0, 1, 2, 3, 6, 9], 'Affordable bedsit with Wi-Fi included. Walking distance to shops, a salon and a small gym.'],
  [10, 12, 'Katani Shared Two-Bedroom', 'shared', 4200, 'Katani', 4.7, 'available', 'approved', [1, 3, 7], 'Share a two-bedroom house with three other students. Own bed and shelf, shared kitchen and living room.'],
  [11, 13, 'New Bedsit, EPZ Road', 'bedsit', 7000, 'EPZ Road, Athi River', 2.6, 'available', 'pending', [0, 1, 3, 6], 'Newly built bedsits, just completed. Waiting for approval.'],
  [12, 14, 'Kinanie Single Room', 'single', 3900, 'Kinanie', 5.2, 'available', 'pending', [1, 3], 'Basic single room, tap water, fenced compound.'],
  [13, 12, 'Luxury Penthouse Studio', 'one_bedroom', 45000, 'Nairobi Expressway', 28.0, 'available', 'rejected', [0, 1, 2, 4, 5], 'Studio far from campus.', 'Too far from Daystar (28 km). Please list properties within 10 km of the campus.'],
];

function seedListings() {
  return DEMO_ROWS.map(r => ({
    id: r[0], landlordId: r[1], title: r[2], roomType: r[3], rent: r[4], location: r[5], distance: r[6],
    availability: r[7], status: r[8], amenities: r[9].map(i => AMENITIES[i]), description: r[10],
    rejectionReason: r[11] || '', created: '2026-10-' + String(r[0] + 8).padStart(2, '0'),
  }));
}

// ---------- storage ----------
const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

function getListings() {
  let all = read('cn_listings', null);
  if (!all) { all = seedListings(); write('cn_listings', all); }
  return all;
}
const saveListings = all => write('cn_listings', all);
const getUser = () => read('cn_user', null);
const getFavs = () => read('cn_favs', []);
function logout() { localStorage.removeItem('cn_user'); location.href = '/'; }
function resetDemo() { ['cn_listings', 'cn_user', 'cn_favs'].forEach(k => localStorage.removeItem(k)); location.href = '/'; }

// Contact details for a listing's owner (demo landlords or accounts registered in this browser).
const landlordInfo = id => LANDLORDS[id] || read('cn_users', []).find(u => u.id === id) || { name: 'Landlord', phone: '', email: '' };

// ---------- helpers ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kes = n => 'KES ' + Number(n).toLocaleString('en-KE');
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Only allow same-site redirects after login.
function safeNext(raw) { return raw && /^\/(?!\/)/.test(raw) ? raw : '/'; }

// Placeholder "photo": a coloured SVG house. Real uploads replace this later.
function photo(l, n = 0) {
  const hue = (l.id * 47 + n * 35) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},45%,82%)"/><stop offset="1" stop-color="hsl(${hue + 30},40%,62%)"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><path d="M110 170 200 100 290 170V230H110Z" fill="#fff" fill-opacity=".85"/><rect x="180" y="185" width="40" height="45" fill="hsl(${hue},40%,35%)"/><rect x="128" y="180" width="30" height="26" fill="hsl(${hue},40%,35%)" fill-opacity=".5"/><rect x="242" y="180" width="30" height="26" fill="hsl(${hue},40%,35%)" fill-opacity=".5"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

const HEART = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2 0 3.6 1.1 4.6 2.7h2C14 6.1 15.6 5 17.6 5 21 5 23.1 8.4 21.6 11.8 19.500 16.400 12 21 12 21Z"/></svg>';

function statusBadge(s) { return `<span class="badge badge-${s}">${s}</span>`; }

function cardHTML(l) {
  const fav = getFavs().includes(l.id);
  const taken = l.availability === 'taken';
  return `<article class="card">
    <a class="card-img" href="/property.html?id=${l.id}"><img src="${photo(l)}" alt="" loading="lazy">${taken ? '<span class="ribbon">Taken</span>' : ''}</a>
    <button class="fav" data-fav="${l.id}" aria-pressed="${fav}" aria-label="${fav ? 'Remove from' : 'Add to'} favourites">${HEART}</button>
    <div class="card-body">
      <p class="price">${kes(l.rent)}<small> / month</small></p>
      <h3><a href="/property.html?id=${l.id}">${esc(l.title)}</a></h3>
      <p class="muted">${esc(l.location)} · ${l.distance} km from campus</p>
      <p><span class="tag">${ROOM_TYPES[l.roomType]}</span> ${l.amenities.slice(0, 2).map(a => `<span class="tag tag-soft">${esc(a)}</span>`).join(' ')}</p>
    </div>
  </article>`;
}

// ---------- navbar / footer ----------
function renderChrome() {
  const u = getUser();
  const links = [['/browse.html', 'Browse']];
  if (u?.role === 'student') links.push(['/favourites.html', 'Favourites']);
  if (u?.role === 'landlord') links.push(['/my-listings.html', 'My listings'], ['/submit-property.html', 'List a property']);
  if (u?.role === 'admin') links.push(['/admin/dashboard.html', 'Dashboard'], ['/admin/listings.html', 'Moderate']);
  if (!u) links.push(['/submit-property.html', 'List a property']);
  links.push(['/about.html', 'About'], ['/contact.html', 'Contact']);
  const here = location.pathname;
  const nav = links.map(([h, t]) => `<a href="${h}"${here === h ? ' aria-current="page"' : ''}>${t}</a>`).join('');
  const auth = u
    ? `<span class="who">${esc(u.name.split(' ')[0])} <small>(${u.role})</small></span><button class="btn btn-ghost btn-sm" id="logout">Log out</button>`
    : '<a class="btn btn-ghost btn-sm" href="/login.html">Log in</a><a class="btn btn-sm" href="/register.html">Sign up</a>';
  const header = $('#site-header');
  if (header) header.innerHTML = `<div class="wrap bar"><a class="brand" href="/"><span class="logo">CN</span>CampusNest</a>
    <button class="menu-btn" aria-label="Menu" aria-expanded="false">☰</button>
    <nav id="nav">${nav}<span class="nav-auth">${auth}</span></nav></div>`;
  const footer = $('#site-footer');
  if (footer) footer.innerHTML = `<div class="wrap foot"><p><strong>CampusNest</strong> · Student accommodation near Daystar University, Athi River</p>
    <p class="muted"><a href="/about.html">About</a> · <a href="/contact.html">Contact</a> · <a href="/admin/login.html">Admin</a> · <a href="#" id="reset-demo">Reset demo data</a></p></div>`;

  $('#logout')?.addEventListener('click', logout);
  $('#reset-demo')?.addEventListener('click', e => { e.preventDefault(); resetDemo(); });
  $('.menu-btn')?.addEventListener('click', e => {
    const open = $('#nav').classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', open);
  });
}

function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

// Favourite hearts (students only). Works for any element with data-fav.
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-fav]');
  if (!btn) return;
  const u = getUser();
  if (u?.role !== 'student') {
    location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search) + '&msg=fav';
    return;
  }
  const id = Number(btn.dataset.fav);
  let favs = getFavs();
  favs = favs.includes(id) ? favs.filter(f => f !== id) : [...favs, id];
  write('cn_favs', favs);
  $$(`[data-fav="${id}"]`).forEach(b => b.setAttribute('aria-pressed', favs.includes(id)));
  toast(favs.includes(id) ? 'Saved to favourites' : 'Removed from favourites');
  document.dispatchEvent(new CustomEvent('favchange'));
});

// Guard for pages that need a role. Returns the user, or redirects.
function requireRole(...roles) {
  const u = getUser();
  if (!u || !roles.includes(u.role)) {
    const admin = roles.includes('admin');
    location.href = (admin ? '/admin/login.html' : '/login.html') + '?next=' + encodeURIComponent(location.pathname + location.search);
    return null;
  }
  return u;
}

renderChrome();
