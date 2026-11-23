import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fs from 'fs';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * Đăng ký các tuyến đường phục vụ giao diện tĩnh (Static Web Routes)
 * @ears .sdd/features/post-job-ui/SPEC.md#REQ-PUI-021
 */
export function registerWebRoutes(fastify: FastifyInstance, publicDirOverride?: string) {
  const publicDir = publicDirOverride || path.resolve(process.cwd(), 'public');

  const serveFile = (filePath: string, reply: FastifyReply) => {
    // Chống Path Traversal
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(publicDir)) {
      return reply.status(403).send('Forbidden');
    }

    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      return reply.status(404).send('Not Found');
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    reply.header('Content-Type', contentType);
    const stream = fs.createReadStream(resolvedPath);
    return reply.send(stream);
  };

  // 1. Phục vụ trang chủ và trang admin (/ và /admin)
  const serveIndex = async (_request: FastifyRequest, reply: FastifyReply) => {
    const indexPath = path.join(publicDir, 'index.html');
    return serveFile(indexPath, reply);
  };

  fastify.get('/', serveIndex);
  fastify.get('/admin', serveIndex);

  // 2. Phục vụ tài nguyên tĩnh (/public/* hoặc /*)
  fastify.get('/public/*', async (request: FastifyRequest<{ Params: { '*': string } }>, reply: FastifyReply) => {
    const subPath = request.params['*'] || '';
    const filePath = path.join(publicDir, subPath);
    return serveFile(filePath, reply);
  });

  // 3. Tuyến đường phục vụ tệp upload (/uploads/*)
  fastify.get('/uploads/*', async (request: FastifyRequest<{ Params: { '*': string } }>, reply: FastifyReply) => {
    const subPath = request.params['*'] || '';
    const filePath = path.join(publicDir, 'uploads', subPath);
    return serveFile(filePath, reply);
  });
}

