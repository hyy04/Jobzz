import { initNavbar, onRoleChange, getCurrentRole } from './components/navbar.js';
import { initTaskForm } from './components/task-form.js';
import { initTaskTable, updateTaskTable } from './components/task-table.js';
import { renderDashboardStats } from './components/dashboard-stats.js';
import { WorkerMarketplace } from './components/worker-marketplace.js';
import { AdminSubmissionsTab } from './components/admin-submissions-tab.js';
import { ApiClient } from './api.js';
import { showToast } from './components/toast-modal.js';

let marketplace = null;
let submissionsTab = null;
let currentTab = 'admin';

/**
 * Tải dữ liệu trang Quản trị Admin
 */
async function loadAdminData() {
  try {
    const res = await ApiClient.getTasks();
    const tasks = res.data || [];

    // Cập nhật thống kê Dashboard
    renderDashboardStats(tasks);

    // Cập nhật Bảng quản trị nhiệm vụ
    updateTaskTable(tasks);
  } catch (err) {
    if (err.status === 403) {
      showToast('Bạn đang ở vai trò WORKER. Vui lòng chuyển sang ADMIN trên Navbar để quản trị task!', 'warning', 4000);
      renderDashboardStats([]);
      updateTaskTable([]);
    } else {
      showToast(err.message || 'Không thể tải danh sách nhiệm vụ. Vui lòng kiểm tra server!', 'error');
    }
  }
}

/**
 * Chuyển đổi giữa Tab Người làm (Worker), Quản trị Task (Admin) và Duyệt bài nộp (Submissions)
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-018
 * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-019
 */
export function switchTab(tab) {
  currentTab = tab;
  const workerView = document.getElementById('view-worker');
  const adminView = document.getElementById('view-admin');
  const submissionsView = document.getElementById('view-submissions');

  const tabWorkerBtn = document.getElementById('nav-tab-worker');
  const tabAdminBtn = document.getElementById('nav-tab-admin');
  const tabSubmissionsBtn = document.getElementById('nav-tab-submissions');

  // Reset classes cho các nút tab
  [tabWorkerBtn, tabAdminBtn, tabSubmissionsBtn].forEach((btn) => {
    btn?.classList.remove('bg-white', 'text-brand-600', 'shadow-2xs');
    btn?.classList.add('text-slate-600');
  });

  // Ẩn toàn bộ views
  workerView?.classList.add('hidden');
  adminView?.classList.add('hidden');
  submissionsView?.classList.add('hidden');

  if (tab === 'worker') {
    window.location.hash = '#worker';
    workerView?.classList.remove('hidden');
    tabWorkerBtn?.classList.add('bg-white', 'text-brand-600', 'shadow-2xs');
    tabWorkerBtn?.classList.remove('text-slate-600');
    if (marketplace) marketplace.loadTasks();
  } else if (tab === 'submissions') {
    window.location.hash = '#submissions';
    submissionsView?.classList.remove('hidden');
    tabSubmissionsBtn?.classList.add('bg-white', 'text-brand-600', 'shadow-2xs');
    tabSubmissionsBtn?.classList.remove('text-slate-600');
    if (submissionsTab) submissionsTab.loadSubmissions();
  } else {
    window.location.hash = '#admin';
    adminView?.classList.remove('hidden');
    tabAdminBtn?.classList.add('bg-white', 'text-brand-600', 'shadow-2xs');
    tabAdminBtn?.classList.remove('text-slate-600');
    loadAdminData();
  }
}

// Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Khởi tạo Navbar & Dev Role Switcher
  initNavbar();

  // 2. Khởi tạo Worker Marketplace
  marketplace = new WorkerMarketplace('worker-marketplace-container');
  marketplace.init();

  // 3. Khởi tạo Admin Submissions Tab
  submissionsTab = new AdminSubmissionsTab('admin-submissions-container');
  submissionsTab.init();

  // 4. Tab navigation listeners
  document.getElementById('nav-tab-worker')?.addEventListener('click', () => switchTab('worker'));
  document.getElementById('nav-tab-admin')?.addEventListener('click', () => switchTab('admin'));
  document.getElementById('nav-tab-submissions')?.addEventListener('click', () => switchTab('submissions'));

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    if (hash === '#worker') switchTab('worker');
    else if (hash === '#submissions') switchTab('submissions');
    else if (hash === '#admin') switchTab('admin');
  });

  onRoleChange(async (role) => {
    showToast(`Đã đổi vai trò kiểm thử sang [${role}].`, 'info', 2000);
    if (role === 'WORKER') {
      switchTab('worker');
    } else if (role === 'ADMIN') {
      if (currentTab === 'worker') switchTab('admin');
      else if (currentTab === 'submissions') submissionsTab.loadSubmissions();
      else loadAdminData();
    } else {
      if (currentTab === 'worker') marketplace.loadTasks();
      else if (currentTab === 'submissions') submissionsTab.loadSubmissions();
      else loadAdminData();
    }
  });

  // 5. Khởi tạo Task Table cho Admin
  initTaskTable(async () => {
    await loadAdminData();
  });

  // 6. Khởi tạo Task Form cho Admin
  initTaskForm(async (_createdTask) => {
    await loadAdminData();
    document.getElementById('task-search-input')?.scrollIntoView({ behavior: 'smooth' });
  });

  // 7. Nút làm mới toàn trang
  document.getElementById('btn-refresh-all')?.addEventListener('click', async () => {
    showToast('Đang làm mới dữ liệu...', 'info', 1500);
    if (currentTab === 'worker') {
      await marketplace.loadTasks();
    } else if (currentTab === 'submissions') {
      await submissionsTab.loadSubmissions();
    } else {
      await loadAdminData();
    }
  });

  // 8. Xác định tab ban đầu theo URL hash hoặc vai trò
  const initialHash = window.location.hash;
  const initialRole = getCurrentRole();
  if (initialHash === '#worker' || initialRole === 'WORKER') {
    switchTab('worker');
  } else if (initialHash === '#submissions') {
    switchTab('submissions');
  } else {
    switchTab('admin');
  }
});
