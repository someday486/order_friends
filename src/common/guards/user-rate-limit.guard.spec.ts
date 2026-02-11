import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UserRateLimitGuard } from './user-rate-limit.guard';

describe('UserRateLimitGuard', () => {
  let guard: UserRateLimitGuard;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockReflector = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRateLimitGuard,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<UserRateLimitGuard>(UserRateLimitGuard);
    jest.clearAllMocks();
  });

  const createMockContext = (user?: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user,
          method: 'POST',
          url: '/api/test',
        }),
        getResponse: jest.fn().mockReturnValue({
          setHeader: jest.fn(),
        }),
      }),
    } as any;
  };

  describe('canActivate', () => {
    it('should allow request when no rate limit is configured', async () => {
      mockReflector.get.mockReturnValue(undefined);
      const context = createMockContext({ id: 'user-123' });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockCacheManager.get).not.toHaveBeenCalled();
    });

    it('should allow request when user is not authenticated', async () => {
      mockReflector.get.mockReturnValue({ points: 5, duration: 60 });
      const context = createMockContext(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockCacheManager.get).not.toHaveBeenCalled();
    });

    it('should allow first request from user', async () => {
      mockReflector.get.mockReturnValue({ points: 5, duration: 60 });
      mockCacheManager.get.mockResolvedValue(null);
      const context = createMockContext({ id: 'user-123' });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        'rate-limit:block:user-123',
      );
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        'rate-limit:user:user-123',
      );
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'rate-limit:user:user-123',
        1,
        60000,
      );
    });

    it('should allow request within rate limit', async () => {
      mockReflector.get.mockReturnValue({ points: 5, duration: 60 });
      mockCacheManager.get
        .mockResolvedValueOnce(null) // blockKey
        .mockResolvedValueOnce(3); // rate key
      const context = createMockContext({ id: 'user-123' });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'rate-limit:user:user-123',
        4,
        60000,
      );
    });

    it('should block request when rate limit is exceeded', async () => {
      mockReflector.get.mockReturnValue({ points: 5, duration: 60 });
      mockCacheManager.get
        .mockResolvedValueOnce(null) // blockKey
        .mockResolvedValueOnce(5); // rate key - at limit
      const context = createMockContext({ id: 'user-123' });

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);

      // Should set the block key
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'rate-limit:block:user-123',
        true,
        60000,
      );
    });

    it('should handle different users separately', async () => {
      mockReflector.get.mockReturnValue({ points: 3, duration: 60 });

      // User 1 - first request
      mockCacheManager.get.mockResolvedValue(null);
      const context1 = createMockContext({ id: 'user-123' });
      await guard.canActivate(context1);

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        'rate-limit:block:user-123',
      );
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        'rate-limit:user:user-123',
      );
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'rate-limit:user:user-123',
        1,
        60000,
      );

      // User 2 - first request (separate counter)
      mockCacheManager.get.mockResolvedValue(null);
      const context2 = createMockContext({ id: 'user-456' });
      await guard.canActivate(context2);

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        'rate-limit:block:user-456',
      );
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        'rate-limit:user:user-456',
      );
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'rate-limit:user:user-456',
        1,
        60000,
      );
    });

    it('should use same counter for all endpoints for a user', async () => {
      mockReflector.get.mockReturnValue({ points: 5, duration: 60 });
      mockCacheManager.get.mockResolvedValue(null);

      // Endpoint 1
      const context1 = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { id: 'user-123' },
            method: 'POST',
            url: '/api/orders',
          }),
          getResponse: jest.fn().mockReturnValue({
            setHeader: jest.fn(),
          }),
        }),
      } as any;
      await guard.canActivate(context1);

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        'rate-limit:user:user-123',
      );

      // Endpoint 2 - same user, different endpoint, same key
      const context2 = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { id: 'user-123' },
            method: 'POST',
            url: '/api/products',
          }),
          getResponse: jest.fn().mockReturnValue({
            setHeader: jest.fn(),
          }),
        }),
      } as any;
      mockCacheManager.get.mockResolvedValue(null);
      await guard.canActivate(context2);

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        'rate-limit:user:user-123',
      );
    });

    it('should use user.sub as fallback when user.id is not available', async () => {
      mockReflector.get.mockReturnValue({ points: 5, duration: 60 });
      mockCacheManager.get.mockResolvedValue(null);
      const context = createMockContext({ sub: 'user-sub-123' });

      await guard.canActivate(context);

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        'rate-limit:user:user-sub-123',
      );
    });

    it('should correctly calculate cache TTL from duration', async () => {
      mockReflector.get.mockReturnValue({ points: 10, duration: 120 });
      mockCacheManager.get.mockResolvedValue(null);
      const context = createMockContext({ id: 'user-123' });

      await guard.canActivate(context);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        1,
        120000, // 120 seconds = 120000 milliseconds
      );
    });

    it('should increment counter on each request', async () => {
      mockReflector.get.mockReturnValue({ points: 10, duration: 60 });
      const context = createMockContext({ id: 'user-123' });

      // First request
      mockCacheManager.get
        .mockResolvedValueOnce(null) // blockKey
        .mockResolvedValueOnce(0); // rate key
      await guard.canActivate(context);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'rate-limit:user:user-123',
        1,
        60000,
      );

      // Second request
      mockCacheManager.get
        .mockResolvedValueOnce(null) // blockKey
        .mockResolvedValueOnce(1); // rate key
      await guard.canActivate(context);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'rate-limit:user:user-123',
        2,
        60000,
      );

      // Third request
      mockCacheManager.get
        .mockResolvedValueOnce(null) // blockKey
        .mockResolvedValueOnce(2); // rate key
      await guard.canActivate(context);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'rate-limit:user:user-123',
        3,
        60000,
      );
    });

    it('should block exactly at the limit', async () => {
      mockReflector.get.mockReturnValue({ points: 3, duration: 60 });
      const context = createMockContext({ id: 'user-123' });

      // Request 1 - allowed
      mockCacheManager.get
        .mockResolvedValueOnce(null) // blockKey
        .mockResolvedValueOnce(0); // rate key
      await expect(guard.canActivate(context)).resolves.toBe(true);

      // Request 2 - allowed
      mockCacheManager.get
        .mockResolvedValueOnce(null) // blockKey
        .mockResolvedValueOnce(1); // rate key
      await expect(guard.canActivate(context)).resolves.toBe(true);

      // Request 3 - allowed
      mockCacheManager.get
        .mockResolvedValueOnce(null) // blockKey
        .mockResolvedValueOnce(2); // rate key
      await expect(guard.canActivate(context)).resolves.toBe(true);

      // Request 4 - blocked (reached limit of 3)
      mockCacheManager.get
        .mockResolvedValueOnce(null) // blockKey
        .mockResolvedValueOnce(3); // rate key - at limit
      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });

    it('should throw when user is blocked', async () => {
      mockReflector.get.mockReturnValue({ points: 5, duration: 60 });
      mockCacheManager.get.mockResolvedValueOnce(true); // isBlocked
      const context = createMockContext({ id: 'user-123' });

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });
  });
});
