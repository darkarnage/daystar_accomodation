// Admin pages (dashboard + moderation). Everything here talks to /api/admin, which only answers to a logged-in admin.
// Changes (approve, reject, delete) also send the session's CSRF token in the X-CSRF-Token header.
const page = document.body.dataset.page;
let csrf = '';

// Call the admin API. Returns { status, data }. Logged out (401) sends you to the admin login page.
async function adminApi(method, path, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-CSRF-Token'] = csrf;
  let res;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    return { status: 0, data: {} };
  }
  if (res.status === 401) { location.href = '/admin/login.html?next=' + encodeURIComponent(location.pathname + location.search); return { status: 401, data: {} }; }
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

// One table row per listing. Taken listings get a "taken" badge. The thumbnail is the first photo.
function table(list) {
  if (!list.length) return `<div class="state">${icon('checkCircle', 32)}<h3>Nothing here</h3><p class="muted">No listings in this group.</p></div>`;
  return `<div class="table-wrap"><table>
    <thead><tr><th>Listing</th><th>Submitted by</th><th>Rent</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    ${list.map(l => `<tr>
      <td class="cell-main"><div class="cell-listing">${photoHTML(l, 0)}
        <div><a href="/property.html?id=${l.id}">${esc(l.title)}</a><span class="muted">${esc(l.location)} · ${l.distance} km</span></div></div></td>
      <td data-label="Submitted by"><div>${esc(l.contact.name)}<span class="muted small contact-sub">${esc(l.contact.phone)} · ${esc(l.contact.email)}</span></div></td>
      <td data-label="Rent" class="rent">${kes(l.rent)}</td>
      <td data-label="Status"><div class="statuses">${statusBadge(l.status)}${l.availability === 'taken' ? statusBadge('taken') : ''}</div>
        ${l.status === 'rejected' && l.rejectionReason ? `<span class="reason">${esc(l.rejectionReason)}</span>` : ''}</td>
      <td class="cell-actions"><div class="actions">
        ${l.status !== 'approved' ? `<button class="btn btn-sm" data-act="approve" data-id="${l.id}">Approve</button>` : ''}
        ${l.status !== 'rejected' ? `<button class="btn btn-danger-outline btn-sm" data-act="reject" data-id="${l.id}">Reject</button>` : ''}
        <button class="btn btn-quiet btn-sm btn-delete" data-act="delete" data-id="${l.id}" aria-label="Delete ${esc(l.title)}">${icon('trash', 16)}Delete</button>
      </div></td></tr>`).join('')}
    </tbody></table></div>`;
}

let filter = new URLSearchParams(location.search).get('status') || '';
let listings = [];   // what is currently shown, so dialogs can show the title

async function draw() {
  // The dashboard shows pending listings; the moderation page shows the chosen tab. Counts always cover everything.
  const { status, data } = await adminApi('GET', '/api/admin/listings' + (page === 'dashboard' ? '?status=pending' : filter ? '?status=' + filter : ''));
  if (status !== 200) {
    $('#queue, #table').innerHTML = `<div class="state">${icon('close', 32)}<h3>Could not load listings</h3><p class="muted">Check your connection and try again.</p><button class="btn btn-secondary" type="button" onclick="location.reload()">Try again</button></div>`;
    return;
  }
  listings = data.listings;
  const c = data.counts;
  if (page === 'dashboard') {
    $('#stats').innerHTML = `
      <div class="stat pending"><span>Pending review</span><b>${c.pending}</b></div>
      <div class="stat approved"><span>Approved</span><b>${c.approved}</b></div>
      <div class="stat rejected"><span>Rejected</span><b>${c.rejected}</b></div>
      <div class="stat"><span>Total listings</span><b>${c.all}</b></div>`;
    $('#queue').innerHTML = table(listings);
  } else {
    const tabs = [['', 'All', c.all], ['pending', 'Pending', c.pending], ['approved', 'Approved', c.approved], ['rejected', 'Rejected', c.rejected]];
    $('#tabs').innerHTML = tabs.map(([s, t, n]) => `<button type="button" data-s="${s}" aria-pressed="${filter === s}" class="${filter === s ? 'on' : ''}">${t}<span class="count">${n}</span></button>`).join('');
    $('#table').innerHTML = table(listings);
  }
}

// Run a change, then reload the list. A 403 means the security token no longer matches this login, so reload the page.
async function change(method, path, body, doneMessage) {
  const { status, data } = await adminApi(method, path, body);
  if (status === 200) { toast(doneMessage); await draw(); return data; }
  if (status === 403) { toast('Your session changed. Reloading…'); setTimeout(() => location.reload(), 1200); return null; }
  if (status === 404) { toast('That listing no longer exists.'); await draw(); return null; }
  toast(status === 0 ? 'Cannot reach the server.' : (data.error || 'Something went wrong. Please try again.'));
  return null;
}

(async () => {
  // Who is logged in? Only an admin may stay. The same answer carries the CSRF token for this session.
  let me = null;
  try { me = await (await fetch('/api/auth/me')).json(); } catch { /* offline */ }
  if (me?.user?.role !== 'admin') {
    location.href = '/admin/login.html?next=' + encodeURIComponent(location.pathname + location.search);
    return;
  }
  csrf = me.csrfToken;

  const rejectDialog = $('#reject-dialog'), deleteDialog = $('#delete-dialog');
  let target = 0;
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    target = Number(b.dataset.id);
    const title = listings.find(l => l.id === target)?.title || '';
    if (b.dataset.act === 'approve') return change('POST', `/api/admin/listings/${target}/approve`, {}, 'Listing approved');
    if (b.dataset.act === 'reject') {
      $('#reject-title').textContent = title; $('#reason').value = ''; $('.err', rejectDialog).textContent = '';
      rejectDialog.showModal();
    } else {
      $('#delete-title').textContent = title;
      deleteDialog.showModal();
    }
  });
  $('#reject-ok').addEventListener('click', async e => {
    e.preventDefault();   // keep the dialog open until the server has answered
    const reason = $('#reason').value.trim();
    if (reason.length < 5) { $('.err', rejectDialog).textContent = 'Give a short reason (at least 5 characters).'; return; }
    const done = await change('POST', `/api/admin/listings/${target}/reject`, { reason }, 'Listing rejected');
    if (done) rejectDialog.close(); else $('.err', rejectDialog).textContent = 'Could not reject the listing. Try again.';
  });
  $('#delete-ok').addEventListener('click', async e => {
    e.preventDefault();
    const done = await change('DELETE', `/api/admin/listings/${target}`, undefined, 'Listing deleted');
    deleteDialog.close();
    if (!done) return;
  });
  $('#tabs')?.addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) { filter = b.dataset.s; draw(); } });
  draw();
})();
