/**
 * Tiện ích khử nhiễm XSS (XSS Sanitizer) tuân thủ CONSTITUTION.md SEC-01 & REQ-POST-008
 */
export class XssSanitizer {
  private static readonly DANGEROUS_TAGS_REGEX = /<\s*\/?\s*(script|iframe|object|embed|applet|meta|link|style|base|form|input|button)\b[^>]*>/gi;
  private static readonly EVENT_HANDLERS_REGEX = /\bon\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
  private static readonly DANGEROUS_SCHEMES_REGEX = /\b(javascript|vbscript|data):[^\s"']*/gi;

  /**
   * Khử nhiễm chuỗi văn bản, loại bỏ các thẻ thực thi mã, handler sự kiện và URL nguy hiểm
   */
  public static sanitize(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input
      .replace(this.DANGEROUS_TAGS_REGEX, '')
      .replace(this.EVENT_HANDLERS_REGEX, '')
      .replace(this.DANGEROUS_SCHEMES_REGEX, '')
      .trim();

    return sanitized;
  }

  /**
   * Kiểm tra xem văn bản có chứa mẫu payload XSS độc hại không
   */
  public static hasXssPayload(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    return (
      this.DANGEROUS_TAGS_REGEX.test(input) ||
      this.EVENT_HANDLERS_REGEX.test(input) ||
      this.DANGEROUS_SCHEMES_REGEX.test(input)
    );
  }
}

