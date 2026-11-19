import { escapeHtml } from '../utils/html-escaper.js';

/**
 * Hiển thị Toast thông báo nhanh (Toast Notification)
 */
export function showToast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-blue-600 text-white',
  };

  const icons = {
    success: '<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
    error: '<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>',
    warning: '<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
    info: '<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
  };

  toast.className = `flex items-center px-4 py-3 rounded-lg shadow-lg font-medium text-sm transition-all transform duration-300 translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `${icons[type] || icons.info}<span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  // Animation xuất hiện
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  }, 10);

  // Tự động biến mất
  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Hiển thị Hộp thoại xác nhận (Confirmation Modal)
 */
export function showConfirmModal({ title, message, confirmText = 'Xác nhận', confirmClass = 'bg-indigo-600 hover:bg-indigo-700', onConfirm }) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-left border border-slate-100 transform transition-all scale-100">
        <h3 class="text-lg font-bold text-slate-800 mb-2">${escapeHtml(title)}</h3>
        <p class="text-sm text-slate-600 mb-6 leading-relaxed">${escapeHtml(message)}</p>
        <div class="flex justify-end space-x-3">
          <button id="modal-cancel-btn" class="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition">
            Hủy bỏ
          </button>
          <button id="modal-confirm-btn" class="px-4 py-2 rounded-xl text-sm font-semibold text-white ${confirmClass} transition shadow-sm">
            ${escapeHtml(confirmText)}
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modal-cancel-btn')?.addEventListener('click', () => {
    modalContainer.innerHTML = '';
  });

  document.getElementById('modal-confirm-btn')?.addEventListener('click', async () => {
    modalContainer.innerHTML = '';
    if (typeof onConfirm === 'function') {
      await onConfirm();
    }
  });
}

/**
 * Hiển thị Hộp thoại cảnh báo va chạm phiên bản OCC 409 (Conflict Modal - REQ-PUI-009)
 */
export function showConflictModal({ title = 'Xung đột phiên làm việc (OCC 409)', message = 'Dữ liệu nhiệm vụ đã bị chỉnh sửa ở một phiên khác. Vui lòng bấm nạp lại để lấy phiên bản mới nhất!', onRefresh }) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-left border border-amber-200 transform transition-all scale-100">
        <div class="flex items-center space-x-3 mb-3">
          <div class="p-2 bg-amber-100 text-amber-600 rounded-xl">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <h3 class="text-lg font-bold text-slate-800">${escapeHtml(title)}</h3>
        </div>
        <p class="text-sm text-slate-600 mb-6 leading-relaxed">${escapeHtml(message)}</p>
        <div class="flex justify-end">
          <button id="modal-refresh-btn" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition shadow-md">
            Làm mới danh sách (Reload)
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modal-refresh-btn')?.addEventListener('click', async () => {
    modalContainer.innerHTML = '';
    if (typeof onRefresh === 'function') {
      await onRefresh();
    }
  });
}

/**
 * Hiển thị Modal chi tiết nhiệm vụ kèm hình ảnh các bước hướng dẫn
 */
export function showTaskDetailModal(task) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer || !task) return;

  const stepsHtml = (task.steps || []).map((s) => `
    <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
      <div class="flex items-start space-x-2.5">
        <span class="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
          ${s.step_number}
        </span>
        <div class="flex-1 space-y-1">
          <p class="text-xs font-semibold text-slate-800 leading-snug">${escapeHtml(s.instruction)}</p>
          ${s.target_url ? `
            <a href="${escapeHtml(s.target_url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-[11px] font-bold text-indigo-600 hover:text-indigo-800">
              <span>Mở liên kết</span>
              <svg class="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            </a>
          ` : ''}
        </div>
      </div>
      ${s.image_url ? `
        <div class="pt-1.5 pl-7">
          <div class="rounded-xl overflow-hidden border border-slate-200 bg-white p-1.5 inline-block">
            <img src="${escapeHtml(s.image_url)}" alt="Hình ảnh minh họa bước ${s.step_number}" class="max-h-56 rounded-lg object-contain" />
          </div>
        </div>
      ` : ''}
    </div>
  `).join('');

  const proofsHtml = (task.proof_requirements || []).map((p) => `
    <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
      <div>
        <span class="font-bold text-slate-700">${escapeHtml(p.title)}</span>
        <p class="text-[11px] text-slate-500 mt-0.5">${escapeHtml(p.description)}</p>
      </div>
      <span class="px-2 py-0.5 text-[10px] font-bold rounded-md ${p.proof_type === 'SCREENSHOT_IMAGE' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}">
        ${p.proof_type === 'SCREENSHOT_IMAGE' ? 'Ảnh chụp' : 'Văn bản'}
      </span>
    </div>
  `).join('');

  modalContainer.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div class="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col text-left border border-slate-100 overflow-hidden transform transition-all scale-100">
        <!-- Header -->
        <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-100 text-indigo-700 uppercase tracking-wider">${escapeHtml(task.category)}</span>
            <h3 class="text-base font-bold text-slate-800 mt-1">${escapeHtml(task.title)}</h3>
          </div>
          <button id="modal-close-detail-btn" class="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <!-- Body Scrollable -->
        <div class="p-6 overflow-y-auto space-y-5 text-slate-600">
          <!-- Stats Summary -->
          <div class="grid grid-cols-3 gap-3 text-center">
            <div class="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100">
              <span class="text-[10px] uppercase font-bold text-slate-400">Thù lao</span>
              <div class="text-sm font-black text-amber-600 mt-0.5">${task.reward_coins?.toLocaleString()} Xu</div>
            </div>
            <div class="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100">
              <span class="text-[10px] uppercase font-bold text-slate-400">Chỉ tiêu</span>
              <div class="text-sm font-black text-slate-800 mt-0.5">${task.quota?.toLocaleString()} lượt</div>
            </div>
            <div class="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100">
              <span class="text-[10px] uppercase font-bold text-slate-400">Tổng ngân sách</span>
              <div class="text-sm font-black text-indigo-700 mt-0.5">${task.total_reward_coins?.toLocaleString()} Xu</div>
            </div>
          </div>

          <!-- Description -->
          <div class="space-y-1.5">
            <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">Mô tả nhiệm vụ</h4>
            <p class="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">${escapeHtml(task.description || 'Chưa có mô tả')}</p>
          </div>

          <!-- Steps with images -->
          <div class="space-y-2">
            <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Các bước thực hiện (${task.steps?.length || 0})</span>
            </h4>
            <div class="space-y-2.5">
              ${stepsHtml || '<p class="text-xs text-slate-400 italic">Chưa có bước hướng dẫn</p>'}
            </div>
          </div>

          <!-- Proofs -->
          <div class="space-y-2">
            <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">Yêu cầu nộp bằng chứng (${task.proof_requirements?.length || 0})</h4>
            <div class="space-y-2">
              ${proofsHtml || '<p class="text-xs text-slate-400 italic">Không có yêu cầu bằng chứng</p>'}
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button id="modal-close-detail-btn-bottom" class="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition shadow-2xs">
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modal-close-detail-btn')?.addEventListener('click', () => {
    modalContainer.innerHTML = '';
  });
  document.getElementById('modal-close-detail-btn-bottom')?.addEventListener('click', () => {
    modalContainer.innerHTML = '';
  });
}

