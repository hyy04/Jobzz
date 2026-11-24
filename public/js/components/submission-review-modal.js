import { ApiClient } from '../api.js';
import { escapeHtml, formatNumber } from '../utils/html-escaper.js';
import { showToast } from './toast-modal.js';
import { ImageLightboxModal } from './image-lightbox-modal.js';

/**
 * Modal Xem và Thẩm định chi tiết bài nộp bằng chứng của Worker (REQ-RTS-019..023)
 * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-019..023
 */
export class SubmissionReviewModal {
  constructor(containerId = 'modal-container') {
    this.container = document.getElementById(containerId);
    this.lightbox = new ImageLightboxModal();
    this.onSuccessCallback = null;
  }

  async open(claimId, onSuccess) {
    this.onSuccessCallback = onSuccess;

    this.container.innerHTML = `
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-8 flex flex-col items-center justify-center space-y-4">
          <div class="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
          <p class="text-sm font-semibold text-slate-600">Đang tải chi tiết bằng chứng nhiệm vụ...</p>
        </div>
      </div>
    `;

    try {
      const res = await ApiClient.getAdminSubmissionDetails(claimId);
      const submission = res.data;
      this.renderReviewView(submission);
    } catch (err) {
      showToast(err.message || 'Không thể tải chi tiết bài nộp.', 'error');
      this.close();
    }
  }

