import { escapeHtml, formatNumber } from '../utils/html-escaper.js';
import { ApiClient } from '../api.js';
import { showToast } from './toast-modal.js';

const STORAGE_KEY = 'jobzz_post_job_draft';
let previewListener = null;
let taskCreatedListener = null;

let steps = [
  { step_number: 1, instruction: 'Tải và cài đặt ứng dụng từ cửa hàng chính thức', target_url: 'https://jobzz.vn/download', image_url: '' },
  { step_number: 2, instruction: 'Mở ứng dụng và đăng ký tài khoản mới bằng số điện thoại', target_url: '', image_url: '' }
];

let proofs = [
  { proof_type: 'SCREENSHOT_IMAGE', title: 'Ảnh chụp màn hình trang chủ', description: 'Chụp rõ ảnh màn hình trang cá nhân sau khi đăng nhập thành công' }
];

/**
 * Khởi tạo Task Form Component
 */
export function initTaskForm(onTaskCreated, onPreviewUpdate) {
  taskCreatedListener = onTaskCreated;
  previewListener = onPreviewUpdate;

  const form = document.getElementById('create-task-form');
  const titleInput = document.getElementById('task-title');
  const categorySelect = document.getElementById('task-category');
  const quotaInput = document.getElementById('task-quota');
  const rewardInput = document.getElementById('task-reward');
  const descInput = document.getElementById('task-description');

  // 1. Kiểm tra khôi phục bản nháp (E-1 & REQ-PUI-020)
  checkLocalDraft();

  // 2. Lắng nghe thay đổi tính toán Xu thời gian thực
  [quotaInput, rewardInput].forEach((input) => {
    input?.addEventListener('input', () => {
      calculateCoins();
      notifyPreview();
      saveDraft();
    });
  });

  // 3. Lắng nghe các trường khác để đồng bộ Preview & Auto-save
  [titleInput, categorySelect, descInput].forEach((input) => {
    input?.addEventListener('input', () => {
      notifyPreview();
      saveDraft();
    });
  });

  // 4. Quản lý Dynamic Steps
  document.getElementById('btn-add-step')?.addEventListener('click', () => {
    if (steps.length >= 10) {
      showToast('Tối đa 10 bước hướng dẫn', 'warning');
      return;
    }
    steps.push({
      step_number: steps.length + 1,
      instruction: '',
      target_url: '',
      image_url: '',
    });
    renderSteps();
    notifyPreview();
    saveDraft();
  });

  // 5. Quản lý Dynamic Proofs
  document.getElementById('btn-add-proof')?.addEventListener('click', () => {
    if (proofs.length >= 5) {
      showToast('Tối đa 5 yêu cầu bằng chứng', 'warning');
      return;
    }
    const screenshotCount = proofs.filter((p) => p.proof_type === 'SCREENSHOT_IMAGE').length;
    proofs.push({
      proof_type: screenshotCount < 3 ? 'SCREENSHOT_IMAGE' : 'TEXT',
      title: '',
      description: '',
    });
    renderProofs();
    notifyPreview();
    saveDraft();
  });

  // 6. Xử lý Submit (Lưu nháp vs Xuất bản ngay)
  document.getElementById('btn-save-draft')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await handleSubmitTask(false);
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSubmitTask(true);
  });

  // Render ban đầu
  renderSteps();
  renderProofs();
  calculateCoins();
  notifyPreview();
}

/**
 * Tính toán Xu và kiểm tra Bounds tức thời (< 5ms) (REQ-PUI-010 & REQ-PUI-011)
 */
function calculateCoins() {
  const quotaInput = document.getElementById('task-quota');
  const rewardInput = document.getElementById('task-reward');
  const totalDisplay = document.getElementById('calculated-total-coins');
  const errorReward = document.getElementById('error-task-reward');
  const errorQuota = document.getElementById('error-task-quota');
  const errorTotal = document.getElementById('error-task-total');
  const submitBtn = document.getElementById('btn-submit-task');
  const draftBtn = document.getElementById('btn-save-draft');

  const quota = parseInt(quotaInput.value, 10);
  const reward = parseInt(rewardInput.value, 10);

  let hasError = false;

  // Kiểm tra reward_coins: 1..500,000
  if (isNaN(reward) || reward < 1 || reward > 500000) {
    errorReward.textContent = 'Thù lao phải từ 1 đến 500,000 Xu';
    errorReward.classList.remove('hidden');
    rewardInput.classList.add('border-rose-500', 'bg-rose-50/20');
    hasError = true;
  } else {
    errorReward.classList.add('hidden');
    rewardInput.classList.remove('border-rose-500', 'bg-rose-50/20');
  }

  // Kiểm tra quota: 1..10,000
  if (isNaN(quota) || quota < 1 || quota > 10000) {
    errorQuota.textContent = 'Số lượng tuyển phải từ 1 đến 10,000 lượt';
    errorQuota.classList.remove('hidden');
    quotaInput.classList.add('border-rose-500', 'bg-rose-50/20');
    hasError = true;
  } else {
    errorQuota.classList.add('hidden');
    quotaInput.classList.remove('border-rose-500', 'bg-rose-50/20');
  }

  // Tính total_reward_coins
  const total = (isNaN(quota) || isNaN(reward)) ? 0 : (quota * reward);
  totalDisplay.textContent = formatNumber(total);

  // Kiểm tra trần 5 tỷ Xu
  if (total > 5000000000) {
    errorTotal.textContent = 'Tổng ngân sách vượt quá hạn mức tối đa cho phép (5 tỷ Xu)!';
    errorTotal.classList.remove('hidden');
    hasError = true;
  } else {
    errorTotal.classList.add('hidden');
  }

  // Khóa nút submit nếu có lỗi bounds
  if (submitBtn) submitBtn.disabled = hasError;
  if (draftBtn) draftBtn.disabled = hasError;

  return !hasError;
}

