import { describe, it, expect, vi, beforeEach } from 'vitest';

const checkDatabase = vi.fn();
const checkRedis = vi.fn();

vi.mock('@/lib/health', () => ({
  checkDatabase: (...args: unknown[]) => checkDatabase(...args),
  checkRedis: (...args: unknown[]) => checkRedis(...args),
}));

import { GET } from './route';

describe('GET /api/health', () => {
  beforeEach(() => {
    checkDatabase.mockReset();
    checkRedis.mockReset();
  });

  it('returns 200 when all dependencies are healthy', async () => {
    checkDatabase.mockResolvedValue({ status: 'healthy' });
    checkRedis.mockResolvedValue({ status: 'healthy' });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
  });

  it('returns 503 when a dependency is degraded', async () => {
    checkDatabase.mockResolvedValue({ status: 'healthy' });
    checkRedis.mockResolvedValue({ status: 'degraded' });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe('degraded');
  });

  it('returns 503 when a dependency is unhealthy', async () => {
    checkDatabase.mockResolvedValue({ status: 'unhealthy' });
    checkRedis.mockResolvedValue({ status: 'healthy' });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe('unhealthy');
  });
});
