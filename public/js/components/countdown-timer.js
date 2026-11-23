/**
 * Component Đồng hồ đếm ngược thời gian thực giữ slot làm bài (REQ-BCT-021 & NFR-UX-001)
 */
export class CountdownTimer {
  constructor({ containerId, expiresAt, remainingSeconds, onCancel, onExpire, onSubmitClick }) {
    this.container = document.getElementById(containerId);
    this.remainingSeconds = remainingSeconds;
    this.expiresAt = new Date(expiresAt);
    this.onCancel = onCancel;
    this.onExpire = onExpire;
    this.onSubmitClick = onSubmitClick;
    this.intervalId = null;
    this.init();
  }

  init() {
    if (!this.container) return;
    this.render();
    this.start();
  }

  start() {
    this.stop();
    this.intervalId = setInterval(() => {
      this.remainingSeconds--;
      if (this.remainingSeconds <= 0) {
        this.remainingSeconds = 0;
        this.stop();
        this.updateDisplay();
        if (this.onExpire) this.onExpire();
      } else {
        this.updateDisplay();
      }
    }, 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  render() {
    const isWarning = this.remainingSeconds <= 300;
    const timeText = this.formatTime(this.remainingSeconds);

    this.container.innerHTML = `
      <div id="countdown-banner" class="flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl border transition-all ${
        isWarning
          ? 'bg-rose-50 border-rose-300 text-rose-900 animate-pulse'
          : 'bg-indigo-50 border-indigo-200 text-indigo-900'
      }">
        <div class="flex items-center space-x-3 mb-3 sm:mb-0">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
            isWarning ? 'bg-rose-500 text-white' : 'bg-brand-600 text-white'
          }">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div>
            <div class="text-xs font-semibold uppercase tracking-wider ${isWarning ? 'text-rose-700 font-bold' : 'text-indigo-600'}">
              ${isWarning ? '⚠️ Sắp hết hạn giữ chỗ!' : 'Đang giữ chỗ làm bài'}
            </div>
            <div class="text-sm font-bold flex items-center space-x-2">
              <span>Thời gian còn lại:</span>
              <span id="countdown-timer-display" class="font-mono text-lg font-black ${isWarning ? 'text-rose-600' : 'text-brand-600'}">
                ${timeText}
              </span>
            </div>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <button id="btn-cancel-claim" class="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition shadow-2xs">
            Hủy nhận việc
          </button>
          <button id="btn-open-submit-modal" class="px-4 py-1.5 text-xs font-bold rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition shadow-xs flex items-center space-x-1.5 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>Nộp bằng chứng</span>
          </button>
        </div>
      </div>
    `;

    const cancelBtn = this.container.querySelector('#btn-cancel-claim');
    if (cancelBtn && this.onCancel) {
      cancelBtn.addEventListener('click', this.onCancel);
    }

    const submitBtn = this.container.querySelector('#btn-open-submit-modal');
    if (submitBtn && this.onSubmitClick) {
      submitBtn.addEventListener('click', this.onSubmitClick);
    }
  }

  updateDisplay() {
    const displayEl = this.container?.querySelector('#countdown-timer-display');
    const bannerEl = this.container?.querySelector('#countdown-banner');
    if (displayEl) {
      displayEl.textContent = this.formatTime(this.remainingSeconds);
    }
    if (bannerEl && this.remainingSeconds <= 300) {
      bannerEl.classList.add('bg-rose-50', 'border-rose-300', 'text-rose-900', 'animate-pulse');
      bannerEl.classList.remove('bg-indigo-50', 'border-indigo-200', 'text-indigo-900');
    }
  }
}

