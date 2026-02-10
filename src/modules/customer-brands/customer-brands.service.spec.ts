import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomerBrandsService } from './customer-brands.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('CustomerBrandsService', () => {
  let service: CustomerBrandsService;
  let mockSb: any;

  const makeSupabase = () => {
    mockSb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      update: jest.fn().mockReturnThis(),
    };
    return {
      adminClient: jest.fn(() => mockSb),
    };
  };

  beforeEach(() => {
    const supabase = makeSupabase();
    service = new CustomerBrandsService(supabase as SupabaseService);
    jest.clearAllMocks();
  });

  it('getMyBrands should return empty when no memberships', async () => {
    await expect(service.getMyBrands('user-1', [])).resolves.toEqual([]);
    expect(mockSb.from).not.toHaveBeenCalled();
  });

  it('getMyBrands should map roles and return brands', async () => {
    mockSb.in.mockReturnValueOnce(mockSb);
    mockSb.order.mockResolvedValueOnce({
      data: [{ id: 'brand-1', name: 'Brand' }],
      error: null,
    });

    const result = await service.getMyBrands('user-1', [
      { brand_id: 'brand-1', role: 'OWNER' } as any,
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].myRole).toBe('OWNER');
  });

  it('getMyBrands should set myRole null when membership is missing', async () => {
    mockSb.in.mockReturnValueOnce(mockSb);
    mockSb.order.mockResolvedValueOnce({
      data: [{ id: 'brand-2', name: 'Brand2' }],
      error: null,
    });

    const result = await service.getMyBrands('user-1', [
      { brand_id: 'brand-1', role: 'OWNER' } as any,
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].myRole).toBeNull();
  });

  it('getMyBrands should throw on query error', async () => {
    mockSb.in.mockReturnValueOnce(mockSb);
    mockSb.order.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.getMyBrands('user-1', [{ brand_id: 'brand-1', role: 'OWNER' } as any]),
    ).rejects.toThrow('Failed to fetch brands');
  });

  it('getMyBrand should throw when membership missing', async () => {
    await expect(
      service.getMyBrand('brand-1', 'user-1', []),
    ).rejects.toThrow(ForbiddenException);
  });

  it('getMyBrand should throw when brand not found', async () => {
    mockSb.single.mockResolvedValueOnce({ data: null, error: { message: 'missing' } });

    await expect(
      service.getMyBrand('brand-1', 'user-1', [{ brand_id: 'brand-1', role: 'OWNER' } as any]),
    ).rejects.toThrow(NotFoundException);
  });

  it('getMyBrand should return brand with role', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'brand-1', name: 'Brand' },
      error: null,
    });

    const result = await service.getMyBrand('brand-1', 'user-1', [
      { brand_id: 'brand-1', role: 'ADMIN' } as any,
    ]);

    expect(result.myRole).toBe('ADMIN');
    expect(result.id).toBe('brand-1');
  });

  it('updateMyBrand should throw when membership missing', async () => {
    await expect(
      service.updateMyBrand('brand-1', {}, 'user-1', []),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updateMyBrand should throw when role not allowed', async () => {
    await expect(
      service.updateMyBrand(
        'brand-1',
        { name: 'Brand' },
        'user-1',
        [{ brand_id: 'brand-1', role: 'STAFF' } as any],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updateMyBrand should throw when update fails', async () => {
    mockSb.single.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.updateMyBrand(
        'brand-1',
        { name: 'Brand' },
        'user-1',
        [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      ),
    ).rejects.toThrow('Failed to update brand');
  });

  it('updateMyBrand should update brand and return role', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'brand-1', name: 'Brand' },
      error: null,
    });

    const result = await service.updateMyBrand(
      'brand-1',
      { name: 'Brand', logo_url: 'logo.png' },
      'user-1',
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
    );

    expect(result.id).toBe('brand-1');
    expect(result.myRole).toBe('OWNER');
  });

  it('updateMyBrand should apply optional fields', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'brand-1', name: 'Brand' },
      error: null,
    });

    await service.updateMyBrand(
      'brand-1',
      {
        name: 'Brand',
        biz_name: 'Biz',
        biz_reg_no: '123',
        logo_url: 'logo.png',
        cover_image_url: 'cover.png',
        thumbnail_url: 'thumb.png',
      },
      'user-1',
      [{ brand_id: 'brand-1', role: 'ADMIN' } as any],
    );

    expect(mockSb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Brand',
        biz_name: 'Biz',
        biz_reg_no: '123',
        logo_url: 'logo.png',
        cover_image_url: 'cover.png',
        thumbnail_url: 'thumb.png',
      }),
    );
  });

  it('updateMyBrand should allow updates without name', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'brand-1', name: 'Brand' },
      error: null,
    });

    await service.updateMyBrand(
      'brand-1',
      { logo_url: 'logo.png' },
      'user-1',
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
    );

    const updatePayload = mockSb.update.mock.calls[0][0];
    expect(updatePayload.name).toBeUndefined();
    expect(updatePayload.logo_url).toBe('logo.png');
  });
});
