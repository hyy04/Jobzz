import { initNavbar, onRoleChange } from './components/navbar.js';
import { initTaskForm } from './components/task-form.js';
import { initTaskTable, updateTaskTable } from './components/task-table.js';
import { renderDashboardStats } from './components/dashboard-stats.js';
import { ApiClient } from './api.js';
import { showToast } from './components/toast-modal.js';

/**
 * Điều phối ứng dụng Single Page Application Quản trị Jobzz
 */
async function loadData() {
  try {
    const res = await ApiClient.getTasks();
    const tasks = res.data || [];

    // Cập nhật thống kê Dashboard
    renderDashboardStats(tasks);

    // Cập nhật Bảng quản trị nhiệm vụ
    updateTaskTable(tasks);
  } catch (err) {
    if (err.status === 403) {
      showToast('Bạn đang ở vai trò WORKER. Vui lòng chuyển sang ADMIN trên Navbar để quản trị task!', 'warning', 5000);
      renderDashboardStats([]);
      updateTaskTable([]);
    } else {
      showToast(err.message || 'Không thể tải danh sách nhiệm vụ. Vui lòng kiểm tra server!', 'error');
    }
  }
}

// Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Khởi tạo Navbar & Dev Role Switcher
  initNavbar();
  onRoleChange(async () => {
    showToast('Đã đổi vai trò kiểm thử. Đang tải lại dữ liệu...', 'info', 2000);
    await loadData();
  });

  // 2. Khởi tạo Task Table
  initTaskTable(async () => {
    await loadData();
  });

  // 3. Khởi tạo Task Form
  initTaskForm(async (_createdTask) => {
    // Khi tạo task thành công: tải lại dữ liệu bảng & cuộn xuống
    await loadData();
    document.getElementById('task-search-input')?.scrollIntoView({ behavior: 'smooth' });
  });

  // 5. Nút làm mới toàn trang
  document.getElementById('btn-refresh-all')?.addEventListener('click', async () => {
    showToast('Đang làm mới dữ liệu...', 'info', 1500);
    await loadData();
  });

  // 6. Nạp dữ liệu ban đầu
  await loadData();
});

