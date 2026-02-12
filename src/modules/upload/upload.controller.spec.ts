import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { AuthGuard } from '../../common/guards/auth.guard';

describe('UploadController', () => {
  let controller: UploadController;

  const mockService = {
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
