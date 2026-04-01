import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreatePublicOrderRequest } from './public-order.dto';
import { CreatePublicShopOrderRequest } from './public-shop.dto';

describe('public order phone validation', () => {
  it('should auto-format 11-digit phones for public orders', () => {
    const dto = plainToInstance(CreatePublicOrderRequest, {
      branchId: 'branch-1',
      customerName: 'Kim',
      customerPhone: '01012345678',
      items: [],
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
    expect(dto.customerPhone).toBe('010-1234-5678');
  });

  it('should reject invalid public order phones', () => {
    const dto = plainToInstance(CreatePublicOrderRequest, {
      branchId: 'branch-1',
      customerName: 'Kim',
      customerPhone: '00',
      items: [],
    });

    const errors = validateSync(dto);

    expect(errors.some((error) => error.property === 'customerPhone')).toBe(
      true,
    );
  });

  it('should auto-format 11-digit phones for shop orders', () => {
    const dto = plainToInstance(CreatePublicShopOrderRequest, {
      customerName: 'Kim',
      customerPhone: '01012345678',
      customerAddress1: 'Seoul',
      items: [],
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
    expect(dto.customerPhone).toBe('010-1234-5678');
  });

  it('should reject invalid shop order phones', () => {
    const dto = plainToInstance(CreatePublicShopOrderRequest, {
      customerName: 'Kim',
      customerPhone: '00',
      customerAddress1: 'Seoul',
      items: [],
    });

    const errors = validateSync(dto);

    expect(errors.some((error) => error.property === 'customerPhone')).toBe(
      true,
    );
  });
});
