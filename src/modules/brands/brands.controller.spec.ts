import { Test, TestingModule } from '@nestjs/testing';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

describe('BrandsController', () => {
  let controller: BrandsController;

  const mockService = {
    getMyBrands: jest.fn(),
    getBrand: jest.fn(),
    createBrand: jest.fn(),
    updateBrand: jest.fn(),
    deleteBrand: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  const makeReq = (overrides: Record<string, any> = {}) =>
    ({ accessToken: 'token', isAdmin: false, ...overrides }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrandsController],
      providers: [
        { provide: BrandsService, useValue: mockService },
        { provide: AuthGuard, useValue: mockGuard },
        { provide: AdminGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .overrideGuard(AdminGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<BrandsController>(BrandsController);
    jest.clearAllMocks();
  });

  it.each([
    {
      name: 'getMyBrands',
      call: () => controller.getMyBrands(makeReq()),
      mockFn: mockService.getMyBrands,
      args: ['token', false],
    },
    {
      name: 'getBrand',
      call: () => controller.getBrand(makeReq(), 'brand-1'),
      mockFn: mockService.getBrand,
      args: ['token', 'brand-1', false],
    },
    {
      name: 'createBrand',
      call: () => controller.createBrand(makeReq(), { name: 'Brand' } as any),
      mockFn: mockService.createBrand,
      args: ['token', { name: 'Brand' }, false],
    },
    {
      name: 'updateBrand',
      call: () =>
        controller.updateBrand(makeReq(), 'brand-1', { name: 'New' } as any),
      mockFn: mockService.updateBrand,
      args: ['token', 'brand-1', { name: 'New' }, false],
    },
    {
      name: 'deleteBrand',
      call: () => controller.deleteBrand(makeReq(), 'brand-1'),
      mockFn: mockService.deleteBrand,
      args: ['token', 'brand-1', false],
    },
  ])('should call service for $name', async ({ call, mockFn, args }) => {
    mockFn.mockResolvedValue({ ok: true });

    const result = await call();

    expect(result).toEqual({ ok: true });
    expect(mockFn).toHaveBeenCalledWith(...args);
  });

  it.each([
    { name: 'getMyBrands', call: () => controller.getMyBrands(makeReq({ accessToken: undefined })) },
    { name: 'getBrand', call: () => controller.getBrand(makeReq({ accessToken: undefined }), 'brand-1') },
    { name: 'createBrand', call: () => controller.createBrand(makeReq({ accessToken: undefined }), {} as any) },
    { name: 'updateBrand', call: () => controller.updateBrand(makeReq({ accessToken: undefined }), 'brand-1', {} as any) },
    { name: 'deleteBrand', call: () => controller.deleteBrand(makeReq({ accessToken: undefined }), 'brand-1') },
  ])('should throw missing access token for $name', async ({ call }) => {
    await expect(call()).rejects.toThrow('Missing access token');
  });
});
