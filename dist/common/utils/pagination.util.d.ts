import { PaginationDto, PaginatedResponse } from '../dto/pagination.dto';
export declare class PaginationUtil {
    static getRange(page: number, limit: number): {
        from: number;
        to: number;
    };
    static getOffset(page: number, limit: number): number;
    static createResponse<T>(data: T[], total: number, paginationDto: PaginationDto): PaginatedResponse<T>;
}
