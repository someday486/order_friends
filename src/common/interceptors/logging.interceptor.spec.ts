import { Logger } from '@nestjs/common';
import { of, throwError, lastValueFrom } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  const createContext = () =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ method: 'GET', url: '/test' }) }),
    }) as any;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log request timing', async () => {
    const interceptor = new LoggingInterceptor();
    const ctx = createContext();
    const next = { handle: () => of('ok') } as any;

    jest.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100);

    const result = await lastValueFrom(interceptor.intercept(ctx, next));

    expect(result).toBe('ok');
    expect(Logger.prototype.log).toHaveBeenCalled();
  });

  it('should warn on slow requests', async () => {
    const interceptor = new LoggingInterceptor();
    const ctx = createContext();
    const next = { handle: () => of('ok') } as any;

    jest.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(1501);

    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(Logger.prototype.warn).toHaveBeenCalled();
  });

  it('should log errors', async () => {
    const interceptor = new LoggingInterceptor();
    const ctx = createContext();
    const next = { handle: () => throwError(() => new Error('boom')) } as any;

    jest.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(10);

    await expect(lastValueFrom(interceptor.intercept(ctx, next))).rejects.toThrow('boom');
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});
