import { escapeHtml, formatNumber } from '../utils/html-escaper.js';
import { ApiClient } from '../api.js';
import { showToast, showConfirmModal, showConflictModal, showTaskDetailModal } from './toast-modal.js';

let allTasks = [];
let currentFilter = 'ALL';
let currentSearch = '';
let onTaskChangedCallback = null;

const STATUS_BADGES = {
  DRAFT: { label: 'Bản nháp', class: 'bg-amber-50 text-amber-700 border-amber-200' },
  ACTIVE: { label: 'Đang chạy', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PAUSED: { label: 'Tạm dừng', class: 'bg-orange-50 text-orange-700 border-orange-200' },
  COMPLETED: { label: 'Hoàn thành', class: 'bg-blue-50 text-blue-700 border-blue-200' },
  CLOSED: { label: 'Đã đóng', class: 'bg-slate-100 text-slate-600 border-slate-200' },
};

/**
 * Khởi tạo Task Table Component
 */
export function initTaskTable(onTaskChanged) {
  onTaskChangedCallback = onTaskChanged;

  // 1. Lắng nghe Tab lọc trạng thái (REQ-PUI-005)
  const tabButtons = document.querySelectorAll('.status-tab-btn');
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => {
        b.classList.remove('bg-indigo-600', 'text-white', 'shadow-2xs');
        b.classList.add('bg-slate-100', 'text-slate-600');
      });
      btn.classList.remove('bg-slate-100', 'text-slate-600');
      btn.classList.add('bg-indigo-600', 'text-white', 'shadow-2xs');

      currentFilter = btn.getAttribute('data-status') || 'ALL';
      filterAndRender();
    });
  });

  // 2. Lắng nghe ô tìm kiếm
  const searchInput = document.getElementById('task-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = (e.target.value || '').trim().toLowerCase();
      filterAndRender();
    });
  }
}

/**
 * Cập nhật danh sách nhiệm vụ và render lại bảng
 */
export function updateTaskTable(tasks = []) {
  allTasks = tasks;
  filterAndRender();
}

/**
 * Lọc và render bảng
 */
function filterAndRender() {
  const tbody = document.getElementById('task-table-body');
  if (!tbody) return;

  let filtered = allTasks;

  // Lọc theo Tab trạng thái
  if (currentFilter !== 'ALL') {
    filtered = filtered.filter((t) => t.status === currentFilter);
  }

  // Lọc theo từ khóa tìm kiếm
  if (currentSearch) {
    filtered = filtered.filter((t) =>
      (t.title && t.title.toLowerCase().includes(currentSearch)) ||
      (t.id && t.id.toLowerCase().includes(currentSearch))
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="py-12 text-center text-slate-400 font-medium">
          Không tìm thấy nhiệm vụ nào phù hợp.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((task) => {
    const badge = STATUS_BADGES[task.status] || { label: task.status, class: 'bg-slate-100 text-slate-600 border-slate-200' };
    const shortId = task.id ? task.id.substring(0, 8) : '...';
    const hasImage = Array.isArray(task.steps) && task.steps.some((s) => Boolean(s.image_url));

    // Tạo các nút bấm thao tác theo trạng thái
    let actionsHtml = '';
    if (task.status === 'DRAFT') {
      actionsHtml = `
        <div class="flex items-center justify-end space-x-1.5">
          <button data-id="${task.id}" class="btn-open-detail px-2 py-1 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition" title="Xem chi tiết các bước">
            👁️ Xem
          </button>
          <button data-action="PUBLISH" data-id="${task.id}" data-version="${task.version}" class="action-btn px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-2xs">
            Xuất bản
          </button>
        </div>
      `;
    } else if (task.status === 'ACTIVE') {
      actionsHtml = `
        <div class="flex items-center justify-end space-x-1.5">
          <button data-id="${task.id}" class="btn-open-detail px-2 py-1 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition" title="Xem chi tiết các bước">
            👁️ Xem
          </button>
          <button data-action="PAUSE" data-id="${task.id}" data-version="${task.version}" class="action-btn px-2.5 py-1 text-xs font-bold rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition shadow-2xs">
            Tạm dừng
          </button>
          <button data-action="CLOSE" data-id="${task.id}" data-version="${task.version}" class="action-btn px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition">
            Đóng
          </button>
        </div>
      `;
    } else if (task.status === 'PAUSED') {
      actionsHtml = `
        <div class="flex items-center justify-end space-x-1.5">
          <button data-id="${task.id}" class="btn-open-detail px-2 py-1 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition" title="Xem chi tiết các bước">
            👁️ Xem
          </button>
          <button data-action="RESUME" data-id="${task.id}" data-version="${task.version}" class="action-btn px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-2xs">
            Mở lại
          </button>
          <button data-action="CLOSE" data-id="${task.id}" data-version="${task.version}" class="action-btn px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition">
            Đóng
          </button>
        </div>
      `;
    } else {
      actionsHtml = `
        <button data-id="${task.id}" class="btn-open-detail px-2 py-1 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition" title="Xem chi tiết các bước">
          👁️ Xem
        </button>
      `;
    }

    return `
      <tr class="hover:bg-slate-50/60 transition group">
        <td class="py-3 px-3 font-mono text-[11px] text-slate-500" title="${escapeHtml(task.id)}">
          #${escapeHtml(shortId)}
        </td>
        <td class="py-3 px-3 max-w-xs">
          <div class="flex items-center space-x-1.5">
            <button data-id="${task.id}" class="btn-open-detail text-left font-bold text-slate-800 text-xs truncate hover:text-indigo-600 transition" title="Xem chi tiết: ${escapeHtml(task.title)}">
              ${escapeHtml(task.title)}
            </button>
            ${hasImage ? `<span class="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">🖼️ Có ảnh</span>` : ''}
          </div>
          <div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(task.category)}</div>
        </td>
        <td class="py-3 px-3 font-semibold text-slate-700">${formatNumber(task.quota)}</td>
        <td class="py-3 px-3 font-bold text-amber-600">${formatNumber(task.reward_coins)} <span class="text-[10px]">Xu</span></td>
        <td class="py-3 px-3 font-bold text-indigo-700">${formatNumber(task.total_reward_coins)} <span class="text-[10px]">Xu</span></td>
        <td class="py-3 px-3">
          <span class="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-md border ${badge.class}">
            ${badge.label}
          </span>
        </td>
        <td class="py-3 px-3">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-500">
            v${task.version}
          </span>
        </td>
        <td class="py-3 px-3 text-right">
          ${actionsHtml}
        </td>
      </tr>
    `;
  }).join('');

  // Gắn sự kiện cho các nút hành động
  tbody.querySelectorAll('.action-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const action = btn.getAttribute('data-action');
      const taskId = btn.getAttribute('data-id');
      const version = parseInt(btn.getAttribute('data-version') || '1', 10);

      await handleTaskAction(action, taskId, version);
    });
  });

  // Gắn sự kiện mở modal xem chi tiết kèm hình ảnh hướng dẫn
  tbody.querySelectorAll('.btn-open-detail').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const task = allTasks.find((t) => t.id === id);
      if (task) {
        showTaskDetailModal(task);
      }
    });
  });
}

