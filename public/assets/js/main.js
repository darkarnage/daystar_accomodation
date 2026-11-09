// Shared frontend code: demo data, "session", favourites, navbar/footer, card renderer.
// DEMO MODE: everything lives in localStorage. The real backend will replace the CN.* data helpers.

const ROOM_TYPES = { single: 'Single room', bedsit: 'Bedsit', one_bedroom: 'One bedroom', shared: 'Shared room', hostel: 'Hostel' };
const AMENITIES = ['Wi-Fi', 'Water 24/7', 'Security guard', 'Fenced compound', 'Parking', 'Furnished', 'Own bathroom', 'Kitchen', 'Backup power', 'Near matatu stage'];

// Fake people. Phones/emails are placeholders.
const DEMO_USERS = {
  student: { id: 1, name: 'Faith Wanjiru', email: 'faith@student.daystar.ac.ke', phone: '0700 000 001', role: 'student' },
  admin: { id: 99, name: 'Site Admin', email: 'admin@campusnest.test', phone: '0700 000 099', role: 'admin' },
};
// Contact details of the demo property owners. Submitted listings carry their own contact details.
const LANDLORDS = {
  11: { name: 'Mama Njeri Properties', phone: '0700 000 011', email: 'njeri@example.com' },
  12: { name: 'Mr. Kamau Ochieng', phone: '0700 000 012', email: 'kamau@example.com' },
  13: { name: 'Savannah Court Ltd', phone: '0700 000 013', email: 'savannah@example.com' },
  14: { name: 'Mrs. Achieng Otieno', phone: '0700 000 014', email: 'achieng@example.com' },
};

// [id, owner id, title, type, rent, location, km, availability, status, amenity indexes, description, rejection]
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
// Only students and the admin can log in (there are no landlord accounts).
const getUser = () => { const u = read('cn_user', null); return u && ['student', 'admin'].includes(u.role) ? u : null; };
const getFavs = () => read('cn_favs', []);
function logout() { localStorage.removeItem('cn_user'); location.href = '/'; }
function resetDemo() { ['cn_listings', 'cn_user', 'cn_favs'].forEach(k => localStorage.removeItem(k)); location.href = '/'; }

// Contact details for a listing: the ones typed into the submission form, or the demo owner's.
const listingContact = l => l.contact || LANDLORDS[l.landlordId] || { name: 'Property owner', phone: '', email: '' };

// Public pages only ever show approved listings that are still available.
const isPublic = l => l.status === 'approved' && l.availability === 'available';