/**
 * Render danh sách Steps động kèm kiểm tra URL HTTPS và hỗ trợ hình ảnh minh họa (REQ-PUI-012 & REQ-PUI-013)
 */
function renderSteps() {
  const container = document.getElementById('steps-container');
  if (!container) return;

  container.innerHTML = steps.map((step, index) => {
    const isUrlInsecure = step.target_url && !step.target_url.startsWith('https://');

    return `
      <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
            <span class="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">${index + 1}</span>
            <span>Bước ${index + 1}</span>
          </span>
          ${steps.length > 1 ? `
            <button type="button" data-index="${index}" class="btn-remove-step text-slate-400 hover:text-rose-500 transition p-1" title="Xóa bước này">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          ` : ''}
        </div>

        <!-- 1. Nội dung hướng dẫn -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-500 mb-1">Nội dung hướng dẫn thực hiện <span class="text-rose-500">*</span></label>
          <input type="text" data-index="${index}" class="step-instruction-input w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:border-brand-500 focus:ring-1 focus:ring-brand-200 outline-hidden bg-white" placeholder="Ví dụ: Tải và cài đặt ứng dụng Jobzz từ cửa hàng chính thức (tối thiểu 10 ký tự)..." value="${escapeHtml(step.instruction)}" required minlength="10">
        </div>

        <!-- 2. Đường dẫn đích (nếu có) -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-500 mb-1">Đường dẫn đích (tùy chọn, bắt buộc https://)</label>
          <input type="text" data-index="${index}" class="step-url-input w-full px-3.5 py-2 rounded-xl border ${isUrlInsecure ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200'} text-xs focus:border-brand-500 focus:ring-1 focus:ring-brand-200 outline-hidden bg-white font-mono" placeholder="https://example.com/download" value="${escapeHtml(step.target_url || '')}">
          ${isUrlInsecure ? `
            <p class="text-[11px] text-rose-500 font-bold mt-1">Đường dẫn bắt buộc phải sử dụng giao thức bảo mật https:// (SEC-01)</p>
          ` : ''}
        </div>

        <!-- 3. Hình ảnh minh họa cho bước (Tải lên hoặc URL) -->
        <div class="pt-2 border-t border-slate-200/60">
          <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span class="flex items-center space-x-1">
              <span>🖼️ Hình ảnh minh họa cho bước</span>
              <span class="text-[10px] text-slate-400 font-normal lowercase">(giúp người làm dễ hiểu)</span>
            </span>
            ${step.image_url ? `
              <button type="button" data-index="${index}" class="btn-remove-step-img text-[11px] text-rose-600 hover:text-rose-800 font-semibold flex items-center space-x-1">
                <span>✕ Xóa ảnh</span>
              </button>
            ` : ''}
          </label>

          ${step.image_url ? `
            <div class="rounded-xl overflow-hidden border border-slate-200 bg-white p-2">
              <img src="${escapeHtml(step.image_url)}" alt="Minh họa bước ${index + 1}" class="max-h-52 rounded-lg object-contain mx-auto" />
            </div>
          ` : `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <input type="file" data-index="${index}" accept="image/*" class="step-file-input hidden" id="step-file-${index}">
                <label for="step-file-${index}" class="w-full cursor-pointer px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center space-x-1.5 transition">
                  <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  <span>Tải ảnh từ máy</span>
                </label>
              </div>
              <div>
                <input type="text" data-index="${index}" class="step-image-url-input w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:border-brand-500 focus:ring-1 focus:ring-brand-200 outline-hidden bg-white" placeholder="Hoặc dán URL ảnh (https://...)" value="">
              </div>
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');

  // Lắng nghe sự kiện input trên từng bước
  container.querySelectorAll('.step-instruction-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(input.getAttribute('data-index'), 10);
      steps[idx].instruction = e.target.value;
      saveDraft();
    });
  });

  container.querySelectorAll('.step-url-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(input.getAttribute('data-index'), 10);
      steps[idx].target_url = e.target.value.trim();
      const isSecure = !steps[idx].target_url || steps[idx].target_url.startsWith('https://');
      if (!isSecure) {
        input.classList.add('border-rose-500', 'bg-rose-50/20');
      } else {
        input.classList.remove('border-rose-500', 'bg-rose-50/20');
      }
      saveDraft();
    });
  });

  // Xử lý dán URL ảnh
  container.querySelectorAll('.step-image-url-input').forEach((input) => {
    input.addEventListener('change', (e) => {
      const idx = parseInt(input.getAttribute('data-index'), 10);
      const url = e.target.value.trim();
      if (url) {
        steps[idx].image_url = url;
        renderSteps();
        saveDraft();
        showToast(`Đã gắn ảnh cho Bước ${idx + 1}!`, 'success');
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.dispatchEvent(new Event('change'));
      }
    });
  });

  // Xử lý tải ảnh từ máy tính (FileReader Base64)
  container.querySelectorAll('.step-file-input').forEach((fileInput) => {
    fileInput.addEventListener('change', (e) => {
      const idx = parseInt(fileInput.getAttribute('data-index'), 10);
      const file = e.target.files && e.target.files[0];
      if (file) {
        if (!file.type.startsWith('image/')) {
          showToast('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP)', 'warning');
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          showToast('Kích thước ảnh tối đa 5MB', 'warning');
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          steps[idx].image_url = event.target.result;
          renderSteps();
          saveDraft();
          showToast(`Đã tải ảnh cho Bước ${idx + 1}!`, 'success');
        };
        reader.readAsDataURL(file);
      }
    });
  });

  // Xóa ảnh bước
  container.querySelectorAll('.btn-remove-step-img').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      steps[idx].image_url = '';
      renderSteps();
      saveDraft();
    });
  });

  // Xóa bước
  container.querySelectorAll('.btn-remove-step').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      steps.splice(idx, 1);
      steps.forEach((s, i) => s.step_number = i + 1);
      renderSteps();
      saveDraft();
    });
  });
}

