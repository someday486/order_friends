import { CurrentUser } from './current-user.decorator';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

describe('CurrentUser decorator', () => {
  it('should return req.user from execution context', () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'user-1', email: 'user@test.com' } }),
      }),
    };

    class TestController {
      test(_: any) {
        return _;
      }
    }

    // Apply decorator to capture metadata
    (CurrentUser() as any)(TestController.prototype, 'test', 0);
    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'test');
    const key = Object.keys(args)[0];
    const factory = args[key].factory;
    const result = factory(undefined, ctx);

    expect(result).toEqual({ id: 'user-1', email: 'user@test.com' });
  });
});