/**
 * Xử lý hành động chuyển trạng thái nhiệm vụ (REQ-PUI-006..009)
 */
async function handleTaskAction(action, taskId, version) {
  if (action === 'PUBLISH') {
    showConfirmModal({
      title: 'Xuất bản nhiệm vụ (Publish)',
      message: 'Bạn có chắc chắn muốn xuất bản nhiệm vụ này sang trạng thái Đang hoạt động (ACTIVE) không? Worker sẽ có thể bắt đầu nhận việc ngay lập tức.',
      confirmText: 'Xuất bản ngay',
      confirmClass: 'bg-emerald-600 hover:bg-emerald-700',
      onConfirm: async () => {
        await executeStatusChange(taskId, 'PUBLISH', version, 'Nhiệm vụ đã được xuất bản thành công!');
      },
    });
  } else if (action === 'PAUSE') {
    await executeStatusChange(taskId, 'PAUSE', version, 'Đã tạm dừng nhận lượt làm mới.');
  } else if (action === 'RESUME') {
    await executeStatusChange(taskId, 'RESUME', version, 'Đã mở lại nhiệm vụ cho Worker nhận việc.');
  } else if (action === 'CLOSE') {
    showConfirmModal({
      title: 'Đóng vĩnh viễn nhiệm vụ (Close)',
      message: 'CẢNH BÁO: Hành động đóng vĩnh viễn nhiệm vụ không thể hoàn tác. Các Worker đang làm dở sẽ có tối đa 24h để hoàn thành bài nộp. Bạn có chắc chắn muốn đóng?',
      confirmText: 'Xác nhận đóng việc',
      confirmClass: 'bg-rose-600 hover:bg-rose-700',
      onConfirm: async () => {
        await executeStatusChange(taskId, 'CLOSE', version, 'Nhiệm vụ đã được đóng vĩnh viễn.');
      },
    });
  }
}

async function executeStatusChange(taskId, action, version, successMsg) {
  try {
    await ApiClient.changeTaskStatus(taskId, action, version);
    showToast(successMsg, 'success');
    if (typeof onTaskChangedCallback === 'function') {
      await onTaskChangedCallback();
    }
  } catch (err) {
    if (err.status === 409) {
      showConflictModal({
        title: 'Xung đột phiên làm việc (OCC 409)',
        message: 'Dữ liệu nhiệm vụ đã bị chỉnh sửa ở một phiên làm việc khác. Bấm làm mới để đồng bộ dữ liệu mới nhất!',
        onRefresh: async () => {
          if (typeof onTaskChangedCallback === 'function') {
            await onTaskChangedCallback();
          }
        },
      });
    } else {
      showToast(err.message || 'Không thể thay đổi trạng thái', 'error');
    }
  }
}

