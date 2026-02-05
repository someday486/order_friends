import { SupabaseService } from '../../infra/supabase/supabase.service';
export interface UploadResult {
    url: string;
    path: string;
    bucket: string;
}
export declare class UploadService {
    private readonly supabase;
    private readonly logger;
    private readonly bucketName;
    private readonly allowedMimeTypes;
    private readonly maxFileSize;
    constructor(supabase: SupabaseService);
    uploadImage(file: Express.Multer.File, folder?: string): Promise<UploadResult>;
    uploadMultipleImages(files: Express.Multer.File[], folder?: string): Promise<UploadResult[]>;
    deleteImage(filePath: string): Promise<void>;
    deleteMultipleImages(filePaths: string[]): Promise<void>;
}
