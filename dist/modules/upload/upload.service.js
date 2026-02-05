"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var UploadService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
const uuid_1 = require("uuid");
let UploadService = UploadService_1 = class UploadService {
    supabase;
    logger = new common_1.Logger(UploadService_1.name);
    bucketName = 'products';
    allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
    ];
    maxFileSize = 5 * 1024 * 1024;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async uploadImage(file, folder = 'general') {
        this.logger.log(`Uploading image: ${file.originalname} to folder: ${folder}`);
        if (!this.allowedMimeTypes.includes(file.mimetype)) {
            throw new common_1.BadRequestException(`Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
        }
        if (file.size > this.maxFileSize) {
            throw new common_1.BadRequestException(`File size exceeds limit. Max size: ${this.maxFileSize / 1024 / 1024}MB`);
        }
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${folder}/${(0, uuid_1.v4)()}.${fileExt}`;
        try {
            const client = this.supabase.adminClient();
            const { data, error } = await client.storage
                .from(this.bucketName)
                .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false,
            });
            if (error) {
                this.logger.error(`Failed to upload file: ${error.message}`, error);
                throw new common_1.BadRequestException(`Failed to upload file: ${error.message}`);
            }
            const { data: urlData } = client.storage
                .from(this.bucketName)
                .getPublicUrl(fileName);
            this.logger.log(`Successfully uploaded image: ${fileName}`);
            return {
                url: urlData.publicUrl,
                path: fileName,
                bucket: this.bucketName,
            };
        }
        catch (error) {
            this.logger.error(`Error uploading file: ${error.message}`, error);
            throw error;
        }
    }
    async uploadMultipleImages(files, folder = 'general') {
        const uploadPromises = files.map((file) => this.uploadImage(file, folder));
        return Promise.all(uploadPromises);
    }
    async deleteImage(filePath) {
        this.logger.log(`Deleting image: ${filePath}`);
        try {
            const client = this.supabase.adminClient();
            const { error } = await client.storage
                .from(this.bucketName)
                .remove([filePath]);
            if (error) {
                this.logger.error(`Failed to delete file: ${error.message}`, error);
                throw new common_1.BadRequestException(`Failed to delete file: ${error.message}`);
            }
            this.logger.log(`Successfully deleted image: ${filePath}`);
        }
        catch (error) {
            this.logger.error(`Error deleting file: ${error.message}`, error);
            throw error;
        }
    }
    async deleteMultipleImages(filePaths) {
        try {
            const client = this.supabase.adminClient();
            const { error } = await client.storage
                .from(this.bucketName)
                .remove(filePaths);
            if (error) {
                this.logger.error(`Failed to delete files: ${error.message}`, error);
                throw new common_1.BadRequestException(`Failed to delete files: ${error.message}`);
            }
            this.logger.log(`Successfully deleted ${filePaths.length} images`);
        }
        catch (error) {
            this.logger.error(`Error deleting files: ${error.message}`, error);
            throw error;
        }
    }
};
exports.UploadService = UploadService;
exports.UploadService = UploadService = UploadService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], UploadService);
//# sourceMappingURL=upload.service.js.map