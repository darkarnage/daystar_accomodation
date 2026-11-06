// Property page: shows one listing. Public sees approved only; landlord phone/email only for logged-in students.
const id = Number(new URLSearchParams(location.search).get('id'));
const l = getListings().find(x => x.id === id);
const user = getUser();
const view = $('#view');

// Owners and admins may preview their own non-approved listings; everyone else gets "not found".
const canPreview = user && (user.role === 'admin' || (user.role === 'landlord' && user.id === l?.landlordId));

if (!l || (l.status !== 'approved' && !canPreview)) {
  view.innerHTML = `<div class="state" style="margin:3rem 0"><h2>Listing not found</h2>
    <p class="muted">It may have been removed or is not available yet.</p><a class="btn" href="/browse.html">Back to browse</a></div>`;
} else {
  document.title = l.title + ' · CampusNest';
  const owner = landlordInfo(l.landlordId);
  const here = encodeURIComponent(location.pathname + location.search);

  let contact;
  if (user?.role === 'student') {
    contact = `<p><b>${esc(owner.name)}</b></p>
      <p><a href="tel:${esc(owner.phone.replace(/\s/g, ''))}">Call ${esc(owner.phone)}</a></p>
      <p><a href="mailto:${esc(owner.email)}">${esc(owner.email)}</a></p>
      <p class="muted">Mention CampusNest when you call.</p>`;
  } else if (user) {
    contact = `<p class="muted">Contact details are shown to logged-in students only.</p>`;
  } else {
    contact = `<p class="muted">Log in as a student to see the landlord's phone and email.</p>
      <a class="btn" href="/login.html?next=${here}">Log in</a>
      <a class="btn btn-ghost" href="/register.html">Create account</a>`;
  }

  const banner = l.status === 'approved' ? '' :
    `<div class="alert ${l.status === 'rejected' ? 'alert-error' : ''}">${statusBadge(l.status)} This listing is not public.
     ${l.status === 'rejected' ? esc(l.rejectionReason) : 'Waiting for admin approval.'}</div>`;

  view.innerHTML = `
    <p class="crumbs"><a href="/browse.html">← All listings</a></p>
    ${banner}
    <div class="detail">
      <div>
        <div class="gallery-main"><img id="big" src="${photo(l, 0)}" alt="Photo of ${esc(l.title)}"></div>
        <div class="thumbs">${[0, 1, 2].map(n => `<button type="button" data-n="${n}" aria-label="Photo ${n + 1}" ${n ? '' : 'aria-current="true"'}><img src="${photo(l, n)}" alt=""></button>`).join('')}</div>
        <h1>${esc(l.title)}</h1>
        <p class="muted">${esc(l.location)}</p>
        <div class="facts">
          <div class="fact"><span class="muted">Rent</span><b>${kes(l.rent)}</b></div>
          <div class="fact"><span class="muted">Room type</span><b>${ROOM_TYPES[l.roomType]}</b></div>
          <div class="fact"><span class="muted">To campus</span><b>${l.distance} km</b></div>
          <div class="fact"><span class="muted">Availability</span><b>${l.availability === 'available' ? 'Available' : 'Taken'}</b></div>
        </div>
        <h2>About this place</h2><p>${esc(l.description)}</p>
        <h2>Amenities</h2>
        <p>${l.amenities.map(a => `<span class="tag">✓ ${esc(a)}</span>`).join(' ') || '<span class="muted">None listed</span>'}</p>
      </div>
      <aside class="side panel">
        <p class="price">${kes(l.rent)}<small> / month</small></p>
        ${l.availability === 'taken' ? '<div class="alert">This room is currently taken.</div>' : ''}
        <h3>Landlord contact</h3>
        ${contact}
        <button class="btn btn-ghost" style="width:100%;margin-top:.5rem" data-fav="${l.id}" id="favbtn"></button>
      </aside>
    </div>`;

  $$('.thumbs button').forEach(b => b.addEventListener('click', () => {
    $('#big').src = photo(l, Number(b.dataset.n));
    $$('.thumbs button').forEach(x => x.removeAttribute('aria-current'));
    b.setAttribute('aria-current', 'true');
  }));

  const favLabel = () => { $('#favbtn').textContent = getFavs().includes(l.id) ? '♥ Saved to favourites' : '♡ Save to favourites'; };
  favLabel();
  document.addEventListener('favchange', favLabel);
  if (user && user.role !== 'student') $('#favbtn').hidden = true;   // only students have favourites
}
