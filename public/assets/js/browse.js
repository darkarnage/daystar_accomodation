// Browse page: plain filtering/sorting of the demo listings. Filters live in the URL so links can be shared.
const form = $('#filters');
const sortSel = $('#sort');

$('#ico-search').outerHTML = icon('search', 20);
$('#ico-filter').outerHTML = icon('filter', 20);
$('#ico-close').outerHTML = icon('close', 24);
$('#ico-ai').outerHTML = icon('sparkle', 18);

$('#amenity-checks').innerHTML = AMENITIES.slice(0, 7).map(a =>
  `<label class="check"><input type="checkbox" name="amenity" value="${esc(a)}"> ${esc(a)}</label>`).join('');

// Fill the form from the URL (e.g. coming from the home search).
const params = new URLSearchParams(location.search);
// The distance menu has a few fixed choices. If we are given another number (from the URL or from AI search), add it as a choice.
function setDistance(value) {
  const select = form.elements.maxDist;
  if (![...select.options].some(o => o.value === String(value))) select.add(new Option(`Within ${value} km`, String(value)));
  select.value = String(value);
}
['q', 'type', 'maxRent'].forEach(k => { if (params.get(k)) form.elements[k].value = params.get(k); });
if (Number(params.get('maxDist')) > 0) setDistance(params.get('maxDist'));
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

// The active filters as one object, and the API query string for them (also used to test "what if I relax this?").
const stateFromForm = () => {
  const f = Object.fromEntries(new FormData(form));
  return { q: (f.q || '').trim(), type: f.type || '', maxRent: Number(f.maxRent) > 0 ? f.maxRent : '', maxDist: Number(f.maxDist) > 0 ? f.maxDist : '',
    amenity: $$('[name=amenity]:checked').map(b => b.value), sort: sortSel.value };
};
function queryFor(st, extra = {}) {
  const api = new URLSearchParams();
  if (st.q) api.set('q', st.q);
  if (st.type) api.set('type', st.type);
  if (st.maxRent) api.set('maxRent', st.maxRent);
  if (st.maxDist) api.set('maxDist', st.maxDist);
  st.amenity.forEach(a => api.append('amenity', a));
  if (st.sort) api.set('sort', st.sort);
  for (const [k, v] of Object.entries(extra)) api.set(k, v);
  return api.toString();
}

// Specific ways to loosen the active filters, one change each. Only the active filters produce an option.
const DIST_STEPS = [1, 2, 5, 10];
function relaxOptions(st) {
  const out = [];
  if (st.q) out.push({ label: `Remove the keyword “${st.q}”`, next: { ...st, q: '' } });
  if (st.type) out.push({ label: `Show all room types, not just ${ROOM_TYPES[st.type]}`, next: { ...st, type: '' } });
  if (st.maxRent) out.push({ label: `Remove the rent limit (now up to ${kes(st.maxRent)})`, next: { ...st, maxRent: '' } });
  if (st.maxDist) {
    const wider = DIST_STEPS.find(d => d > Number(st.maxDist));
    out.push(wider ? { label: `Widen the distance from ${st.maxDist} km to ${wider} km`, next: { ...st, maxDist: String(wider) } }
                   : { label: `Remove the distance limit (now within ${st.maxDist} km)`, next: { ...st, maxDist: '' } });
  }
  st.amenity.forEach(a => out.push({ label: `Drop the “${a}” requirement`, next: { ...st, amenity: st.amenity.filter(x => x !== a) } }));
  return out;
}
let suggestions = [];   // the options currently shown under "No listings match", picked by data-relax="index"

// After a search finds nothing: ask the normal search how many listings each single relaxation would find,
// and suggest only the ones that find something (best first).
async function showSuggestions(st, mine) {
  const box = $('#suggest');
  const options = relaxOptions(st);
  if (!box || !options.length) return;
  const counts = await Promise.all(options.map(o => apiGet('/api/listings?' + queryFor(o.next)).then(d => d.count).catch(() => 0)));
  if (mine !== latest) return;   // the filters changed while we were asking
  suggestions = options.map((o, i) => ({ ...o, count: counts[i] })).filter(o => o.count > 0).sort((x, y) => y.count - x.count).slice(0, 4);
  box.innerHTML = suggestions.length
    ? `<p><b>You could try:</b></p><div class="suggest-list">${suggestions.map((o, i) =>
        `<button class="btn btn-secondary btn-sm" type="button" data-relax="${i}">${esc(o.label)} <span class="muted">(${o.count} ${o.count === 1 ? 'listing' : 'listings'})</span></button>`).join('')}</div>`
    : '<p class="muted">Loosening any single filter still finds nothing, so try clearing all filters.</p>';
}

