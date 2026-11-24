import { ApiClient } from '../api.js';
import { escapeHtml, formatNumber } from '../utils/html-escaper.js';
import { showToast } from './toast-modal.js';
import { SubmissionReviewModal } from './submission-review-modal.js';

/**
 * Tab Quản trị Duyệt bài nộp bằng chứng cho Admin (REQ-RTS-019..023)
 * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-019..023
 */
export class AdminSubmissionsTab {
  constructor(containerId = 'admin-submissions-container') {
    this.container = document.getElementById(containerId);
    this.modal = new SubmissionReviewModal();
    this.currentPage = 1;
    this.limit = 10;
    this.currentTaskId = '';
    this.isLoading = false;
  }

  init() {
    if (!this.container) return;
    this.renderLayout();
    this.loadSubmissions();
  }

  renderLayout() {
    this.container.innerHTML = `
      <div class="space-y-6">
        <!-- Header & Filter Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div>
            <h2 class="text-lg font-black text-slate-800 flex items-center space-x-2">
              <span>📝 Duyệt Bài Nộp Bằng Chứng</span>
              <span id="submissions-badge-count" class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                0 bài chờ duyệt
              </span>
            </h2>
            <p class="text-xs text-slate-500 mt-1">
              Thẩm định bằng chứng do Người làm (Worker) gửi lên, phê duyệt chi trả Xu hoặc từ chối giải phóng slot.
            </p>
          </div>

          <!-- Controls Filter -->
          <div class="flex items-center space-x-3">
            <div class="relative">
              <input
                id="submissions-filter-task-id"
                type="text"
                placeholder="Lọc theo Task ID..."
                class="text-xs px-3 py-2 pl-8 rounded-xl border border-slate-200 bg-slate-50 focus:outline-hidden focus:bg-white focus:border-brand-500 w-48 sm:w-56 transition"
              />
              <svg class="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>

            <button id="btn-refresh-submissions" class="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-2xs flex items-center space-x-1.5 cursor-pointer">
              <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        <!-- Table Container -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th class="py-3 px-4">Bài nộp / Task</th>
                  <th class="py-3 px-4">Người làm (Worker)</th>
                  <th class="py-3 px-4 text-right">Mức thưởng</th>
                  <th class="py-3 px-4 text-center">Bằng chứng</th>
                  <th class="py-3 px-4">Thời gian nộp</th>
                  <th class="py-3 px-4 text-center">Trạng thái</th>
                  <th class="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody id="submissions-table-body" class="divide-y divide-slate-100 text-xs">
                <tr>
                  <td colspan="7" class="py-12 text-center text-slate-400">
                    <div class="inline-block animate-spin mr-2">🔄</div> Đang tải danh sách bài nộp...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Bar -->
          <div id="submissions-pagination" class="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
            <span id="submissions-pagination-info">Trang 1 / 1</span>
            <div class="flex items-center space-x-2">
              <button id="btn-submissions-prev" disabled class="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition">
                Trước
              </button>
              <button id="btn-submissions-next" disabled class="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition">
                Tiếp theo
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Gắn sự kiện điều khiển
    document.getElementById('btn-refresh-submissions')?.addEventListener('click', () => {
      this.loadSubmissions();
    });

    let searchTimeout = null;
    document.getElementById('submissions-filter-task-id')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.currentTaskId = e.target.value.trim();
        this.currentPage = 1;
        this.loadSubmissions();
      }, 350);
    });

    document.getElementById('btn-submissions-prev')?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.loadSubmissions();
      }
    });

    document.getElementById('btn-submissions-next')?.addEventListener('click', () => {
      this.currentPage++;
      this.loadSubmissions();
    });
  }

  async loadSubmissions() {
    if (this.isLoading) return;
    this.isLoading = true;

    const tbody = document.getElementById('submissions-table-body');
    const badgeCount = document.getElementById('submissions-badge-count');

    try {
      const res = await ApiClient.getAdminSubmissions({
        page: this.currentPage,
        limit: this.limit,
        task_id: this.currentTaskId,
      });

      const items = res.data || [];
      const pagination = res.pagination || { total: 0, total_pages: 1 };

      if (badgeCount) {
        badgeCount.textContent = `${pagination.total} bài chờ duyệt`;
      }

      if (items.length === 0) {
        if (tbody) {
          tbody.innerHTML = `
            <tr>
              <td colspan="7" class="py-12 text-center text-slate-400">
                <div class="max-w-xs mx-auto space-y-2">
                  <span class="text-3xl block">🎉</span>
                  <p class="font-bold text-slate-700">Không có bài nộp nào cần duyệt!</p>
                  <p class="text-[11px] text-slate-400">Tất cả bài nộp bằng chứng của Worker đã được xử lý hoặc chưa có ai nộp mới.</p>
                </div>
              </td>
            </tr>
          `;
        }
      } else {
        if (tbody) {
          tbody.innerHTML = items
            .map((item) => {
              const safeTaskTitle = escapeHtml(item.task_title);
              const safeWorkerId = escapeHtml(item.worker_id);
              const safeClaimId = escapeHtml(item.claim_id);
              const safeTaskId = escapeHtml(item.task_id);
              const rewardFormatted = formatNumber(item.reward_coins);
              const submittedFormatted = new Date(item.submitted_at).toLocaleString('vi-VN');

              return `
                <tr class="hover:bg-slate-50/80 transition">
                  <td class="py-3 px-4">
                    <div class="font-bold text-slate-800 truncate max-w-xs" title="${safeTaskTitle}">${safeTaskTitle}</div>
                    <div class="text-[11px] font-mono text-slate-400 truncate max-w-xs">Task: #${safeTaskId.slice(0, 8)} | Claim: #${safeClaimId.slice(0, 8)}</div>
                  </td>
                  <td class="py-3 px-4 font-mono font-semibold text-slate-700">
                    ${safeWorkerId}
                  </td>
                  <td class="py-3 px-4 text-right font-black font-mono text-amber-600">
                    +${rewardFormatted} Xu
                  </td>
                  <td class="py-3 px-4 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      ${item.proofs_count} bằng chứng
                    </span>
                  </td>
                  <td class="py-3 px-4 text-slate-500 whitespace-nowrap">
                    ${submittedFormatted}
                  </td>
                  <td class="py-3 px-4 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Chờ duyệt
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <button
                      class="btn-review-submission px-3 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-2xs transition cursor-pointer flex items-center space-x-1 ml-auto"
                      data-claim-id="${safeClaimId}"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                      <span>Xem & Duyệt</span>
                    </button>
                  </td>
                </tr>
              `;
            })
            .join('');

          // Gắn sự kiện mở modal xem & duyệt
          tbody.querySelectorAll('.btn-review-submission').forEach((btn) => {
            btn.addEventListener('click', () => {
              const claimId = btn.getAttribute('data-claim-id');
              if (claimId) {
                this.modal.open(claimId, () => {
                  this.loadSubmissions();
                });
              }
            });
          });
        }
      }

      // Cập nhật phân trang
      const pageInfo = document.getElementById('submissions-pagination-info');
      const prevBtn = document.getElementById('btn-submissions-prev');
      const nextBtn = document.getElementById('btn-submissions-next');

      if (pageInfo) {
        pageInfo.textContent = `Trang ${this.currentPage} / ${pagination.total_pages || 1} (Tổng cộng ${pagination.total} bài)`;
      }

      if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
      if (nextBtn) nextBtn.disabled = this.currentPage >= (pagination.total_pages || 1);
    } catch (err) {
      if (err.status === 403) {
        showToast('Bạn không có quyền truy cập trang quản trị duyệt bài nộp!', 'warning');
      } else {
        showToast(err.message || 'Lỗi khi tải danh sách bài nộp chờ duyệt.', 'error');
      }
    } finally {
      this.isLoading = false;
    }
  }
}

