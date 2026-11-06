// Admin pages (dashboard + moderation). Demo: approve/reject update localStorage.
const admin = requireRole('admin');
const page = document.body.dataset.page;

// Listings that are not public are still shown here. Taken ones get a "taken" badge.
function table(list) {
  if (!list.length) return `<div class="state">${icon('checkCircle', 32)}<h3>Nothing here</h3><p class="muted">No listings in this group.</p></div>`;
  return `<div class="table-wrap"><table>
    <thead><tr><th>Listing</th><th>Submitted by</th><th>Rent</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    ${list.map(l => `<tr>
      <td class="cell-main"><div class="cell-listing">${photoHTML(l, 0)}
        <div><a href="/property.html?id=${l.id}">${esc(l.title)}</a><span class="muted">${esc(l.location)} · ${l.distance} km</span></div></div></td>
      <td data-label="Submitted by">${esc(listingContact(l).name)}</td>
      <td data-label="Rent" class="rent">${kes(l.rent)}</td>
      <td data-label="Status"><div class="statuses">${statusBadge(l.status)}${l.availability === 'taken' ? statusBadge('taken') : ''}</div>
        ${l.status === 'rejected' && l.rejectionReason ? `<span class="reason">${esc(l.rejectionReason)}</span>` : ''}</td>
      <td class="cell-actions"><div class="actions">
        ${l.status !== 'approved' ? `<button class="btn btn-sm" data-act="approve" data-id="${l.id}">Approve</button>` : ''}
        ${l.status !== 'rejected' ? `<button class="btn btn-danger-outline btn-sm" data-act="reject" data-id="${l.id}">Reject</button>` : ''}
      </div></td></tr>`).join('')}
    </tbody></table></div>`;
}

let filter = new URLSearchParams(location.search).get('status') || '';

function draw() {
  const all = getListings();
  const n = s => all.filter(l => l.status === s).length;
  if (page === 'dashboard') {
    $('#stats').innerHTML = `
      <div class="stat pending"><span>Pending review</span><b>${n('pending')}</b></div>
      <div class="stat approved"><span>Approved</span><b>${n('approved')}</b></div>
      <div class="stat rejected"><span>Rejected</span><b>${n('rejected')}</b></div>
      <div class="stat"><span>Total listings</span><b>${all.length}</b></div>`;
    $('#queue').innerHTML = table(all.filter(l => l.status === 'pending'));
  } else {
    const tabs = [['', 'All', all.length], ['pending', 'Pending', n('pending')], ['approved', 'Approved', n('approved')], ['rejected', 'Rejected', n('rejected')]];
    $('#tabs').innerHTML = tabs.map(([s, t, c]) => `<button type="button" data-s="${s}" aria-pressed="${filter === s}" class="${filter === s ? 'on' : ''}">${t}<span class="count">${c}</span></button>`).join('');
    $('#table').innerHTML = table(filter ? all.filter(l => l.status === filter) : all);
  }
}

function setStatus(id, status, reason = '') {
  const all = getListings();
  Object.assign(all.find(l => l.id === id), { status, rejectionReason: reason });
  saveListings(all); draw();
  toast(status === 'approved' ? 'Listing approved' : 'Listing rejected');
}

if (admin) {
  const dialog = $('#reject-dialog');
  let rejecting = 0;
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = Number(b.dataset.id);
    if (b.dataset.act === 'approve') return setStatus(id, 'approved');
    rejecting = id;
    $('#reject-title').textContent = getListings().find(l => l.id === id).title;
    $('#reason').value = ''; $('.err', dialog).textContent = '';
    dialog.showModal();
  });
  $('#reject-ok').addEventListener('click', e => {
    const reason = $('#reason').value.trim();
    if (reason.length < 5) { e.preventDefault(); $('.err', dialog).textContent = 'Give a short reason (at least 5 characters).'; return; }
    setStatus(rejecting, 'rejected', reason);
  });
  $('#tabs')?.addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) { filter = b.dataset.s; draw(); } });
  draw();
}
