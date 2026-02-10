import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

describe('BranchesController', () => {
  let controller: BranchesController;

  const mockService = {
    getBranches: jest.fn(),
    getBranch: jest.fn(),
    createBranch: jest.fn(),
    updateBranch: jest.fn(),
    deleteBranch: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  const makeReq = (overrides: Record<string, any> = {}) =>
    ({ accessToken: 'token', isAdmin: false, ...overrides }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BranchesController],
      providers: [
        { provide: BranchesService, useValue: mockService },
        { provide: AuthGuard, useValue: mockGuard },
        { provide: AdminGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .overrideGuard(AdminGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<BranchesController>(BranchesController);
    jest.clearAllMocks();
  });

  it('getBranches should call service and return result', async () => {
    mockService.getBranches.mockResolvedValue([{ id: 'branch-1' }]);

    const result = await controller.getBranches(makeReq(), 'brand-1');

    expect(result).toEqual([{ id: 'branch-1' }]);
    expect(mockService.getBranches).toHaveBeenCalledWith(
      'token',
      'brand-1',
      false,
    );
  });

  it('getBranches should throw when access token is missing', async () => {
    await expect(
      controller.getBranches(makeReq({ accessToken: undefined }), 'brand-1'),
    ).rejects.toThrow('Missing access token');
  });

  it('getBranch should call service and return result', async () => {
    mockService.getBranch.mockResolvedValue({ id: 'branch-1' });

    const result = await controller.getBranch(makeReq(), 'branch-1');

    expect(result).toEqual({ id: 'branch-1' });
    expect(mockService.getBranch).toHaveBeenCalledWith(
      'token',
      'branch-1',
      false,
    );
  });

  it('getBranch should throw when access token is missing', async () => {
    await expect(
      controller.getBranch(makeReq({ accessToken: undefined }), 'branch-1'),
    ).rejects.toThrow('Missing access token');
  });

  it('createBranch should call service and return result', async () => {
    mockService.createBranch.mockResolvedValue({ id: 'branch-1' });

    const dto = { brandId: 'brand-1', name: 'Store', slug: 'store' } as any;
    const result = await controller.createBranch(dto, makeReq());

    expect(result).toEqual({ id: 'branch-1' });
    expect(mockService.createBranch).toHaveBeenCalledWith(
      'token',
      { ...dto, brandId: 'brand-1' },
      false,
    );
  });

  it('createBranch should throw when brandId is missing', async () => {
    await expect(
      controller.createBranch(
        { name: 'Store', slug: 'store' } as any,
        makeReq(),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('createBranch should throw when name or slug is missing', async () => {
    await expect(
      controller.createBranch(
        { brandId: 'brand-1', name: '' } as any,
        makeReq(),
      ),
    ).rejects.toThrow('name and slug are required');
  });

  it('updateBranch should call service and return result', async () => {
    mockService.updateBranch.mockResolvedValue({ id: 'branch-1' });

    const dto = { name: 'New' } as any;
    const result = await controller.updateBranch(makeReq(), 'branch-1', dto);

    expect(result).toEqual({ id: 'branch-1' });
    expect(mockService.updateBranch).toHaveBeenCalledWith(
      'token',
      'branch-1',
      dto,
      false,
    );
  });

  it('updateBranch should throw when access token is missing', async () => {
    await expect(
      controller.updateBranch(
        makeReq({ accessToken: undefined }),
        'branch-1',
        {} as any,
      ),
    ).rejects.toThrow('Missing access token');
  });

  it('deleteBranch should call service and return result', async () => {
    mockService.deleteBranch.mockResolvedValue({ id: 'branch-1' });

    const result = await controller.deleteBranch(makeReq(), 'branch-1');

    expect(result).toEqual({ id: 'branch-1' });
    expect(mockService.deleteBranch).toHaveBeenCalledWith(
      'token',
      'branch-1',
      false,
    );
  });

  it('deleteBranch should throw when access token is missing', async () => {
    await expect(
      controller.deleteBranch(makeReq({ accessToken: undefined }), 'branch-1'),
    ).rejects.toThrow('Missing access token');
  });
});
