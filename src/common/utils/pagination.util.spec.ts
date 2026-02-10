import { PaginationUtil } from './pagination.util';

describe('PaginationUtil', () => {
  it('should calculate range correctly', () => {
    expect(PaginationUtil.getRange(1, 10)).toEqual({ from: 0, to: 9 });
    expect(PaginationUtil.getRange(2, 10)).toEqual({ from: 10, to: 19 });
  });

  it('should calculate offset correctly', () => {
    expect(PaginationUtil.getOffset(3, 5)).toBe(10);
  });

  it('should create pagination response', () => {
    const response = PaginationUtil.createResponse([{ id: 1 }], 21, {
      page: 2,
      limit: 10,
    });

    expect(response.data).toHaveLength(1);
    expect(response.pagination.totalPages).toBe(3);
    expect(response.pagination.hasNext).toBe(true);
    expect(response.pagination.hasPrev).toBe(true);
  });
});
