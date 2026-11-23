import { ApiClient } from '../api.js';
import { escapeHtml } from '../utils/html-escaper.js';
import { openTaskClaimModal } from './task-claim-modal.js';
import { CountdownTimer } from './countdown-timer.js';
import { showToast } from './toast-modal.js';

const CATEGORIES = [
  { id: '', label: 'Tất cả' },
  { id: 'APP_INSTALL', label: 'Cài đặt ứng dụng' },
  { id: 'ACCOUNT_REGISTRATION', label: 'Đăng ký tài khoản' },
  { id: 'SOCIAL_INTERACTION', label: 'Tương tác MXH' },
  { id: 'REVIEW_RATING', label: 'Đánh giá & Review' },
  { id: 'SURVEY', label: 'Khảo sát' },
  { id: 'CONTENT_WRITING', label: 'Viết bài' },
  { id: 'OTHER', label: 'Khác' },
];

export class WorkerMarketplace {
  constructor(containerId = 'worker-marketplace-container') {
    this.container = document.getElementById(containerId);
    this.selectedCategory = '';
    this.selectedSort = 'LATEST';
    this.tasks = [];
    this.activeTimer = null;
    this.activeClaim = null;
  }

  init() {
    if (!this.container) return;
    this.renderLayout();
    this.bindEvents();
    this.loadTasks();
  }

  renderLayout() {
    this.container.innerHTML = `
      <div class="space-y-6">
        <!-- Active Claim Banner Mount Point -->
        <div id="active-claim-widget-container"></div>

        <!-- Marketplace Header & Description -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
          <div>
            <h2 class="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <span>Khám Phá Việc Làm Vi Mô</span>
              <span class="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Live
              </span>
            </h2>
            <p class="text-xs text-slate-500 mt-1">Duyệt nhiệm vụ uy tín, nhận việc giữ slot và nhận thù lao Xu nhanh chóng</p>
          </div>

          <!-- Sort Select -->
          <div class="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span class="text-xs font-semibold text-slate-500">Sắp xếp:</span>
            <select id="marketplace-sort-select" class="text-xs font-bold bg-transparent text-slate-800 focus:outline-hidden cursor-pointer">
              <option value="LATEST">Việc mới nhất</option>
              <option value="REWARD_DESC">Thù lao Xu cao nhất</option>
            </select>
          </div>
        </div>

        <!-- Category Pills Filter Bar -->
        <div class="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none" id="category-pills-bar">
          ${CATEGORIES.map(
            (c) => `
            <button data-category="${c.id}" class="category-pill shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              this.selectedCategory === c.id
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }">
              ${c.label}
            </button>
          `
          ).join('')}
        </div>

        <!-- Task Cards Grid -->
        <div id="marketplace-cards-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <!-- Loading skeleton initially -->
          <div class="bg-white p-5 rounded-2xl border border-slate-200 h-48 animate-pulse"></div>
          <div class="bg-white p-5 rounded-2xl border border-slate-200 h-48 animate-pulse"></div>
          <div class="bg-white p-5 rounded-2xl border border-slate-200 h-48 animate-pulse"></div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // 1. Sort change
    const sortSelect = this.container.querySelector('#marketplace-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.selectedSort = e.target.value;
        this.loadTasks();
      });
    }

    // 2. Category pills
    const pills = this.container.querySelectorAll('.category-pill');
    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        this.selectedCategory = pill.dataset.category;
        pills.forEach((p) => {
          if (p.dataset.category === this.selectedCategory) {
            p.className =
              'category-pill shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition bg-brand-600 text-white shadow-xs';
          } else {
            p.className =
              'category-pill shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition bg-white text-slate-600 border border-slate-200 hover:bg-slate-50';
          }
        });
        this.loadTasks();
      });
    });
  }

  async loadTasks() {
    const grid = this.container.querySelector('#marketplace-cards-grid');
    if (!grid) return;

    try {
      const response = await ApiClient.getPublicTasks({
        category: this.selectedCategory || undefined,
        sort_by: this.selectedSort,
        page: 1,
        limit: 50,
      });

      this.tasks = response.data || [];
      this.renderCards(this.tasks);
    } catch (err) {
      grid.innerHTML = `
        <div class="col-span-full p-8 text-center bg-white rounded-3xl border border-slate-200">
          <p class="text-xs font-bold text-rose-600">Không thể tải danh sách việc làm.</p>
          <button id="btn-retry-marketplace" class="mt-3 px-4 py-1.5 text-xs font-bold bg-slate-100 rounded-xl hover:bg-slate-200">Thử lại</button>
        </div>
      `;
      grid.querySelector('#btn-retry-marketplace')?.addEventListener('click', () => this.loadTasks());
    }
  }

  renderCards(tasks) {
    const grid = this.container.querySelector('#marketplace-cards-grid');
    if (!grid) return;

    if (!tasks || tasks.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 space-y-3">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 text-brand-600 flex items-center justify-center">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
          </div>
          <h3 class="text-sm font-bold text-slate-800">Không có nhiệm vụ nào phù hợp</h3>
          <p class="text-xs text-slate-500 max-w-sm mx-auto">Hiện tại toàn bộ nhiệm vụ trong danh mục này đã hết suất hoặc chưa có việc mới. Vui lòng quay lại sau!</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = tasks
      .map(
        (task) => `
        <div data-task-id="${task.id}" class="task-marketplace-card bg-white p-5 rounded-2xl border border-slate-200 hover:border-brand-500 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between group">
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-indigo-50 text-brand-600 border border-indigo-100">
                ${task.category}
              </span>
              <span class="text-2xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                Còn ${task.remaining_quota} suất
              </span>
            </div>