// ---------- helpers ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kes = n => 'KES ' + Number(n).toLocaleString('en-KE');
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Only allow same-site redirects after login.
function safeNext(raw) { return raw && /^\/(?!\/)/.test(raw) ? raw : '/'; }

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
  sparkle: '<path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>',
  home: '<path d="m3 11 9-7 9 7M5 10v10h14V10"/>',
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
// Sample photographs (see /credits.html). They are generic examples, NOT pictures of the listed properties.
// Photos by Wikimedia Commons contributors, files in /assets/images (a -sm copy is used on cards).
const IMAGES = {
  'bedroom-dark-wall': { alt: "Bedroom with a double bed and a dark patterned wall", by: "Shixart1985", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Modern_bedroom_design_in_a_stylish_hotel_room_featuring_geometric_patterns_and_soft_linens.jpg" },
  'study-laptop': { alt: "Student studying at a desk with a laptop", by: "English106", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Female_student_writing_and_studying_at_dorm_room_desk.jpg" },
  'dining-kitchenette': { alt: "Small kitchen and dining area in an apartment", by: "Apartman 218", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Apartment_218_kitchen_1.jpg" },
  'bedroom-teal': { alt: "Bedroom with a teal bedspread", by: "Shixart1985", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Cozy_bedroom_with_a_large_bed_and_simple_decor_in_a_modern_home.jpg" },
  'exterior-brick': { alt: "Brick student residence building", by: "Sdkb", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Living_and_Learning_Residence_Hall,_Gallaudet_University.jpg" },
  'bedroom-window': { alt: "Bedroom with a double bed beside a window", by: "Chris Olszewski", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Bedroom,_Interior_of_apartment_in_Brisbane,_2025,_02.jpg" },
  'desk-shelf': { alt: "Study desk with shelving in a student room", by: "tomsky", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Dalian_University_in_2018_62.jpg" },
  'kitchen-wood': { alt: "Kitchen with wooden cabinets", by: "Fanti Salms", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Kitchen_Layout_2.jpg" },
  'exterior-block': { alt: "Brick and white apartment block", by: "Graham Robson\u00a0", license: "CC BY-SA 2.0", page: "https://commons.wikimedia.org/wiki/File:Student_Housing,_Leeds_-_geograph.org.uk_-_4705882.jpg" },
  'living-blue-sofa': { alt: "Bright living room with a blue sofa", by: "Jaros\u0142aw Ceborski jarson", license: "CC0", page: "https://commons.wikimedia.org/wiki/File:Living_room_(Unsplash).jpg" },
  'bedroom-lamps': { alt: "Bedroom with a double bed and bedside lamps", by: "Chris Olszewski", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Bedroom,_Interior_of_apartment_in_Brisbane,_2025,_01.jpg" },
  'kitchen-dining-modern': { alt: "Modern kitchen and dining space", by: "Shixart1985", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Modern_kitchen_and_dining_area_with_stylish_furnishings_and_natural_light_in_a_contemporary_home_setting.jpg" },
  'living-leather-sofa': { alt: "Living room with a leather sofa", by: "Shixart1985", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Modern_living_room_with_stylish_furniture_and_a_view_of_the_outdoors_in_a_cozy_apartment_setting.jpg" },
  'bedroom-mountain': { alt: "Bedroom with a wooden headboard", by: "Shixart1985", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Modern_bedroom_design_with_wooden_mountain_headboard_in_cozy_space.jpg" },
  'exterior-modern': { alt: "Modern apartment building exterior", by: "Elekhh", license: "CC BY-SA 3.0", page: "https://commons.wikimedia.org/wiki/File:Barry_St_Student_Housing_Melbourne_2011.jpg" },
  'hostel-bunks-bright': { alt: "Bright hostel room with bunk beds", by: "LorfHostelsChain", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Typical_dorm_room.jpg" },
  'bunk-room': { alt: "Small room with a bunk bed", by: "Eliedion", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Efteling_Loonsche_Land_Hotel_themed_room_water_-_bunk_beds.jpg" },
  'kitchen-shared': { alt: "Large shared kitchen", by: "Gausanchennai", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Kitchen_1.jpg" },
  'exterior-apartments': { alt: "Row of brick apartment buildings", by: "Andre Carrotflower", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Colvin_Gardens_Apartments,_Buffalo,_New_York_-_20220902.jpg" },
  'bunk-desk': { alt: "Room with a bunk bed and desk", by: "Forest and Kim Starr", license: "CC BY 3.0 us", page: "https://commons.wikimedia.org/wiki/File:Starr-130904-0497-bunk_bed_in_room-Kapahulu_Bunkhouse-Oahu_(24595176053).jpg" },
  'bunk-plain': { alt: "Simple room with a bunk bed", by: "Tiemannl at English Wikipedia", license: "CC BY 2.5", page: "https://commons.wikimedia.org/wiki/File:WRA_Dorm.jpg" },
  'kitchen-steel': { alt: "Kitchen with stainless steel appliances", by: "User:Gnangarra", license: "CC BY 2.5 au", page: "https://commons.wikimedia.org/wiki/File:Modern_kitchen_gnangarra.JPG" },
  'bedroom-attic': { alt: "Bedroom under a pitched roof", by: "Category:Government of the United States Virgin Islands", license: "Public domain", page: "https://commons.wikimedia.org/wiki/File:USVI_IMG_5201_-_Bright_modern_bedroom_with_a_white_vaulted_ceiling_a_colorful_zigzag_rug_and_a_four-poster_bed.jpg" },
  'studio-living': { alt: "Studio apartment living and kitchen area", by: "IFERREIRO", license: "CC BY-SA 3.0", page: "https://commons.wikimedia.org/wiki/File:Flat.jpg" },
  'student-room': { alt: "Student room with a bed beside a window", by: "Kleon3", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:2020_The_Student_Hotel_Maastricht_09.jpg" },
  'hostel-tv': { alt: "Hostel room with bunk beds and a television", by: "Shixart1985", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Modern_bedroom_with_bunked_bed_and_small_table_with_chairs_next_to_a_tv_on_the_wall.jpg" },
  'living-white-sofa': { alt: "Living room with a white sofa", by: "Reiner Kraft from Gilroy, USA", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Living_room_Germany_2006.jpg" },
  'studio-kitchenette': { alt: "Small studio with a sofa and kitchenette", by: "Icade", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Montpellier_studio_icade.jpg" },
  'living-bright': { alt: "Bright living area", by: "Artchapiz", license: "CC0", page: "https://commons.wikimedia.org/wiki/File:Artchapiz1_artchapiz.es_apartment_rental_granada_01.jpg" },
};
// Which sample photos each demo listing shows (first one is the cover). Listings submitted in the demo have no photos yet.
const LISTING_PHOTOS = {
  1: ['bedroom-dark-wall', 'study-laptop', 'dining-kitchenette', 'bedroom-teal', 'exterior-brick'],
  2: ['bedroom-window', 'desk-shelf', 'kitchen-wood', 'exterior-block'],
  3: ['living-blue-sofa', 'bedroom-lamps', 'kitchen-dining-modern', 'living-leather-sofa', 'bedroom-mountain'],
  4: ['hostel-bunks-bright', 'bunk-room', 'kitchen-shared', 'desk-shelf', 'exterior-apartments'],
  5: ['bunk-desk', 'bunk-plain', 'study-laptop', 'kitchen-steel'],
  6: ['bedroom-teal', 'bedroom-window', 'studio-living', 'exterior-block'],
  7: ['bedroom-mountain', 'studio-living', 'kitchen-dining-modern', 'exterior-modern'],
  8: ['bedroom-attic', 'study-laptop', 'kitchen-wood', 'exterior-apartments'],
  9: ['desk-shelf', 'bedroom-dark-wall', 'dining-kitchenette', 'exterior-block'],
  10: ['hostel-tv', 'bunk-room', 'living-white-sofa', 'kitchen-steel', 'exterior-apartments'],
  11: ['bedroom-lamps', 'studio-kitchenette', 'exterior-modern'],
  12: ['bunk-plain', 'kitchen-wood'],
  13: ['living-leather-sofa', 'living-bright', 'kitchen-dining-modern'],
};
const photosOf = l => LISTING_PHOTOS[l.id] || [];
const imgUrl = (key, small) => `/assets/images/${key}${small ? '-sm' : ''}.jpg`;

// One photo as an <img>, or a calm "coming soon" block when the listing has no photo yet.
function photoHTML(l, n = 0, small = true) {
  const key = photosOf(l)[n];
  if (!key) return `<div class="ph">${LOGO_MARK}<span>Photos coming soon</span></div>`;
  return `<img src="${imgUrl(key, small)}" alt="${esc(IMAGES[key].alt)}" loading="lazy" width="${small ? 640 : 1280}" height="${small ? 480 : 960}">`;
}

// ---------- cards ----------
// variant: '' (normal), 'card-feature' (big, homepage) or 'card-row' (small horizontal, homepage).
function cardHTML(l, variant = '') {
  const fav = getFavs().includes(l.id);
  const ams = l.amenities.slice(0, 2).map(a =>
    `<span class="am">${icon(AMENITY_ICON[a] || 'check', 16)}${esc(a)}</span>`).join('');
  return `<article class="card ${variant}">
    <a class="card-img" href="/property.html?id=${l.id}" tabindex="-1" aria-hidden="true">${photoHTML(l, 0, variant !== 'card-feature')}</a>
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
      <a href="/credits.html">Photo credits</a> · <a href="/admin/login.html">Admin</a> · <a href="#" id="reset-demo">Reset demo data</a></p></div>`;

  $('#logout')?.addEventListener('click', logout);
  $('#reset-demo')?.addEventListener('click', e => { e.preventDefault(); resetDemo(); });

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
  const u = getUser();
  if (!u || !roles.includes(u.role)) {
    const admin = roles.includes('admin');
    location.href = (admin ? '/admin/login.html' : '/login.html') + '?next=' + encodeURIComponent(location.pathname + location.search);
    return null;
  }
  return u;
}

renderChrome();
