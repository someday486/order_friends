import { DepositSyncService } from './deposit-sync.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('DepositSyncService', () => {
  let service: DepositSyncService;
  let branchesChain: any;
  let ordersChain: any;
  let paymentsChain: any;
  let depositMatchRowsChain: any;
  let orderStatusHistoryChain: any;
  let mockSb: any;

  const makeChain = () => ({
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    lt: jest.fn(),
    not: jest.fn().mockReturnThis(),
  });

  beforeEach(() => {
    branchesChain = makeChain();
    ordersChain = makeChain();
    paymentsChain = makeChain();
    depositMatchRowsChain = makeChain();
    orderStatusHistoryChain = makeChain();

    mockSb = {
      from: jest.fn((table: string) => {
        if (table === 'branches') return branchesChain;
        if (table === 'orders') return ordersChain;
        if (table === 'payments') return paymentsChain;
        if (table === 'deposit_match_rows') return depositMatchRowsChain;
        if (table === 'order_status_history') return orderStatusHistoryChain;
        return ordersChain;
      }),
    };

    service = new DepositSyncService({
      adminClient: jest.fn(() => mockSb),
    } as unknown as SupabaseService);
  });

  it('findCandidateOrders should keep only transfer payments', async () => {
    ordersChain.lt.mockResolvedValueOnce({
      data: [
        {
          id: 'o-transfer',
          branch_id: 'b1',
          status: 'CREATED',
          customer_name: 'LEE SUK',
        },
        {
          id: 'o-cash',
          branch_id: 'b1',
          status: 'CREATED',
          customer_name: 'LEE SUK',
        },
      ],
      error: null,
    });
    paymentsChain.in.mockResolvedValueOnce({
      data: [
        {
          order_id: 'o-transfer',
          payment_method: 'TRANSFER',
          status: 'PENDING',
        },
        { order_id: 'o-cash', payment_method: 'CASH', status: 'PENDING' },
      ],
      error: null,
    });

    const result = await (service as any).findCandidateOrders({
      branch_ids: ['b1'],
      deposit_date: '2026-03-24',
      amount: 10000,
      depositor_name_normalized: 'leesuk',
    });

    expect(result).toEqual([
      {
        id: 'o-transfer',
        branch_id: 'b1',
        status: 'CREATED',
        customer_name: 'LEE SUK',
      },
    ]);
  });

  it('matchPendingRow should match against all branches sharing the same sheet', async () => {
    ordersChain.lt.mockResolvedValueOnce({
      data: [
        {
          id: 'order-pangyo',
          branch_id: 'pangyo-branch',
          status: 'CREATED',
          customer_name: '김한나',
        },
      ],
      error: null,
    });
    paymentsChain.in.mockResolvedValueOnce({
      data: [
        {
          order_id: 'order-pangyo',
          payment_method: 'TRANSFER',
          status: 'PENDING',
        },
      ],
      error: null,
    });
    paymentsChain.limit.mockResolvedValueOnce({
      data: [{ id: 'payment-1' }],
      error: null,
    });
    ordersChain.maybeSingle
      .mockResolvedValueOnce({
        data: { id: 'order-pangyo', status: 'CONFIRMED' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'order-pangyo', status: 'PREPARING' },
        error: null,
      });
    depositMatchRowsChain.eq
      .mockReturnValueOnce(depositMatchRowsChain)
      .mockResolvedValueOnce({ error: null });

    await (service as any).matchPendingRow(
      {
        id: 'deposit-row-1',
        branch_id: 'bundang-branch',
        spreadsheet_id: 'sheet-1',
        sheet_name: '시트1',
        deposit_date: '2026-03-24',
        amount: 64000,
        depositor_name: '김한나',
        depositor_name_normalized: '김한나',
        row_number: 22,
      },
      new Map([['sheet-1::시트1', ['bundang-branch', 'pangyo-branch']]]),
    );

    expect(ordersChain.in).toHaveBeenCalledWith('branch_id', [
      'bundang-branch',
      'pangyo-branch',
    ]);
    expect(ordersChain.update).toHaveBeenNthCalledWith(1, {
      status: 'CONFIRMED',
    });
    expect(ordersChain.update).toHaveBeenNthCalledWith(2, {
      status: 'PREPARING',
    });
    expect(depositMatchRowsChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        match_status: 'MATCHED',
        branch_id: 'pangyo-branch',
        matched_order_id: 'order-pangyo',
      }),
    );
  });
});
