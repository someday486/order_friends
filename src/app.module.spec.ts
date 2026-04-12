import 'reflect-metadata';
import { AppModule } from './app.module';
import { BillingModule } from './modules/billing/billing.module';
import { PublicOrderModule } from './modules/public-order/public-order.module';
import { SettlementModule } from './modules/settlement/settlement.module';

describe('AppModule', () => {
  it('should keep PublicOrderModule wired as the active public ordering module', () => {
    const imports = Reflect.getMetadata('imports', AppModule) as
      | Array<unknown>
      | undefined;

    expect(imports).toBeDefined();
    expect(imports).toContain(PublicOrderModule);
    expect(imports).toContain(BillingModule);
    expect(imports).toContain(SettlementModule);
    expect(
      imports?.some((item) => {
        const metatype = (item as { metatype?: { name?: string } }).metatype;
        return metatype?.name === 'PublicModule';
      }),
    ).toBe(false);
  });
});
