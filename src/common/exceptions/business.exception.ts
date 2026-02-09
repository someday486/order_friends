import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 비즈니스 로직 예외의 기본 클래스
 */
export class BusinessException extends HttpException {
  constructor(
    message: string,
    errorCode: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, any>,
  ) {
    super(
      {
        statusCode,
        message,
        error: errorCode,
        details,
      },
      statusCode,
    );
  }
}

/**
 * 리소스를 찾을 수 없을 때 사용
 */
export class ResourceNotFoundException extends BusinessException {
  constructor(resource: string, identifier: string | number) {
    super(`${resource} not found`, 'RESOURCE_NOT_FOUND', HttpStatus.NOT_FOUND, {
      resource,
      identifier,
    });
  }
}

/**
 * 권한 부족 예외
 */
export class InsufficientPermissionException extends BusinessException {
  constructor(requiredPermission?: string) {
    super(
      'Insufficient permission to perform this action',
      'INSUFFICIENT_PERMISSION',
      HttpStatus.FORBIDDEN,
      { requiredPermission },
    );
  }
}

/**
 * 잘못된 요청 데이터
 */
export class InvalidRequestException extends BusinessException {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'INVALID_REQUEST', HttpStatus.BAD_REQUEST, details);
  }
}

/**
 * 중복 리소스
 */
export class DuplicateResourceException extends BusinessException {
  constructor(resource: string, field: string, value: any) {
    super(
      `${resource} with ${field} '${value}' already exists`,
      'DUPLICATE_RESOURCE',
      HttpStatus.CONFLICT,
      { resource, field, value },
    );
  }
}
