// Shared frontend code: constants, small helpers, login state, favourites, navbar/footer, card renderer.
// Listings, accounts and moderation live in the database (see /api). Only favourites and a saved copy of the
// logged-in user are kept in this browser's localStorage.

const ROOM_TYPES = { single: 'Single room', bedsit: 'Bedsit', one_bedroom: 'One bedroom', shared: 'Shared room', hostel: 'Hostel' };
const AMENITIES = ['Wi-Fi', 'Water 24/7', 'Security guard', 'Fenced compound', 'Parking', 'Furnished', 'Own bathroom', 'Kitchen', 'Backup power', 'Near matatu stage'];

// The seeded demo student (created by db/seed.js in development), used by the "Log in as demo student" button.
const DEMO_USERS = { student: { email: 'faith@student.daystar.ac.ke' } };

// ---------- storage ----------
const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// The logged-in user. cn_user is only a saved copy of what the server says (see syncSession below):
// the server session cookie is what really counts.
const getUser = () => { const u = read('cn_user', null); return u && ['student', 'admin'].includes(u.role) ? u : null; };
const getFavs = () => read('cn_favs', []);
// Logging out ends the server session (students) and clears the saved copy of the user.
async function endSession() { try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* server offline: still log out here */ } }
async function logout() { await endSession(); localStorage.removeItem('cn_user'); location.href = '/'; }
async function clearSavedData() { await endSession(); ['cn_user', 'cn_favs'].forEach(k => localStorage.removeItem(k)); location.href = '/'; }
// Older versions of the demo kept listings and accounts in this browser. They are not used any more.
['cn_listings', 'cn_users'].forEach(k => localStorage.removeItem(k));

// Public pages only ever show approved listings that are still available.
const isPublic = l => l.status === 'approved' && l.availability === 'available';

// ---------- helpers ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kes = n => 'KES ' + Number(n).toLocaleString('en-KE');
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Only allow same-site redirects after login (the ?next= address). Anything else becomes '/'.
// Browsers treat a backslash like a slash and ignore tabs and line breaks inside an address, so "/\evil.com" and
// "/<tab>/evil.com" would really mean "//evil.com" (another site). We refuse those characters, then let the browser's
// own URL parser decide and accept only an address that stays on this site.
// The original text is returned, not the parser's tidied-up version: tidying can turn "/.//evil.com" into "//evil.com".
function safeNext(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return '/';
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return '/';
  try {
    const url = new URL(raw, location.origin);
    return url.origin === location.origin ? raw : '/';
  } catch {
    return '/';
  }
}

function statusBadge(s) { return `<span class="badge badge-${s}">${s}</span>`; }

