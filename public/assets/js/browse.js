// Browse page: plain filtering/sorting of the demo listings. Filters live in the URL so links can be shared.
const form = $('#filters');
const sortSel = $('#sort');

$('#ico-search').outerHTML = icon('search', 20);
$('#ico-filter').outerHTML = icon('filter', 20);
$('#ico-close').outerHTML = icon('close', 24);

$('#amenity-checks').innerHTML = AMENITIES.slice(0, 7).map(a =>
  `<label class="check"><input type="checkbox" name="amenity" value="${esc(a)}"> ${esc(a)}</label>`).join('');

// Fill the form from the URL (e.g. coming from the home search).
const params = new URLSearchParams(location.search);
['q', 'type', 'maxRent', 'maxDist'].forEach(k => { if (params.get(k)) form.elements[k].value = params.get(k); });
if (params.get('sort')) sortSel.value = params.get('sort');
params.getAll('amenity').forEach(a => { const box = $(`[name=amenity][value="${CSS.escape(a)}"]`); if (box) box.checked = true; });

// Words for the active-filter chips.
const chipText = {
  q: v => `“${v}”`,
  type: v => ROOM_TYPES[v],
  maxRent: v => `Up to ${kes(v)}`,
  maxDist: v => `Within ${v} km`,
};

let shown = [];   // listings currently matching (used by the mobile "Show N results" button)

function render() {
  const f = Object.fromEntries(new FormData(form));
  const wanted = $$('[name=amenity]:checked').map(b => b.value);
  const q = (f.q || '').trim().toLowerCase();
  const maxRent = Number(f.maxRent) || Infinity;
  const maxDist = Number(f.maxDist) || Infinity;

  // Public pages: approved AND available only (isPublic), so taken rooms never show up here.
  shown = getListings().filter(l =>
    isPublic(l) &&
    (!q || (l.title + ' ' + l.location + ' ' + l.description).toLowerCase().includes(q)) &&
    (!f.type || l.roomType === f.type) &&
    l.rent <= maxRent && l.distance <= maxDist &&
    wanted.every(a => l.amenities.includes(a)));

  const s = sortSel.value;
  shown.sort((a, b) => s === 'rent' ? a.rent - b.rent : s === 'distance' ? a.distance - b.distance : b.id - a.id);

  $('#count').textContent = shown.length + (shown.length === 1 ? ' listing found' : ' listings found');
  $('#apply').textContent = shown.length ? `Show ${shown.length} ${shown.length === 1 ? 'result' : 'results'}` : 'No results';
  $('#results').innerHTML = shown.length ? shown.map(l => cardHTML(l)).join('') :
    `<div class="state">${icon('search', 32)}<h3>No listings match your filters</h3><p class="muted">Try a higher rent, a longer distance, or fewer amenities.</p><button class="btn btn-secondary" type="button" id="empty-clear">Clear all filters</button></div>`;

  // Active-filter chips (click one to remove it).
  const chips = ['q', 'type', 'maxRent', 'maxDist'].filter(k => f[k] && String(f[k]).trim())
    .map(k => `<button class="chip" type="button" data-clear="${k}">${esc(chipText[k](String(f[k]).trim()))}${icon('close', 14)}<span class="sr-only"> remove</span></button>`)
    .concat(wanted.map(a => `<button class="chip" type="button" data-amenity="${esc(a)}">${esc(a)}${icon('close', 14)}</button>`));
  $('#chips').innerHTML = chips.length ? chips.join('') + '<button class="clear-all" type="button" data-clear="all">Clear all</button>' : '';

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
document.addEventListener('favchange', render);

// Chips and the empty-state button remove filters.
document.addEventListener('click', e => {
  const chip = e.target.closest('[data-clear], [data-amenity], #empty-clear');
  if (!chip) return;
  if (chip.dataset.amenity) { const box = $(`[name=amenity][value="${CSS.escape(chip.dataset.amenity)}"]`); if (box) box.checked = false; }
  else if (chip.dataset.clear && chip.dataset.clear !== 'all') form.elements[chip.dataset.clear].value = '';
  else { form.reset(); return; }
  render();
});

// Mobile: the filter panel is a bottom sheet.
const scrim = $('#filter-scrim'), toggle = $('#toggle-filters');
const setSheet = open => {
  form.classList.toggle('open', open); scrim.hidden = !open;
  toggle.setAttribute('aria-expanded', open); document.body.classList.toggle('no-scroll', open);
  if (open) $('#close-filters').focus(); else if (form.contains(document.activeElement)) toggle.focus();
};
toggle.addEventListener('click', () => setSheet(true));
$('#close-filters').addEventListener('click', () => setSheet(false));
$('#apply').addEventListener('click', () => { setSheet(false); $('#count').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
scrim.addEventListener('click', () => setSheet(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && form.classList.contains('open')) setSheet(false); });
// If the window grows past the mobile size while the sheet is open, close it.
matchMedia('(min-width: 901px)').addEventListener('change', e => { if (e.matches) setSheet(false); });

render();
