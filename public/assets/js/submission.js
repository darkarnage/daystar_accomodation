// Landlord form to add or edit a listing. Demo: saves to localStorage with status "pending".
const form = $('#listing-form');
const user = getUser();
const editId = Number(new URLSearchParams(location.search).get('edit')) || 0;
const existing = editId ? getListings().find(l => l.id === editId && l.landlordId === user?.id) : null;

$('#amenities').innerHTML = AMENITIES.map(a => `<label><input type="checkbox" name="amenity" value="${esc(a)}"> ${esc(a)}</label>`).join('');

function setErr(name, text) {
  const field = form.elements[name].closest('.field');
  field.classList.toggle('invalid', !!text);
  $('.err', field).textContent = text || '';
  return !text;
}

if (user?.role !== 'landlord') {
  $('#gate').hidden = false;
} else {
  form.hidden = false;
  if (existing) {   // editing: pre-fill, and warn that it goes back to pending
    $('#page-title').textContent = 'Edit listing';
    ['title', 'roomType', 'rent', 'distance', 'location', 'description', 'availability'].forEach(k => form.elements[k].value = existing[k]);
    existing.amenities.forEach(a => { const b = $(`[name=amenity][value="${CSS.escape(a)}"]`); if (b) b.checked = true; });
    form.insertAdjacentHTML('afterbegin', '<div class="alert">Saving your changes sends the listing back to <b>pending</b> for approval.</div>');
  } else if (editId) {
    form.hidden = true; $('#gate').hidden = false; $('#gate').innerHTML = '<p>That listing was not found, or it is not yours.</p><a class="btn" href="/my-listings.html">My listings</a>';
  }
}

// Photo checks + preview (images are not uploaded in demo mode)
$('#photos').addEventListener('change', e => {
  const files = [...e.target.files];
  const bad = files.length > 5 ? 'Choose at most 5 photos.'
    : files.find(f => !['image/jpeg', 'image/png'].includes(f.type)) ? 'Only JPG or PNG files are allowed.'
    : files.find(f => f.size > 2 * 1024 * 1024) ? 'Each photo must be under 2 MB.' : '';
  setErr('photos', bad);
  $('#preview').innerHTML = bad ? '' : files.map(f => `<img src="${URL.createObjectURL(f)}" alt="" style="width:90px;border-radius:8px">`).join('');
});

form.addEventListener('submit', e => {
  e.preventDefault();
  const v = n => form.elements[n].value.trim();
  const rent = Number(v('rent')), dist = Number(v('distance'));
  const ok = [
    setErr('title', v('title').length >= 5 ? '' : 'Give the listing a title (at least 5 characters).'),
    setErr('roomType', v('roomType') ? '' : 'Choose a room type.'),
    setErr('rent', Number.isInteger(rent) && rent > 0 ? '' : 'Enter the rent as a whole number above 0.'),
    setErr('distance', v('distance') !== '' && dist >= 0 && dist < 100 ? '' : 'Enter the distance in km (0 to 99.9).'),
    setErr('location', v('location') ? '' : 'Enter the area.'),
    setErr('description', v('description').length >= 20 ? '' : 'Describe the place in at least 20 characters.'),
    !$('.invalid [name=photos]') ,
  ].every(Boolean);
  if (!ok) { $('.invalid input, .invalid select, .invalid textarea')?.focus(); return; }

  const fields = {
    title: v('title'), roomType: v('roomType'), rent, distance: dist, location: v('location'),
    description: v('description'), availability: v('availability'),
    amenities: $$('[name=amenity]:checked').map(b => b.value),
    status: 'pending', rejectionReason: '',          // new or edited listings always go to pending
  };
  const all = getListings();
  if (existing) Object.assign(all.find(l => l.id === existing.id), fields);
  else all.push({ id: Math.max(0, ...all.map(l => l.id)) + 1, landlordId: user.id, created: new Date().toISOString().slice(0, 10), ...fields });
  saveListings(all);
  form.hidden = true; $('#done').hidden = false;
});
