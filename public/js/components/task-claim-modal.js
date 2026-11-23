import { escapeHtml } from '../utils/html-escaper.js';
import { getCurrentRole } from './navbar.js';
import { showToast } from './toast-modal.js';
import { ApiClient } from '../api.js';

const CATEGORY_NAMES = {
  APP_INSTALL: 'Cài đặt ứng dụng',
  ACCOUNT_REGISTRATION: 'Đăng ký tài khoản',
  SOCIAL_INTERACTION: 'Tương tác MXH',
  REVIEW_RATING: 'Đánh giá & Review',
  SURVEY: 'Khảo sát',
  CONTENT_WRITING: 'Viết bài / Content',
  OTHER: 'Khác',
};

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Modal hiển thị chi tiết nhiệm vụ, nhận việc và nộp bằng chứng trực quan
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-019..020
 * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-STP-019..023
 */
export function openTaskClaimModal(
  task,
  onClaimSuccess,
  onCancelSuccess,
  activeClaim = null,
  onSubmitSuccess = null
) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  const role = getCurrentRole();
  const isWorker = role === 'WORKER';
  const isClaimed = Boolean(activeClaim && activeClaim.status === 'IN_PROGRESS');
  const isSubmitted = Boolean(activeClaim && activeClaim.status === 'SUBMITTED');

  // State lưu trữ các bằng chứng đang nhập / upload: Map<requirementId, { type, value, previewUrl, fileName }>
  const proofState = new Map();

  // Khởi tạo state từ activeClaim nếu đã nộp
  if (isSubmitted && activeClaim.submitted_proofs) {
    for (const p of activeClaim.submitted_proofs) {
      proofState.set(p.requirement_id, {
        type: p.proof_type,
        value: p.value,
        previewUrl: p.proof_type === 'SCREENSHOT_IMAGE' ? p.value : null,
      });
    }
  }

  const stepsHtml = (task.steps || [])
    .map(
      (s) => `
      <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
        <div class="flex items-start space-x-3">
          <span class="w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
            ${s.step_number}
          </span>
          <div class="flex-1 space-y-1">
            <p class="text-sm font-semibold text-slate-800 leading-relaxed">${escapeHtml(s.instruction)}</p>
            ${
              s.target_url
                ? `<a href="${escapeHtml(s.target_url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center space-x-1 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-100 mt-1">
                    <span>Mở liên kết an toàn</span>
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                  </a>`
                : ''
            }
          </div>
        </div>
        ${
          s.image_url
            ? `<div class="mt-2 pl-9">
                <p class="text-xs font-medium text-slate-500 mb-1">Hình ảnh minh họa:</p>
                <img src="${escapeHtml(s.image_url)}" alt="Minh họa bước ${s.step_number}" class="rounded-xl border border-slate-200 max-h-56 max-w-full object-contain bg-white shadow-2xs hover:opacity-95 transition cursor-pointer" onclick="window.open('${escapeHtml(s.image_url)}', '_blank')" />
              </div>`
            : ''
        }
      </div>`
    )
    .join('');

  // Render danh sách bằng chứng cần nộp hoặc Form nộp bài
  const renderProofInputsHtml = () => {
    return (task.proof_requirements || [])
      .map((p) => {
        const isRequired = p.is_required ?? true;
        const state = proofState.get(p.id) || {};

        if (isSubmitted) {
          // Trạng thái đã nộp - chỉ xem (Read-only view)
          return `
            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-800">${escapeHtml(p.title)}</span>
                <span class="text-2xs font-semibold px-2 py-0.5 rounded-full ${isRequired ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'}">
                  ${isRequired ? 'Bắt buộc' : 'Tùy chọn'}
                </span>
              </div>
              ${
                p.proof_type === 'SCREENSHOT_IMAGE'
                  ? state.value
                    ? `<div class="mt-2">
                        <img src="${escapeHtml(state.value)}" alt="Bằng chứng đã nộp" class="rounded-xl border border-slate-200 max-h-48 max-w-full object-contain bg-white cursor-pointer" onclick="window.open('${escapeHtml(state.value)}', '_blank')" />
                       </div>`
                    : '<p class="text-xs text-slate-400 italic">Chưa nộp ảnh</p>'
                  : `<div class="p-3 bg-white rounded-xl border border-slate-200 text-xs font-medium text-slate-700 break-words whitespace-pre-wrap">${escapeHtml(state.value || 'Chưa nộp văn bản')}</div>`
              }
            </div>
          `;
        }

        // Trạng thái nộp bài (IN_PROGRESS)
        if (p.proof_type === 'SCREENSHOT_IMAGE') {
          return `
            <div class="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3" data-req-id="${p.id}">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-xs font-bold text-slate-900">${escapeHtml(p.title)}</div>
                  ${p.description ? `<p class="text-xs text-slate-500 mt-0.5">${escapeHtml(p.description)}</p>` : ''}
                </div>
                <span class="text-2xs font-bold px-2 py-0.5 rounded-full ${isRequired ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}">
                  ${isRequired ? 'Bắt buộc' : 'Tùy chọn'}
                </span>
              </div>

              <!-- Upload Dropzone & Preview -->
              <div class="proof-upload-area relative">
                <input type="file" id="file-input-${p.id}" class="hidden proof-file-input" accept="image/png,image/jpeg,image/webp" data-req-id="${p.id}" />
                
                <div id="dropzone-${p.id}" class="border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-2xl p-5 text-center transition cursor-pointer bg-slate-50/50 hover:bg-brand-50/30 flex flex-col items-center justify-center space-y-2 ${state.value ? 'hidden' : ''}">
                  <div class="w-10 h-10 rounded-xl bg-indigo-50 text-brand-600 flex items-center justify-center">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </div>
                  <div class="text-xs font-bold text-slate-700">Nhấn để chọn ảnh hoặc kéo thả vào đây</div>
                  <div class="text-2xs text-slate-400">Hỗ trợ PNG, JPEG, WebP (Tối đa 5MB)</div>
                </div>

                <!-- Preview container -->
                <div id="preview-${p.id}" class="relative ${state.value ? '' : 'hidden'}">
                  <div class="relative inline-block border border-slate-200 rounded-2xl overflow-hidden bg-slate-100 shadow-2xs">
                    <img id="preview-img-${p.id}" src="${escapeHtml(state.previewUrl || '')}" alt="Xem trước ảnh bằng chứng" class="max-h-48 max-w-full rounded-2xl object-contain bg-white" />
                    <button type="button" data-remove-req="${p.id}" class="btn-remove-proof-image absolute top-2 right-2 p-1.5 bg-slate-900/70 hover:bg-rose-600 text-white rounded-full transition shadow-md">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  </div>
                  <div id="upload-status-${p.id}" class="text-2xs font-bold text-emerald-600 mt-1 flex items-center space-x-1">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    <span>Ảnh đã sẵn sàng tải lên</span>
                  </div>
                </div>
              </div>
            </div>
          `;
        } else {
          // TEXT requirement
          return `
            <div class="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2" data-req-id="${p.id}">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-xs font-bold text-slate-900">${escapeHtml(p.title)}</div>
                  ${p.description ? `<p class="text-xs text-slate-500 mt-0.5">${escapeHtml(p.description)}</p>` : ''}
                </div>
                <span class="text-2xs font-bold px-2 py-0.5 rounded-full ${isRequired ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}">
                  ${isRequired ? 'Bắt buộc' : 'Tùy chọn'}
                </span>
              </div>

              <div class="relative">
                <textarea
                  id="text-input-${p.id}"
                  data-req-id="${p.id}"
                  rows="3"
                  maxlength="500"
                  class="proof-text-input w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 transition resize-none"
                  placeholder="Nhập nội dung bằng chứng (mã giao dịch, username, văn bản...)"
                >${escapeHtml(state.value || '')}</textarea>
                <div class="flex items-center justify-between text-2xs mt-1">
                  <span id="text-error-${p.id}" class="text-rose-600 font-medium hidden">Vượt quá 500 ký tự cho phép!</span>
                  <span id="char-counter-${p.id}" class="text-slate-400 font-semibold ml-auto">
                    ${(state.value || '').length}/500
                  </span>
                </div>
              </div>
            </div>
          `;
        }
      })
      .join('');
  };

  container.innerHTML = `
    <div id="claim-modal-overlay" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-in">
        
        <!-- Modal Header -->
        <div class="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-brand-600 border border-indigo-200">
                ${CATEGORY_NAMES[task.category] || task.category}
              </span>
              ${
                isSubmitted
                  ? '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">Đang chờ duyệt</span>'
                  : isClaimed
                  ? '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Đang giữ slot</span>'
                  : `<span class="text-xs font-medium text-slate-500">Giữ slot: ${task.execution_time_minutes} phút</span>`
              }
            </div>
            <h3 class="text-lg font-bold text-slate-900">${escapeHtml(task.title)}</h3>
          </div>
          <button id="btn-close-claim-modal" class="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <!-- Modal Body (Scrollable) -->
        <div class="p-6 overflow-y-auto space-y-6 flex-1">
          <!-- Submitted Banner nếu đã nộp -->
          ${
            isSubmitted
              ? `
            <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start space-x-3 text-amber-900">
              <div class="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 font-bold">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <div>
                <h4 class="text-xs font-bold uppercase tracking-wider text-amber-800">Bài nộp đang chờ xét duyệt</h4>
                <p class="text-xs text-amber-700 mt-1 leading-relaxed">
                  Bạn đã nộp bằng chứng thành công lúc <strong>${new Date(activeClaim.submitted_at).toLocaleTimeString('vi-VN')} ${new Date(activeClaim.submitted_at).toLocaleDateString('vi-VN')}</strong>. Người tạo nhiệm vụ sẽ duyệt bài trong thời gian quy định (${task.auto_approval_days || 3} ngày).
                </p>
              </div>
            </div>`
              : ''
          }

          <!-- Reward Box -->
          <div class="p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between shadow-xs">
            <div>
              <span class="text-xs font-bold tracking-wider uppercase text-amber-100">Thù lao hoàn thành</span>
              <div class="text-2xl font-black">${(task.reward_coins || 0).toLocaleString('vi-VN')} Xu</div>
            </div>
            <div class="text-right">
              <span class="text-xs font-medium text-amber-100">Suất khả dụng</span>
              <div class="text-lg font-bold">${task.remaining_quota ?? 0} / ${task.quota || 0}</div>
            </div>
          </div>

          <!-- Description -->
          <div>
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Mô tả nhiệm vụ</h4>
            <div class="text-sm text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-200/60 leading-relaxed whitespace-pre-line">
              ${escapeHtml(task.description || 'Chưa có mô tả chi tiết.')}
            </div>
          </div>

          <!-- Step Instructions with Images -->
          <div>
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Hướng dẫn từng bước (${(task.steps || []).length} bước)</h4>
            <div class="space-y-3">
              ${stepsHtml || '<p class="text-xs text-slate-400">Chưa có hướng dẫn.</p>'}
            </div>
          </div>

          <!-- Proof Requirements Section -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400">
                ${isClaimed ? 'Nộp bằng chứng hoàn thành' : isSubmitted ? 'Bằng chứng đã nộp' : 'Bằng chứng cần nộp'}
              </h4>
              ${
                isClaimed
                  ? '<span class="text-2xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">Vui lòng nộp đủ các mục bắt buộc</span>'
                  : ''
              }
            </div>
            <div id="proof-container" class="space-y-3">
              ${renderProofInputsHtml()}
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="text-xs text-slate-500">
            ${
              isSubmitted
                ? '🔒 Bài nộp đã bị khóa để đối soát. Bạn không thể chỉnh sửa hoặc nộp lại.'
                : isClaimed
                ? 'Hãy kiểm tra kỹ ảnh và nội dung trước khi bấm Nộp bài nhận Xu.'
                : isWorker
                ? 'Sau khi nhận việc, slot sẽ được giữ chỗ và đếm ngược thời gian.'
                : '⚠️ Vui lòng chuyển sang vai trò WORKER để nhận việc.'
            }
          </div>
          <div class="flex items-center space-x-3 w-full sm:w-auto">
            <button id="btn-cancel-modal" class="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer">
              Đóng
            </button>
            ${
              isSubmitted
                ? ''
                : isClaimed
                ? `
              <button id="btn-submit-proof" class="flex-1 sm:flex-none px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                <span>Nộp bài nhận Xu</span>
              </button>`
                : `
              <button id="btn-action-claim" class="flex-1 sm:flex-none px-6 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition ${
                isWorker
                  ? 'bg-brand-600 hover:bg-brand-700 cursor-pointer'
                  : 'bg-slate-400 cursor-not-allowed opacity-75'
              }">
                Nhận việc ngay (${task.execution_time_minutes}p)
              </button>`
            }
          </div>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => {
    container.innerHTML = '';
  };

  container.querySelector('#btn-close-claim-modal')?.addEventListener('click', closeModal);
  container.querySelector('#btn-cancel-modal')?.addEventListener('click', closeModal);

  // 1. Logic khi chưa claim: Nhận việc ngay
  const claimBtn = container.querySelector('#btn-action-claim');
  if (claimBtn) {
    claimBtn.addEventListener('click', async () => {
      if (!isWorker) {
        showToast('Vui lòng chọn vai trò WORKER trên thanh điều hướng để nhận việc!', 'warning');
        return;
      }

      claimBtn.disabled = true;
      claimBtn.innerHTML = 'Đang xử lý nhận việc...';

      try {
        const result = await ApiClient.claimTaskSlot(task.id);
        showToast('Nhận việc thành công! Slot đã được giữ chỗ.', 'success');
        closeModal();
        if (onClaimSuccess) onClaimSuccess(result.data);
      } catch (err) {
        claimBtn.disabled = false;
        claimBtn.innerHTML = `Nhận việc ngay (${task.execution_time_minutes}p)`;
        const errorMsg = err.data?.error?.message || err.message || 'Không thể nhận việc lúc này.';
        showToast(errorMsg, 'error');
      }
    });
  }

  // 2. Logic khi đang giữ slot (isClaimed): Xử lý tải ảnh, nhập text và nộp bài
  if (isClaimed) {
    const submitBtn = container.querySelector('#btn-submit-proof');

    // Thiết lập kéo thả và chọn file cho các mục ảnh
    container.querySelectorAll('.proof-file-input').forEach((input) => {
      const reqId = input.dataset.reqId;
      const dropzone = container.querySelector(`#dropzone-${reqId}`);
      const previewContainer = container.querySelector(`#preview-${reqId}`);
      const previewImg = container.querySelector(`#preview-img-${reqId}`);
      const statusEl = container.querySelector(`#upload-status-${reqId}`);

      dropzone?.addEventListener('click', () => input.click());

      dropzone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-brand-500', 'bg-brand-50/50');
      });

      dropzone?.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-brand-500', 'bg-brand-50/50');
      });

      dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-brand-500', 'bg-brand-50/50');
        if (e.dataTransfer?.files?.length) {
          handleFileSelect(e.dataTransfer.files[0], reqId);
        }
      });

      input.addEventListener('change', () => {
        if (input.files?.length) {
          handleFileSelect(input.files[0], reqId);
        }
      });

      const handleFileSelect = async (file, rId) => {
        // Kiểm tra loại file
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
          showToast('Định dạng tệp không được hỗ trợ. Chỉ chấp nhận PNG, JPEG, WebP!', 'error');
          return;
        }

        // Kiểm tra dung lượng file <= 5MB
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          showToast('Dung lượng tệp vượt quá giới hạn 5MB cho phép!', 'error');
          return;
        }

        // Đọc preview cục bộ ngay lập tức
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64Data = e.target.result;
          previewImg.src = base64Data;
          previewContainer.classList.remove('hidden');
          dropzone.classList.add('hidden');
          statusEl.innerHTML = '<span class="text-amber-600">Đang tải ảnh lên máy chủ...</span>';

          try {
            const uploadRes = await ApiClient.uploadProofImage(base64Data, file.type, file.name);
            const uploadedUrl = uploadRes.data.file_url;
            proofState.set(rId, {
              type: 'SCREENSHOT_IMAGE',
              value: uploadedUrl,
              previewUrl: base64Data,
              fileName: uploadRes.data.file_name,
            });
            statusEl.innerHTML = '<span class="text-emerald-600 font-bold">✓ Tải ảnh thành công</span>';
          } catch (err) {
            statusEl.innerHTML = '<span class="text-rose-600 font-bold">✕ Tải ảnh thất bại!</span>';
            const msg = err.data?.error?.message || err.message || 'Lỗi khi upload tệp.';
            showToast(msg, 'error');
          }
        };
        reader.readAsDataURL(file);
      };
    });

    // Nút xóa ảnh đã chọn
    container.querySelectorAll('.btn-remove-proof-image').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const reqId = btn.dataset.removeReq;
        proofState.delete(reqId);

        const dropzone = container.querySelector(`#dropzone-${reqId}`);
        const previewContainer = container.querySelector(`#preview-${reqId}`);
        const fileInput = container.querySelector(`#file-input-${reqId}`);

        if (fileInput) fileInput.value = '';
        previewContainer?.classList.add('hidden');
        dropzone?.classList.remove('hidden');
      });
    });

    // Lắng nghe nhập liệu Text & bộ đếm ký tự 0/500
    container.querySelectorAll('.proof-text-input').forEach((textarea) => {
      const reqId = textarea.dataset.reqId;
      const counter = container.querySelector(`#char-counter-${reqId}`);
      const errorMsg = container.querySelector(`#text-error-${reqId}`);

      textarea.addEventListener('input', () => {
        const val = textarea.value || '';
        const len = val.length;
        if (counter) counter.innerText = `${len}/500`;

        if (len > 500) {
          errorMsg?.classList.remove('hidden');
          counter?.classList.add('text-rose-600');
        } else {
          errorMsg?.classList.add('hidden');
          counter?.classList.remove('text-rose-600');
        }

        if (val.trim()) {
          proofState.set(reqId, {
            type: 'TEXT',
            value: val,
          });
        } else {
          proofState.delete(reqId);
        }
      });
    });

    // Nút Nộp bài nhận Xu
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        // 1. Kiểm tra đủ 100% bằng chứng bắt buộc
        const requirements = task.proof_requirements || [];
        for (const req of requirements) {
          const isRequired = req.is_required ?? true;
          if (isRequired) {
            const entry = proofState.get(req.id);
            if (!entry || !entry.value || !entry.value.trim()) {
              showToast(`Vui lòng cung cấp bằng chứng bắt buộc: "${req.title}"!`, 'warning');
              return;
            }
          }
        }

        // 2. Chuẩn bị payload nộp bài
        const proofsPayload = [];
        for (const [rId, entry] of proofState.entries()) {
          if (entry.value && entry.value.trim()) {
            proofsPayload.push({
              requirement_id: rId,
              value: entry.value.trim(),
            });
          }
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <svg class="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <span>Đang nộp bài...</span>
        `;

        try {
          const result = await ApiClient.submitTaskProof(activeClaim.id, proofsPayload);
          showToast('🎉 Nộp bài thành công! Nhiệm vụ đang chờ xét duyệt thù lao Xu.', 'success');
          closeModal();
          if (onSubmitSuccess) {
            onSubmitSuccess(result.data);
          }
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            <span>Nộp bài nhận Xu</span>
          `;
          const errorMsg = err.data?.error?.message || err.message || 'Không thể nộp bài lúc này.';
          showToast(errorMsg, 'error');
        }
      });
    }
  }
}
