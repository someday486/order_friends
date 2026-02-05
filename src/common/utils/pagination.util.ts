import {
  PaginationDto,
  PaginatedResponse,
  PaginationMeta,
} from '../dto/pagination.dto';

export class PaginationUtil {
  /**
   * Supabase range 계산
   * @param page 페이지 번호 (1부터 시작)
   * @param limit 페이지당 항목 수
   * @returns {from, to} range 값
   */
  static getRange(page: number, limit: number): { from: number; to: number } {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    return { from, to };
  }

  /**
   * Offset 계산
   * @param page 페이지 번호 (1부터 시작)
   * @param limit 페이지당 항목 수
   * @returns offset 값
   */
  static getOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  /**
   * 페이지네이션 응답 생성
   * @param data 데이터 배열
   * @param total 전체 항목 수
   * @param paginationDto 페이지네이션 DTO
   * @returns 페이지네이션 응답
   */
  static createResponse<T>(
    data: T[],
    total: number,
    paginationDto: PaginationDto,
  ): PaginatedResponse<T> {
    const { page = 1, limit = 20 } = paginationDto;
    const pagination = new PaginationMeta(page, limit, total);

    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasNext: pagination.hasNext,
        hasPrev: pagination.hasPrev,
      },
    };
  }
}
