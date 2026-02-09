import { SupabaseService } from './supabase.service';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('SupabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should disable supabase when URL is missing', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'SUPABASE_URL') return undefined;
        return undefined;
      }),
    } as unknown as ConfigService;

    const service = new SupabaseService(config);

    expect(() => service.adminClient()).toThrow(
      'Supabase admin client is not initialized',
    );
    expect(() => service.userClient('token')).toThrow(
      'Supabase user client is not initialized',
    );
    expect(() => service.anonClient()).toThrow(
      'Supabase anon client is not initialized',
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it('should create admin, user, and anon clients when config is present', () => {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_ANON_KEY: 'anon-key',
          SUPABASE_SERVICE_ROLE_KEY: 'service-key',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const adminClient = { id: 'admin' } as any;
    const userClient = { id: 'user' } as any;
    const anonClient = { id: 'anon' } as any;

    (createClient as jest.Mock)
      .mockReturnValueOnce(adminClient)
      .mockReturnValueOnce(userClient)
      .mockReturnValueOnce(anonClient);

    const service = new SupabaseService(config);

    expect(service.adminClient()).toBe(adminClient);

    const user = service.userClient('token');
    expect(user).toBe(userClient);

    const anon = service.anonClient();
    expect(anon).toBe(anonClient);

    expect(createClient).toHaveBeenNthCalledWith(
      1,
      'https://example.supabase.co',
      'service-key',
    );
    expect(createClient).toHaveBeenNthCalledWith(
      2,
      'https://example.supabase.co',
      'anon-key',
      {
        global: { headers: { Authorization: 'Bearer token' } },
      },
    );
    expect(createClient).toHaveBeenNthCalledWith(
      3,
      'https://example.supabase.co',
      'anon-key',
    );
  });

  it('should throw when anon key is missing', () => {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'service-key',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const adminClient = { id: 'admin' } as any;
    (createClient as jest.Mock).mockReturnValueOnce(adminClient);

    const service = new SupabaseService(config);

    expect(service.adminClient()).toBe(adminClient);
    expect(() => service.userClient('token')).toThrow(
      'Supabase user client is not initialized',
    );
    expect(() => service.anonClient()).toThrow(
      'Supabase anon client is not initialized',
    );
  });
});
