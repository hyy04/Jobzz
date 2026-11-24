import { buildApp } from './app';
import { InMemoryTaskClaimRepository } from './infra/repositories/in-memory-task-claim.repository';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  const usePrisma = Boolean(process.env.DATABASE_URL);
  // Khi chạy local in-memory, khởi tạo sẵn bài nộp mẫu để Admin có thể thử nghiệm tính năng Duyệt bài ngay lập tức
  const claimRepo = usePrisma ? undefined : new InMemoryTaskClaimRepository(true);
  const app = buildApp({
    taskClaimRepository: claimRepo,
  });
  const dbMode = process.env.DATABASE_URL ? 'PostgreSQL (Prisma)' : 'In-Memory (Demo Mode with Sample Tasks)';

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`\n======================================================`);
    console.log(`🚀 Jobzz Bounty Platform Server running!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`👑 Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`💾 Database Mode: ${dbMode}`);
    console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('Lỗi khởi động server:', err);
    process.exit(1);
  }
}

// Chạy server khi được gọi trực tiếp
if (require.main === module) {
  startServer();
}

export { startServer };

