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

  it('getBranches should map optional fields with defaults using user client', async () => {
    userSb.order.mockResolvedValueOnce({
      data: [
        {
          id: 'b1',
          brand_id: 'brand',
          name: 'A',
          slug: null,
          logo_url: null,
          thumbnail_url: null,
          created_at: null,
        },
      ],
      error: null,
    });

    const result = await service.getBranches('token', 'brand', false);

    expect(result[0].slug).toBe('');
    expect(result[0].logoUrl).toBeNull();
    expect(result[0].thumbnailUrl).toBeNull();
    expect(result[0].createdAt).toBe('');
    expect(userSb.from).toHaveBeenCalledWith('branches');
  });

  it('getBranches should return empty list when data is null', async () => {
    adminSb.order.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await service.getBranches('token', 'brand', true);

    expect(result).toEqual([]);
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

  it('getBranch should map optional fields with defaults', async () => {
    adminSb.single.mockResolvedValueOnce({
      data: {
        id: 'b1',
        brand_id: 'brand',
        name: 'Branch',
        slug: null,
        logo_url: null,
        cover_image_url: null,
        thumbnail_url: null,
        created_at: null,
      },
      error: null,
    });

    const result = await service.getBranch('token', 'b1', true);

    expect(result.slug).toBe('');
    expect(result.logoUrl).toBeNull();
    expect(result.coverImageUrl).toBeNull();
    expect(result.thumbnailUrl).toBeNull();
    expect(result.createdAt).toBe('');
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

  it('createBranch should map admin response with defaults', async () => {
    adminSb.single.mockResolvedValueOnce({
      data: {
        id: 'b1',
        brand_id: 'brand',
        name: 'Branch',
        slug: null,
        created_at: null,
      },
      error: null,
    });

    const result = await service.createBranch(
      'token',
      { brandId: 'brand', name: 'Branch', slug: 's' } as any,
      true,
    );

    expect(result.slug).toBe('');
    expect(result.createdAt).toBe('');
  });

  it('createBranch should include optional fields in payload', async () => {
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

    await service.createBranch(
      'token',
      {
        brandId: 'brand',
        name: 'Branch',
        slug: 's',
        logoUrl: 'logo.png',
        coverImageUrl: 'cover.png',
        thumbnailUrl: 'thumb.png',
      } as any,
      true,
    );

    expect(adminSb.insert).toHaveBeenCalledWith({
      brand_id: 'brand',
      name: 'Branch',
      slug: 's',
      logo_url: 'logo.png',
      cover_image_url: 'cover.png',
      thumbnail_url: 'thumb.png',
    });
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

  it('createBranch should throw conflict on duplicate for user client', async () => {
    userSb.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'dup', code: '23505' },
    });

    await expect(
      service.createBranch('token', { brandId: 'b', name: 'n', slug: 's' } as any),
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

  it('createBranch should map user response defaults', async () => {
    userSb.single.mockResolvedValueOnce({
      data: {
        id: 'b2',
        brand_id: 'brand',
        name: 'Branch',
        slug: null,
        logo_url: null,
        cover_image_url: null,
        thumbnail_url: null,
        created_at: null,
      },
      error: null,
    });

    const result = await service.createBranch(
      'token',
      { brandId: 'brand', name: 'Branch', slug: 's' } as any,
    );

    expect(result.slug).toBe('');
    expect(result.logoUrl).toBeNull();
    expect(result.coverImageUrl).toBeNull();
    expect(result.thumbnailUrl).toBeNull();
    expect(result.createdAt).toBe('');
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

  it('updateBranch should include optional fields in update payload', async () => {
    adminSb.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'b1',
        brand_id: 'brand',
        name: 'Branch',
        slug: null,
        logo_url: null,
        cover_image_url: null,
        thumbnail_url: null,
        created_at: null,
      },
      error: null,
    });

    const result = await service.updateBranch(
      'token',
      'b1',
      {
        name: 'New',
        slug: 'slug',
        logoUrl: 'logo.png',
        coverImageUrl: 'cover.png',
        thumbnailUrl: 'thumb.png',
      } as any,
      true,
    );

    expect(adminSb.update).toHaveBeenCalledWith({
      name: 'New',
      slug: 'slug',
      logo_url: 'logo.png',
      cover_image_url: 'cover.png',
      thumbnail_url: 'thumb.png',
    });
    expect(result.slug).toBe('');
    expect(result.logoUrl).toBeNull();
    expect(result.coverImageUrl).toBeNull();
    expect(result.thumbnailUrl).toBeNull();
    expect(result.createdAt).toBe('');
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
