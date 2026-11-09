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

let shown = [];   // listings currently matching
let latest = 0;   // numbers each request so a slow, old answer can never replace a newer one

// Search, filter and sort happen in SQL: this just sends the form values to GET /api/listings.
async function render() {
  const f = Object.fromEntries(new FormData(form));
  const wanted = $$('[name=amenity]:checked').map(b => b.value);
  const s = sortSel.value;

  const api = new URLSearchParams();
  if ((f.q || '').trim()) api.set('q', f.q.trim());
  if (f.type) api.set('type', f.type);
  if (Number(f.maxRent) > 0) api.set('maxRent', f.maxRent);
  if (Number(f.maxDist) > 0) api.set('maxDist', f.maxDist);
  wanted.forEach(a => api.append('amenity', a));
  if (s) api.set('sort', s);

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

  const mine = ++latest;
  try {
    const data = await apiGet('/api/listings?' + api);
    if (mine !== latest) return;   // a newer request has started
    shown = data.listings;
  } catch {
    if (mine !== latest) return;
    $('#count').textContent = '';
    $('#results').innerHTML = `<div class="state">${icon('close', 32)}<h3>Could not load listings</h3><p class="muted">Check your connection and try again.</p><button class="btn btn-secondary" type="button" id="retry">Try again</button></div>`;
    return;
  }

  $('#count').textContent = shown.length + (shown.length === 1 ? ' listing found' : ' listings found');
  $('#apply').textContent = shown.length ? `Show ${shown.length} ${shown.length === 1 ? 'result' : 'results'}` : 'No results';
  $('#results').innerHTML = shown.length ? shown.map(l => cardHTML(l)).join('') :
    `<div class="state">${icon('search', 32)}<h3>No listings match your filters</h3><p class="muted">Try a higher rent, a longer distance, or fewer amenities.</p><button class="btn btn-secondary" type="button" id="empty-clear">Clear all filters</button></div>`;
}

// Typing in the search box waits a moment so we do not send a request for every key press.
let timer;
form.addEventListener('input', render);
// The search box sits outside the <form> (it is linked with form="filters"), so its typing is listened to separately.
$('#q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 250); });
form.addEventListener('submit', e => e.preventDefault());
form.addEventListener('reset', () => setTimeout(render));
sortSel.addEventListener('change', render);

// Chips and the empty-state button remove filters.
document.addEventListener('click', e => {
  if (e.target.closest('#retry')) return render();
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

// First load: show placeholders until the API answers.
$('#results').innerHTML = '<div class="card card-skel"></div>'.repeat(6);
render();
