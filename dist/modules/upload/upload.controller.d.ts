import { UploadService } from './upload.service';
export declare class UploadController {
    private readonly uploadService;
    constructor(uploadService: UploadService);
    uploadImage(file: Express.Multer.File, folder?: string): Promise<import("./upload.service").UploadResult>;
    uploadMultipleImages(files: Express.Multer.File[], folder?: string): Promise<import("./upload.service").UploadResult[]>;
    deleteImage(path: string): Promise<{
        message: string;
    }>;
    deleteMultipleImages(paths: string[]): Promise<{
        message: string;
    }>;
}
