// Browse page: plain filtering/sorting of the demo listings. Filters live in the URL so links can be shared.
const form = $('#filters');
const sortSel = $('#sort');

$('#amenity-checks').innerHTML = AMENITIES.slice(0, 7).map(a =>
  `<label><input type="checkbox" name="amenity" value="${esc(a)}"> ${esc(a)}</label>`).join('');

// Fill the form from the URL (e.g. coming from the home search).
const params = new URLSearchParams(location.search);
['q', 'type', 'maxRent', 'maxDist'].forEach(k => { if (params.get(k)) form.elements[k].value = params.get(k); });
if (params.get('sort')) sortSel.value = params.get('sort');
params.getAll('amenity').forEach(a => { const box = $(`[name=amenity][value="${CSS.escape(a)}"]`); if (box) box.checked = true; });
if (params.get('hideTaken')) $('#hideTaken').checked = true;

function render() {
  const f = Object.fromEntries(new FormData(form));
  const wanted = $$('[name=amenity]:checked').map(b => b.value);
  const q = (f.q || '').trim().toLowerCase();
  const maxRent = Number(f.maxRent) || Infinity;
  const maxDist = Number(f.maxDist) || Infinity;

  let list = getListings().filter(l =>
    l.status === 'approved' &&                                   // public pages: approved only
    (!q || (l.title + ' ' + l.location + ' ' + l.description).toLowerCase().includes(q)) &&
    (!f.type || l.roomType === f.type) &&
    l.rent <= maxRent && l.distance <= maxDist &&
    wanted.every(a => l.amenities.includes(a)) &&
    !(f.hideTaken && l.availability === 'taken'));

  const s = sortSel.value;
  list.sort((a, b) => s === 'rent' ? a.rent - b.rent : s === 'distance' ? a.distance - b.distance : b.id - a.id);

  $('#count').textContent = list.length + (list.length === 1 ? ' listing found' : ' listings found');
  $('#results').innerHTML = list.length ? list.map(cardHTML).join('') :
    `<div class="state"><h3>No listings match your filters</h3><p class="muted">Try a higher rent, a longer distance, or fewer amenities.</p></div>`;

  // Keep URL in sync (no page reload).
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v && k !== 'amenity') p.set(k, v);
  wanted.forEach(a => p.append('amenity', a));
  if (s) p.set('sort', s);
  history.replaceState(null, '', p.toString() ? '?' + p : location.pathname);
}

form.addEventListener('input', render);
form.addEventListener('submit', e => e.preventDefault());
form.addEventListener('reset', () => setTimeout(render));
sortSel.addEventListener('change', render);
$('#toggle-filters').addEventListener('click', () => form.classList.toggle('open'));
render();
