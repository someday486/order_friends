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

const flushPromises = async () =>
  new Promise((resolve) => setImmediate(resolve));

describe('main bootstrap', () => {
  const makeApp = () =>
    ({
      use: jest.fn(),
      useGlobalFilters: jest.fn(),
      useGlobalPipes: jest.fn(),
      enableCors: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    }) as unknown as INestApplication;

  const runMain = async (app: INestApplication) => {
    let nestFactoryMock: any;
    let swaggerMock: any;
    let sentryMock: any;
    let helmetMock: any;

    jest.isolateModules(() => {
      nestFactoryMock = jest.requireMock('@nestjs/core').NestFactory;
      swaggerMock = jest.requireMock('@nestjs/swagger').SwaggerModule;
      sentryMock = jest.requireMock('@sentry/nestjs');
      helmetMock = jest.requireMock('helmet');

      nestFactoryMock.create.mockResolvedValue(app);
      void jest.requireActual('./main');
    });

    await flushPromises();
    return { nestFactoryMock, swaggerMock, sentryMock, helmetMock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SENTRY_DSN;
    delete process.env.NODE_ENV;
    delete process.env.PORT;
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
