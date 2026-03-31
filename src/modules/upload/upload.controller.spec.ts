import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { AuthGuard } from '../../common/guards/auth.guard';

describe('UploadController', () => {
  let controller: UploadController;

  const mockService = {
    listBusinessOrderImportBatches: jest.fn(),
    getBusinessOrderImportBatch: jest.fn(),
    createBusinessOrderImportBatch: jest.fn(),
    updateBusinessOrderImportBatchStatus: jest.fn(),
    deleteBusinessOrderImportBatch: jest.fn(),
    uploadImage: jest.fn(),
    uploadMultipleImages: jest.fn(),
    deleteImage: jest.fn(),
    deleteMultipleImages: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        { provide: UploadService, useValue: mockService },
        { provide: AuthGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<UploadController>(UploadController);
    jest.clearAllMocks();
  });

  it('listBusinessOrderImports should return batches for current user', async () => {
    mockService.listBusinessOrderImportBatches.mockResolvedValue([
      { id: 'UP-1' },
    ]);

    const result = await controller.listBusinessOrderImports({
      user: { id: 'user-1' },
    } as any);

    expect(result).toEqual([{ id: 'UP-1' }]);
    expect(mockService.listBusinessOrderImportBatches).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('getBusinessOrderImport should return a batch for current user', async () => {
    mockService.getBusinessOrderImportBatch.mockResolvedValue({ id: 'UP-1' });

    const result = await controller.getBusinessOrderImport(
      { user: { id: 'user-1' } } as any,
      'UP-1',
    );

    expect(result).toEqual({ id: 'UP-1' });
    expect(mockService.getBusinessOrderImportBatch).toHaveBeenCalledWith(
      'user-1',
      'UP-1',
    );
  });

  it('createBusinessOrderImport should save a batch for current user', async () => {
    const dto = {
      supplierId: 'sup-1',
      supplierName: '공급처',
      orderDate: '2026-03-31',
      fileName: 'sample.xlsx',
      headerRowIndex: 0,
      rows: [
        {
          merchantOrderNo: 'A-1',
          productName: '사과',
          quantity: 2,
          recipientName: '홍길동',
          recipientPhone: '010-0000-0000',
          recipientAddress: '서울',
        },
      ],
    };

    mockService.createBusinessOrderImportBatch.mockResolvedValue({
      id: 'UP-1',
    });

    const result = await controller.createBusinessOrderImport(
      { user: { id: 'user-1' } } as any,
      dto as any,
    );

    expect(result).toEqual({ id: 'UP-1' });
    expect(mockService.createBusinessOrderImportBatch).toHaveBeenCalledWith(
      'user-1',
      dto,
    );
  });

  it('updateBusinessOrderImportStatus should update a batch status', async () => {
    mockService.updateBusinessOrderImportBatchStatus.mockResolvedValue({
      id: 'UP-1',
      status: '승인대기',
    });

    const result = await controller.updateBusinessOrderImportStatus(
      { user: { id: 'user-1' } } as any,
      'UP-1',
      { status: '승인대기' },
    );

    expect(result).toEqual({ id: 'UP-1', status: '승인대기' });
    expect(
      mockService.updateBusinessOrderImportBatchStatus,
    ).toHaveBeenCalledWith('user-1', 'UP-1', '승인대기');
  });

  it('deleteBusinessOrderImport should delete a batch for current user', async () => {
    mockService.deleteBusinessOrderImportBatch.mockResolvedValue(undefined);

    const result = await controller.deleteBusinessOrderImport(
      { user: { id: 'user-1' } } as any,
      'UP-1',
    );

    expect(result).toEqual({
      message: 'Business order import deleted successfully',
    });
    expect(mockService.deleteBusinessOrderImportBatch).toHaveBeenCalledWith(
      'user-1',
      'UP-1',
    );
  });

  it('uploadImage should call service and return result', async () => {
    mockService.uploadImage.mockResolvedValue({ url: 'http://file' });

    const file = { originalname: 'file.png' } as any;
    const result = await controller.uploadImage(file, 'avatars');

    expect(result).toEqual({ url: 'http://file' });
    expect(mockService.uploadImage).toHaveBeenCalledWith(file, 'avatars');
  });

  it('uploadImage should throw when file is missing', async () => {
    await expect(
      controller.uploadImage(undefined as any, 'avatars'),
    ).rejects.toThrow(BadRequestException);
  });

  it('uploadMultipleImages should call service and return result', async () => {
    mockService.uploadMultipleImages.mockResolvedValue([
      { url: 'http://file' },
    ]);

    const files = [{ originalname: 'file.png' }] as any;
    const result = await controller.uploadMultipleImages(files, 'avatars');

    expect(result).toEqual([{ url: 'http://file' }]);
    expect(mockService.uploadMultipleImages).toHaveBeenCalledWith(
      files,
      'avatars',
    );
  });

  it('uploadMultipleImages should throw when files are missing', async () => {
    await expect(
      controller.uploadMultipleImages([], 'avatars'),
    ).rejects.toThrow(BadRequestException);
  });

  it('deleteImage should call service and return result', async () => {
    mockService.deleteImage.mockResolvedValue(undefined);

    const result = await controller.deleteImage('path/to/file.png');

    expect(result).toEqual({ message: 'Image deleted successfully' });
    expect(mockService.deleteImage).toHaveBeenCalledWith('path/to/file.png');
  });

  it('deleteImage should throw when path is missing', async () => {
    await expect(controller.deleteImage('')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deleteMultipleImages should call service and return result', async () => {
    mockService.deleteMultipleImages.mockResolvedValue(undefined);

    const result = await controller.deleteMultipleImages(['a.png', 'b.png']);

    expect(result).toEqual({ message: '2 images deleted successfully' });
    expect(mockService.deleteMultipleImages).toHaveBeenCalledWith([
      'a.png',
      'b.png',
    ]);
  });

  it('deleteMultipleImages should throw when paths are missing', async () => {
    await expect(controller.deleteMultipleImages([])).rejects.toThrow(
      BadRequestException,
    );
  });
});
