import { HttpException, HttpStatus } from '@nestjs/common';
export declare class BusinessException extends HttpException {
    constructor(message: string, errorCode: string, statusCode?: HttpStatus, details?: Record<string, any>);
}
export declare class ResourceNotFoundException extends BusinessException {
    constructor(resource: string, identifier: string | number);
}
export declare class InsufficientPermissionException extends BusinessException {
    constructor(requiredPermission?: string);
}
export declare class InvalidRequestException extends BusinessException {
    constructor(message: string, details?: Record<string, any>);
}
export declare class DuplicateResourceException extends BusinessException {
    constructor(resource: string, field: string, value: any);
}
