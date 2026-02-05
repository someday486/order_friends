"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuplicateResourceException = exports.InvalidRequestException = exports.InsufficientPermissionException = exports.ResourceNotFoundException = exports.BusinessException = void 0;
const common_1 = require("@nestjs/common");
class BusinessException extends common_1.HttpException {
    constructor(message, errorCode, statusCode = common_1.HttpStatus.BAD_REQUEST, details) {
        super({
            statusCode,
            message,
            error: errorCode,
            details,
        }, statusCode);
    }
}
exports.BusinessException = BusinessException;
class ResourceNotFoundException extends BusinessException {
    constructor(resource, identifier) {
        super(`${resource} not found`, 'RESOURCE_NOT_FOUND', common_1.HttpStatus.NOT_FOUND, {
            resource,
            identifier,
        });
    }
}
exports.ResourceNotFoundException = ResourceNotFoundException;
class InsufficientPermissionException extends BusinessException {
    constructor(requiredPermission) {
        super('Insufficient permission to perform this action', 'INSUFFICIENT_PERMISSION', common_1.HttpStatus.FORBIDDEN, { requiredPermission });
    }
}
exports.InsufficientPermissionException = InsufficientPermissionException;
class InvalidRequestException extends BusinessException {
    constructor(message, details) {
        super(message, 'INVALID_REQUEST', common_1.HttpStatus.BAD_REQUEST, details);
    }
}
exports.InvalidRequestException = InvalidRequestException;
class DuplicateResourceException extends BusinessException {
    constructor(resource, field, value) {
        super(`${resource} with ${field} '${value}' already exists`, 'DUPLICATE_RESOURCE', common_1.HttpStatus.CONFLICT, { resource, field, value });
    }
}
exports.DuplicateResourceException = DuplicateResourceException;
//# sourceMappingURL=business.exception.js.map