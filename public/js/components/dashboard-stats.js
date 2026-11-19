import { formatNumber } from '../utils/html-escaper.js';

/**
 * Hiển thị khối 4 thẻ thống kê Dashboard Stats (REQ-PUI-001)
 */
export function renderDashboardStats(tasks = []) {
  const container = document.getElementById('dashboard-stats-grid');
  if (!container) return;

  const totalTasks = tasks.length;
  const activeTasks = tasks.filter((t) => t.status === 'ACTIVE').length;
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const totalCoinsAllocated = tasks.reduce((sum, t) => sum + (Number(t.total_reward_coins) || 0), 0);

  container.innerHTML = `
    <!-- Thẻ 1: Tổng số nhiệm vụ -->
    <div class="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
      <div>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng số nhiệm vụ</p>
        <h3 class="text-2xl font-black text-slate-800 mt-1">${formatNumber(totalTasks)}</h3>
      </div>
      <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
        📋
      </div>
    </div>

    <!-- Thẻ 2: Nhiệm vụ đang chạy -->
    <div class="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
      <div>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Đang hoạt động</p>
        <h3 class="text-2xl font-black text-emerald-600 mt-1">${formatNumber(activeTasks)}</h3>
      </div>
      <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
        ⚡
      </div>
    </div>

    <!-- Thẻ 3: Tổng ngân sách Xu -->
    <div class="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
      <div>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng ngân sách Xu</p>
        <h3 class="text-2xl font-black text-amber-500 mt-1">${formatNumber(totalCoinsAllocated)}</h3>
      </div>
      <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
        🪙
      </div>
    </div>

    <!-- Thẻ 4: Đã hoàn thành chỉ tiêu -->
    <div class="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
      <div>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Đã hoàn thành</p>
        <h3 class="text-2xl font-black text-blue-600 mt-1">${formatNumber(completedTasks)}</h3>
      </div>
      <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
        🎯
      </div>
    </div>
  `;
}

