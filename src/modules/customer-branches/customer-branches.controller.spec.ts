import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CustomerBranchesController } from './customer-branches.controller';
import { CustomerBranchesService } from './customer-branches.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';

describe('CustomerBranchesController', () => {
  let controller: CustomerBranchesController;

  const mockService = {
    getMyBranches: jest.fn(),
    getMyBranch: jest.fn(),
    createMyBranch: jest.fn(),
    updateMyBranch: jest.fn(),
    deleteMyBranch: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  const makeReq = (overrides: Record<string, any> = {}) =>
    ({
      user: { id: 'user-1' },
      brandMemberships: [],
      branchMemberships: [],
      ...overrides,
    }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerBranchesController],
      providers: [
        { provide: CustomerBranchesService, useValue: mockService },
        { provide: AuthGuard, useValue: mockGuard },
        { provide: CustomerGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .overrideGuard(CustomerGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<CustomerBranchesController>(CustomerBranchesController);
    jest.clearAllMocks();
  });

  it('getBranches should call service and return result', async () => {
    mockService.getMyBranches.mockResolvedValue([{ id: 'branch-1' }]);

    const result = await controller.getBranches(makeReq(), 'brand-1');

    expect(result).toEqual([{ id: 'branch-1' }]);
    expect(mockService.getMyBranches).toHaveBeenCalledWith('user-1', 'brand-1', [], []);
  });

  it('getBranches should throw when user is missing', async () => {
    await expect(
      controller.getBranches(makeReq({ user: undefined }), 'brand-1'),
    ).rejects.toThrow('Missing user');
  });

  it('getBranch should call service and return result', async () => {
    mockService.getMyBranch.mockResolvedValue({ id: 'branch-1' });

    const result = await controller.getBranch(makeReq(), 'branch-1');

    expect(result).toEqual({ id: 'branch-1' });
    expect(mockService.getMyBranch).toHaveBeenCalledWith('user-1', 'branch-1', [], []);
  });

  it('getBranch should throw when user is missing', async () => {
    await expect(
      controller.getBranch(makeReq({ user: undefined }), 'branch-1'),
    ).rejects.toThrow('Missing user');
  });

  it('createBranch should call service and return result', async () => {
    mockService.createMyBranch.mockResolvedValue({ id: 'branch-1' });

    const dto = { brandId: 'brand-1', name: 'Store', slug: 'store' } as any;
    const result = await controller.createBranch(makeReq(), dto);

    expect(result).toEqual({ id: 'branch-1' });
    expect(mockService.createMyBranch).toHaveBeenCalledWith('user-1', dto, []);
  });

  it('createBranch should throw when brandId is missing', async () => {
    await expect(
      controller.createBranch(makeReq(), { name: 'Store' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateBranch should call service and return result', async () => {
    mockService.updateMyBranch.mockResolvedValue({ id: 'branch-1' });

    const dto = { name: 'New' } as any;
    const result = await controller.updateBranch(makeReq(), 'branch-1', dto);

    expect(result).toEqual({ id: 'branch-1' });
    expect(mockService.updateMyBranch).toHaveBeenCalledWith('user-1', 'branch-1', dto, [], []);
  });

  it('updateBranch should throw when user is missing', async () => {
    await expect(
      controller.updateBranch(makeReq({ user: undefined }), 'branch-1', {} as any),
    ).rejects.toThrow('Missing user');
  });

  it('deleteBranch should call service and return result', async () => {
    mockService.deleteMyBranch.mockResolvedValue({ ok: true });

    const result = await controller.deleteBranch(makeReq(), 'branch-1');

    expect(result).toEqual({ ok: true });
    expect(mockService.deleteMyBranch).toHaveBeenCalledWith('user-1', 'branch-1', [], []);
  });

  it('deleteBranch should throw when user is missing', async () => {
    await expect(
      controller.deleteBranch(makeReq({ user: undefined }), 'branch-1'),
    ).rejects.toThrow('Missing user');
  });

  it.each([
    {
      name: 'getBranches',
      setup: () => mockService.getMyBranches.mockResolvedValueOnce([{ id: 'branch-1' }]),
      call: () =>
        controller.getBranches(
          makeReq({ brandMemberships: undefined, branchMemberships: undefined }),
          'brand-1',
        ),
      expectCall: () =>
        expect(mockService.getMyBranches).toHaveBeenCalledWith('user-1', 'brand-1', [], []),
    },
    {
      name: 'getBranch',
      setup: () => mockService.getMyBranch.mockResolvedValueOnce({ id: 'branch-1' }),
      call: () =>
        controller.getBranch(
          makeReq({ brandMemberships: undefined, branchMemberships: undefined }),
          'branch-1',
        ),
      expectCall: () =>
        expect(mockService.getMyBranch).toHaveBeenCalledWith('user-1', 'branch-1', [], []),
    },
    {
      name: 'createBranch',
      setup: () => mockService.createMyBranch.mockResolvedValueOnce({ id: 'branch-1' }),
      call: () =>
        controller.createBranch(
          makeReq({ brandMemberships: undefined, branchMemberships: undefined }),
          { brandId: 'brand-1', name: 'Store', slug: 'store' } as any,
        ),
      expectCall: () =>
        expect(mockService.createMyBranch).toHaveBeenCalledWith(
          'user-1',
          { brandId: 'brand-1', name: 'Store', slug: 'store' },
          [],
        ),
    },
    {
      name: 'updateBranch',
      setup: () => mockService.updateMyBranch.mockResolvedValueOnce({ id: 'branch-1' }),
      call: () =>
        controller.updateBranch(
          makeReq({ brandMemberships: undefined, branchMemberships: undefined }),
          'branch-1',
          { name: 'New' } as any,
        ),
      expectCall: () =>
        expect(mockService.updateMyBranch).toHaveBeenCalledWith(
          'user-1',
          'branch-1',
          { name: 'New' },
          [],
          [],
        ),
    },
    {
      name: 'deleteBranch',
      setup: () => mockService.deleteMyBranch.mockResolvedValueOnce({ ok: true }),
      call: () =>
        controller.deleteBranch(
          makeReq({ brandMemberships: undefined, branchMemberships: undefined }),
          'branch-1',
        ),
      expectCall: () =>
        expect(mockService.deleteMyBranch).toHaveBeenCalledWith('user-1', 'branch-1', [], []),
    },
  ])('should default memberships for $name', async ({ setup, call, expectCall }) => {
    setup();
    await call();
    expectCall();
  });
});
