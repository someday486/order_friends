import { Test, TestingModule } from '@nestjs/testing';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

describe('MembersController', () => {
  let controller: MembersController;

  const mockService = {
    getBrandMembers: jest.fn(),
    addBrandMember: jest.fn(),
    updateBrandMember: jest.fn(),
    removeBrandMember: jest.fn(),
    getBranchMembers: jest.fn(),
    addBranchMember: jest.fn(),
    updateBranchMember: jest.fn(),
    removeBranchMember: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  const makeReq = (overrides: Record<string, any> = {}) =>
    ({ accessToken: 'token', isAdmin: false, ...overrides }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MembersController],
      providers: [
        { provide: MembersService, useValue: mockService },
        { provide: AuthGuard, useValue: mockGuard },
        { provide: AdminGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .overrideGuard(AdminGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<MembersController>(MembersController);
    jest.clearAllMocks();
  });

  it.each([
    {
      name: 'getBrandMembers',
      call: () => controller.getBrandMembers(makeReq(), 'brand-1'),
      mockFn: mockService.getBrandMembers,
      args: ['token', 'brand-1', false],
    },
    {
      name: 'addBrandMember',
      call: () =>
        controller.addBrandMember(makeReq(), 'brand-1', { userId: 'user-1', role: 'OWNER' } as any),
      mockFn: mockService.addBrandMember,
      args: ['token', 'brand-1', 'user-1', 'OWNER', false],
    },
    {
      name: 'updateBrandMember',
      call: () =>
        controller.updateBrandMember(makeReq(), 'brand-1', 'user-1', { role: 'ADMIN' } as any),
      mockFn: mockService.updateBrandMember,
      args: ['token', 'brand-1', 'user-1', { role: 'ADMIN' }, false],
    },
    {
      name: 'removeBrandMember',
      call: () => controller.removeBrandMember(makeReq(), 'brand-1', 'user-1'),
      mockFn: mockService.removeBrandMember,
      args: ['token', 'brand-1', 'user-1', false],
    },
    {
      name: 'getBranchMembers',
      call: () => controller.getBranchMembers(makeReq(), 'branch-1'),
      mockFn: mockService.getBranchMembers,
      args: ['token', 'branch-1', false],
    },
    {
      name: 'addBranchMember',
      call: () =>
        controller.addBranchMember(makeReq(), { branchId: 'branch-1', userId: 'user-2', role: 'STAFF' } as any),
      mockFn: mockService.addBranchMember,
      args: ['token', { branchId: 'branch-1', userId: 'user-2', role: 'STAFF' }, false],
    },
    {
      name: 'updateBranchMember',
      call: () =>
        controller.updateBranchMember(makeReq(), 'branch-1', 'user-2', { role: 'VIEWER' } as any),
      mockFn: mockService.updateBranchMember,
      args: ['token', 'branch-1', 'user-2', { role: 'VIEWER' }, false],
    },
    {
      name: 'removeBranchMember',
      call: () => controller.removeBranchMember(makeReq(), 'branch-1', 'user-2'),
      mockFn: mockService.removeBranchMember,
      args: ['token', 'branch-1', 'user-2', false],
    },
  ])('should call service for $name', async ({ call, mockFn, args }) => {
    mockFn.mockResolvedValue({ ok: true });

    const result = await call();

    expect(result).toEqual({ ok: true });
    expect(mockFn).toHaveBeenCalledWith(...args);
  });

  it.each([
    { name: 'getBrandMembers', call: () => controller.getBrandMembers(makeReq({ accessToken: undefined }), 'brand-1') },
    { name: 'addBrandMember', call: () => controller.addBrandMember(makeReq({ accessToken: undefined }), 'brand-1', {} as any) },
    { name: 'updateBrandMember', call: () => controller.updateBrandMember(makeReq({ accessToken: undefined }), 'brand-1', 'user-1', {} as any) },
    { name: 'removeBrandMember', call: () => controller.removeBrandMember(makeReq({ accessToken: undefined }), 'brand-1', 'user-1') },
    { name: 'getBranchMembers', call: () => controller.getBranchMembers(makeReq({ accessToken: undefined }), 'branch-1') },
    { name: 'addBranchMember', call: () => controller.addBranchMember(makeReq({ accessToken: undefined }), {} as any) },
    { name: 'updateBranchMember', call: () => controller.updateBranchMember(makeReq({ accessToken: undefined }), 'branch-1', 'user-2', {} as any) },
    { name: 'removeBranchMember', call: () => controller.removeBranchMember(makeReq({ accessToken: undefined }), 'branch-1', 'user-2') },
  ])('should throw missing access token for $name', async ({ call }) => {
    await expect(call()).rejects.toThrow('Missing access token');
  });
});
