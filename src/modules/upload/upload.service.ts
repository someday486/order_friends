import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { v4 as uuidv4 } from 'uuid';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CreateBusinessOrderImportBatchDto,
  CreateBusinessOrderImportRowDto,
} from './dto/business-order-import.dto';

export type BusinessOrderImportStatus =
  | '작성중'
  | '승인대기'
  | '출고준비'
  | '부분출고'
  | '정산대기';

export type BusinessOrderImportPaymentStatus =
  | '예치금 차감'
  | '후불 예정'
  | '입금 확인';

export interface BusinessOrderImportRow {
  merchantOrderNo: string;
  productName: string;
  quantity: number;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  unitPrice: number | null;
  lineAmount: number | null;
}

export interface BusinessOrderImportBatch {
  id: string;
  createdByUserId: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  fileName: string;
  headerRowIndex: number;
  uploadedAt: string;
  rowCount: number;
  totalQty: number;
  totalAmount: number;
  itemSummary: string;
  rows: BusinessOrderImportRow[];
  status: BusinessOrderImportStatus;
  paymentStatus: BusinessOrderImportPaymentStatus;
}

function normalizeMerchantOrderNo(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export interface UploadResult {
  url: string;
  path: string;
  bucket: string;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly bucketName = 'product-images';
  private readonly businessOrderImportDir =
    process.env.BUSINESS_ORDER_IMPORTS_DIR?.trim() ||
    path.join(process.cwd(), '.data', 'business-order-imports');

  // Allowed file types
  private readonly allowedImageMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ];
  private readonly allowedBizCertMimeTypes = [
    ...this.allowedImageMimeTypes,
    'application/pdf',
  ];

  // Max file size: 5MB
  private readonly maxFileSize = 5 * 1024 * 1024;

  constructor(private readonly supabase: SupabaseService) {}

  private getBusinessOrderImportFilePath(userId: string): string {
    return path.join(this.businessOrderImportDir, `${userId}.json`);
  }

  private async readBusinessOrderImportBatches(
    userId: string,
  ): Promise<BusinessOrderImportBatch[]> {
    const filePath = this.getBusinessOrderImportFilePath(userId);

    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item) => item && typeof item === 'object')
        .map((item) => item as BusinessOrderImportBatch)
        .filter((item) => item.createdByUserId === userId)
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }

      this.logger.error(
        `Failed to read business order imports for user ${userId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException('업로드 주문서를 불러오지 못했습니다.');
    }
  }

  private async writeBusinessOrderImportBatches(
    userId: string,
    batches: BusinessOrderImportBatch[],
  ): Promise<void> {
    const filePath = this.getBusinessOrderImportFilePath(userId);
    await mkdir(this.businessOrderImportDir, { recursive: true });
    await writeFile(filePath, JSON.stringify(batches, null, 2), 'utf8');
  }

  private normalizeBusinessOrderImportRow(
    row: CreateBusinessOrderImportRowDto,
  ): BusinessOrderImportRow {
    const merchantOrderNo = String(row.merchantOrderNo || '').trim();
    const productName = String(row.productName || '').trim();
    const recipientName = String(row.recipientName || '').trim();
    const recipientPhone = String(row.recipientPhone || '').trim();
    const recipientAddress = String(row.recipientAddress || '').trim();

    if (
      !merchantOrderNo ||
      !productName ||
      !recipientName ||
      !recipientPhone ||
      !recipientAddress ||
      !Number.isFinite(row.quantity) ||
      row.quantity <= 0
    ) {
      throw new BadRequestException(
        '유효하지 않은 주문 행이 포함되어 있습니다.',
      );
    }

    const normalizedUnitPrice =
      typeof row.unitPrice === 'number' && Number.isFinite(row.unitPrice)
        ? row.unitPrice
        : null;
    const normalizedLineAmount =
      typeof row.lineAmount === 'number' && Number.isFinite(row.lineAmount)
        ? row.lineAmount
        : normalizedUnitPrice == null
          ? null
          : normalizedUnitPrice * row.quantity;

    return {
      merchantOrderNo,
      productName,
      quantity: row.quantity,
      recipientName,
      recipientPhone,
      recipientAddress,
      unitPrice: normalizedUnitPrice,
      lineAmount: normalizedLineAmount,
    };
  }

  private collectDuplicateMerchantOrderNos(
    rows: BusinessOrderImportRow[],
    existingBatches: BusinessOrderImportBatch[],
  ): string[] {
    const duplicates = new Set<string>();
    const seenInPayload = new Set<string>();
    const existingKeys = new Set(
      existingBatches.flatMap((batch) =>
        batch.rows.map((row) => normalizeMerchantOrderNo(row.merchantOrderNo)),
      ),
    );

    rows.forEach((row) => {
      const normalized = normalizeMerchantOrderNo(row.merchantOrderNo);
      if (!normalized) {
        return;
      }

      if (seenInPayload.has(normalized) || existingKeys.has(normalized)) {
        duplicates.add(row.merchantOrderNo);
      }

      seenInPayload.add(normalized);
    });

    return [...duplicates];
  }

  async listBusinessOrderImportBatches(
    userId: string,
  ): Promise<BusinessOrderImportBatch[]> {
    return this.readBusinessOrderImportBatches(userId);
  }

  async getBusinessOrderImportBatch(
    userId: string,
    batchId: string,
  ): Promise<BusinessOrderImportBatch> {
    const batches = await this.readBusinessOrderImportBatches(userId);
    const found = batches.find((batch) => batch.id === batchId);

    if (!found) {
      throw new NotFoundException('업로드 주문서를 찾을 수 없습니다.');
    }

    return found;
  }

  async createBusinessOrderImportBatch(
    userId: string,
    dto: CreateBusinessOrderImportBatchDto,
  ): Promise<BusinessOrderImportBatch> {
    const rows = dto.rows.map((row) =>
      this.normalizeBusinessOrderImportRow(row),
    );
    if (rows.length === 0) {
      throw new BadRequestException('저장할 주문 행이 없습니다.');
    }

    const current = await this.readBusinessOrderImportBatches(userId);
    const duplicateMerchantOrderNos = this.collectDuplicateMerchantOrderNos(
      rows,
      current,
    );
    if (duplicateMerchantOrderNos.length > 0) {
      throw new BadRequestException(
        `중복된 업체주문번호가 있습니다: ${duplicateMerchantOrderNos.slice(0, 10).join(', ')}`,
      );
    }

    const totalQty = rows.reduce((sum, row) => sum + row.quantity, 0);
    const totalAmount = rows.reduce(
      (sum, row) => sum + (row.lineAmount ?? 0),
      0,
    );
    const itemSummary =
      rows.length === 1
        ? rows[0].productName
        : `${rows[0].productName} 외 ${rows.length - 1}건`;
    const now = new Date();

    const nextBatch: BusinessOrderImportBatch = {
      id: `UP-${now
        .toISOString()
        .replaceAll('-', '')
        .replaceAll(':', '')
        .replaceAll('T', '')
        .replaceAll('Z', '')
        .replaceAll('.', '')
        .slice(2, 14)}`,
      createdByUserId: userId,
      supplierId: String(dto.supplierId || '').trim(),
      supplierName: String(dto.supplierName || '').trim(),
      orderDate: String(dto.orderDate || '').trim(),
      fileName: String(dto.fileName || '').trim(),
      headerRowIndex: dto.headerRowIndex,
      uploadedAt: now.toISOString().slice(0, 16).replace('T', ' '),
      rowCount: rows.length,
      totalQty,
      totalAmount,
      itemSummary,
      rows,
      status: '작성중',
      paymentStatus: '후불 예정',
    };

    if (
      !nextBatch.supplierId ||
      !nextBatch.supplierName ||
      !nextBatch.orderDate ||
      !nextBatch.fileName
    ) {
      throw new BadRequestException('업로드 주문서 기본 정보가 부족합니다.');
    }

    // TODO: Move B2B import batches to a dedicated table once the schema is ready.
    await this.writeBusinessOrderImportBatches(
      userId,
      [nextBatch, ...current].slice(0, 50),
    );

    return nextBatch;
  }

  async updateBusinessOrderImportBatchStatus(
    userId: string,
    batchId: string,
    status: BusinessOrderImportStatus,
  ): Promise<BusinessOrderImportBatch> {
    const current = await this.readBusinessOrderImportBatches(userId);
    let updated: BusinessOrderImportBatch | null = null;

    const next = current.map((batch) => {
      if (batch.id !== batchId) {
        return batch;
      }

      updated = {
        ...batch,
        status,
      };
      return updated;
    });

    if (!updated) {
      throw new NotFoundException('업로드 주문서를 찾을 수 없습니다.');
    }

    await this.writeBusinessOrderImportBatches(userId, next);
    return updated;
  }

  async deleteBusinessOrderImportBatch(
    userId: string,
    batchId: string,
  ): Promise<void> {
    const current = await this.readBusinessOrderImportBatches(userId);
    const next = current.filter((batch) => batch.id !== batchId);

    if (next.length === current.length) {
      throw new NotFoundException('업로드 주문서를 찾을 수 없습니다.');
    }

    await this.writeBusinessOrderImportBatches(userId, next);
  }

  private getAllowedMimeTypes(folder: string): string[] {
    if (folder === 'biz-certs') {
      return this.allowedBizCertMimeTypes;
    }

    return this.allowedImageMimeTypes;
  }

  /**
   * Upload image to Supabase Storage
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'general',
  ): Promise<UploadResult> {
    this.logger.log(
      `Uploading file: ${file.originalname} to folder: ${folder}`,
    );

    const allowedMimeTypes = this.getAllowedMimeTypes(folder);

    // Validate file type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
      );
    }

    // Validate file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds limit. Max size: ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }

    // Generate unique filename
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${folder}/${uuidv4()}.${fileExt}`;

    try {
      const client = this.supabase.adminClient();

      // Upload file to Supabase Storage
      const { error } = await client.storage
        .from(this.bucketName)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        this.logger.error(`Failed to upload file: ${error.message}`, error);
        throw new BadRequestException(
          `Failed to upload file: ${error.message}`,
        );
      }

      // Get public URL
      const { data: urlData } = client.storage
        .from(this.bucketName)
        .getPublicUrl(fileName);

      this.logger.log(`Successfully uploaded file: ${fileName}`);

      return {
        url: urlData.publicUrl,
        path: fileName,
        bucket: this.bucketName,
      };
    } catch (error) {
      this.logger.error(`Error uploading file: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Upload multiple images
   */
  async uploadMultipleImages(
    files: Express.Multer.File[],
    folder: string = 'general',
  ): Promise<UploadResult[]> {
    const uploadPromises = files.map((file) => this.uploadImage(file, folder));
    return Promise.all(uploadPromises);
  }

  /**
   * Delete image from Supabase Storage
   */
  async deleteImage(filePath: string): Promise<void> {
    this.logger.log(`Deleting image: ${filePath}`);

    try {
      const client = this.supabase.adminClient();

      const { error } = await client.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        this.logger.error(`Failed to delete file: ${error.message}`, error);
        throw new BadRequestException(
          `Failed to delete file: ${error.message}`,
        );
      }

      this.logger.log(`Successfully deleted image: ${filePath}`);
    } catch (error) {
      this.logger.error(`Error deleting file: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Delete multiple images
   */
  async deleteMultipleImages(filePaths: string[]): Promise<void> {
    try {
      const client = this.supabase.adminClient();

      const { error } = await client.storage
        .from(this.bucketName)
        .remove(filePaths);

      if (error) {
        this.logger.error(`Failed to delete files: ${error.message}`, error);
        throw new BadRequestException(
          `Failed to delete files: ${error.message}`,
        );
      }

      this.logger.log(`Successfully deleted ${filePaths.length} images`);
    } catch (error) {
      this.logger.error(`Error deleting files: ${error.message}`, error);
      throw error;
    }
  }
}
