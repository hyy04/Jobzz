import { InsecureUrlError } from '../../shared/errors/task-errors';

/**
 * Value Object: SecureUrl (SEC-01)
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-006
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-007
 */
export class SecureUrl {
  private constructor(private readonly url: string) {}

  public static create(rawUrl: string): SecureUrl {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new InsecureUrlError('URL không được để trống.');
    }

    const trimmed = rawUrl.trim();

    // Kiểm tra tiền tố bắt buộc https://
    if (!trimmed.toLowerCase().startsWith('https://')) {
      throw new InsecureUrlError();
    }

    // Kiểm tra cấu trúc URL hợp lệ
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:') {
        throw new InsecureUrlError();
      }
    } catch {
      throw new InsecureUrlError('Định dạng URL không hợp lệ.');
    }

    return new SecureUrl(trimmed);
  }

  public getValue(): string {
    return this.url;
  }

  public equals(other: SecureUrl): boolean {
    return this.url === other.url;
  }
}