/**
 * Render danh sách Proofs động (REQ-PUI-014 & REQ-PUI-015)
 */
function renderProofs() {
  const container = document.getElementById('proofs-container');
  if (!container) return;

  container.innerHTML = proofs.map((proof, index) => {
    return `
      <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="text-xs font-bold text-slate-700">Yêu cầu ${index + 1}</span>
            <select data-index="${index}" class="proof-type-select text-xs font-semibold px-2 py-0.5 rounded-md border border-slate-200 bg-white">
              <option value="SCREENSHOT_IMAGE" ${proof.proof_type === 'SCREENSHOT_IMAGE' ? 'selected' : ''}>Ảnh chụp màn hình (SCREENSHOT)</option>
              <option value="TEXT" ${proof.proof_type === 'TEXT' ? 'selected' : ''}>Báo cáo văn bản (TEXT)</option>
            </select>
          </div>
          ${proofs.length > 1 ? `
            <button type="button" data-index="${index}" class="btn-remove-proof text-slate-400 hover:text-rose-500 transition p-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          ` : ''}
        </div>
        <div>
          <input type="text" data-index="${index}" class="proof-title-input w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-brand-500 focus:ring-1 focus:ring-brand-200 outline-hidden bg-white font-medium" placeholder="Tiêu đề bằng chứng (ví dụ: Ảnh chụp màn hình tài khoản)..." value="${escapeHtml(proof.title)}" required minlength="5">
        </div>
        <div>
          <input type="text" data-index="${index}" class="proof-desc-input w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-brand-500 focus:ring-1 focus:ring-brand-200 outline-hidden bg-white" placeholder="Mô tả cụ thể Worker cần nộp gì..." value="${escapeHtml(proof.description)}" required minlength="10">
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.proof-type-select').forEach((select) => {
    select.addEventListener('change', (e) => {
      const idx = parseInt(select.getAttribute('data-index'), 10);
      proofs[idx].proof_type = e.target.value;
      notifyPreview();
      saveDraft();
    });
  });

  container.querySelectorAll('.proof-title-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(input.getAttribute('data-index'), 10);
      proofs[idx].title = e.target.value;
      notifyPreview();
      saveDraft();
    });
  });

  container.querySelectorAll('.proof-desc-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(input.getAttribute('data-index'), 10);
      proofs[idx].description = e.target.value;
      notifyPreview();
      saveDraft();
    });
  });

  container.querySelectorAll('.btn-remove-proof').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      proofs.splice(idx, 1);
      renderProofs();
      notifyPreview();
      saveDraft();
    });
  });
}

