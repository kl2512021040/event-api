document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('token');
  let currentUser;
  try { currentUser = JSON.parse(sessionStorage.getItem('user') || 'null'); } catch { currentUser = null; }
  if (!token || !currentUser || !['admin', 'super_admin'].includes(currentUser.role)) {
    location.href = '../index.html'; return;
  }
  const $ = id => document.getElementById(id);
  const isSuper = currentUser.role === 'super_admin';
  const actorId = Number(currentUser.user_id ?? currentUser.id);
  let users = [];
  const name = currentUser.full_name || currentUser.name || currentUser.email || 'Administrator';
  $('adminName').textContent = name;
  $('adminRole').textContent = currentUser.role.replaceAll('_', ' ');
  $('adminAvatar').textContent = name.trim().charAt(0).toUpperCase() || 'A';
  $('currentDate').textContent = new Intl.DateTimeFormat('en-MY', {day:'numeric',month:'short',year:'numeric'}).format(new Date());

  function alertBox(id, message = '', success = false) {
    const el = $(id); el.textContent = message;
    el.className = success ? 'um-alert success' : 'um-alert';
    el.style.display = message ? 'block' : 'none';
  }
  function errorMessage(error) { return error.apiMessage || error.message || 'Request failed.'; }
  async function apiRequest(endpoint, options = {}) {
    let response;
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: { Accept:'application/json', Authorization:`Bearer ${token}`,
          ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers || {}) }
      });
    } catch { throw new Error('Cannot connect to API. Check Apache and MySQL.'); }
    if (response.status === 401) {
      sessionStorage.removeItem('token'); sessionStorage.removeItem('user');
      location.href = '../index.html'; throw new Error('Session expired.');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.status === false) {
      const error = new Error(payload.message || `HTTP ${response.status}`);
      error.status = response.status; error.apiMessage = payload.message; throw error;
    }
    return payload;
  }
  function extractUsers(payload) {
    for (const candidate of [payload?.data, payload?.data?.users, payload?.users]) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  }
  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }
  function idOf(user) { return Number(user.user_id ?? user.id); }
  function roleOf(user) { return String(user.role || 'customer').toLowerCase(); }
  function canManage(user) {
    if (idOf(user) === actorId) return false;
    const role = roleOf(user);
    if (role === 'admin' || role === 'super_admin') return false;
    return isSuper ? ['customer','organiser'].includes(role) : role === 'customer';
  }
  function showTableMessage(message) {
    $('usersTableBody').innerHTML = `<tr><td colspan="5" class="um-table-message">${escapeHTML(message)}</td></tr>`;
  }
  function renderUsers() {
    const search = $('searchUsers').value.trim().toLowerCase();
    const selected = $('roleFilter').value;
    const filtered = users.filter(user => {
      const fullName = String(user.full_name ?? user.name ?? '').toLowerCase();
      return (fullName.includes(search) || String(user.email || '').toLowerCase().includes(search)) &&
        (selected === 'all' || roleOf(user) === selected);
    });
    $('totalUsers').textContent = users.length.toLocaleString('en-MY');
    if (!filtered.length) { showTableMessage(users.length ? 'No users match your search.' : 'No users available.'); return; }
    $('usersTableBody').innerHTML = filtered.map(user => {
      const id = idOf(user), role = roleOf(user), allowed = canManage(user);
      const roleClass = ['customer','organiser','admin','super_admin'].includes(role) ? role : 'customer';
      return `<tr><td>${escapeHTML(id)}</td><td><span class="um-user-name">${escapeHTML(user.full_name ?? user.name ?? '')}</span></td>
        <td><span class="um-user-email">${escapeHTML(user.email)}</span></td>
        <td><span class="um-role um-role-${roleClass}">${escapeHTML(role.replaceAll('_',' '))}</span></td>
        <td>${allowed ? `<button type="button" class="um-action-btn" data-action="edit" data-id="${id}"><i class="bi bi-pencil"></i> Edit</button>
          <button type="button" class="um-action-btn um-action-danger" data-action="delete" data-id="${id}"><i class="bi bi-trash"></i> Delete</button>` : '<span class="text-muted small">Protected</span>'}</td></tr>`;
    }).join('');
  }
  async function loadUsers() {
    $('refreshButton').disabled = true;
    showTableMessage('Loading users...');
    try { users = extractUsers(await apiRequest('/users')); renderUsers(); }
    catch (error) { users = []; $('totalUsers').textContent = '—'; showTableMessage('Unable to load users.'); alertBox('pageAlert', errorMessage(error)); }
    finally { $('refreshButton').disabled = false; }
  }
  function openModal(id, focusId) { $(id).hidden = false; if (focusId) $(focusId).focus(); }
  function closeModal(id) { $(id).hidden = true; }
  $('addCustomerButton').addEventListener('click', () => { $('customerForm').reset(); alertBox('formAlert'); openModal('customerModal','customerName'); });
  for (const id of ['closeCustomerModal','cancelCustomerButton']) $(id).addEventListener('click', () => closeModal('customerModal'));
  for (const id of ['closeEditModal','cancelEditButton']) $(id).addEventListener('click', () => closeModal('editModal'));
  for (const id of ['customerModal','editModal']) $(id).addEventListener('click', event => { if (event.target === $(id)) closeModal(id); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') for (const id of ['customerModal','editModal']) closeModal(id); });
  $('customerForm').addEventListener('submit', async event => {
    event.preventDefault(); alertBox('formAlert');
    const button = $('saveCustomerButton'); button.disabled = true;
    try {
      await apiRequest('/auth/register', {method:'POST', body:JSON.stringify({
        full_name:$('customerName').value.trim(), email:$('customerEmail').value.trim(), password:$('customerPassword').value
      })});
      closeModal('customerModal'); await loadUsers(); alertBox('pageAlert','Customer account created successfully.',true);
    } catch (error) { alertBox('formAlert', errorMessage(error)); }
    finally { button.disabled = false; }
  });
  $('usersTableBody').addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]'); if (!button) return;
    const user = users.find(u => idOf(u) === Number(button.dataset.id));
    if (!user || !canManage(user)) return;
    if (button.dataset.action === 'edit') {
      $('editUserId').value = idOf(user);
      $('editName').value = user.full_name ?? user.name ?? '';
      $('editEmail').value = user.email ?? '';
      $('editRoleGroup').hidden = !isSuper;
      if (isSuper) $('editRole').value = roleOf(user);
      alertBox('editAlert'); openModal('editModal','editName');
    } else if (button.dataset.action === 'delete') {
      if (!confirm(`Delete ${user.full_name || user.email}?\n\nThis action cannot be undone. Users with bookings or events cannot be deleted.`)) return;
      button.disabled = true;
      try { await apiRequest(`/users/${idOf(user)}`, {method:'DELETE'}); await loadUsers(); alertBox('pageAlert','User deleted successfully.',true); }
      catch (error) { alertBox('pageAlert', errorMessage(error)); button.disabled = false; }
    }
  });
  $('editForm').addEventListener('submit', async event => {
    event.preventDefault(); alertBox('editAlert');
    const id = Number($('editUserId').value), user = users.find(u => idOf(u) === id);
    if (!user || !canManage(user)) return;
    const data = {full_name:$('editName').value.trim(),email:$('editEmail').value.trim()};
    if (isSuper) data.role = $('editRole').value;
    const button = $('saveEditButton'); button.disabled = true;
    try {
      await apiRequest(`/users/${id}`, {method:'PUT',body:JSON.stringify(data)});
      closeModal('editModal'); await loadUsers(); alertBox('pageAlert','User updated successfully.',true);
    } catch (error) { alertBox('editAlert', errorMessage(error)); }
    finally { button.disabled = false; }
  });
  $('searchUsers').addEventListener('input', renderUsers);
  $('roleFilter').addEventListener('change', renderUsers);
  $('refreshButton').addEventListener('click', () => { alertBox('pageAlert'); loadUsers(); });
  $('logoutButton').addEventListener('click', () => { sessionStorage.removeItem('token');sessionStorage.removeItem('user');location.href='../index.html'; });
  loadUsers();
});
