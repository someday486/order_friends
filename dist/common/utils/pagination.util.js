"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationUtil = void 0;
const pagination_dto_1 = require("../dto/pagination.dto");
class PaginationUtil {
    static getRange(page, limit) {
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        return { from, to };
    }
    static getOffset(page, limit) {
        return (page - 1) * limit;
    }
    static createResponse(data, total, paginationDto) {
        const { page = 1, limit = 20 } = paginationDto;
        const pagination = new pagination_dto_1.PaginationMeta(page, limit, total);
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
exports.PaginationUtil = PaginationUtil;
//# sourceMappingURL=pagination.util.js.map