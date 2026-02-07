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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../../common/guards/auth.guard");
const admin_guard_1 = require("../../common/guards/admin.guard");
const upload_service_1 = require("./upload.service");
const user_rate_limit_decorator_1 = require("../../common/decorators/user-rate-limit.decorator");
let UploadController = class UploadController {
    uploadService;
    constructor(uploadService) {
        this.uploadService = uploadService;
    }
    async uploadImage(file, folder) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        return this.uploadService.uploadImage(file, folder || 'general');
    }
    async uploadMultipleImages(files, folder) {
        if (!files || files.length === 0) {
            throw new common_1.BadRequestException('No files uploaded');
        }
        return this.uploadService.uploadMultipleImages(files, folder || 'general');
    }
    async deleteImage(path) {
        if (!path) {
            throw new common_1.BadRequestException('Image path is required');
        }
        await this.uploadService.deleteImage(path);
        return { message: 'Image deleted successfully' };
    }
    async deleteMultipleImages(paths) {
        if (!paths || paths.length === 0) {
            throw new common_1.BadRequestException('Image paths are required');
        }
        await this.uploadService.deleteMultipleImages(paths);
        return { message: `${paths.length} images deleted successfully` };
    }
};
exports.UploadController = UploadController;
__decorate([
    (0, common_1.Post)('image'),
    (0, user_rate_limit_decorator_1.UserRateLimit)({ points: 20, duration: 60 }),
    (0, swagger_1.ApiOperation)({
        summary: '이미지 업로드',
        description: '단일 이미지를 업로드합니다.',
    }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
                folder: {
                    type: 'string',
                    description: '저장할 폴더 (선택사항)',
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: '이미지 업로드 성공',
        schema: {
            type: 'object',
            properties: {
                url: { type: 'string' },
                path: { type: 'string' },
                bucket: { type: 'string' },
            },
        },
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)('folder')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "uploadImage", null);
__decorate([
    (0, common_1.Post)('images'),
    (0, user_rate_limit_decorator_1.UserRateLimit)({ points: 10, duration: 60 }),
    (0, swagger_1.ApiOperation)({
        summary: '다중 이미지 업로드',
        description: '여러 이미지를 한번에 업로드합니다.',
    }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                files: {
                    type: 'array',
                    items: {
                        type: 'string',
                        format: 'binary',
                    },
                },
                folder: {
                    type: 'string',
                    description: '저장할 폴더 (선택사항)',
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: '이미지 업로드 성공',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    url: { type: 'string' },
                    path: { type: 'string' },
                    bucket: { type: 'string' },
                },
            },
        },
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 10)),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Body)('folder')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, String]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "uploadMultipleImages", null);
__decorate([
    (0, common_1.Delete)('image'),
    (0, user_rate_limit_decorator_1.UserRateLimit)({ points: 30, duration: 60 }),
    (0, swagger_1.ApiOperation)({
        summary: '이미지 삭제',
        description: '업로드된 이미지를 삭제합니다.',
    }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: '삭제할 이미지 경로',
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '이미지 삭제 성공' }),
    __param(0, (0, common_1.Body)('path')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "deleteImage", null);
__decorate([
    (0, common_1.Delete)('images'),
    (0, user_rate_limit_decorator_1.UserRateLimit)({ points: 10, duration: 60 }),
    (0, swagger_1.ApiOperation)({
        summary: '다중 이미지 삭제',
        description: '여러 이미지를 한번에 삭제합니다.',
    }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                paths: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '삭제할 이미지 경로 배열',
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '이미지 삭제 성공' }),
    __param(0, (0, common_1.Body)('paths')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "deleteMultipleImages", null);
exports.UploadController = UploadController = __decorate([
    (0, swagger_1.ApiTags)('upload'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('upload'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [upload_service_1.UploadService])
], UploadController);
//# sourceMappingURL=upload.controller.js.map