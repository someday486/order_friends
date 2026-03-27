import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ConfigValues = Record<string, string | undefined>;

const createConfigService = (values: ConfigValues): ConfigService =>
  ({
    get: jest.fn((key: string) => values[key]),
  }) as unknown as ConfigService;

const loadClientModule =
  (): typeof import('./popbill-cash-receipts.client') => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./popbill-cash-receipts.client');
  };

describe('PopbillCashReceiptsClient', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('should stay disabled when the popbill package is unavailable', () => {
    jest.doMock(
      'popbill',
      () => {
        const error = new Error(
          "Cannot find module 'popbill'",
        ) as NodeJS.ErrnoException;
        error.code = 'MODULE_NOT_FOUND';
        throw error;
      },
      { virtual: true },
    );
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { PopbillCashReceiptsClient } = loadClientModule();

    let client: InstanceType<typeof PopbillCashReceiptsClient> | null = null;
    expect(() => {
      client = new PopbillCashReceiptsClient(
        createConfigService({
          POPBILL_LINK_ID: 'link-id',
          POPBILL_SECRET_KEY: 'secret-key',
        }),
      );
    }).not.toThrow();

    expect(client).not.toBeNull();
    expect(client?.isConfigured()).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"popbill" package is not installed'),
    );
  });

  it('should configure the SDK when the popbill package is available', () => {
    const config = jest.fn();
    const cashbillService = {
      checkIsMember: jest.fn(),
      joinMember: jest.fn(),
      registIssue: jest.fn(),
      getInfo: jest.fn(),
      revokeRegistIssue: jest.fn(),
    };
    const cashbillServiceFactory = jest.fn(() => cashbillService);

    jest.doMock(
      'popbill',
      () => ({
        __esModule: true,
        default: {
          config,
          CashbillService: cashbillServiceFactory,
        },
      }),
      { virtual: true },
    );

    const { PopbillCashReceiptsClient } = loadClientModule();
    const client = new PopbillCashReceiptsClient(
      createConfigService({
        POPBILL_LINK_ID: 'link-id',
        POPBILL_SECRET_KEY: 'secret-key',
        POPBILL_IS_TEST: 'true',
      }),
    );

    expect(client.isConfigured()).toBe(true);
    expect(config).toHaveBeenCalledWith({
      LinkID: 'link-id',
      SecretKey: 'secret-key',
      IsTest: true,
    });
    expect(cashbillServiceFactory).toHaveBeenCalledTimes(1);
  });
});
