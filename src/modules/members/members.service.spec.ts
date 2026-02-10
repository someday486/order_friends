import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MembersService } from './members.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('MembersService', () => {
  let service: MembersService;
  let mockSb: any;
  let supabase: any;

  const makeSupabase = () => {
    mockSb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };
    return {
      adminClient: jest.fn(() => mockSb),
      userClient: jest.fn(() => mockSb),
    };
  };

  beforeEach(() => {
    supabase = makeSupabase();
    service = new MembersService(supabase as SupabaseService);
    jest.clearAllMocks();
  });

  it('getBrandMembers should map members', async () => {
    mockSb.order.mockResolvedValueOnce({
      data: [
        {
          brand_id: 'brand',
          user_id: 'u1',
          role: 'OWNER',
          status: 'ACTIVE',
          created_at: 't',
          profiles: { display_name: 'User' },
        },
      ],
      error: null,
    });

    const result = await service.getBrandMembers('token', 'brand', true);

    expect(result[0].brandId).toBe('brand');
    expect(result[0].displayName).toBe('User');
  });

  it('getBrandMembers should map missing profile and createdAt', async () => {
    mockSb.order.mockResolvedValueOnce({
      data: [
        {
          brand_id: 'brand',
          user_id: 'u1',
          role: 'OWNER',
          status: 'ACTIVE',
          created_at: null,
          profiles: null,
        },
      ],
      error: null,
    });

    const result = await service.getBrandMembers('token', 'brand', true);

    expect(result[0].displayName).toBeNull();
    expect(result[0].createdAt).toBe('');
  });

  it('getBrandMembers should return empty list when data is null', async () => {
    mockSb.order.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.getBrandMembers('token', 'brand', true);

    expect(result).toEqual([]);
  });

  it('getBrandMembers should use user client when isAdmin is false', async () => {
    mockSb.order.mockResolvedValueOnce({ data: [], error: null });

    await service.getBrandMembers('token', 'brand', false);

    expect(supabase.userClient).toHaveBeenCalledWith('token');
  });

  it('getBrandMembers should throw on error', async () => {
    mockSb.order.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.getBrandMembers('token', 'brand', true),
    ).rejects.toThrow('[members.getBrandMembers]');
  });

  it('inviteBrandMember should throw not implemented', async () => {
    await expect(
      service.inviteBrandMember('token', { email: 'a@b.com' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('addBrandMember should throw when exists', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: { user_id: 'u1' } });

    await expect(
      service.addBrandMember('token', 'brand', 'u1', 'MEMBER' as any, true),
    ).rejects.toThrow(BadRequestException);
  });

  it('addBrandMember should insert member', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    mockSb.single.mockResolvedValueOnce({
      data: {
        brand_id: 'brand',
        user_id: 'u1',
        role: 'MEMBER',
        status: 'ACTIVE',
        created_at: 't',
      },
      error: null,
    });

    const result = await service.addBrandMember(
      'token',
      'brand',
      'u1',
      'MEMBER' as any,
      true,
    );

    expect(result.brandId).toBe('brand');
  });

  it('addBrandMember should default role and map null createdAt', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    mockSb.single.mockResolvedValueOnce({
      data: {
        brand_id: 'brand',
        user_id: 'u1',
        role: 'MEMBER',
        status: 'ACTIVE',
        created_at: null,
      },
      error: null,
    });

    const result = await service.addBrandMember(
      'token',
      'brand',
      'u1',
      undefined as any,
      true,
    );

    expect(result.role).toBe('MEMBER');
    expect(result.createdAt).toBe('');
  });

  it('addBrandMember should throw on insert error', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    mockSb.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.addBrandMember('token', 'brand', 'u1', 'MEMBER' as any, true),
    ).rejects.toThrow('[members.addBrandMember]');
  });

  it('updateBrandMember should throw when no changes', async () => {
    await expect(
      service.updateBrandMember('token', 'brand', 'u1', {} as any, true),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateBrandMember should update member', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({
      data: {
        brand_id: 'brand',
        user_id: 'u1',
        role: 'OWNER',
        status: 'ACTIVE',
        created_at: 't',
      },
      error: null,
    });

    const result = await service.updateBrandMember(
      'token',
      'brand',
      'u1',
      { role: 'OWNER' } as any,
      true,
    );

    expect(result.role).toBe('OWNER');
  });

  it('updateBrandMember should update status when provided', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({
      data: {
        brand_id: 'brand',
        user_id: 'u1',
        role: 'MEMBER',
        status: 'INACTIVE',
        created_at: null,
      },
      error: null,
    });

    const result = await service.updateBrandMember(
      'token',
      'brand',
      'u1',
      { status: 'INACTIVE' } as any,
      true,
    );

    expect(result.status).toBe('INACTIVE');
    expect(result.createdAt).toBe('');
  });

  it('updateBrandMember should throw on update error', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.updateBrandMember(
        'token',
        'brand',
        'u1',
        { role: 'OWNER' } as any,
        true,
      ),
    ).rejects.toThrow('[members.updateBrandMember]');
  });

  it('updateBrandMember should throw when member missing', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.updateBrandMember(
        'token',
        'brand',
        'u1',
        { role: 'OWNER' } as any,
        true,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('removeBrandMember should delete', async () => {
    mockSb.eq
      .mockReturnValueOnce(mockSb) // brand_id filter
      .mockResolvedValueOnce({ error: null }); // user_id filter

    const result = await service.removeBrandMember(
      'token',
      'brand',
      'u1',
      true,
    );

    expect(result.deleted).toBe(true);
  });

  it('removeBrandMember should throw on delete error', async () => {
    mockSb.eq
      .mockReturnValueOnce(mockSb)
      .mockResolvedValueOnce({ error: { message: 'fail' } });

    await expect(
      service.removeBrandMember('token', 'brand', 'u1', true),
    ).rejects.toThrow('[members.removeBrandMember]');
  });

  it('getBranchMembers should map members', async () => {
    mockSb.order.mockResolvedValueOnce({
      data: [
        {
          branch_id: 'branch',
          user_id: 'u1',
          role: 'STAFF',
          status: 'ACTIVE',
          created_at: 't',
          profiles: { display_name: 'User' },
        },
      ],
      error: null,
    });

    const result = await service.getBranchMembers('token', 'branch', true);

    expect(result[0].branchId).toBe('branch');
  });

  it('getBranchMembers should return empty list when data is null', async () => {
    mockSb.order.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.getBranchMembers('token', 'branch', true);

    expect(result).toEqual([]);
  });

  it('getBranchMembers should map missing profile to null', async () => {
    mockSb.order.mockResolvedValueOnce({
      data: [
        {
          branch_id: 'branch',
          user_id: 'u1',
          role: 'STAFF',
          status: 'ACTIVE',
          created_at: null,
          profiles: null,
        },
      ],
      error: null,
    });

    const result = await service.getBranchMembers('token', 'branch', true);

    expect(result[0].displayName).toBeNull();
    expect(result[0].createdAt).toBe('');
  });

  it('getBranchMembers should use user client when isAdmin is false', async () => {
    mockSb.order.mockResolvedValueOnce({ data: [], error: null });

    await service.getBranchMembers('token', 'branch', false);

    expect(supabase.userClient).toHaveBeenCalledWith('token');
  });

  it('getBranchMembers should throw on error', async () => {
    mockSb.order.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.getBranchMembers('token', 'branch', true),
    ).rejects.toThrow('[members.getBranchMembers]');
  });

  it('addBranchMember should throw when exists', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: { user_id: 'u1' } });

    await expect(
      service.addBranchMember(
        'token',
        { branchId: 'branch', userId: 'u1' } as any,
        true,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('addBranchMember should insert', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    mockSb.single.mockResolvedValueOnce({
      data: {
        branch_id: 'branch',
        user_id: 'u1',
        role: 'STAFF',
        status: 'ACTIVE',
        created_at: 't',
      },
      error: null,
    });

    const result = await service.addBranchMember(
      'token',
      { branchId: 'branch', userId: 'u1' } as any,
      true,
    );

    expect(result.branchId).toBe('branch');
  });

  it('addBranchMember should map null createdAt', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    mockSb.single.mockResolvedValueOnce({
      data: {
        branch_id: 'branch',
        user_id: 'u1',
        role: 'STAFF',
        status: 'ACTIVE',
        created_at: null,
      },
      error: null,
    });

    const result = await service.addBranchMember(
      'token',
      { branchId: 'branch', userId: 'u1' } as any,
      true,
    );

    expect(result.createdAt).toBe('');
  });

  it('addBranchMember should default role when missing', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    mockSb.single.mockResolvedValueOnce({
      data: {
        branch_id: 'branch',
        user_id: 'u1',
        role: 'STAFF',
        status: 'ACTIVE',
        created_at: 't',
      },
      error: null,
    });

    const result = await service.addBranchMember(
      'token',
      { branchId: 'branch', userId: 'u1' } as any,
      true,
    );

    expect(result.role).toBe('STAFF');
  });

  it('addBranchMember should throw on insert error', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    mockSb.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.addBranchMember(
        'token',
        { branchId: 'branch', userId: 'u1' } as any,
        true,
      ),
    ).rejects.toThrow('[members.addBranchMember]');
  });

  it('updateBranchMember should throw when no changes', async () => {
    await expect(
      service.updateBranchMember('token', 'branch', 'u1', {} as any, true),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateBranchMember should update member', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({
      data: {
        branch_id: 'branch',
        user_id: 'u1',
        role: 'STAFF',
        status: 'ACTIVE',
        created_at: 't',
      },
      error: null,
    });

    const result = await service.updateBranchMember(
      'token',
      'branch',
      'u1',
      { role: 'MANAGER' } as any,
      true,
    );

    expect(result.branchId).toBe('branch');
  });

  it('updateBranchMember should update status when provided', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({
      data: {
        branch_id: 'branch',
        user_id: 'u1',
        role: 'STAFF',
        status: 'INACTIVE',
        created_at: null,
      },
      error: null,
    });

    const result = await service.updateBranchMember(
      'token',
      'branch',
      'u1',
      { status: 'INACTIVE' } as any,
      true,
    );

    expect(result.status).toBe('INACTIVE');
    expect(result.createdAt).toBe('');
  });

  it('updateBranchMember should throw on update error', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.updateBranchMember(
        'token',
        'branch',
        'u1',
        { role: 'MANAGER' } as any,
        true,
      ),
    ).rejects.toThrow('[members.updateBranchMember]');
  });

  it('updateBranchMember should throw when missing', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.updateBranchMember(
        'token',
        'branch',
        'u1',
        { role: 'MANAGER' } as any,
        true,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('removeBranchMember should delete', async () => {
    mockSb.eq
      .mockReturnValueOnce(mockSb) // branch_id filter
      .mockResolvedValueOnce({ error: null }); // user_id filter

    const result = await service.removeBranchMember(
      'token',
      'branch',
      'u1',
      true,
    );

    expect(result.deleted).toBe(true);
  });

  it('removeBranchMember should throw on delete error', async () => {
    mockSb.eq
      .mockReturnValueOnce(mockSb)
      .mockResolvedValueOnce({ error: { message: 'fail' } });

    await expect(
      service.removeBranchMember('token', 'branch', 'u1', true),
    ).rejects.toThrow('[members.removeBranchMember]');
  });
});
