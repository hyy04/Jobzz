import { getCurrentRole } from './components/navbar.js';

const API_TIMEOUT_MS = 5000;

/**
 * Lớp gọi REST API chuẩn hóa với timeout, headers xác thực và phân loại mã lỗi
 * @ears .sdd/features/post-job-ui/SPEC.md#REQ-PUI-001..009
 * @ears .sdd/features/post-job-ui/SPEC.md#NFR-RELI-01
 */
export class ApiClient {
  static async request(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const role = getCurrentRole();
    const headers = {
      'Content-Type': 'application/json',
      'x-user-role': role,
      'x-user-id': role === 'ADMIN' ? 'adm-001' : 'worker-001',
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const error = new Error(data.message || `Lỗi HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const timeoutError = new Error('Yêu cầu hết thời gian chờ (Timeout 5s). Vui lòng thử lại!');
        timeoutError.status = 408;
        throw timeoutError;
      }
      throw err;
    }
  }

  /**
   * Lấy danh sách toàn bộ nhiệm vụ
   */
  static async getTasks() {
    return this.request('/api/v1/tasks', { method: 'GET' });
  }

  /**
   * Tạo mới nhiệm vụ
   */
  static async createTask(payload) {
    return this.request('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Chuyển đổi trạng thái nhiệm vụ (Publish, Pause, Resume, Close)
   */
  static async changeTaskStatus(id, action, expectedVersion) {
    return this.request(`/api/v1/tasks/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        expected_version: expectedVersion,
      }),
    });
  }

  /**
   * Lấy danh sách nhiệm vụ công khai khả dụng cho Người làm
   * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-001..005
   */
  static async getPublicTasks(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);
    if (params.category) query.set('category', params.category);
    if (params.sort_by) query.set('sort_by', params.sort_by);

    const queryString = query.toString();
    const endpoint = queryString ? `/api/v1/public/tasks?${queryString}` : '/api/v1/public/tasks';
    return this.request(endpoint, { method: 'GET' });
  }

  /**
   * Xem chi tiết nhiệm vụ công khai kèm ảnh minh họa và yêu cầu bằng chứng
   * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-006..008
   */
  static async getPublicTaskDetails(id) {
    return this.request(`/api/v1/public/tasks/${id}`, { method: 'GET' });
  }

  /**
   * Nhận việc giữ slot (Claim Slot)
   * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-009..014
   */
  static async claimTaskSlot(id) {
    return this.request(`/api/v1/tasks/${id}/claim`, { method: 'POST' });
  }

  /**
   * Hủy nhận việc để hoàn trả slot
   * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-015..016
   */
  static async cancelTaskClaim(id) {
    return this.request(`/api/v1/tasks/${id}/claims/cancel`, { method: 'POST' });
  }

  /**
   * Kiểm tra thông tin lượt giữ slot hiện tại của Worker
   */
  static async getMyClaim(id) {
    return this.request(`/api/v1/tasks/${id}/my-claim`, { method: 'GET' });
  }

  /**
   * Tải tệp ảnh bằng chứng nhiệm vụ (PNG, JPEG, WebP <= 5MB)
   * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-STP-001..005
   */
  static async uploadProofImage(fileData, mimeType, filename) {
    return this.request('/api/v1/uploads/proof-image', {
      method: 'POST',
      body: JSON.stringify({
        file: fileData,
        mime_type: mimeType,
        filename,
      }),
    });
  }

  /**
   * Nộp bằng chứng hoàn thành nhiệm vụ
   * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-STP-006..014
   */
  static async submitTaskProof(claimId, proofs) {
    return this.request(`/api/v1/claims/${claimId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ proofs }),
    });
  }

  /**
   * Lấy thông tin chi tiết lượt claim và bằng chứng đã nộp
   * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-STP-015
   */
  static async getClaimDetails(claimId) {
    return this.request(`/api/v1/claims/${claimId}`, { method: 'GET' });
  }
}
