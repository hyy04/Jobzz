import { describe, it, expect } from 'vitest';
import { XssSanitizer } from '../../../src/shared/utils/xss-sanitizer';
import {
  UnauthorizedCreatorError,
  InvalidRewardCoinsError,
  InvalidQuotaError,
  TotalRewardCoinsOverflowError,
  InsecureUrlError,
  QuotaReductionConflictError,
  TaskConcurrencyConflictError,
  TaskNotFoundError,
} from '../../../src/shared/errors/task-errors';

describe('XssSanitizer (SEC-01 & REQ-POST-008)', () => {
  it('should sanitize script tags and event handlers', () => {
    const malicious = '<script>alert("XSS")</script>Đây là nhiệm vụ an toàn<img src="x" onerror="alert(1)">';
    const clean = XssSanitizer.sanitize(malicious);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('onerror');
    expect(clean).toContain('Đây là nhiệm vụ an toàn');
  });

  it('should detect malicious XSS payloads', () => {
    expect(XssSanitizer.hasXssPayload('<script>alert(1)</script>')).toBe(true);
    expect(XssSanitizer.hasXssPayload('<a href="javascript:alert(1)">Click</a>')).toBe(true);
    expect(XssSanitizer.hasXssPayload('Nhiệm vụ tải app hoàn toàn sạch sẽ')).toBe(false);
  });

  it('should handle empty or whitespace inputs gracefully', () => {
    expect(XssSanitizer.sanitize('')).toBe('');
    expect(XssSanitizer.sanitize('   ')).toBe('');
  });
});

describe('Typed Errors (ENG-02)', () => {
  it('should instantiate error classes with correct errorCode and statusCode', () => {
    const authErr = new UnauthorizedCreatorError();
    expect(authErr.errorCode).toBe('FORBIDDEN');
    expect(authErr.statusCode).toBe(403);

    const rewardErr = new InvalidRewardCoinsError();
    expect(rewardErr.errorCode).toBe('INVALID_REWARD_COINS');
    expect(rewardErr.statusCode).toBe(400);

    const quotaErr = new InvalidQuotaError();
    expect(quotaErr.errorCode).toBe('INVALID_QUOTA');
    expect(quotaErr.statusCode).toBe(400);

    const overflowErr = new TotalRewardCoinsOverflowError();
    expect(overflowErr.errorCode).toBe('REWARD_OVERFLOW');
    expect(overflowErr.statusCode).toBe(400);

    const urlErr = new InsecureUrlError();
    expect(urlErr.errorCode).toBe('INSECURE_URL_PROTOCOL');
    expect(urlErr.statusCode).toBe(400);

    const conflictErr = new QuotaReductionConflictError();
    expect(conflictErr.errorCode).toBe('QUOTA_REDUCTION_CONFLICT');
    expect(conflictErr.statusCode).toBe(400);

    const occErr = new TaskConcurrencyConflictError();
    expect(occErr.errorCode).toBe('CONCURRENCY_CONFLICT');
    expect(occErr.statusCode).toBe(409);

    const notFoundErr = new TaskNotFoundError();
    expect(notFoundErr.errorCode).toBe('TASK_NOT_FOUND');
    expect(notFoundErr.statusCode).toBe(404);
  });
});

