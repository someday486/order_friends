import { Test, TestingModule } from '@nestjs/testing';
import { CustomerBrandsController } from './customer-brands.controller';
import { CustomerBrandsService } from './customer-brands.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';

describe('CustomerBrandsController', () => {
  let controller: CustomerBrandsController;

  const mockService = {
    getMyBrands: jest.fn(),
    getMyBrand: jest.fn(),
    createMyBrand: jest.fn(),
    updateMyBrand: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  const makeReq = (overrides: Record<string, any> = {}) =>
    ({ user: { id: 'user-1' }, brandMemberships: [], ...overrides }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerBrandsController],
      providers: [
        { provide: CustomerBrandsService, useValue: mockService },
        { provide: AuthGuard, useValue: mockGuard },
        { provide: CustomerGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .overrideGuard(CustomerGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<CustomerBrandsController>(CustomerBrandsController);
    jest.clearAllMocks();
  });

  it('getMyBrands should call service and return result', async () => {
    mockService.getMyBrands.mockResolvedValue([{ id: 'brand-1' }]);

    const result = await controller.getMyBrands(makeReq());

    expect(result).toEqual([{ id: 'brand-1' }]);
    expect(mockService.getMyBrands).toHaveBeenCalledWith('user-1', []);
  });

  it('getMyBrands should throw when user is missing', async () => {
    await expect(
      controller.getMyBrands(makeReq({ user: undefined })),
    ).rejects.toThrow('Missing user');
  });

  it('createMyBrand should call service and return result', async () => {
    mockService.createMyBrand.mockResolvedValue({ id: 'brand-new' });

    const createData = {
      name: '브랜드',
      slug: 'brand',
    } as any;

    const result = await controller.createMyBrand(makeReq(), createData);

    expect(result).toEqual({ id: 'brand-new' });
    expect(mockService.createMyBrand).toHaveBeenCalledWith(
      createData,
      'user-1',
      [],
    );
  });

  it('createMyBrand should throw when user is missing', async () => {
    await expect(
      controller.createMyBrand(makeReq({ user: undefined }), {} as any),
    ).rejects.toThrow('Missing user');
  });

  it('getMyBrand should call service and return result', async () => {
    mockService.getMyBrand.mockResolvedValue({ id: 'brand-1' });

    const result = await controller.getMyBrand('brand-1', makeReq());

    expect(result).toEqual({ id: 'brand-1' });
    expect(mockService.getMyBrand).toHaveBeenCalledWith(
      'brand-1',
      'user-1',
      [],
    );
  });

  it('getMyBrand should throw when user is missing', async () => {
    await expect(
      controller.getMyBrand('brand-1', makeReq({ user: undefined })),
    ).rejects.toThrow('Missing user');
  });

  it('updateMyBrand should call service and return result', async () => {
    mockService.updateMyBrand.mockResolvedValue({ id: 'brand-1' });

    const updateData = { name: 'New' } as any;
    const result = await controller.updateMyBrand(
      'brand-1',
      updateData,
      makeReq(),
    );

    expect(result).toEqual({ id: 'brand-1' });
    expect(mockService.updateMyBrand).toHaveBeenCalledWith(
      'brand-1',
      updateData,
      'user-1',
      [],
    );
  });

  it('updateMyBrand should throw when user is missing', async () => {
    await expect(
      controller.updateMyBrand(
        'brand-1',
        {} as any,
        makeReq({ user: undefined }),
      ),
    ).rejects.toThrow('Missing user');
  });
});
