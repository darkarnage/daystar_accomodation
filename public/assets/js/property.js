// Property page: shows one listing. The public sees approved + available listings only.
// Landlord phone/email are shown to logged-in students only. Admins can preview any listing.
const id = Number(new URLSearchParams(location.search).get('id'));
const l = getListings().find(x => x.id === id);
const user = getUser();
const view = $('#view');

const canPreview = user?.role === 'admin';

if (!l || (!isPublic(l) && !canPreview)) {
  view.innerHTML = `<div class="state" style="margin:var(--s7) 0">${icon('home', 32)}<h2>Listing not found</h2>
    <p class="muted">It may have been removed, or it is not available right now.</p><a class="btn" href="/browse.html">Back to browse</a></div>`;
} else {
  document.title = l.title + ' · CampusNest';
  const owner = listingContact(l);
  const here = encodeURIComponent(location.pathname + location.search);
  const keys = photosOf(l);
  const available = l.availability === 'available';

  // Contact card: details for students, a login prompt for everyone else.
  let contact;
  if (user?.role === 'student') {
    contact = `<p><b>${esc(owner.name)}</b></p>
      <p class="contact-line">${icon('phone', 18)}<a href="tel:${esc(owner.phone.replace(/\s/g, ''))}">${esc(owner.phone)}</a></p>
      <p class="contact-line">${icon('mail', 18)}<a href="mailto:${esc(owner.email)}">${esc(owner.email)}</a></p>
      <p class="muted small">Mention CampusNest when you call.</p>`;
  } else if (user) {
    contact = `<div class="contact-gate"><div class="lock">${icon('lock', 18)}<span>Contact details are shown to logged-in students only.</span></div></div>`;
  } else {
    contact = `<div class="contact-gate"><div class="lock">${icon('lock', 18)}<span>Log in as a student to see the owner's phone and email.</span></div>
      <a class="btn btn-block" href="/login.html?next=${here}">Log in</a>
      <a class="btn btn-secondary btn-block" href="/register.html">Create a free account</a></div>`;
  }

  // Admin/preview banner for listings that are not public.
  const banner = isPublic(l) ? '' :
    `<div class="alert ${l.status === 'rejected' ? 'alert-error' : ''}">${statusBadge(l.status)}<span>${available ? '' : 'Marked as taken. '}This listing is not public.
     ${l.status === 'rejected' ? esc(l.rejectionReason) : l.status === 'pending' ? 'Waiting for admin approval.' : ''}</span></div>`;

  // Gallery: one big photo plus a mosaic. Missing photos get a calm placeholder.
  const gallery = keys.length
    ? `<div class="gallery" id="gallery" data-n="${keys.length}">
        ${keys.map((k, i) => `<a href="${imgUrl(k)}" data-i="${i}" aria-label="Open photo ${i + 1} of ${keys.length}"><img src="${imgUrl(k, i > 0)}" alt="${esc(IMAGES[k].alt)}" width="${i ? 640 : 1280}" height="${i ? 480 : 960}" ${i ? 'loading="lazy"' : ''}></a>`).join('')}
        ${keys.length > 1 ? `<button class="btn btn-sm gallery-all" type="button" data-i="0">${icon('camera', 16)}View all ${keys.length} photos</button>` : ''}
      </div>
      <p class="gallery-note">Sample photographs for demonstration. They do not show the actual property.</p>`
    : `<div class="gallery" data-n="1"><div class="ph">${LOGO_MARK}<span>The owner has not added photos yet</span></div></div>`;

  const facts = [
    ['bed', 'Room type', ROOM_TYPES[l.roomType]],
    ['route', 'Distance to campus', `${l.distance} km`],
    ['pin', 'Area', l.location.split(',')[0]],
    ['calendar', 'Listed', new Date(l.created).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })],
  ];

  view.innerHTML = `
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> ${icon('right', 14)} <a href="/browse.html">Browse</a> ${icon('right', 14)} <span aria-current="page">${esc(l.title)}</span></nav>
    ${banner}
    <div class="detail-head">
      <div><h1>${esc(l.title)}</h1><p class="loc">${icon('pin', 18)}${esc(l.location)}</p></div>
      ${statusBadge(available ? 'available' : 'taken')}
    </div>
    ${gallery}
    <div class="detail">
      <div>
        <div class="facts">${facts.map(([i, k, v]) => `<div class="fact">${icon(i, 24)}<span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>
        <section><h2>About this place</h2><p class="desc">${esc(l.description)}</p></section>
        <section><h2>Amenities</h2>
          ${l.amenities.length ? `<ul class="amenities">${l.amenities.map(a => `<li>${icon(AMENITY_ICON[a] || 'check', 22)}${esc(a)}</li>`).join('')}</ul>` : '<p class="muted">None listed.</p>'}
        </section>
        <section><h2>Before you pay</h2><p class="muted desc">Visit the place, go with a friend and ask for a written agreement. <a href="/about.html#safety">Read the safety tips</a>.</p></section>
      </div>
      <aside class="side" id="contact" aria-label="Contact">
        <div class="contact-card">
          <p class="price">${kes(l.rent)}<small> / month</small></p>
          <p class="avail">${icon(available ? 'checkCircle' : 'close', 18)}${available ? 'Available now' : 'Currently taken'}</p>
          <button class="btn btn-secondary btn-block save-btn" id="favbtn" type="button" data-fav="${l.id}"></button>
          <h3>Owner contact</h3>
          ${contact}
        </div>
      </aside>
    </div>
    <div class="mobile-bar"><p class="price">${kes(l.rent)}<small> / month</small></p>
      <a class="btn" href="#contact">${user?.role === 'student' ? 'View contact' : 'Contact owner'}</a></div>`;
  document.body.classList.add('has-bar');

  // Save button (students only).
  const favBtn = $('#favbtn');
  const favLabel = () => {
    const saved = getFavs().includes(l.id);
    favBtn.setAttribute('aria-pressed', saved);
    favBtn.innerHTML = `${icon('heart', 18)}${saved ? 'Saved to favourites' : 'Save to favourites'}`;
  };
  favLabel();
  document.addEventListener('favchange', favLabel);
  if (user && user.role !== 'student') favBtn.hidden = true;   // only students have favourites

  // Photo viewer.
  if (keys.length) {
    const box = $('#lightbox'), img = $('#lb-img');
    let at = 0;
    $('#lb-close').innerHTML = icon('close', 22); $('#lb-prev').innerHTML = icon('left', 22); $('#lb-next').innerHTML = icon('right', 22);
    const show = n => {
      at = (n + keys.length) % keys.length;
      img.src = imgUrl(keys[at]); img.alt = IMAGES[keys[at]].alt;
      $('#lb-count').textContent = `Photo ${at + 1} of ${keys.length}`;
    };
    $('#gallery').addEventListener('click', e => {
      const t = e.target.closest('[data-i]');
      if (!t) return;
      e.preventDefault(); show(Number(t.dataset.i)); box.showModal();
    });
    $('#lb-close').addEventListener('click', () => box.close());
    $('#lb-prev').addEventListener('click', () => show(at - 1));
    $('#lb-next').addEventListener('click', () => show(at + 1));
    box.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') show(at - 1); if (e.key === 'ArrowRight') show(at + 1); });
    box.addEventListener('click', e => { if (e.target === box) box.close(); });   // click on the dark area closes it
  }
}
