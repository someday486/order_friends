import { BadRequestException } from '@nestjs/common';
import { ExportsService } from './exports.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('ExportsService', () => {
  let service: ExportsService;
  let mockSb: any;
  let orderExportsChain: any;

  beforeEach(() => {
    orderExportsChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    };

    mockSb = {
      from: jest.fn((table: string) => {
        if (table === 'order_exports') return orderExportsChain;
        return null;
      }),
    };

    const supabaseService = {
      adminClient: jest.fn(() => mockSb),
    };

    service = new ExportsService(supabaseService as SupabaseService);
  });

  it('normalizeDateForRpc should normalize date-only start and end boundaries', () => {
    const start = (service as any).normalizeDateForRpc('2026-01-15', false);
    const end = (service as any).normalizeDateForRpc('2026-01-15', true);

    expect(start).toBe('2026-01-15T00:00:00.000Z');
    expect(end).toBe('2026-01-15T23:59:59.999Z');
  });

  it('normalizeDateForRpc should return null for invalid values', () => {
    expect((service as any).normalizeDateForRpc('not-a-date', false)).toBeNull();
    expect((service as any).normalizeDateForRpc(null, true)).toBeNull();
  });

  it('buildOrdersCsv should include notice line when rows reach 5000', () => {
    const rows = Array.from({ length: 5000 }, (_, index) => ({
      orderNo: `ORD-${index}`,
      branchName: '강남점',
      orderedAt: '2026-01-15T10:00:00.000Z',
      status: 'PAID',
      totalAmount: 10000,
      itemsSummary: '아메리카노 1',
    }));

    const csv = (service as any).buildOrdersCsv(rows);

    expect(csv.startsWith('\uFEFF# 안내: 최대 5000건까지만 다운로드됩니다.')).toBe(true);
  });

  it('createOrderExportJob should normalize date filters before persisting params', async () => {
    orderExportsChain.single.mockResolvedValueOnce({
      data: {
        id: 'export-1',
        user_id: 'user-1',
        status: 'PENDING',
        created_at: '2026-01-15T00:00:00.000Z',
        updated_at: '2026-01-15T00:00:00.000Z',
      },
      error: null,
    });

    const processSpy = jest
      .spyOn(service, 'processOrderExport')
      .mockResolvedValueOnce(undefined);

    await service.createOrderExportJob('user-1', {
      format: 'csv',
      filters: {
        dateStart: '2026-01-15',
        dateEnd: '2026-01-20',
        status: 'PAID',
      },
    });

    expect(orderExportsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          dateStart: '2026-01-15T00:00:00.000Z',
          dateEnd: '2026-01-20T23:59:59.999Z',
          status: 'PAID',
        }),
      }),
    );
    expect(processSpy).toHaveBeenCalledWith('export-1');
  });

  it('createOrderExportJob should throw for invalid format', async () => {
    await expect(
      service.createOrderExportJob('user-1', {
        format: 'pdf' as any,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