// Search, filter and sort happen in SQL: this just sends the form values to GET /api/listings.
async function render() {
  const st = stateFromForm();
  const f = { q: st.q, type: st.type, maxRent: st.maxRent, maxDist: st.maxDist };
  const wanted = st.amenity;
  const api = queryFor(st);

  // Active-filter chips (click one to remove it).
  const chips = ['q', 'type', 'maxRent', 'maxDist'].filter(k => f[k] && String(f[k]).trim())
    .map(k => `<button class="chip" type="button" data-clear="${k}">${esc(chipText[k](String(f[k]).trim()))}${icon('close', 14)}<span class="sr-only"> remove</span></button>`)
    .concat(wanted.map(a => `<button class="chip" type="button" data-amenity="${esc(a)}">${esc(a)}${icon('close', 14)}</button>`));
  $('#chips').innerHTML = chips.length ? chips.join('') + '<button class="clear-all" type="button" data-clear="all">Clear all</button>' : '';

  // Keep URL in sync (no page reload).
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v && k !== 'amenity') p.set(k, v);
  wanted.forEach(a => p.append('amenity', a));
  if (st.sort) p.set('sort', st.sort);
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
    `<div class="state">${icon('search', 32)}<h3>No listings match your filters</h3><p class="muted">Try a higher rent, a longer distance, or fewer amenities.</p><div id="suggest" class="suggest" aria-live="polite"></div><button class="btn btn-secondary" type="button" id="empty-clear">Clear all filters</button></div>`;
  if (!shown.length) await showSuggestions(st, mine);
}

// Typing in the search box waits a moment so we do not send a request for every key press.
let timer;
form.addEventListener('input', () => { clearAiNote(); render(); });
// The search box sits outside the <form> (it is linked with form="filters"), so its typing is listened to separately.
$('#q').addEventListener('input', () => { clearAiNote(); clearTimeout(timer); timer = setTimeout(render, 250); });
form.addEventListener('submit', e => e.preventDefault());
let applying = false;   // true while applyAiFilters() resets the form itself: that reset must not start its own extra search
form.addEventListener('reset', () => { if (applying) return; clearAiNote(); setTimeout(render); });
sortSel.addEventListener('change', render);

// Chips and the empty-state button remove filters.
document.addEventListener('click', e => {
  if (e.target.closest('#retry')) return render();
  const relax = e.target.closest('[data-relax]');
  if (relax) { const o = suggestions[Number(relax.dataset.relax)]; if (o) { clearAiNote(); applyAiFilters(o.next); } return; }
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

// ---------- AI-assisted search (optional extra) ----------
// The box is shown only if the server has a Gemini key. The server turns the sentence into filters, and this page
// puts those filters into the normal filter form, so the results come from the same search as everything else.
// If AI is off or fails, nothing else on the page is affected.
const aiBox = $('#ai-box'), aiNote = $('#ai-note');
function clearAiNote() { aiNote.textContent = ''; }
apiGet('/api/ai-search/status').then(s => { if (s?.enabled) aiBox.hidden = false; }).catch(() => {});

// Fill the filter form from the filters the server sent back, then search.
function applyAiFilters(f) {
  applying = true; form.reset(); applying = false;   // start from a clean slate
  sortSel.value = f.sort || '';
  $('#q').value = f.q || '';
  form.elements.type.value = f.type || '';
  form.elements.maxRent.value = f.maxRent || '';
  if (f.maxDist) setDistance(f.maxDist);
  (f.amenity || []).forEach(a => { const box = $(`[name=amenity][value="${CSS.escape(a)}"]`); if (box) box.checked = true; });
  return render();
}

$('#ai-form').addEventListener('submit', async e => {
  e.preventDefault();
  const text = $('#ai-q').value.trim();
  if (text.length < 3) { aiNote.textContent = 'Describe what you are looking for, for example "single room under 6000 within 2 km".'; return; }
  const button = $('#ai-go');
  button.disabled = true; button.classList.add('is-loading'); aiNote.textContent = '';
  let status = 0, data = {};
  try {
    const res = await fetch('/api/ai-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: text }) });
    status = res.status; data = await res.json().catch(() => ({}));
  } catch { /* network problem: status stays 0 */ }
  button.disabled = false; button.classList.remove('is-loading');

  if (status !== 200) {
    aiNote.textContent = status === 0 ? 'Cannot reach the server. You can still use the filters below.' : (data.error || 'AI search is not available right now. You can still use the filters below.');
    return;
  }
  if (!data.understood?.length) {
    aiNote.textContent = "I couldn't turn that into filters. Try mentioning a room type, a budget or a distance, or use the filters below.";
    return;
  }
  await applyAiFilters(data.filters);
  // A keyword is the most fragile filter (it must appear in the title, area or description). If it is the reason
  // nothing was found, search again without it and keep every other filter; if that still finds nothing, undo.
  let dropped = '';
  if (data.filters.q && !shown.length) {
    await applyAiFilters({ ...data.filters, q: '' });
    if (shown.length) dropped = data.filters.q; else await applyAiFilters(data.filters);
  }
  const chips = data.understood.filter(t => !dropped || t !== `“${dropped}”`);
  aiNote.innerHTML = `<b>Showing:</b> ${chips.map(t => `<span class="ai-chip">${esc(t)}</span>`).join(' ')}` +
    (dropped ? ` <span class="muted small">Nothing matched the keyword “${esc(dropped)}”, so I searched without it.</span>` : '') +
    ` <span class="muted small">Change them with the filters below.</span>`;
  aiNote.scrollIntoView({ behavior: 'smooth', block: 'start' });   // the note and the results below it
});

// First load: show placeholders until the API answers.
$('#results').innerHTML = '<div class="card card-skel"></div>'.repeat(6);
render();