            <h3 class="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition line-clamp-2 leading-snug">
              ${escapeHtml(task.title)}
            </h3>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span class="text-2xs text-slate-400 font-semibold uppercase">Thù lao</span>
              <div class="text-base font-black text-amber-500 flex items-center space-x-1">
                <span>${task.reward_coins.toLocaleString('vi-VN')}</span>
                <span class="text-xs font-bold text-amber-600">Xu</span>
              </div>
            </div>

            <div class="text-right">
              <span class="text-2xs text-slate-400 font-medium">Thời gian</span>
              <div class="text-xs font-bold text-slate-600">${task.execution_time_minutes} phút</div>
            </div>
          </div>
        </div>
      `
      )
      .join('');

    // Click handler for task cards
    grid.querySelectorAll('.task-marketplace-card').forEach((card) => {
      card.addEventListener('click', async () => {
        const taskId = card.dataset.taskId;
        try {
          const detailRes = await ApiClient.getPublicTaskDetails(taskId);
          const claimForThisTask =
            this.activeClaim && this.activeClaim.taskId === taskId ? this.activeClaim : null;

          openTaskClaimModal(
            detailRes.data,
            (claimData) => this.handleClaimSuccess(taskId, claimData),
            () => this.loadTasks(),
            claimForThisTask,
            (submittedData) => this.handleSubmitSuccess(submittedData)
          );
        } catch (err) {
          showToast('Không thể nạp chi tiết nhiệm vụ.', 'error');
        }
      });
    });
  }

  handleClaimSuccess(taskId, claimData) {
    this.activeClaim = { taskId, id: claimData.claim_id, ...claimData };
    this.mountCountdownTimer(claimData);
    this.loadTasks(); // refresh quota counts
  }

  handleSubmitSuccess(submittedData) {
    if (this.activeTimer) {
      this.activeTimer.stop();
    }
    if (this.activeClaim) {
      this.activeClaim.status = 'SUBMITTED';
      this.activeClaim.submitted_at = submittedData.submitted_at;
    }

    const widget = document.getElementById('active-claim-widget-container');
    if (widget) {
      widget.innerHTML = `
        <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div class="flex items-center space-x-3">
            <span class="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black">
              ✓
            </span>
            <div>
              <div class="text-xs font-bold text-amber-800 uppercase tracking-wider">Đã nộp bài thành công</div>
              <div class="text-xs text-amber-700">Bài nộp của bạn đang chờ Người tạo xét duyệt thù lao Xu.</div>
            </div>
          </div>
          <button id="btn-view-submitted-banner" class="px-4 py-2 text-xs font-bold rounded-xl bg-white border border-amber-300 text-amber-800 hover:bg-amber-100/50 transition cursor-pointer shadow-2xs">
            Xem lại bài nộp
          </button>
        </div>
      `;

      widget.querySelector('#btn-view-submitted-banner')?.addEventListener('click', async () => {
        if (!this.activeClaim) return;
        try {
          const detailRes = await ApiClient.getPublicTaskDetails(this.activeClaim.taskId);
          const claimDetailsRes = await ApiClient.getClaimDetails(this.activeClaim.id);
          openTaskClaimModal(
            detailRes.data,
            null,
            null,
            claimDetailsRes.data,
            null
          );
        } catch (err) {
          showToast('Không thể nạp thông tin bài nộp.', 'error');
        }
      });
    }

    this.loadTasks();
  }

  mountCountdownTimer(claimData) {
    if (this.activeTimer) {
      this.activeTimer.stop();
    }

    this.activeTimer = new CountdownTimer({
      containerId: 'active-claim-widget-container',
      expiresAt: claimData.expires_at,
      remainingSeconds: claimData.remaining_seconds,
      onSubmitClick: async () => {
        try {
          const detailRes = await ApiClient.getPublicTaskDetails(this.activeClaim.taskId);
          openTaskClaimModal(
            detailRes.data,
            null,
            () => this.loadTasks(),
            this.activeClaim,
            (submittedData) => this.handleSubmitSuccess(submittedData)
          );
        } catch (err) {
          showToast('Không thể mở hộp nộp bằng chứng.', 'error');
        }
      },
      onCancel: async () => {
        try {
          await ApiClient.cancelTaskClaim(claimData.task_id);
          showToast('Đã hủy giữ slot nhận việc thành công.', 'info');
          if (this.activeTimer) this.activeTimer.stop();
          const widget = document.getElementById('active-claim-widget-container');
          if (widget) widget.innerHTML = '';
          this.activeClaim = null;
          this.loadTasks();
        } catch (err) {
          showToast('Không thể hủy giữ slot lúc này.', 'error');
        }
      },
      onExpire: () => {
        showToast('Thời gian giữ slot làm bài đã hết! Suất đã được giải phóng.', 'warning');
        const widget = document.getElementById('active-claim-widget-container');
        if (widget) widget.innerHTML = '';
        this.activeClaim = null;
        this.loadTasks();
      },
    });
  }
}

