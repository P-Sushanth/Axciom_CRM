let currentUser = null;

async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      if (window.location.pathname !== '/' && !window.location.pathname.endsWith('index.html')) {
        window.location.href = '/index.html';
      }
      return null;
    }
    const data = await res.json();
    currentUser = data.user;
    renderNavbar();
    return currentUser;
  } catch (err) {
    if (window.location.pathname !== '/' && !window.location.pathname.endsWith('index.html')) {
      window.location.href = '/index.html';
    }
    return null;
  }
}

function renderNavbar() {
  const navContainer = document.getElementById('navbar');
  if (!navContainer || !currentUser) return;

  let links = `
    <a href="dashboard.html">Dashboard</a> |
    <a href="customers.html">Customers</a> |
    <a href="leads.html">Leads</a> |
    <a href="opportunities.html">Opportunities</a> |
    <a href="followups.html">Follow-Ups</a>
  `;

  if (currentUser.role === 'Manager' || currentUser.role === 'Admin') {
    links += ` | <a href="reports.html">Reports</a>`;
  }

  if (currentUser.role === 'Admin') {
    links += ` | <a href="users.html">User Management</a> | <a href="audit.html">Audit Logs</a>`;
  }

  navContainer.innerHTML = `
    <div style="background: #f0f0f0; padding: 10px; border-bottom: 1px solid #ccc; margin-bottom: 20px;">
      <strong>AcxiomCRM</strong> &nbsp;|&nbsp;
      ${links}
      <span style="float: right;">
        User: <strong>${escapeHtml(currentUser.name)}</strong> (${escapeHtml(currentUser.role)})
        &nbsp;<button onclick="logout()">Logout</button>
      </span>
    </div>
  `;
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/index.html';
}

function showAlert(elementId, message, isError = true) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.style.display = 'block';
  el.style.color = isError ? 'red' : 'green';
  el.style.padding = '8px';
  el.style.marginBottom = '10px';
  el.style.border = isError ? '1px solid red' : '1px solid green';
  el.style.backgroundColor = isError ? '#ffe6e6' : '#e6ffe6';
  el.innerText = message;
}

function clearAlert(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.style.display = 'none';
  el.innerText = '';
}

function escapeHtml(str) {
  return (str || '').toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
