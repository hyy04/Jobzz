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
}