  renderReviewView(sub) {
    const safeTitle = escapeHtml(sub.task_title);
    const safeWorkerId = escapeHtml(sub.worker_id);
    const safeClaimId = escapeHtml(sub.claim_id);
    const rewardFormatted = formatNumber(sub.reward_coins);
    const submittedAtFormatted = sub.submitted_at
      ? new Date(sub.submitted_at).toLocaleString('vi-VN')
      : 'Chưa xác định';

    const proofsHtml = (sub.submitted_proofs || [])
      .map((proof, idx) => {
        const safeReqDesc = escapeHtml(proof.description || `Yêu cầu bằng chứng #${idx + 1}`);
        const isImage = proof.proof_type === 'SCREENSHOT_IMAGE' || proof.proof_type === 'IMAGE' || (proof.value && proof.value.match(/\.(png|jpe?g|webp)(\?.*)?$/i));

        if (isImage) {
          const safeImgUrl = escapeHtml(proof.value);
          return `
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-700">📸 Bằng chứng ${idx + 1}: ${safeReqDesc}</span>
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">Ảnh chụp</span>
              </div>
              <div class="relative group cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white flex items-center justify-center max-h-64">
                <img src="${safeImgUrl}" alt="Proof image" class="max-h-64 object-contain transition group-hover:scale-102" data-lightbox-src="${safeImgUrl}" />
                <div class="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center" data-lightbox-src="${safeImgUrl}">
                  <span class="px-3 py-1.5 bg-white/90 text-slate-800 text-xs font-bold rounded-lg shadow-sm flex items-center space-x-1.5 pointer-events-none">
                    <svg class="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                    <span>Click để phóng to</span>
                  </span>
                </div>
              </div>
            </div>
          `;
        } else {
          const safeText = escapeHtml(proof.value);
          return `
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-700">📝 Bằng chứng ${idx + 1}: ${safeReqDesc}</span>
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Văn bản / Text</span>
              </div>
              <div class="p-3 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 whitespace-pre-wrap break-all select-all">
                ${safeText}
              </div>
            </div>
          `;
        }
      })
      .join('');

    this.container.innerHTML = `
      <div id="review-modal-backdrop" class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4 sm:p-6 overflow-y-auto">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full my-8 overflow-hidden flex flex-col max-h-[90vh]">
          
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <div class="flex items-center space-x-2">
                <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Chờ duyệt (SUBMITTED)</span>
                <span class="text-xs font-mono text-slate-400">#${safeClaimId.slice(0, 8)}</span>
              </div>
              <h3 class="text-lg font-black text-slate-800 mt-1 truncate">${safeTitle}</h3>
            </div>
            <button id="btn-close-review-modal" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition cursor-pointer">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>

          <!-- Body Scrollable -->
          <div class="px-6 py-5 overflow-y-auto space-y-5 flex-1">
            <!-- Metadata Cards -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-100/70 border border-slate-200/80 rounded-xl text-xs">
              <div>
                <span class="text-slate-500 block">Người làm (Worker):</span>
                <span class="font-bold text-slate-800 font-mono">${safeWorkerId}</span>
              </div>
              <div>
                <span class="text-slate-500 block">Thời gian nộp:</span>
                <span class="font-bold text-slate-800">${submittedAtFormatted}</span>
              </div>
              <div class="col-span-2 sm:col-span-1">
                <span class="text-slate-500 block">Thù lao phê duyệt:</span>
                <span class="font-black text-amber-600 font-mono text-sm">+${rewardFormatted} Xu</span>
              </div>
            </div>

            <!-- Proofs Area -->
            <div class="space-y-3">
              <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Danh sách bằng chứng gửi lên (${sub.submitted_proofs?.length || 0})</h4>
              <div class="space-y-3">
                ${proofsHtml || '<p class="text-sm text-slate-400 italic">Không có bằng chứng nào được nộp.</p>'}
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <button id="btn-open-reject-view" class="px-4 py-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition cursor-pointer flex items-center space-x-1.5">
              <svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              <span>Từ chối bài nộp</span>
            </button>

            <div class="flex items-center space-x-3">
              <button id="btn-cancel-review" class="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition cursor-pointer">
                Đóng
              </button>
              <button id="btn-confirm-approve" class="px-5 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm transition cursor-pointer flex items-center space-x-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                <span>Phê duyệt & Cộng Xu</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Gắn sự kiện đóng
    document.getElementById('btn-close-review-modal')?.addEventListener('click', () => this.close());
    document.getElementById('btn-cancel-review')?.addEventListener('click', () => this.close());

    // Sự kiện mở Lightbox khi click vào ảnh
    this.container.querySelectorAll('[data-lightbox-src]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const src = el.getAttribute('data-lightbox-src');
        if (src) this.lightbox.open(src, safeTitle);
      });
    });

    // Sự kiện Phê duyệt (APPROVE)
    document.getElementById('btn-confirm-approve')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-confirm-approve');
      btn.disabled = true;
      btn.innerHTML = `<span class="inline-block animate-spin mr-1">🔄</span> Đang xử lý...`;

      try {
        await ApiClient.approveSubmission(sub.claim_id);
        showToast(`Đã duyệt bài nộp thành công! +${rewardFormatted} Xu đã cộng vào ví Worker.`, 'success');
        this.close();
        if (this.onSuccessCallback) this.onSuccessCallback();
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `<span>Phê duyệt & Cộng Xu</span>`;
        showToast(err.message || 'Lỗi khi phê duyệt bài nộp!', 'error');
      }
    });

    // Sự kiện mở view Từ chối (REJECT)
    document.getElementById('btn-open-reject-view')?.addEventListener('click', () => {
      this.renderRejectView(sub);
    });
  }

  renderRejectView(sub) {
    const safeTitle = escapeHtml(sub.task_title);
    const safeWorkerId = escapeHtml(sub.worker_id);

    this.container.innerHTML = `
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4 sm:p-6 overflow-y-auto">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in duration-150">
          
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-base font-black text-rose-600 flex items-center space-x-1.5">
                <span>⚠️ Từ chối bài nộp</span>
              </h3>
              <p class="text-xs text-slate-500 mt-0.5 truncate max-w-sm">${safeTitle}</p>
            </div>
            <button id="btn-close-reject-modal" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>

          <div class="space-y-3">
            <label class="block text-xs font-bold text-slate-700">
              Lý do từ chối bài nộp <span class="text-rose-500">*</span>
              <span class="text-[11px] font-normal text-slate-400 block mt-0.5">Nêu rõ lý do để Worker (${safeWorkerId}) hiểu và rút kinh nghiệm (từ 10 đến 500 ký tự).</span>
            </label>

            <div class="relative">
              <textarea
                id="reject-reason-input"
                rows="4"
                maxlength="500"
                placeholder="Ví dụ: Ảnh chụp màn hình mờ, không thấy thông tin tài khoản hoặc mã giao dịch đối soát..."
                class="w-full text-xs text-slate-800 p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition resize-none"
              ></textarea>
              <div class="flex items-center justify-between mt-1 text-[11px]">
                <span id="reject-reason-warning" class="text-rose-500 font-semibold hidden">Tối thiểu 10 ký tự</span>
                <span id="reject-reason-counter" class="text-slate-400 ml-auto font-mono">0 / 500 ký tự</span>
              </div>
            </div>
          </div>

          <div class="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 space-y-1">
            <p class="font-bold">💡 Lưu ý quan trọng:</p>
            <p>Sau khi từ chối, slot sẽ tự động được giải phóng để các Worker khác có thể nhận làm bù cho đủ Quota chiến dịch.</p>
          </div>

          <div class="flex items-center justify-end space-x-3 pt-2">
            <button id="btn-back-to-review" class="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer">
              Quay lại
            </button>
            <button id="btn-submit-reject" disabled class="px-5 py-2 text-xs font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition cursor-pointer">
              Xác nhận từ chối
            </button>
          </div>
        </div>
      </div>
    `;

    const textarea = document.getElementById('reject-reason-input');
    const counter = document.getElementById('reject-reason-counter');
    const warning = document.getElementById('reject-reason-warning');
    const submitBtn = document.getElementById('btn-submit-reject');

    textarea?.addEventListener('input', () => {
      const len = textarea.value.trim().length;
      if (counter) counter.textContent = `${len} / 500 ký tự`;

      if (len > 0 && len < 10) {
        warning?.classList.remove('hidden');
        submitBtn.disabled = true;
      } else if (len >= 10) {
        warning?.classList.add('hidden');
        submitBtn.disabled = false;
      } else {
        warning?.classList.add('hidden');
        submitBtn.disabled = true;
      }
    });

    document.getElementById('btn-close-reject-modal')?.addEventListener('click', () => this.close());
    document.getElementById('btn-back-to-review')?.addEventListener('click', () => this.renderReviewView(sub));

    submitBtn?.addEventListener('click', async () => {
      const reason = textarea.value.trim();
      if (reason.length < 10) return;

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="inline-block animate-spin mr-1">🔄</span> Đang từ chối...`;

      try {
        await ApiClient.rejectSubmission(sub.claim_id, reason);
        showToast('Đã từ chối bài nộp thành công. Suất làm việc đã được giải phóng để làm bù!', 'info');
        this.close();
        if (this.onSuccessCallback) this.onSuccessCallback();
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Xác nhận từ chối</span>`;
        showToast(err.message || 'Lỗi khi từ chối bài nộp!', 'error');
      }
    });
  }

  close() {
    this.container.innerHTML = '';
  }
}

