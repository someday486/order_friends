import { HealthCheckError } from '@nestjs/terminus';
import { SupabaseHealthIndicator } from './supabase.health';

describe('SupabaseHealthIndicator', () => {
  const makeIndicator = () => {
    const mockClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    };
    const supabase = {
      adminClient: jest.fn(() => mockClient),
    };
    return { indicator: new SupabaseHealthIndicator(supabase as any), mockClient };
  };

  it('should report healthy when query succeeds', async () => {
    const { indicator, mockClient } = makeIndicator();
    mockClient.limit.mockResolvedValueOnce({ error: null });

    const result = await indicator.isHealthy('supabase');

    expect(result.supabase.status).toBe('up');
  });

  it('should throw HealthCheckError when query fails', async () => {
    const { indicator, mockClient } = makeIndicator();
    mockClient.limit.mockResolvedValueOnce({ error: { message: 'fail' } });

    await expect(indicator.isHealthy('supabase')).rejects.toThrow(HealthCheckError);
  });
});
