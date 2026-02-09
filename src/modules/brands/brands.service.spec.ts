import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('BrandsService', () => {
  let service: BrandsService;
  let adminSb: any;
  let userSb: any;

  const makeClient = () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    order: jest.fn(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn(),
    auth: { getUser: jest.fn() },
  });

  beforeEach(() => {
    adminSb = makeClient();
    userSb = makeClient();

    const supabase = {
      adminClient: jest.fn(() => adminSb),
      userClient: jest.fn(() => userSb),
    };

    service = new BrandsService(supabase as SupabaseService);
    jest.clearAllMocks();
  });

  it('getMyBrands should return admin brands', async () => {
    adminSb.order.mockResolvedValueOnce({
      data: [{ id: 'b1', name: 'Brand', created_at: 't' }],
      error: null,
    });

    const result = await service.getMyBrands('token', true);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b1');
  });

  it('getMyBrands should throw on admin error', async () => {
    adminSb.order.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(service.getMyBrands('token', true)).rejects.toThrow(
      '[brands.getMyBrands]',
    );
  });

  it('getMyBrands should return user brand memberships', async () => {
    userSb.eq.mockResolvedValueOnce({
      data: [{ brands: { id: 'b2', name: 'Brand2', created_at: 't' } }],
      error: null,
    });

    const result = await service.getMyBrands('token', false);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b2');
  });

  it('getMyBrands should throw on user error', async () => {
    userSb.eq.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(service.getMyBrands('token', false)).rejects.toThrow(
      '[brands.getMyBrands]',
    );
  });

  it('getBrand should throw when not found', async () => {
    adminSb.single.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

    await expect(service.getBrand('token', 'b1', true)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getBrand should return detail', async () => {
    adminSb.single.mockResolvedValueOnce({
      data: { id: 'b1', name: 'Brand', owner_user_id: 'u1', created_at: 't' },
      error: null,
    });

    const result = await service.getBrand('token', 'b1', true);

    expect(result.id).toBe('b1');
    expect(result.ownerUserId).toBe('u1');
  });

  it('getBrand should throw when data missing', async () => {
    adminSb.single.mockResolvedValueOnce({ data: null, error: null });

    await expect(service.getBrand('token', 'b1', true)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('createBrand should create brand and member', async () => {
    userSb.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    });
    adminSb.upsert.mockResolvedValueOnce({ error: null });
    adminSb.insert
      .mockReturnValueOnce(adminSb) // brand insert chain
      .mockResolvedValueOnce({ error: null }); // member insert
    adminSb.single.mockResolvedValueOnce({
      data: { id: 'b1', name: 'Brand', owner_user_id: 'u1', created_at: 't' },
      error: null,
    });

    const result = await service.createBrand('token', { name: 'Brand' } as any);

    expect(result.id).toBe('b1');
  });

  it('createBrand should throw when user missing', async () => {
    userSb.auth.getUser.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

    await expect(
      service.createBrand('token', { name: 'Brand' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('createBrand should throw on profile upsert error', async () => {
    userSb.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    });
    adminSb.upsert.mockResolvedValueOnce({ error: { message: 'fail' } });

    await expect(
      service.createBrand('token', { name: 'Brand' } as any),
    ).rejects.toThrow('[brands.createBrand] profile upsert');
  });

  it('createBrand should throw on brand insert error', async () => {
    userSb.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    });
    adminSb.upsert.mockResolvedValueOnce({ error: null });
    adminSb.single.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.createBrand('token', { name: 'Brand' } as any),
    ).rejects.toThrow('[brands.createBrand] brand insert');
  });

  it('createBrand should throw on member insert error and cleanup', async () => {
    userSb.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    });
    adminSb.upsert.mockResolvedValueOnce({ error: null });
    adminSb.single.mockResolvedValueOnce({
      data: { id: 'b1', name: 'Brand', owner_user_id: 'u1', created_at: 't' },
      error: null,
    });
    adminSb.insert
      .mockReturnValueOnce(adminSb) // brand insert chain
      .mockResolvedValueOnce({ error: { message: 'member fail' } }); // member insert
    adminSb.eq.mockResolvedValueOnce({ error: null });

    await expect(
      service.createBrand('token', { name: 'Brand' } as any),
    ).rejects.toThrow('[brands.createBrand] member insert');
  });

  it('updateBrand should return getBrand when no changes', async () => {
    const spy = jest
      .spyOn(service, 'getBrand')
      .mockResolvedValue({ id: 'b1' } as any);

    const result = await service.updateBrand('token', 'b1', {} as any, true);

    expect(spy).toHaveBeenCalled();
    expect(result.id).toBe('b1');
  });

  it('updateBrand should update when membership valid', async () => {
    userSb.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    });
    adminSb.maybeSingle
      .mockResolvedValueOnce({ data: { role: 'OWNER', status: 'ACTIVE' }, error: null })
      .mockResolvedValueOnce({
        data: { id: 'b1', name: 'Brand', owner_user_id: 'u1', created_at: 't' },
        error: null,
      });

    const result = await service.updateBrand(
      'token',
      'b1',
      { name: 'New' } as any,
      false,
    );

    expect(result.id).toBe('b1');
  });

  it('updateBrand should throw when membership invalid', async () => {
    userSb.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    });
    adminSb.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.updateBrand('token', 'b1', { name: 'New' } as any, false),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updateBrand should throw when membership check error', async () => {
    userSb.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    });
    adminSb.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.updateBrand('token', 'b1', { name: 'New' } as any, false),
    ).rejects.toThrow('[brands.updateBrand] membership check');
  });

  it('updateBrand should throw on update error', async () => {
    adminSb.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    await expect(
      service.updateBrand('token', 'b1', { name: 'New' } as any, true),
    ).rejects.toThrow('[brands.updateBrand]');
  });

  it('updateBrand should throw when not found', async () => {
    adminSb.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.updateBrand('token', 'b1', { name: 'New' } as any, true),
    ).rejects.toThrow(NotFoundException);
  });

  it('deleteBrand should delete when admin', async () => {
    adminSb.eq.mockResolvedValueOnce({ error: null });

    const result = await service.deleteBrand('token', 'b1', true);

    expect(result.deleted).toBe(true);
  });

  it('deleteBrand should enforce membership for non-admin', async () => {
    userSb.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    });
    adminSb.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(service.deleteBrand('token', 'b1', false)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('deleteBrand should throw on membership check error', async () => {
    userSb.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    });
    adminSb.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(service.deleteBrand('token', 'b1', false)).rejects.toThrow(
      '[brands.deleteBrand] membership check',
    );
  });

  it('deleteBrand should throw when user missing', async () => {
    userSb.auth.getUser.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

    await expect(service.deleteBrand('token', 'b1', false)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('deleteBrand should throw on delete error', async () => {
    adminSb.eq.mockResolvedValueOnce({ error: { message: 'fail' } });

    await expect(service.deleteBrand('token', 'b1', true)).rejects.toThrow(
      '[brands.deleteBrand]',
    );
  });
});
