// Admin pages (dashboard + moderation). Demo: approve/reject update localStorage.
const admin = requireRole('admin');
const owner = id => landlordInfo(id).name;

function table(list) {
  if (!list.length) return '<div class="state"><h3>Nothing here</h3><p class="muted">No listings in this group.</p></div>';
  return `<div class="table-wrap"><table>
    <thead><tr><th>Listing</th><th>Landlord</th><th>Rent</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    ${list.map(l => `<tr>
      <td><a href="/property.html?id=${l.id}"><b>${esc(l.title)}</b></a><br><span class="muted">${esc(l.location)} · ${l.distance} km</span>
        ${l.status === 'rejected' ? `<br><span class="muted">Reason: ${esc(l.rejectionReason)}</span>` : ''}</td>
      <td>${esc(owner(l.landlordId))}</td><td>${kes(l.rent)}</td><td>${statusBadge(l.status)}</td>
      <td><div class="actions">
        ${l.status !== 'approved' ? `<button class="btn btn-sm" data-act="approve" data-id="${l.id}">Approve</button>` : ''}
        ${l.status !== 'rejected' ? `<button class="btn btn-ghost btn-sm" data-act="reject" data-id="${l.id}">Reject</button>` : ''}
      </div></td></tr>`).join('')}
    </tbody></table></div>`;
}

let filter = new URLSearchParams(location.search).get('status') || '';
const mount = document.body.dataset.page === 'dashboard' ? 'queue' : 'table';

function draw() {
  const all = getListings();
  if (document.body.dataset.page === 'dashboard') {
    const n = s => all.filter(l => l.status === s).length;
    $('#stats').innerHTML = `
      <div class="stat warn"><b>${n('pending')}</b>Pending review</div>
      <div class="stat"><b>${n('approved')}</b>Approved</div>
      <div class="stat"><b>${n('rejected')}</b>Rejected</div>
      <div class="stat"><b>${all.length}</b>Total listings</div>`;
    $('#queue').innerHTML = table(all.filter(l => l.status === 'pending'));
  } else {
    $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.s === filter));
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
  $('#tabs')?.addEventListener('click', e => { if (e.target.dataset.s !== undefined) { filter = e.target.dataset.s; draw(); } });
  draw();
}
