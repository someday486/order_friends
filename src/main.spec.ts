import type { INestApplication } from '@nestjs/common';

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn(),
  },
}));

jest.mock('@nestjs/swagger', () => {
  const decorator = () => () => undefined;
  return {
    SwaggerModule: {
      createDocument: jest.fn(() => ({})),
      setup: jest.fn(),
    },
    DocumentBuilder: jest.fn().mockImplementation(() => ({
      setTitle() {
        return this;
      },
      setDescription() {
        return this;
      },
      setVersion() {
        return this;
      },
      addBearerAuth() {
        return this;
      },
      addTag() {
        return this;
      },
      build() {
        return { ok: true };
      },
    })),
    ApiProperty: decorator,
    ApiPropertyOptional: decorator,
    ApiTags: decorator,
    ApiOperation: decorator,
    ApiBearerAuth: decorator,
    ApiParam: decorator,
    ApiQuery: decorator,
    ApiResponse: decorator,
    ApiBody: decorator,
    ApiServiceUnavailableResponse: decorator,
    ApiOkResponse: decorator,
    ApiConsumes: decorator,
  };
});

jest.mock('helmet', () => jest.fn(() => 'helmet-middleware'));
jest.mock('@sentry/nestjs', () => ({ init: jest.fn() }));
jest.mock('express', () => ({
  json: jest.fn(() => 'json-middleware'),
  urlencoded: jest.fn(() => 'urlencoded-middleware'),
}));

const flushPromises = async () =>
  new Promise((resolve) => setImmediate(resolve));

describe('main bootstrap', () => {
  const makeApp = () => {
    const server = {
      keepAliveTimeout: 0,
      headersTimeout: 0,
    };

    return {
      use: jest.fn(),
      useGlobalFilters: jest.fn(),
      useGlobalPipes: jest.fn(),
      enableCors: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
      getHttpServer: jest.fn(() => server),
    } as unknown as INestApplication;
  };

  const runMain = async (app: INestApplication) => {
    let nestFactoryMock: any;
    let swaggerMock: any;
    let sentryMock: any;
    let helmetMock: any;
    let unhandledRejection: unknown;
    let uncaughtException: unknown;
    let bootstrapImportError: unknown;
    const rejectionHandler = (reason: unknown) => {
      unhandledRejection = reason;
    };
    const exceptionHandler = (error: unknown) => {
      uncaughtException = error;
    };

    process.on('unhandledRejection', rejectionHandler);
    process.on('uncaughtException', exceptionHandler);

    jest.isolateModules(() => {
      nestFactoryMock = jest.requireMock('@nestjs/core').NestFactory;
      swaggerMock = jest.requireMock('@nestjs/swagger').SwaggerModule;
      sentryMock = jest.requireMock('@sentry/nestjs');
      helmetMock = jest.requireMock('helmet');

      nestFactoryMock.create.mockResolvedValue(app);
      try {
        void jest.requireActual('./main');
      } catch (error) {
        bootstrapImportError = error;
      }
    });

    await flushPromises();
    process.off('unhandledRejection', rejectionHandler);
    process.off('uncaughtException', exceptionHandler);
    return {
      nestFactoryMock,
      swaggerMock,
      sentryMock,
      helmetMock,
      unhandledRejection,
      uncaughtException,
      bootstrapImportError,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SENTRY_DSN;
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.TOSS_SECRET_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.JWT_SECRET;
  });

  it('should initialize app with middleware and swagger', async () => {
    const app = makeApp();

    process.env.SENTRY_DSN = 'dsn';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '4001';

    const { nestFactoryMock, swaggerMock, sentryMock, helmetMock } =
      await runMain(app);

    expect(sentryMock.init).toHaveBeenCalled();
    expect(nestFactoryMock.create).toHaveBeenCalledWith(expect.any(Function), {
      bufferLogs: false,
      rawBody: true,
    });
    expect(helmetMock).toHaveBeenCalled();
    expect(swaggerMock.createDocument).toHaveBeenCalled();
    expect(swaggerMock.setup).toHaveBeenCalledWith(
      'api-docs',
      app,
      expect.any(Object),
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const listenMock = app.listen as jest.Mock;
    expect(listenMock).toHaveBeenCalledWith('4001');
  });

  it.skip('should throw in production when required env vars are missing', async () => {
    const app = makeApp();

    process.env.NODE_ENV = 'production';
    // No TOSS_SECRET_KEY, SUPABASE_URL etc.

    const {
      nestFactoryMock,
      bootstrapImportError,
      unhandledRejection,
      uncaughtException,
    } = await runMain(app);

    expect(nestFactoryMock.create).not.toHaveBeenCalled();
    expect(
      bootstrapImportError ?? unhandledRejection ?? uncaughtException,
    ).toBeDefined();
  });

  it('should start successfully in production when all required env vars are set', async () => {
    const app = makeApp();

    process.env.NODE_ENV = 'production';
    process.env.TOSS_SECRET_KEY = 'test_secret';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_role_key';
    process.env.JWT_SECRET = 'test_jwt_secret';

    const { nestFactoryMock } = await runMain(app);

    expect(nestFactoryMock.create).toHaveBeenCalled();
  });

  it('should allow and block cors origins', async () => {
    const app = makeApp();

    process.env.NODE_ENV = 'development';

    await runMain(app);

    const corsOptions = (app.enableCors as jest.Mock).mock.calls[0][0];
    const originFn = corsOptions.origin as Function;

    const cb = jest.fn();
    originFn(undefined, cb);
    expect(cb).toHaveBeenCalledWith(null, true);

    const cb2 = jest.fn();
    originFn('http://localhost:3000', cb2);
    expect(cb2).toHaveBeenCalledWith(null, true);

    const cb3 = jest.fn();
    originFn('http://127.0.0.1:3000', cb3);
    expect(cb3).toHaveBeenCalledWith(null, true);

    const cb4 = jest.fn();
    originFn('http://192.168.0.2:3000', cb4);
    expect(cb4).toHaveBeenCalledWith(null, true);

    const cb5 = jest.fn();
    originFn('http://evil.com', cb5);
    expect(cb5.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(cb5.mock.calls[0][1]).toBe(false);
  });
});
