import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomerBranchesService } from './customer-branches.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('CustomerBranchesService', () => {
  let service: CustomerBranchesService;
  let mockSb: any;

  const makeSupabase = () => {
    mockSb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn(),
      single: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };
    return {
      adminClient: jest.fn(() => mockSb),
    };
  };

  beforeEach(() => {
    const supabase = makeSupabase();
    service = new CustomerBranchesService(supabase as SupabaseService);
    jest.clearAllMocks();
  });

  it('getMyBranches should throw when brand membership missing', async () => {
    await expect(
      service.getMyBranches('user-1', 'brand-1', [], []),
    ).rejects.toThrow(ForbiddenException);
  });

  it('getMyBranches should throw on query error', async () => {
    mockSb.order.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.getMyBranches(
        'user-1',
        'brand-1',
        [{ brand_id: 'brand-1', role: 'OWNER' } as any],
        [],
      ),
    ).rejects.toThrow('Failed to fetch branches');
  });

  it('getMyBranches should return branches for brand', async () => {
    mockSb.order.mockResolvedValueOnce({
      data: [{ id: 'b1', brand_id: 'brand-1', name: 'Branch' }],
      error: null,
    });

    const result = await service.getMyBranches(
      'user-1',
      'brand-1',
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      [],
    );

    expect(result).toHaveLength(1);
    expect(result[0].myRole).toBe('OWNER');
  });

  it('getMyBranches should return empty list when brand query returns null data', async () => {
    mockSb.order.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await service.getMyBranches(
      'user-1',
      'brand-1',
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      [],
    );

    expect(result).toEqual([]);
  });

  it('getMyBranches should merge brand and branch memberships', async () => {
    mockSb.in.mockReturnValueOnce(mockSb).mockReturnValueOnce(mockSb);
    mockSb.order
      .mockResolvedValueOnce({
        data: [{ id: 'b1', brand_id: 'brand-1', name: 'B1' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'b2', brand_id: 'brand-2', name: 'B2' }],
        error: null,
      });

    const result = await service.getMyBranches(
      'user-1',
      undefined,
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      [{ branch_id: 'b2', role: 'STAFF' } as any],
    );

    expect(result.map((b) => b.id).sort()).toEqual(['b1', 'b2']);
  });

  it('getMyBranches should skip branch query when no missing ids', async () => {
    mockSb.in.mockReturnValueOnce(mockSb);
    mockSb.order.mockResolvedValueOnce({
      data: [{ id: 'b1', brand_id: 'brand-1', name: 'B1' }],
      error: null,
    });

    const result = await service.getMyBranches(
      'user-1',
      undefined,
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      [{ branch_id: 'b1', role: 'STAFF' } as any],
    );

    expect(result.map((b) => b.id)).toEqual(['b1']);
  });

  it('getMyBranches should fall back to branch memberships when brand query fails', async () => {
    mockSb.in.mockReturnValueOnce(mockSb).mockReturnValueOnce(mockSb);
    mockSb.order
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } })
      .mockResolvedValueOnce({
        data: [{ id: 'b2', brand_id: 'brand-2', name: 'B2' }],
        error: null,
      });

    const result = await service.getMyBranches(
      'user-1',
      undefined,
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      [{ branch_id: 'b2', role: 'STAFF' } as any],
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b2');
  });

  it('getMyBranches should ignore branch query errors when merging', async () => {
    mockSb.in.mockReturnValueOnce(mockSb).mockReturnValueOnce(mockSb);
    mockSb.order
      .mockResolvedValueOnce({
        data: [{ id: 'b1', brand_id: 'brand-1', name: 'B1' }],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    const result = await service.getMyBranches(
      'user-1',
      undefined,
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      [{ branch_id: 'b2', role: 'STAFF' } as any],
    );

    expect(result.map((b) => b.id)).toEqual(['b1']);
  });

  it('mapBranchesWithRole should return null role when no memberships', () => {
    const result = (service as any).mapBranchesWithRole(
      [
        {
          id: 'b1',
          brand_id: 'brand-1',
          name: 'Branch',
          logo_url: null,
          thumbnail_url: null,
          created_at: 't',
        },
      ],
      [],
      [],
    );

    expect(result[0].myRole).toBeNull();
  });

  it('getMyBranches should return branches from branch memberships only', async () => {
    mockSb.in.mockReturnValueOnce(mockSb);
    mockSb.order.mockResolvedValueOnce({
      data: [{ id: 'b2', brand_id: 'brand-2', name: 'B2' }],
      error: null,
    });

    const result = await service.getMyBranches(
      'user-1',
      undefined,
      [],
      [{ branch_id: 'b2', role: 'STAFF' } as any],
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b2');
  });

  it('getMyBranches should return empty when no accessible branches', async () => {
    const result = await service.getMyBranches('user-1', undefined, [], []);
    expect(result).toEqual([]);
  });

  it('getMyBranch should return branch with role', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1', name: 'Branch' },
      error: null,
    });

    const result = await service.getMyBranch(
      'user-1',
      'b1',
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      [],
    );

    expect(result.id).toBe('b1');
    expect(result.myRole).toBe('OWNER');
  });

  it('checkBranchAccess should return branch membership when present', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1', name: 'Branch' },
      error: null,
    });

    const result = await (service as any).checkBranchAccess(
      'b1',
      'user-1',
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      [{ branch_id: 'b1', role: 'STAFF' } as any],
    );

    expect(result.branchMembership?.role).toBe('STAFF');
  });

  it('checkBranchAccess should return brand membership when branch membership missing', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1', name: 'Branch' },
      error: null,
    });

    const result = await (service as any).checkBranchAccess(
      'b1',
      'user-1',
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      [],
    );

    expect(result.brandMembership?.role).toBe('OWNER');
  });

  it('checkBranchAccess should throw when no memberships match', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1', name: 'Branch' },
      error: null,
    });

    await expect(
      (service as any).checkBranchAccess('b1', 'user-1', [], []),
    ).rejects.toThrow(ForbiddenException);
  });

  it('checkModificationPermission should throw for non-admin roles', () => {
    expect(() =>
      (service as any).checkModificationPermission(
        'STAFF',
        'update branches',
        'user-1',
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      (service as any).checkModificationPermission(
        'OWNER',
        'update branches',
        'user-1',
      ),
    ).not.toThrow();
  });

  it('getMyBranch should prioritize branch membership role', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1', name: 'Branch' },
      error: null,
    });

    const result = await service.getMyBranch(
      'user-1',
      'b1',
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      [{ branch_id: 'b1', role: 'STAFF' } as any],
    );

    expect(result.myRole).toBe('STAFF');
  });

  it('getMyBranch should throw when branch not found', async () => {
    mockSb.single.mockResolvedValueOnce({ data: null, error: { message: 'missing' } });

    await expect(
      service.getMyBranch('user-1', 'b1', [], []),
    ).rejects.toThrow(NotFoundException);
  });

  it('createMyBranch should enforce role', async () => {
    await expect(
      service.createMyBranch(
        'user-1',
        { brandId: 'brand-1', name: 'B1', slug: 'b1' } as any,
        [{ brand_id: 'brand-1', role: 'STAFF' } as any],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('createMyBranch should throw on duplicate slug', async () => {
    mockSb.single.mockResolvedValueOnce({ data: null, error: { code: '23505' } });

    await expect(
      service.createMyBranch(
        'user-1',
        { brandId: 'brand-1', name: 'B1', slug: 'b1' } as any,
        [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('createMyBranch should throw on insert error', async () => {
    mockSb.single.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.createMyBranch(
        'user-1',
        { brandId: 'brand-1', name: 'B1', slug: 'b1' } as any,
        [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      ),
    ).rejects.toThrow('Failed to create branch');
  });

  it('createMyBranch should return created branch', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1', name: 'B1', slug: 'b1' },
      error: null,
    });

    const result = await service.createMyBranch(
      'user-1',
      { brandId: 'brand-1', name: 'B1', slug: 'b1', logoUrl: 'l' } as any,
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
    );

    expect(result.id).toBe('b1');
    expect(result.myRole).toBe('OWNER');
  });

  it('createMyBranch should include optional image fields', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: {
        id: 'b1',
        brand_id: 'brand-1',
        name: 'B1',
        slug: 'b1',
        logo_url: 'logo',
        cover_image_url: 'cover',
        thumbnail_url: 'thumb',
        created_at: 't',
      },
      error: null,
    });

    await service.createMyBranch(
      'user-1',
      {
        brandId: 'brand-1',
        name: 'B1',
        slug: 'b1',
        logoUrl: 'logo',
        coverImageUrl: 'cover',
        thumbnailUrl: 'thumb',
      } as any,
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
    );

    expect(mockSb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        logo_url: 'logo',
        cover_image_url: 'cover',
        thumbnail_url: 'thumb',
      }),
    );
  });

  it('updateMyBranch should return current when no updates', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1', name: 'B1' },
      error: null,
    });

    const spy = jest.spyOn(service, 'getMyBranch').mockResolvedValueOnce({
      id: 'b1',
      brandId: 'brand-1',
      name: 'B1',
      slug: 'b1',
      logoUrl: null,
      coverImageUrl: null,
      thumbnailUrl: null,
      createdAt: 't',
      myRole: 'OWNER',
    } as any);

    const result = await service.updateMyBranch(
      'user-1',
      'b1',
      {} as any,
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      [],
    );

    expect(result.id).toBe('b1');
    expect(spy).toHaveBeenCalled();
  });

  it('updateMyBranch should throw when role missing', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1', name: 'B1' },
      error: null,
    });

    await expect(
      service.updateMyBranch(
        'user-1',
        'b1',
        { name: 'B1' } as any,
        [{ brand_id: 'brand-1' } as any],
        [],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updateMyBranch should throw on duplicate slug', async () => {
    mockSb.single
      .mockResolvedValueOnce({
        data: { id: 'b1', brand_id: 'brand-1', name: 'B1' },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { code: '23505' } });

    await expect(
      service.updateMyBranch(
        'user-1',
        'b1',
        { slug: 'dup' } as any,
        [{ brand_id: 'brand-1', role: 'OWNER' } as any],
        [],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updateMyBranch should update and return branch', async () => {
    mockSb.single
      .mockResolvedValueOnce({
        data: { id: 'b1', brand_id: 'brand-1', name: 'B1' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'b1', brand_id: 'brand-1', name: 'B1', slug: 'b1' },
        error: null,
      });

    const result = await service.updateMyBranch(
      'user-1',
      'b1',
      { name: 'B1' } as any,
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      [],
    );

    expect(result.id).toBe('b1');
  });

  it('updateMyBranch should apply optional fields', async () => {
    mockSb.single
      .mockResolvedValueOnce({
        data: { id: 'b1', brand_id: 'brand-1', name: 'B1' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'b1',
          brand_id: 'brand-1',
          name: 'B1',
          slug: 's',
          logo_url: 'l',
          cover_image_url: 'c',
          thumbnail_url: 't',
        },
        error: null,
      });

    await service.updateMyBranch(
      'user-1',
      'b1',
      {
        name: 'B1',
        slug: 's',
        logoUrl: 'l',
        coverImageUrl: 'c',
        thumbnailUrl: 't',
      } as any,
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      [],
    );

    expect(mockSb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'B1',
        slug: 's',
        logo_url: 'l',
        cover_image_url: 'c',
        thumbnail_url: 't',
      }),
    );
  });

  it('updateMyBranch should throw on update error', async () => {
    mockSb.single
      .mockResolvedValueOnce({
        data: { id: 'b1', brand_id: 'brand-1', name: 'B1' },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.updateMyBranch(
        'user-1',
        'b1',
        { name: 'B1' } as any,
        [{ brand_id: 'brand-1', role: 'OWNER' } as any],
        [],
      ),
    ).rejects.toThrow('Failed to update branch');
  });

  it('deleteMyBranch should delete branch', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1', name: 'B1' },
      error: null,
    });
    mockSb.eq
      .mockReturnValueOnce(mockSb) // checkBranchAccess
      .mockResolvedValueOnce({ error: null }); // delete

    const result = await service.deleteMyBranch(
      'user-1',
      'b1',
      [{ brand_id: 'brand-1', role: 'OWNER' } as any],
      [],
    );

    expect(result.deleted).toBe(true);
  });

  it('deleteMyBranch should throw when role is missing', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1', name: 'B1' },
      error: null,
    });

    await expect(
      service.deleteMyBranch(
        'user-1',
        'b1',
        [{ brand_id: 'brand-1' } as any],
        [],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deleteMyBranch should throw on delete error', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1', name: 'B1' },
      error: null,
    });
    mockSb.eq
      .mockReturnValueOnce(mockSb)
      .mockResolvedValueOnce({ error: { message: 'fail' } });

    await expect(
      service.deleteMyBranch(
        'user-1',
        'b1',
        [{ brand_id: 'brand-1', role: 'OWNER' } as any],
        [],
      ),
    ).rejects.toThrow('Failed to delete branch');
  });
});
