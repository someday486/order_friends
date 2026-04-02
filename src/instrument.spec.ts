jest.mock('@sentry/nestjs', () => ({ init: jest.fn() }));

describe('instrument', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.SENTRY_DSN;
    delete process.env.NODE_ENV;
  });

  it('initializes Sentry when SENTRY_DSN is set', () => {
    let sentryMock: any;

    process.env.SENTRY_DSN = 'dsn';
    process.env.NODE_ENV = 'test';

    jest.isolateModules(() => {
      sentryMock = jest.requireMock('@sentry/nestjs');
      void jest.requireActual('./instrument');
    });

    expect(sentryMock.init).toHaveBeenCalledWith({
      dsn: 'dsn',
      environment: 'test',
      tracesSampleRate: 1.0,
    });
  });

  it('does not initialize Sentry when SENTRY_DSN is missing', () => {
    let sentryMock: any;

    jest.isolateModules(() => {
      sentryMock = jest.requireMock('@sentry/nestjs');
      void jest.requireActual('./instrument');
    });

    expect(sentryMock.init).not.toHaveBeenCalled();
  });
});
