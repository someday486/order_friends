import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('UploadService', () => {
  let service: UploadService;
  let supabaseService: SupabaseService;

  const mockStorageClient = {
    upload: jest.fn(),
    remove: jest.fn(),
    getPublicUrl: jest.fn(),
  };

  const mockSupabaseClient = {
    storage: {
      from: jest.fn().mockReturnValue(mockStorageClient),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: SupabaseService,
          useValue: {
            adminClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
    supabaseService = module.get<SupabaseService>(SupabaseService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('uploadImage', () => {
    const createMockFile = (
      mimetype: string,
      size: number,
      originalname: string,
    ): Express.Multer.File => ({
      fieldname: 'file',
      originalname,
      encoding: '7bit',
      mimetype,
      size,
      buffer: Buffer.from('test'),
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    });

    it('should successfully upload a valid image', async () => {
      const mockFile = createMockFile('image/jpeg', 1024 * 1024, 'test.jpg');
      const mockUrl = 'https://example.com/products/folder/uuid.jpg';

      mockStorageClient.upload.mockResolvedValue({
        data: { path: 'folder/uuid.jpg' },
        error: null,
      });

      mockStorageClient.getPublicUrl.mockReturnValue({
        data: { publicUrl: mockUrl },
      });

      const result = await service.uploadImage(mockFile, 'folder');

      expect(result).toEqual({
        url: mockUrl,
        path: expect.stringMatching(/^folder\/[a-f0-9-]+\.jpg$/),
        bucket: 'products',
      });

      expect(supabaseService.adminClient).toHaveBeenCalled();
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('products');
      expect(mockStorageClient.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^folder\/[a-f0-9-]+\.jpg$/),
        mockFile.buffer,
        {
          contentType: 'image/jpeg',
          upsert: false,
        },
      );
    });

    it('should throw BadRequestException for invalid file type', async () => {
      const mockFile = createMockFile(
        'application/pdf',
        1024,
        'document.pdf',
      );

      await expect(service.uploadImage(mockFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.uploadImage(mockFile)).rejects.toThrow(
        /Invalid file type/,
      );

      expect(mockStorageClient.upload).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for file exceeding size limit', async () => {
      const mockFile = createMockFile(
        'image/jpeg',
        6 * 1024 * 1024, // 6MB
        'large.jpg',
      );

      await expect(service.uploadImage(mockFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.uploadImage(mockFile)).rejects.toThrow(
        /File size exceeds limit/,
      );

      expect(mockStorageClient.upload).not.toHaveBeenCalled();
    });

    it('should accept all allowed image types', async () => {
      const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
      ];

      mockStorageClient.upload.mockResolvedValue({
        data: { path: 'test.jpg' },
        error: null,
      });
      mockStorageClient.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/test.jpg' },
      });

      for (const mimeType of allowedTypes) {
        const mockFile = createMockFile(mimeType, 1024, 'test.jpg');
        await expect(service.uploadImage(mockFile)).resolves.toBeDefined();
      }

      expect(mockStorageClient.upload).toHaveBeenCalledTimes(
        allowedTypes.length,
      );
    });

    it('should throw BadRequestException when storage upload fails', async () => {
      const mockFile = createMockFile('image/jpeg', 1024, 'test.jpg');

      mockStorageClient.upload.mockResolvedValue({
        data: null,
        error: { message: 'Storage error' },
      });

      await expect(service.uploadImage(mockFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.uploadImage(mockFile)).rejects.toThrow(
        /Failed to upload file/,
      );
    });

    it('should use default folder "general" when not specified', async () => {
      const mockFile = createMockFile('image/jpeg', 1024, 'test.jpg');

      mockStorageClient.upload.mockResolvedValue({
        data: { path: 'general/uuid.jpg' },
        error: null,
      });
      mockStorageClient.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/general/uuid.jpg' },
      });

      const result = await service.uploadImage(mockFile);

      expect(result.path).toMatch(/^general\//);
      expect(mockStorageClient.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^general\/[a-f0-9-]+\.jpg$/),
        expect.any(Buffer),
        expect.any(Object),
      );
    });

    it('should generate unique filenames for multiple uploads', async () => {
      const mockFile = createMockFile('image/jpeg', 1024, 'test.jpg');

      mockStorageClient.upload.mockResolvedValue({
        data: { path: 'test.jpg' },
        error: null,
      });
      mockStorageClient.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/test.jpg' },
      });

      const result1 = await service.uploadImage(mockFile, 'folder');
      const result2 = await service.uploadImage(mockFile, 'folder');

      expect(result1.path).not.toEqual(result2.path);
    });
  });

  describe('uploadMultipleImages', () => {
    it('should upload multiple images successfully', async () => {
      const mockFiles = [
        {
          fieldname: 'files',
          originalname: 'image1.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('test1'),
        } as Express.Multer.File,
        {
          fieldname: 'files',
          originalname: 'image2.png',
          encoding: '7bit',
          mimetype: 'image/png',
          size: 2048,
          buffer: Buffer.from('test2'),
        } as Express.Multer.File,
      ];

      mockStorageClient.upload.mockResolvedValue({
        data: { path: 'test.jpg' },
        error: null,
      });
      mockStorageClient.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/test.jpg' },
      });

      const results = await service.uploadMultipleImages(mockFiles, 'batch');

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('url');
      expect(results[0]).toHaveProperty('path');
      expect(results[1]).toHaveProperty('url');
      expect(results[1]).toHaveProperty('path');
      expect(mockStorageClient.upload).toHaveBeenCalledTimes(2);
    });

    it('should fail if any file is invalid', async () => {
      const mockFiles = [
        {
          fieldname: 'files',
          originalname: 'image1.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('test1'),
        } as Express.Multer.File,
        {
          fieldname: 'files',
          originalname: 'doc.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 2048,
          buffer: Buffer.from('test2'),
        } as Express.Multer.File,
      ];

      await expect(
        service.uploadMultipleImages(mockFiles, 'batch'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteImage', () => {
    it('should successfully delete an image', async () => {
      const filePath = 'folder/test.jpg';

      mockStorageClient.remove.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(service.deleteImage(filePath)).resolves.toBeUndefined();

      expect(supabaseService.adminClient).toHaveBeenCalled();
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('products');
      expect(mockStorageClient.remove).toHaveBeenCalledWith([filePath]);
    });

    it('should throw BadRequestException when delete fails', async () => {
      const filePath = 'folder/test.jpg';

      mockStorageClient.remove.mockResolvedValue({
        data: null,
        error: { message: 'File not found' },
      });

      await expect(service.deleteImage(filePath)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.deleteImage(filePath)).rejects.toThrow(
        /Failed to delete file/,
      );
    });
  });

  describe('deleteMultipleImages', () => {
    it('should successfully delete multiple images', async () => {
      const filePaths = ['folder/test1.jpg', 'folder/test2.png'];

      mockStorageClient.remove.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        service.deleteMultipleImages(filePaths),
      ).resolves.toBeUndefined();

      expect(mockStorageClient.remove).toHaveBeenCalledWith(filePaths);
    });

    it('should throw BadRequestException when batch delete fails', async () => {
      const filePaths = ['folder/test1.jpg', 'folder/test2.png'];

      mockStorageClient.remove.mockResolvedValue({
        data: null,
        error: { message: 'Batch delete failed' },
      });

      await expect(service.deleteMultipleImages(filePaths)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
