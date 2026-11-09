// Public property submission form (no account needed). Sends the fields and photos to POST /api/submissions.
// The server re-checks everything and saves the listing as "pending" until an admin approves it.
const form = $('#listing-form');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+254|0)[17]\d{2}[\s-]?\d{3}[\s-]?\d{3}$/;

$('#ico-camera').outerHTML = icon('camera', 28);
$('#done-icon').innerHTML = icon('checkCircle', 30);
$('#amenities').innerHTML = AMENITIES.map(a => `<label class="check"><input type="checkbox" name="amenity" value="${esc(a)}"> ${esc(a)}</label>`).join('');

function setErr(name, text) {
  const field = form.elements[name].closest('.field');
  field.classList.toggle('invalid', !!text);
  $('.err', field).textContent = text || '';
  return !text;
}

// Photo checks + preview (images are not uploaded in demo mode)
$('#photos').addEventListener('change', e => {
  const files = [...e.target.files];
  const bad = files.length > 5 ? 'Choose at most 5 photos.'
    : files.find(f => !['image/jpeg', 'image/png'].includes(f.type)) ? 'Only JPG or PNG files are allowed.'
    : files.find(f => f.size > 2 * 1024 * 1024) ? 'Each photo must be under 2 MB.' : '';
  setErr('photos', bad);
  $('#preview').innerHTML = bad ? '' : files.map(f => `<img src="${URL.createObjectURL(f)}" alt="Selected photo preview">`).join('');
});

form.addEventListener('submit', async e => {
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
    !$('.invalid [name=photos]'),
    setErr('contactName', v('contactName').length >= 2 ? '' : 'Enter your name or business name.'),
    setErr('contactPhone', PHONE_RE.test(v('contactPhone')) ? '' : 'Enter a Kenyan number like 0712 345 678.'),
    setErr('contactEmail', EMAIL_RE.test(v('contactEmail')) ? '' : 'Enter a valid email address.'),
  ].every(Boolean);
  if (!ok) { $('.invalid input, .invalid select, .invalid textarea')?.focus(); return; }

  // Send the form as multipart data. The browser adds the boundary, so no Content-Type header is set here.
  const data = new FormData(form);
  $('#form-error').hidden = true;
  const button = $('button[type=submit]', form);
  button.disabled = true; button.classList.add('is-loading');
  let status = 0, result = {};
  try {
    const res = await fetch('/api/submissions', { method: 'POST', body: data });
    status = res.status; result = await res.json().catch(() => ({}));
  } catch { /* network problem: status stays 0 */ }
  button.disabled = false; button.classList.remove('is-loading');

  if (status === 201) {
    form.hidden = true; $('#done').hidden = false;
    $('#done-title').textContent = v('title');
    scrollTo({ top: 0 });
    return;
  }
  // Show the server's per-field messages next to the fields; anything else goes in the alert above the buttons.
  const fieldErrors = Object.entries(result.errors || {}).filter(([name]) => form.elements[name]);
  fieldErrors.forEach(([name, message]) => setErr(name, message));
  if (fieldErrors.length) { $('.invalid input, .invalid select, .invalid textarea')?.focus(); return; }
  const other = result.errors?.amenity ||
    (status === 429 ? result.error : status === 0 ? 'Cannot reach the server. Please check your connection and try again.' : result.error || 'Something went wrong. Please try again.');
  $('#form-error').innerHTML = icon('close', 20) + '<span></span>';
  $('#form-error span').textContent = other;
  $('#form-error').hidden = false;
});
