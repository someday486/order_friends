import { PaginationDto, PaginatedResponse, PaginationMeta } from '../dto/pagination.dto';

export class PaginationUtil {
  /**
   * 페이지네이션 응답 생성
   */
  static createResponse<T>(
    data: T[],
    total: number,
    paginationDto: PaginationDto,
  ): PaginatedResponse<T> {
    const { page = 1, limit = 20 } = paginationDto;
    const meta = new PaginationMeta(page, limit, total);

    return {
      data,
      pagination: {
        page: meta.page,
        limit: meta.limit,
        total: meta.total,
        totalPages: meta.totalPages,
        hasNext: meta.hasNext,
        hasPrev: meta.hasPrev,
      },
    };
  }

  /**
   * offset 계산
   */
  static getOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  /**
   * range 계산 (Supabase용)
   */
  static getRange(page: number, limit: number): { from: number; to: number } {
    const offset = this.getOffset(page, limit);
    return {
      from: offset,
      to: offset + limit - 1,
    };
  }
}
