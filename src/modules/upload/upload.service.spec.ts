import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

describe('UploadService', () => {
  let service: UploadService;
  let tempImportDir: string;

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

  const adminClientMock = jest.fn().mockReturnValue(mockSupabaseClient);

  beforeEach(async () => {
    tempImportDir = await mkdtemp(
      path.join(os.tmpdir(), 'orderfriends-upload-service-'),
    );
    process.env.BUSINESS_ORDER_IMPORTS_DIR = tempImportDir;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: SupabaseService,
          useValue: {
            adminClient: adminClientMock,
          },
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  afterEach(async () => {
    delete process.env.BUSINESS_ORDER_IMPORTS_DIR;
    await rm(tempImportDir, { recursive: true, force: true });
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
        bucket: 'product-images',
      });

      expect(adminClientMock).toHaveBeenCalled();
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith(
        'product-images',
      );
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
      const mockFile = createMockFile('application/pdf', 1024, 'document.pdf');

      await expect(service.uploadImage(mockFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.uploadImage(mockFile)).rejects.toThrow(
        /Invalid file type/,
      );

      expect(mockStorageClient.upload).not.toHaveBeenCalled();
    });

    it('should allow pdf upload for biz certificate folder', async () => {
      const mockFile = createMockFile('application/pdf', 1024, 'document.pdf');
      const mockUrl = 'https://example.com/biz-certs/uuid.pdf';

      mockStorageClient.upload.mockResolvedValue({
        data: { path: 'biz-certs/uuid.pdf' },
        error: null,
      });
      mockStorageClient.getPublicUrl.mockReturnValue({
        data: { publicUrl: mockUrl },
      });

      const result = await service.uploadImage(mockFile, 'biz-certs');

      expect(result).toEqual({
        url: mockUrl,
        path: expect.stringMatching(/^biz-certs\/[a-f0-9-]+\.pdf$/),
        bucket: 'product-images',
      });
      expect(mockStorageClient.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^biz-certs\/[a-f0-9-]+\.pdf$/),
        mockFile.buffer,
        {
          contentType: 'application/pdf',
          upsert: false,
        },
      );
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

    it('should treat undefined folder as default', async () => {
      const mockFile = createMockFile('image/jpeg', 1024, 'test.jpg');

      mockStorageClient.upload.mockResolvedValue({
        data: { path: 'general/uuid.jpg' },
        error: null,
      });
      mockStorageClient.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/general/uuid.jpg' },
      });

      const result = await service.uploadImage(mockFile, undefined as any);

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

    it('should use default folder when omitted', async () => {
      const mockFiles = [
        {
          fieldname: 'files',
          originalname: 'image1.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('test1'),
        } as Express.Multer.File,
      ];

      const spy = jest.spyOn(service, 'uploadImage').mockResolvedValue({
        url: 'u',
        path: 'general/x.jpg',
        bucket: 'product-images',
      });

      const results = await service.uploadMultipleImages(mockFiles);

      expect(results).toHaveLength(1);
      expect(spy).toHaveBeenCalledWith(mockFiles[0], 'general');
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

    it('should upload multiple pdf files for biz certificate folder', async () => {
      const mockFiles = [
        {
          fieldname: 'files',
          originalname: 'doc1.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from('test1'),
        } as Express.Multer.File,
        {
          fieldname: 'files',
          originalname: 'doc2.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 2048,
          buffer: Buffer.from('test2'),
        } as Express.Multer.File,
      ];

      mockStorageClient.upload.mockResolvedValue({
        data: { path: 'biz-certs/test.pdf' },
        error: null,
      });
      mockStorageClient.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/biz-certs/test.pdf' },
      });

      const results = await service.uploadMultipleImages(
        mockFiles,
        'biz-certs',
      );

      expect(results).toHaveLength(2);
      expect(mockStorageClient.upload).toHaveBeenCalledTimes(2);
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

      expect(adminClientMock).toHaveBeenCalled();
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith(
        'product-images',
      );
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

  describe('business order imports', () => {
    const createDto = () => ({
      supplierId: 'sup-1',
      supplierName: '공급처',
      orderDate: '2026-03-31',
      fileName: 'sample.xlsx',
      headerRowIndex: 0,
      rows: [
        {
          merchantOrderNo: 'OF-001',
          productName: '제주 감귤',
          quantity: 2,
          recipientName: '홍길동',
          recipientPhone: '010-1111-2222',
          recipientAddress: '서울시 중구 1',
          unitPrice: 15000,
          lineAmount: 30000,
        },
      ],
    });

    it('should create and list business order import batches', async () => {
      const created = await service.createBusinessOrderImportBatch(
        'user-1',
        createDto(),
      );

      const listed = await service.listBusinessOrderImportBatches('user-1');

      expect(created.id).toMatch(/^UP-/);
      expect(created.status).toBe('작성중');
      expect(created.paymentStatus).toBe('후불 예정');
      expect(created.totalQty).toBe(2);
      expect(created.totalAmount).toBe(30000);
      expect(listed).toHaveLength(1);
      expect(listed[0].id).toBe(created.id);
    });

    it('should return a single business order import batch by id', async () => {
      const created = await service.createBusinessOrderImportBatch(
        'user-1',
        createDto(),
      );

      const found = await service.getBusinessOrderImportBatch(
        'user-1',
        created.id,
      );

      expect(found.id).toBe(created.id);
      expect(found.fileName).toBe('sample.xlsx');
    });

    it('should update business order import batch status', async () => {
      const created = await service.createBusinessOrderImportBatch(
        'user-1',
        createDto(),
      );

      const updated = await service.updateBusinessOrderImportBatchStatus(
        'user-1',
        created.id,
        '승인대기',
      );

      const found = await service.getBusinessOrderImportBatch(
        'user-1',
        created.id,
      );

      expect(updated.status).toBe('승인대기');
      expect(found.status).toBe('승인대기');
    });

    it('should delete a business order import batch', async () => {
      const created = await service.createBusinessOrderImportBatch(
        'user-1',
        createDto(),
      );

      await service.deleteBusinessOrderImportBatch('user-1', created.id);

      await expect(
        service.getBusinessOrderImportBatch('user-1', created.id),
      ).rejects.toThrow();
      await expect(
        service.listBusinessOrderImportBatches('user-1'),
      ).resolves.toHaveLength(0);
    });

    it('should reject duplicate merchant order numbers from previous uploads', async () => {
      await service.createBusinessOrderImportBatch('user-1', createDto());

      await expect(
        service.createBusinessOrderImportBatch('user-1', createDto()),
      ).rejects.toThrow(/중복된 업체주문번호/);
    });

    it('should reject duplicate merchant order numbers inside the same upload', async () => {
      const duplicatedDto = {
        ...createDto(),
        rows: [
          ...createDto().rows,
          {
            ...createDto().rows[0],
            productName: '한라봉',
          },
        ],
      };

      await expect(
        service.createBusinessOrderImportBatch('user-1', duplicatedDto as any),
      ).rejects.toThrow(/중복된 업체주문번호/);
    });

    it('should reject invalid business order import rows', async () => {
      const invalidDto = {
        ...createDto(),
        rows: [
          {
            merchantOrderNo: '',
            productName: '제주 감귤',
            quantity: 0,
            recipientName: '홍길동',
            recipientPhone: '010-1111-2222',
            recipientAddress: '서울시 중구 1',
          },
        ],
      };

      await expect(
        service.createBusinessOrderImportBatch('user-1', invalidDto as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