/**
 * Thu thập dữ liệu form hiện tại
 */
export function getFormData() {
  const title = document.getElementById('task-title')?.value || '';
  const category = document.getElementById('task-category')?.value || 'APP_INSTALL';
  const quota = parseInt(document.getElementById('task-quota')?.value || '0', 10);
  const reward = parseInt(document.getElementById('task-reward')?.value || '0', 10);
  const description = document.getElementById('task-description')?.value || '';
  const execution_time_minutes = 60; // Giá trị ngầm định hệ thống, không yêu cầu người làm
  const auto_approval_days = 3; // Giá trị ngầm định hệ thống

  return {
    title,
    category,
    quota,
    reward_coins: reward,
    total_reward_coins: quota * reward,
    description,
    execution_time_minutes,
    auto_approval_days,
    steps,
    proof_requirements: proofs,
  };
}

/**
 * Thông báo đồng bộ sang Mobile Preview
 */
function notifyPreview() {
  if (typeof previewListener === 'function') {
    previewListener(getFormData());
  }
}

/**
 * Tự động lưu bản nháp vào LocalStorage (REQ-PUI-020)
 */
function saveDraft() {
  const data = getFormData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Kiểm tra và hiển thị banner khôi phục bản nháp
 */
function checkLocalDraft() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);
    const banner = document.getElementById('draft-restore-banner');
    if (banner && draft.title) {
      banner.classList.remove('hidden');

      document.getElementById('btn-restore-draft')?.addEventListener('click', () => {
        applyDraftData(draft);
        banner.classList.add('hidden');
        showToast('Đã khôi phục bản nháp!', 'info');
      });

      document.getElementById('btn-discard-draft')?.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY);
        banner.classList.add('hidden');
      });
    }
  } catch (err) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function applyDraftData(draft) {
  if (draft.title) document.getElementById('task-title').value = draft.title;
  if (draft.category) document.getElementById('task-category').value = draft.category;
  if (draft.quota) document.getElementById('task-quota').value = draft.quota;
  if (draft.reward_coins) document.getElementById('task-reward').value = draft.reward_coins;
  if (draft.description) document.getElementById('task-description').value = draft.description;

  if (Array.isArray(draft.steps) && draft.steps.length > 0) steps = draft.steps;
  if (Array.isArray(draft.proof_requirements) && draft.proof_requirements.length > 0) proofs = draft.proof_requirements;

  renderSteps();
  renderProofs();
  calculateCoins();
  notifyPreview();
}

/**
 * Gửi form tạo nhiệm vụ (Lưu nháp hoặc Xuất bản) (REQ-PUI-016 & REQ-PUI-017)
 */
async function handleSubmitTask(autoPublish = false) {
  if (!calculateCoins()) {
    showToast('Vui lòng sửa các lỗi nhập liệu trước khi tiếp tục', 'error');
    return;
  }

  // Kiểm tra an ninh URL HTTPS
  for (const step of steps) {
    if (step.target_url && !step.target_url.startsWith('https://')) {
      showToast(`Bước ${step.step_number}: URL bắt buộc sử dụng giao thức https:// (SEC-01)`, 'error');
      return;
    }
  }

  const data = getFormData();
  const payload = {
    title: data.title,
    description: data.description,
    category: data.category,
    reward_coins: data.reward_coins,
    quota: data.quota,
    execution_time_minutes: data.execution_time_minutes,
    auto_approval_days: data.auto_approval_days,
    auto_publish: autoPublish,
    steps: steps.map((s) => ({
      step_number: s.step_number,
      instruction: s.instruction,
      target_url: s.target_url || undefined,
      image_url: s.image_url || undefined,
    })),
    proof_requirements: proofs.map((p) => ({
      proof_type: p.proof_type,
      title: p.title,
      description: p.description,
      is_required: true,
    })),
  };

  try {
    const res = await ApiClient.createTask(payload);
    const createdTask = res.data;
    showToast(
      autoPublish ? 'Nhiệm vụ đã được tạo và xuất bản thành công!' : 'Đã lưu bản nháp nhiệm vụ thành công!',
      'success'
    );

    // Xóa form & draft
    localStorage.removeItem(STORAGE_KEY);
    document.getElementById('create-task-form')?.reset();
    steps = [{ step_number: 1, instruction: '', target_url: '', image_url: '' }];
    proofs = [{ proof_type: 'SCREENSHOT_IMAGE', title: '', description: '' }];
    renderSteps();
    renderProofs();
    calculateCoins();
    notifyPreview();

    if (typeof taskCreatedListener === 'function') {
      await taskCreatedListener(createdTask);
    }
  } catch (err) {
    showToast(err.message || 'Lỗi khi tạo nhiệm vụ', 'error');
  }
}

