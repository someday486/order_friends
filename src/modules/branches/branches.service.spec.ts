import { ConflictException, NotFoundException } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('BranchesService', () => {
  let service: BranchesService;
  let adminSb: any;
  let userSb: any;

  const makeClient = () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  });

  beforeEach(() => {
    adminSb = makeClient();
    userSb = makeClient();

    const supabase = {
      adminClient: jest.fn(() => adminSb),
      userClient: jest.fn(() => userSb),
    };

    service = new BranchesService(supabase as SupabaseService);
    jest.clearAllMocks();
  });

  it('getBranches should map results', async () => {
    adminSb.order.mockResolvedValueOnce({
      data: [
        { id: 'b1', brand_id: 'brand', name: 'A', slug: 'a', created_at: 't' },
      ],
      error: null,
    });

    const result = await service.getBranches('token', 'brand', true);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b1');
  });

  it('getBranches should throw on error', async () => {
    adminSb.order.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(service.getBranches('token', 'brand', true)).rejects.toThrow(
      '[branches.getBranches]',
    );
  });

  it('getBranch should throw when not found', async () => {
    adminSb.single.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

    await expect(service.getBranch('token', 'b1', true)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getBranch should return detail', async () => {
    adminSb.single.mockResolvedValueOnce({
      data: {
        id: 'b1',
        brand_id: 'brand',
        name: 'Branch',
        slug: 's',
        created_at: 't',
      },
      error: null,
    });

    const result = await service.getBranch('token', 'b1', true);

    expect(result.id).toBe('b1');
    expect(result.brandId).toBe('brand');
  });

  it('getBranch should throw when data missing', async () => {
    adminSb.single.mockResolvedValueOnce({ data: null, error: null });

    await expect(service.getBranch('token', 'b1', true)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('createBranch should insert using admin client', async () => {
    adminSb.single.mockResolvedValueOnce({
      data: {
        id: 'b1',
        brand_id: 'brand',
        name: 'Branch',
        slug: 's',
        created_at: 't',
      },
      error: null,
    });

    const result = await service.createBranch(
      'token',
      { brandId: 'brand', name: 'Branch', slug: 's' } as any,
      true,
    );

    expect(result.id).toBe('b1');
  });

  it('createBranch should fall back to admin on RLS error', async () => {
    userSb.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'row-level security' },
    });
    adminSb.single.mockResolvedValueOnce({
      data: {
        id: 'b2',
        brand_id: 'brand',
        name: 'Branch',
        slug: 's',
        created_at: 't',
      },
      error: null,
    });

    const result = await service.createBranch(
      'token',
      { brandId: 'brand', name: 'Branch', slug: 's' } as any,
    );

    expect(result.id).toBe('b2');
  });

  it('createBranch should throw conflict on duplicate', async () => {
    adminSb.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'dup', code: '23505' },
    });

    await expect(
      service.createBranch('token', { brandId: 'b', name: 'n', slug: 's' } as any, true),
    ).rejects.toThrow(ConflictException);
  });

  it('createBranch should throw on admin insert error', async () => {
    adminSb.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    });

    await expect(
      service.createBranch('token', { brandId: 'b', name: 'n', slug: 's' } as any, true),
    ).rejects.toThrow('[branches.createBranch]');
  });

  it('createBranch should throw on user insert error without RLS', async () => {
    userSb.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'other' },
    });

    await expect(
      service.createBranch('token', { brandId: 'b', name: 'n', slug: 's' } as any),
    ).rejects.toThrow('[branches.createBranch]');
  });

  it('updateBranch should return getBranch when no changes', async () => {
    const spy = jest.spyOn(service, 'getBranch').mockResolvedValue({
      id: 'b1',
      brandId: 'brand',
      name: 'Branch',
      slug: 's',
      createdAt: 't',
    } as any);

    const result = await service.updateBranch('token', 'b1', {} as any, true);

    expect(spy).toHaveBeenCalled();
    expect(result.id).toBe('b1');
  });

  it('updateBranch should update and return data', async () => {
    adminSb.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'b1',
        brand_id: 'brand',
        name: 'Branch',
        slug: 's',
        created_at: 't',
      },
      error: null,
    });

    const result = await service.updateBranch(
      'token',
      'b1',
      { name: 'New' } as any,
      true,
    );

    expect(result.name).toBe('Branch');
  });

  it('updateBranch should throw when not found', async () => {
    adminSb.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.updateBranch('token', 'b1', { name: 'New' } as any, true),
    ).rejects.toThrow(NotFoundException);
  });

  it('updateBranch should throw conflict on duplicate slug', async () => {
    adminSb.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'dup', code: '23505' },
    });

    await expect(
      service.updateBranch('token', 'b1', { slug: 's' } as any, true),
    ).rejects.toThrow(ConflictException);
  });

  it('updateBranch should throw on update error', async () => {
    adminSb.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    });

    await expect(
      service.updateBranch('token', 'b1', { name: 'New' } as any, true),
    ).rejects.toThrow('[branches.updateBranch]');
  });

  it('deleteBranch should return deleted true', async () => {
    adminSb.eq.mockResolvedValueOnce({ error: null });

    const result = await service.deleteBranch('token', 'b1', true);

    expect(result.deleted).toBe(true);
  });

  it('deleteBranch should throw on delete error', async () => {
    adminSb.eq.mockResolvedValueOnce({ error: { message: 'fail' } });

    await expect(service.deleteBranch('token', 'b1', true)).rejects.toThrow(
      '[branches.deleteBranch]',
    );
  });
});
