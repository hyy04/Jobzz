import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Interface Layer: Static Web Routes (T002-PUI & REQ-PUI-021)', () => {
  let app: FastifyInstance;
  let tempPublicDir: string;

  beforeEach(async () => {
    // Tạo thư mục public giả lập phục vụ test
    tempPublicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobzz-public-test-'));
    fs.writeFileSync(path.join(tempPublicDir, 'index.html'), '<html><body><h1>Jobzz Admin</h1></body></html>');

    const cssDir = path.join(tempPublicDir, 'css');
    fs.mkdirSync(cssDir);
    fs.writeFileSync(path.join(cssDir, 'style.css'), 'body { background: #f0f0f0; }');

    app = buildApp({
      publicDir: tempPublicDir,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tempPublicDir, { recursive: true, force: true });
  });

  it('GET / trả về index.html với đúng MIME type text/html', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.payload).toContain('Jobzz Admin');
  });

  it('GET /admin trả về index.html phục vụ quản trị', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.payload).toContain('Jobzz Admin');
  });

  it('GET /public/css/style.css phục vụ file tĩnh với Content-Type text/css', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/public/css/style.css',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/css');
    expect(res.payload).toContain('background: #f0f0f0');
  });

  it('GET /public/missing-file.js trả về 404 Not Found', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/public/missing-file.js',
    });

    expect(res.statusCode).toBe(404);
  });

  it('Chống Path Traversal: cố tình đọc file ngoài thư mục public bị từ chối 403 hoặc 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/public/../package.json',
    });

    expect([403, 404]).toContain(res.statusCode);
  });
});