// ---------- icons ----------
// Simple inline SVG icons (24x24, drawn with a stroke). Styled by .icon in main.css.
const ICONS = {
  search: '<path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  heart: '<path d="M12 20s-7.5-4.6-9-9.2C1.900 7.800 3.900 5 6.800 5c2 0 3.500 1.100 5.200 3 1.700-1.900 3.200-3 5.200-3 2.900 0 4.900 2.800 3.800 5.800C19.500 15.400 12 20 12 20Z"/>',
  pin: '<path d="M12 21s7-6.200 7-11.500a7 7 0 0 0-14 0C5 14.800 12 21 12 21ZM12 11.500a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>',
  route: '<path d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
  bed: '<path d="M3 19V6M3 15h18v4M21 15v-2.500a3 3 0 0 0-3-3h-7V15M7.500 12.500a1.500 1.500 0 1 0 0-3 1.500 1.500 0 0 0 0 3Z"/>',
  calendar: '<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/>',
  check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
  checkCircle: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12.500l3 3 5-6"/>',
  phone: '<path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  mail: '<path d="M4 6h16v12H4zM4 7.500l8 6 8-6"/>',
  lock: '<path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3"/>',
  filter: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  grid: '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.500 6h.01M4.500 12h.01M4.500 18h.01"/>',
  logout: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
  wifi: '<path d="M4.500 10a11 11 0 0 1 15 0M7.500 13.200a6.500 6.500 0 0 1 9 0M12 17.500h.01"/>',
  water: '<path d="M12 3s6 6.200 6 10.500a6 6 0 0 1-12 0C6 9.200 12 3 12 3Z"/>',
  shield: '<path d="M12 3 5 6v5.500c0 4.200 2.900 7.600 7 9.500 4.100-1.900 7-5.300 7-9.500V6l-7-3ZM9 12l2 2 4-4"/>',
  fence: '<path d="M4 20V8l2-2 2 2v12M10 20V8l2-2 2 2v12M16 20V8l2-2 2 2v12M3 13h18"/>',
  car: '<path d="M4 17v-5l2-5h12l2 5v5zM4 12h16M7 17v2.500M17 17v2.500M7.500 14.500h.01M16.500 14.500h.01"/>',
  sofa: '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 13a2 2 0 0 1 4 0v1.500h10V13a2 2 0 0 1 4 0v5H3zM6 18v2M18 18v2"/>',
  bath: '<path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2"/>',
  kitchen: '<path d="M5 10h14v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM3 10h18M9 6.500c0-1.500 1-1.500 1-3M14 6.500c0-1.500 1-1.500 1-3"/>',
  power: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
  bus: '<path d="M5 16V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10zM5 11h14M7 16v3M17 16v3M8.500 13.500h.01M15.500 13.500h.01"/>',
  mapping: '<path d="M9 5 3 7v12l6-2 6 2 6-2V5l-6 2zM9 5v12M15 7v12"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7Z"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 3v4M17 5h4"/>',
  home: '<path d="m3 11 9-7 9 7M5 10v10h14V10"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};
const icon = (name, size = 20) => `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const AMENITY_ICON = { 'Wi-Fi': 'wifi', 'Water 24/7': 'water', 'Security guard': 'shield', 'Fenced compound': 'fence', 'Parking': 'car', 'Furnished': 'sofa', 'Own bathroom': 'bath', 'Kitchen': 'kitchen', 'Backup power': 'power', 'Near matatu stage': 'bus' };

// ---------- logo ----------
// A house with a small nest (curved bowl) and an egg inside. Colours come from --mark, --cut and --egg in main.css,
// so it also works in one colour.
const LOGO_MARK = `<svg class="logo-mark" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
  <path d="M16 3.500 3.500 14.500V28h25V14.500Z" fill="var(--mark)" stroke="var(--mark)" stroke-width="2" stroke-linejoin="round"/>
  <path d="M10 19.500c.8 4 11.200 4 12 0" fill="none" stroke="var(--cut)" stroke-width="2" stroke-linecap="round"/>
  <circle cx="16" cy="16.500" r="2.200" fill="var(--egg)"/></svg>`;
const LOGO = `${LOGO_MARK}<span class="wordmark">Campus<b>Nest</b></span>`;

// ---------- photos ----------
// Illustrative sample photographs: free stock photos from Pexels (Pexels License), NOT pictures of the listed properties.
// Files are in /assets/images (a -sm copy is used on cards). Photographer and source page: /image-sources.html.
const PHOTO_LICENSE = { name: 'Pexels License', url: 'https://www.pexels.com/license/' };
const IMAGES = {
  "bedroom-neutral-door": { alt: "Bedroom with a bed, a rug and an open door", by: "Lisa Anna", title: "Interior of a Modern, Minimalist Bedroom with a Single Bed", page: "https://www.pexels.com/photo/interior-of-a-modern-minimalist-bedroom-with-a-single-bed-19836795/" },
  "single-bed-desk-white": { alt: "Bright room with a single bed and a desk by the window", by: "Mateusz Pielech", title: "Minimalist Modern Bedroom with White Decor", page: "https://www.pexels.com/photo/minimalist-modern-bedroom-with-white-decor-39338470/" },
  "bedroom-desk-tv": { alt: "Bedroom with a bed, a desk and a monitor", by: "Lisa Anna", title: "Interior of a Modern Bedroom with a Desk and a Computer", page: "https://www.pexels.com/photo/interior-of-a-modern-bedroom-with-a-desk-and-a-computer-19866422/" },
  "bedroom-grey-window": { alt: "Grey bedroom with a window, a bed and a wall shelf", by: "tn2222 Koh", title: "A Grey Bedroom", page: "https://www.pexels.com/photo/a-grey-bedroom-6289053/" },
  "bed-desk-wall-unit": { alt: "Room with a bed and a long desk with shelves above", by: "Medhat Ayad", title: "White and Black Desk Beside Bed and Window", page: "https://www.pexels.com/photo/apartment-bed-bedroom-book-shelves-439227/" },
  "room-bed-desk-window": { alt: "Small room with a single bed and a desk beside a window", by: "Alexander F Ungerer", title: "Room with a Bed and a Desk in an Apartment", page: "https://www.pexels.com/photo/room-with-a-bed-and-a-desk-in-an-apartment-20725943/" },
  "loft-studio-desk": { alt: "Studio with a sleeping area, a dining table and a bookshelf", by: "Lisa Anna", title: "Cozy Bedroom with Bed and Wooden Desk", page: "https://www.pexels.com/photo/cozy-bedroom-with-bed-and-wooden-desk-19857234/" },
  "studio-open-plan-sofa": { alt: "Open-plan studio with a corner sofa, a TV and a kitchen", by: "Max Vakhtbovych", title: "Cozy Studio Apartment Design", page: "https://www.pexels.com/photo/cozy-studio-apartment-design-8082559/" },
  "studio-brick-window": { alt: "Studio with a brick wall, a window and a breakfast counter", by: "Max Vakhtbovych", title: "Interior of contemporary studio apartment in daytime", page: "https://www.pexels.com/photo/interior-of-contemporary-studio-apartment-in-daytime-6447393/" },
  "studio-brick-kitchen": { alt: "Studio kitchen and dining area with a brick wall", by: "Max Vakhtbovych", title: "Interior Design of Small Studio Apartment", page: "https://www.pexels.com/photo/interior-design-of-small-studio-apartment-6969987/" },
  "studio-kitchen-bed": { alt: "Studio with a kitchen counter and a sleeping area", by: "Max Vakhtbovych", title: "Interior modern apartment with kitchen and bedroom", page: "https://www.pexels.com/photo/interior-modern-apartment-with-kitchen-and-bedroom-6447384/" },
  "studio-counter-view": { alt: "Studio with a counter and stools by a large window", by: "Max Vakhtbovych", title: "Interior of miniature modern apartment with furniture", page: "https://www.pexels.com/photo/interior-of-miniature-modern-apartment-with-furniture-6447390/" },
  "studio-white-bright": { alt: "Bright white studio with a dining table and a mirror", by: "Max Vakhtbovych", title: "Modern studio apartment with white furniture and mirror in sunlight", page: "https://www.pexels.com/photo/modern-studio-apartment-with-white-furniture-and-mirror-in-sunlight-6890395/" },
  "kitchen-small-rug": { alt: "Small kitchen with white cabinets and a rug", by: "Alexander F Ungerer", title: "Rug in a Small Kitchen", page: "https://www.pexels.com/photo/rug-in-a-small-kitchen-19776462/" },
  "kitchen-green": { alt: "Kitchen with green cabinets and a breakfast bar", by: "Erdem ÖZDEMİR", title: "Interior of a Modern Kitchen", page: "https://www.pexels.com/photo/interior-of-a-modern-kitchen-16056401/" },
  "kitchen-open-plan": { alt: "Open-plan kitchen with a counter and bar stools", by: "Max Vakhtbovych", title: "Contemporary apartment with open space kitchen", page: "https://www.pexels.com/photo/contemporary-apartment-with-open-space-kitchen-7031214/" },
  "hostel-bunk-beds": { alt: "Hostel room with wooden bunk beds and a desk", by: "cottonbro studio", title: "A Room in a Hostel", page: "https://www.pexels.com/photo/a-room-in-a-hostel-5137980/" },
  "living-grey-sofa": { alt: "Living room with a grey sofa and a round table", by: "Max Vakhtbovych", title: "Interior of modern apartment living room", page: "https://www.pexels.com/photo/interior-of-modern-apartment-living-room-6588599/" },
  "living-orange-sofa": { alt: "Living room with an orange sofa and a dining area", by: "Max Vakhtbovych", title: "Comfy sofa in stylish apartment with living room and kitchen", page: "https://www.pexels.com/photo/comfy-sofa-in-stylish-apartment-with-living-room-and-kitchen-6284236/" },
  "living-dark-sofa": { alt: "Living room with a dark sofa and a round coffee table", by: "Max Vakhtbovych", title: "Interior of apartment with furniture", page: "https://www.pexels.com/photo/interior-of-apartment-with-furniture-6527037/" },
  "living-light-sofa": { alt: "Bright living room with a light corner sofa", by: "Max Vakhtbovych", title: "Sofa with Pillows in Living Room", page: "https://www.pexels.com/photo/sofa-with-pillows-in-living-room-11701115/" },
  "exterior-balcony-block": { alt: "Apartment block with balconies", by: "George Becker", title: "Photography of Orange and Gray Building", page: "https://www.pexels.com/photo/photography-of-orange-and-gray-building-129494/" },
  "desk-laptop-notebook": { alt: "Desk with a laptop and a notebook", by: "Mikhail Nilov", title: "Minimalist Workspace with Laptop and Notebook", page: "https://www.pexels.com/photo/laptop-notebook-office-pen-7594479/" },
};
const imgUrl = (key, small) => `/assets/images/${key}${small ? '-sm' : ''}.jpg`;   // used by the photo sources page

// Photos of a listing as [{ full, small, alt, sample }].
// Listings from the API carry image paths. Sample photos have a smaller -sm copy for cards; uploaded photos do not.
function photosOf(l) {
  return (l.images || []).map(p => {
    const sample = IMAGES[p.split('/').pop().replace('.jpg', '')];
    return { full: p, small: sample ? p.replace('.jpg', '-sm.jpg') : p, alt: sample ? sample.alt : 'Photo of ' + (l.title || 'the property'), sample: !!sample };
  });
}

// One photo as an <img>, or a calm "coming soon" block when the listing has no photo yet.
function photoHTML(l, n = 0, small = true) {
  const photo = photosOf(l)[n];
  if (!photo) return `<div class="ph">${LOGO_MARK}<span>Photos coming soon</span></div>`;
  return `<img src="${small ? photo.small : photo.full}" alt="${esc(photo.alt)}" loading="lazy" width="${small ? 640 : 1280}" height="${small ? 480 : 960}">`;
}

// ---------- API ----------
// GET a JSON endpoint. Returns the parsed JSON, or null for a 404. Any other problem throws.
async function apiGet(path) {
  const res = await fetch(path);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('API ' + res.status);
  return res.json();
}

// ---------- cards ----------
// variant: '' (normal), 'card-feature' (big, homepage) or 'card-row' (small horizontal, homepage).
function cardHTML(l, variant = '') {
  const fav = getFavs().includes(l.id);
  const ams = l.amenities.slice(0, 2).map(a =>
    `<span class="am">${icon(AMENITY_ICON[a] || 'check', 16)}${esc(a)}</span>`).join('');
  return `<article class="card ${variant}">
    <a class="card-img" href="/property.html?id=${l.id}" tabindex="-1" aria-hidden="true">${photoHTML(l, 0, variant !== 'card-feature')}${photosOf(l)[0]?.sample ? '<span class="sample-tag">Sample photo</span>' : ''}</a>
    <button class="fav" data-fav="${l.id}" aria-pressed="${fav}" aria-label="${fav ? 'Remove from' : 'Add to'} favourites">${icon('heart', 20)}</button>
    <div class="card-body">
      <p class="price">${kes(l.rent)}<small> / month</small></p>
      <h3><a href="/property.html?id=${l.id}">${esc(l.title)}</a></h3>
      <p class="meta">${icon('pin', 16)}<span>${esc(l.location)} · ${l.distance} km from campus</span></p>
      <p class="card-foot"><span class="type">${ROOM_TYPES[l.roomType]}</span>${ams}</p>
    </div>
  </article>`;
}

// ---------- navbar / footer ----------
function renderAdminShell() {
  const here = location.pathname;
  const item = (href, ic, text) => `<a href="${href}"${here === href ? ' aria-current="page"' : ''}>${icon(ic, 20)}${text}</a>`;
  const u = getUser();
  $('#admin-side').innerHTML = `
    <a class="brand" href="/admin/dashboard.html" aria-label="CampusNest admin">${LOGO}</a>
    <p class="side-label">Admin</p>
    <nav class="side-nav" aria-label="Admin">
      ${item('/admin/dashboard.html', 'grid', 'Dashboard')}
      ${item('/admin/listings.html', 'list', 'Moderate listings')}
      <a href="/">${icon('arrow', 20)}View public site</a>
    </nav>
    <div class="side-foot">
      <p class="muted">${u ? esc(u.name) : ''}</p>
      <button class="btn btn-quiet btn-sm" id="logout">${icon('logout', 18)}Log out</button>
    </div>`;
  $('#logout')?.addEventListener('click', logout);
}

function renderChrome() {
  if ($('#admin-side')) return renderAdminShell();
  const u = getUser();
  const links = [['/browse.html', 'Browse'], ['/submit-property.html', 'List a property']];
  if (u?.role === 'student') links.push(['/favourites.html', 'Favourites']);
  if (u?.role === 'admin') links.push(['/admin/dashboard.html', 'Admin']);
  links.push(['/about.html', 'About'], ['/contact.html', 'Contact']);
  const here = location.pathname;
  const nav = links.map(([h, t]) => `<a href="${h}"${here === h ? ' aria-current="page"' : ''}>${t}</a>`).join('');
  const auth = u
    ? `<span class="who">${esc(u.name.split(' ')[0])}</span><button class="btn btn-secondary btn-sm" id="logout">Log out</button>`
    : '<a class="link-quiet" href="/login.html">Log in</a><a class="btn btn-sm" href="/register.html">Sign up</a>';
  const header = $('#site-header');
  if (header) header.innerHTML = `<div class="wrap bar">
    <a class="brand" href="/" aria-label="CampusNest home">${LOGO}</a>
    <button class="menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="nav">${icon('menu', 24)}</button>
    <nav id="nav" aria-label="Main">
      <div class="nav-head"><span class="brand">${LOGO}</span><button class="menu-close" type="button" aria-label="Close menu">${icon('close', 24)}</button></div>
      <div class="nav-links">${nav}</div>
      <div class="nav-auth">${auth}</div>
    </nav></div><div class="scrim" hidden></div>`;
  const footer = $('#site-footer');
  if (footer) footer.innerHTML = `<div class="wrap foot">
    <div class="foot-brand"><a class="brand" href="/" aria-label="CampusNest home">${LOGO}</a>
      <p>Find a place to call home.</p></div>
    <nav class="foot-links" aria-label="Footer"><a href="/browse.html">Browse</a><a href="/submit-property.html">List a property</a><a href="/about.html">About</a><a href="/contact.html">Contact</a></nav>
    <p class="foot-small">CampusNest is an independent student accommodation platform, starting with Daystar University, Athi River. It is not run by the university.<br>
      <a href="/image-sources.html">Photo sources</a> · <a href="/admin/login.html">Admin</a> · <a href="#" id="reset-demo">Clear saved data</a></p></div>`;

  $('#logout')?.addEventListener('click', logout);
  $('#reset-demo')?.addEventListener('click', e => { e.preventDefault(); clearSavedData(); });

  if (!header) return;   // pages without the site header (admin login)

  // Mobile menu: slides in from the right, closes with the X, the backdrop or Escape.
  const nav_ = $('#nav'), scrim = $('.scrim'), btn = $('.menu-btn');
  const setMenu = open => {
    nav_.classList.toggle('open', open); scrim.hidden = !open;
    btn.setAttribute('aria-expanded', open); document.body.classList.toggle('no-scroll', open);
    if (open) $('.menu-close').focus(); else if (nav_.contains(document.activeElement)) btn.focus();
  };
  btn.addEventListener('click', () => setMenu(true));
  $('.menu-close').addEventListener('click', () => setMenu(false));
  scrim.addEventListener('click', () => setMenu(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav_.classList.contains('open')) setMenu(false); });
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
  $$(`[data-fav="${id}"]`).forEach(b => {
    b.setAttribute('aria-pressed', favs.includes(id));
    b.setAttribute('aria-label', favs.includes(id) ? 'Remove from favourites' : 'Add to favourites');
  });
  toast(favs.includes(id) ? 'Saved to favourites' : 'Removed from favourites');
  document.dispatchEvent(new CustomEvent('favchange'));
});

// Guard for pages that need a role. Returns the user, or redirects.
function requireRole(...roles) {
  // If the server later says the session is gone, leave the page.
  document.addEventListener('sessionchange', () => { if (!roles.includes(getUser()?.role)) requireRole(...roles); }, { once: true });
  const u = getUser();
  if (!u || !roles.includes(u.role)) {
    const admin = roles.includes('admin');
    location.href = (admin ? '/admin/login.html' : '/login.html') + '?next=' + encodeURIComponent(location.pathname + location.search);
    return null;
  }
  return u;
}

// The page first shows the saved user (no flicker), then asks the server who is really logged in.
// If they differ, update the saved copy and redraw the header.
async function syncSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return;
    const server = (await res.json()).user;
    const saved = getUser();
    if (JSON.stringify(server) === JSON.stringify(saved)) return;
    if (server) write('cn_user', server); else localStorage.removeItem('cn_user');
    renderChrome();
    document.dispatchEvent(new Event('sessionchange'));
  } catch { /* server offline: keep showing the saved user */ }
}

renderChrome();
syncSession();
