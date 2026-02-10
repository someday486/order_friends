import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService } from '@nestjs/terminus';
import { SupabaseHealthIndicator } from './supabase.health';

describe('HealthController', () => {
  let controller: HealthController;

  const mockSupabaseHealth = {
    isHealthy: jest.fn(),
  };

  const mockHealthCheck = {
    check: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheck },
        { provide: SupabaseHealthIndicator, useValue: mockSupabaseHealth },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    jest.clearAllMocks();
  });

  it('check should call health service and return result', async () => {
    mockSupabaseHealth.isHealthy.mockResolvedValue({
      supabase: { status: 'up' },
    });
    mockHealthCheck.check.mockImplementation(
      async (checks: Array<() => any>) => {
        await Promise.all(checks.map((fn) => fn()));
        return { status: 'ok' };
      },
    );

    const result = await controller.check();

    expect(result).toEqual({ status: 'ok' });
    expect(mockHealthCheck.check).toHaveBeenCalled();
    expect(mockSupabaseHealth.isHealthy).toHaveBeenCalledWith('supabase');
  });

  it('check should propagate health check errors', async () => {
    mockHealthCheck.check.mockRejectedValue(new Error('boom'));

    await expect(controller.check()).rejects.toThrow('boom');
  });
});
