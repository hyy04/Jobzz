import { PrismaClient } from '@prisma/client';

export type AppPrismaClient = PrismaClient;

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prismaInstance;
}

export function setPrismaClient(client: PrismaClient | null): void {
  prismaInstance = client;
}

