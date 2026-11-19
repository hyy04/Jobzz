import { escapeHtml, formatNumber } from '../utils/html-escaper.js';
import { showToast } from './toast-modal.js';

let debounceTimer = null;

const CATEGORY_NAMES = {
  APP_INSTALL: 'Cài đặt ứng dụng',
  ACCOUNT_REGISTRATION: 'Đăng ký tài khoản',
  SOCIAL_INTERACTION: 'Tương tác mạng xã hội',
  REVIEW_RATING: 'Đánh giá & Xếp hạng',
  SURVEY: 'Khảo sát trực tuyến',
  CONTENT_WRITING: 'Viết nội dung',
  OTHER: 'Nhiệm vụ tự do',
};

/**
 * Khởi tạo Mobile Preview Component
 */
export function initMobilePreview() {
  updateClock();
  setInterval(updateClock, 30000);

  // Nút "Nhận việc ngay" mô phỏng (REQ-PUI-019)
  const acceptBtn = document.getElementById('btn-preview-accept');
  acceptBtn?.addEventListener('click', () => {
    showToast('Đây là màn hình xem trước của Worker. Tính năng nhận việc thực tế sẽ có trên ứng dụng Worker!', 'info', 4000);
  });
}

function updateClock() {
  const clockEl = document.getElementById('preview-clock');
  if (!clockEl) return;
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  clockEl.textContent = `${hours}:${minutes}`;
}

/**
 * Cập nhật giao diện Mobile Preview với debounce 100ms (REQ-PUI-018)
 */
export function updateMobilePreview(formData) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    renderPreview(formData);
  }, 100);
}

function renderPreview(data) {
  if (!data) return;

  // 1. Thù lao Xu
  const rewardEl = document.getElementById('preview-reward-coins');
  if (rewardEl) {
    rewardEl.textContent = `${formatNumber(data.reward_coins || 0)} Xu`;
  }

  // 2. Tiêu đề
  const titleEl = document.getElementById('preview-title');
  if (titleEl) {
    titleEl.textContent = data.title || 'Tiêu đề nhiệm vụ';
  }

  // 3. Danh mục
  const catEl = document.getElementById('preview-category-badge');
  if (catEl) {
    catEl.textContent = CATEGORY_NAMES[data.category] || data.category;
  }

  // 4. Thời gian làm bài
  const timeEl = document.getElementById('preview-time');
  if (timeEl) {
    timeEl.textContent = `${data.execution_time_minutes || 60} phút`;
  }

  // 5. Mô tả
  const descEl = document.getElementById('preview-description');
  if (descEl) {
    descEl.textContent = data.description || 'Chưa có mô tả chi tiết...';
  }

  // 6. Danh sách các bước (Steps)
  const stepsList = document.getElementById('preview-steps-list');
  if (stepsList) {
    if (!data.steps || data.steps.length === 0) {
      stepsList.innerHTML = `<p class="text-xs text-slate-400 italic">Chưa có bước hướng dẫn</p>`;
    } else {
      stepsList.innerHTML = data.steps.map((step) => {
        const hasUrl = step.target_url && step.target_url.startsWith('https://');

        return `
          <div class="p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs space-y-1.5">
            <div class="flex items-center space-x-1.5">
              <span class="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                ${step.step_number}
              </span>
              <p class="text-xs font-semibold text-slate-700 leading-snug">${escapeHtml(step.instruction || 'Nội dung bước...')}</p>
            </div>
            ${hasUrl ? `
              <div class="pt-1">
                <a href="${escapeHtml(step.target_url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold transition">
                  <span>Mở liên kết</span>
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                </a>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }
  }

  // 7. Danh sách bằng chứng (Proofs)
  const proofsList = document.getElementById('preview-proofs-list');
  if (proofsList) {
    if (!data.proof_requirements || data.proof_requirements.length === 0) {
      proofsList.innerHTML = `<p class="text-xs text-slate-400 italic">Chưa cấu hình bằng chứng</p>`;
    } else {
      proofsList.innerHTML = data.proof_requirements.map((proof, i) => {
        const isScreenshot = proof.proof_type === 'SCREENSHOT_IMAGE';

        return `
          <div class="p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-slate-700">${escapeHtml(proof.title || `Bằng chứng ${i + 1}`)}</span>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${isScreenshot ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}">
                ${isScreenshot ? 'Ảnh chụp' : 'Văn bản'}
              </span>
            </div>
            <p class="text-[10px] text-slate-500 leading-normal">${escapeHtml(proof.description || 'Chi tiết yêu cầu bằng chứng...')}</p>
          </div>
        `;
      }).join('');
    }
  }
}

