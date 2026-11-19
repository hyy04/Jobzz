/**
 * Thanh Navbar & Quản lý vai trò kiểm thử Dev Role Switcher (REQ-PUI-023)
 */
let currentRole = localStorage.getItem('jobzz_dev_role') || 'ADMIN';
const listeners = [];

export function getCurrentRole() {
  return currentRole;
}

export function onRoleChange(callback) {
  listeners.push(callback);
}

export function initNavbar() {
  const roleSelect = document.getElementById('dev-role-select');
  if (roleSelect) {
    roleSelect.value = currentRole;
    roleSelect.addEventListener('change', (e) => {
      currentRole = e.target.value;
      localStorage.setItem('jobzz_dev_role', currentRole);
      listeners.forEach((fn) => fn(currentRole));
    });
  }
}

