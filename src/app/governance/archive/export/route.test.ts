import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockProposals = [
  {
    id: 'prop-1',
    title: 'Proposal ending on boundary',
    status: 'closed',
    endDate: '2024-06-15T00:00:00.000Z',
    createdAt: '2024-06-01T00:00:00.000Z',
  },
  {
    id: 'prop-2',
    title: 'Proposal ending after boundary',
    status: 'closed',
    endDate: '2024-06-20T00:00:00.000Z',
    createdAt: '2024-06-01T00:00:00.000Z',
  },
];

vi.mock('@/lib/governance/proposals', () => ({
  getProposals: vi.fn(async () => mockProposals),
}));

import { GET } from './route';

describe('governance archive export route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns proposals within the date range', async () => {
    const req = new NextRequest(
      'http://localhost/governance/archive/export?from=2024-06-01&to=2024-06-30'
    );
    const res = await GET(req);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain('prop-1');
    expect(body).toContain('prop-2');
  });

  it('includes proposals whose end date equals the to boundary', async () => {
    const req = new NextRequest(
      'http://localhost/governance/archive/export?from=2024-06-01&to=2024-06-15'
    );
    const res = await GET(req);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain('prop-1');
    expect(body).not.toContain('prop-2');
  });

  it('returns proposals ending that day when from equals to', async () => {
    const req = new NextRequest(
      'http://localhost/governance/archive/export?from=2024-06-15&to=2024-06-15'
    );
    const res = await GET(req);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain('prop-1');
    expect(body).not.toContain('prop-2');
  });
});
