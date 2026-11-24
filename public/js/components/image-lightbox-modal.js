import { escapeHtml } from '../utils/html-escaper.js';

/**
 * Modal phóng to ảnh chụp màn hình bằng chứng (Lightbox Viewer)
 * Hỗ trợ Admin quan sát chi tiết từng pixel ảnh bằng chứng đối soát (REQ-RTS-020)
 * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-020
 */
export class ImageLightboxModal {
  constructor(containerId = 'lightbox-modal-container') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = containerId;
      document.body.appendChild(this.container);
    }
  }

  open(imageUrl, title = 'Ảnh chụp màn hình bằng chứng') {
    const safeUrl = escapeHtml(imageUrl);
    const safeTitle = escapeHtml(title);

    this.container.innerHTML = `
      <div id="lightbox-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 sm:p-6 transition-opacity animate-in fade-in duration-200">
        <div class="relative max-w-5xl w-full max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          
          <!-- Header Bar -->
          <div class="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/90 text-white">
            <div class="flex items-center space-x-2 truncate">
              <span class="text-base font-bold truncate">🔍 ${safeTitle}</span>
            </div>
            <div class="flex items-center space-x-3">
              <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline flex items-center space-x-1">
                <span>Mở tab mới</span>
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
              </a>
              <button id="lightbox-btn-close" class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          </div>

          <!-- Image Area -->
          <div class="flex-1 overflow-auto flex items-center justify-center p-2 bg-slate-950">
            <img src="${safeUrl}" alt="${safeTitle}" class="max-w-full max-h-[78vh] object-contain rounded-lg shadow-lg border border-slate-800 transition-transform select-none" />
          </div>

          <!-- Footer Instruction -->
          <div class="px-4 py-2 border-t border-slate-800 text-center text-xs text-slate-400 bg-slate-900">
            Nhấn <kbd class="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono text-[10px]">ESC</kbd> hoặc click vào nền tối để đóng trình xem ảnh
          </div>
        </div>
      </div>
    `;

    const close = () => this.close();

    document.getElementById('lightbox-btn-close')?.addEventListener('click', close);
    document.getElementById('lightbox-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'lightbox-backdrop') close();
    });

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        close();
        window.removeEventListener('keydown', handleKeydown);
      }
    };
    window.addEventListener('keydown', handleKeydown);
  }

  close() {
    this.container.innerHTML = '';
  }
}

