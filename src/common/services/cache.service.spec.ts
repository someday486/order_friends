import { CacheService } from './cache.service';

describe('CacheService', () => {
  const makeService = (overrides: Partial<Record<string, any>> = {}) => {
    const store = overrides.store ?? { keys: jest.fn().mockResolvedValue([]) };
    const cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      reset: jest.fn(),
      store,
      ...overrides,
    };
    return { service: new CacheService(cacheManager as any), cacheManager };
  };

  it('get should return value on hit', async () => {
    const { service, cacheManager } = makeService();
    cacheManager.get.mockResolvedValueOnce({ ok: true });

    const result = await service.get('key');

    expect(result).toEqual({ ok: true });
    expect(cacheManager.get).toHaveBeenCalledWith('key');
  });

  it('get should return undefined on miss', async () => {
    const { service, cacheManager } = makeService();
    cacheManager.get.mockResolvedValueOnce(undefined);

    const result = await service.get('missing');

    expect(result).toBeUndefined();
    expect(cacheManager.get).toHaveBeenCalledWith('missing');
  });

  it('get should handle errors', async () => {
    const { service, cacheManager } = makeService();
    cacheManager.get.mockRejectedValueOnce(new Error('boom'));

    const result = await service.get('err');

    expect(result).toBeUndefined();
  });

  it('set should store value', async () => {
    const { service, cacheManager } = makeService();

    await service.set('key', { ok: true }, 30);

    expect(cacheManager.set).toHaveBeenCalledWith('key', { ok: true }, 30);
  });

  it('set should store value without ttl', async () => {
    const { service, cacheManager } = makeService();

    await service.set('key', { ok: true });

    expect(cacheManager.set).toHaveBeenCalledWith(
      'key',
      { ok: true },
      undefined,
    );
  });

  it('set should handle errors', async () => {
    const { service, cacheManager } = makeService();
    cacheManager.set.mockRejectedValueOnce(new Error('boom'));

    await service.set('key', 1, 10);
  });

  it('del should delete key', async () => {
    const { service, cacheManager } = makeService();

    await service.del('key');

    expect(cacheManager.del).toHaveBeenCalledWith('key');
  });

  it('del should handle errors', async () => {
    const { service, cacheManager } = makeService();
    cacheManager.del.mockRejectedValueOnce(new Error('boom'));

    await service.del('key');
  });

  it('delPattern should delete matching keys when supported', async () => {
    const store = { keys: jest.fn().mockResolvedValue(['a:1', 'b:1', 'a:2']) };
    const { service, cacheManager } = makeService({ store });

    await service.delPattern('a:');

    expect(store.keys).toHaveBeenCalled();
    expect(cacheManager.del).toHaveBeenCalledTimes(2);
  });

  it('delPattern should warn when store lacks keys', async () => {
    const store = {};
    const { service } = makeService({ store });

    await service.delPattern('x');
  });

  it('delPattern should handle errors', async () => {
    const store = { keys: jest.fn().mockRejectedValue(new Error('boom')) };
    const { service } = makeService({ store });

    await service.delPattern('x');
  });

  it('reset should clear cache', async () => {
    const { service, cacheManager } = makeService();

    await service.reset();

    expect(cacheManager.reset).toHaveBeenCalled();
  });

  it('reset should handle errors', async () => {
    const { service, cacheManager } = makeService();
    cacheManager.reset.mockRejectedValueOnce(new Error('boom'));

    await service.reset();
  });

  it('getOrSet should return cached value when present', async () => {
    const { service, cacheManager } = makeService();
    cacheManager.get.mockResolvedValueOnce('cached');

    const result = await service.getOrSet(
      'k',
      () => Promise.resolve('fresh'),
      10,
    );

    expect(result).toBe('cached');
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('getOrSet should compute and store value when missing', async () => {
    const { service, cacheManager } = makeService();
    cacheManager.get.mockResolvedValueOnce(undefined);

    const result = await service.getOrSet(
      'k',
      () => Promise.resolve('fresh'),
      10,
    );

    expect(result).toBe('fresh');
    expect(cacheManager.set).toHaveBeenCalledWith('k', 'fresh', 10);
  });

  it('invalidateProduct should delete related keys', async () => {
    const { service, cacheManager } = makeService();

    await service.invalidateProduct('p1', 'b1');

    expect(cacheManager.del).toHaveBeenCalledWith('product:p1');
  });

  it('invalidateProduct should skip branch patterns when branchId missing', async () => {
    const { service, cacheManager } = makeService();

    await service.invalidateProduct('p1');

    expect(cacheManager.del).toHaveBeenCalledTimes(1);
    expect(cacheManager.del).toHaveBeenCalledWith('product:p1');
  });

  it('invalidateOrder should delete related keys', async () => {
    const { service, cacheManager } = makeService();

    await service.invalidateOrder('o1', 'b1');

    expect(cacheManager.del).toHaveBeenCalledWith('order:o1');
  });

  it('invalidateOrder should skip branch patterns when branchId missing', async () => {
    const { service, cacheManager } = makeService();

    await service.invalidateOrder('o1');

    expect(cacheManager.del).toHaveBeenCalledTimes(1);
    expect(cacheManager.del).toHaveBeenCalledWith('order:o1');
  });

  it('invalidateInventory should delete related keys', async () => {
    const { service, cacheManager } = makeService();

    await service.invalidateInventory('b1', 'p1');

    expect(cacheManager.del).toHaveBeenCalledWith('inventory:b1:p1');
  });

  it('invalidateInventory should skip product key when productId missing', async () => {
    const { service, cacheManager } = makeService();

    await service.invalidateInventory('b1');

    expect(cacheManager.del).not.toHaveBeenCalledWith('inventory:b1:p1');
  });

  it('invalidateBranch should delete related keys', async () => {
    const { service, cacheManager } = makeService();

    await service.invalidateBranch('b1', 'brand1');

    expect(cacheManager.del).toHaveBeenCalledWith('branch:b1');
    expect(cacheManager.del).toHaveBeenCalledWith('branches:brand1');
  });

  it('invalidateBranch should skip brand cache when brandId missing', async () => {
    const { service, cacheManager } = makeService();

    await service.invalidateBranch('b1');

    expect(cacheManager.del).toHaveBeenCalledWith('branch:b1');
    expect(cacheManager.del).not.toHaveBeenCalledWith('branches:brand1');
  });

  it('getStats should return stats when supported', async () => {
    const store = { keys: jest.fn().mockResolvedValue(['a', 'b', 'c']) };
    const { service } = makeService({ store });

    const result = await service.getStats();

    expect(result.totalKeys).toBe(3);
    expect(result.keys).toEqual(['a', 'b', 'c']);
  });

  it('getStats should return message when not supported', async () => {
    const store = {};
    const { service } = makeService({ store });

    const result = await service.getStats();

    expect(result.message).toMatch(/not supported/i);
  });

  it('getStats should handle errors', async () => {
    const store = { keys: jest.fn().mockRejectedValue(new Error('boom')) };
    const { service } = makeService({ store });

    const result = await service.getStats();

    expect(result.error).toMatch(/failed/i);
  });
});
