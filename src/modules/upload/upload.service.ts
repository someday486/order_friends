import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResult {
  url: string;
  path: string;
  bucket: string;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly bucketName = 'product-images';

  // Allowed file types
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  // Max file size: 5MB
  private readonly maxFileSize = 5 * 1024 * 1024;

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Upload image to Supabase Storage
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'general',
  ): Promise<UploadResult> {
    this.logger.log(`Uploading image: ${file.originalname} to folder: ${folder}`);

    // Validate file type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
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
      const { data, error } = await client.storage
        .from(this.bucketName)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        this.logger.error(`Failed to upload file: ${error.message}`, error);
        throw new BadRequestException(`Failed to upload file: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = client.storage
        .from(this.bucketName)
        .getPublicUrl(fileName);

      this.logger.log(`Successfully uploaded image: ${fileName}`);

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
    const uploadPromises = files.map((file) =>
      this.uploadImage(file, folder),
    );
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
        throw new BadRequestException(`Failed to delete file: ${error.message}`);
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
