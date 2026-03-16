import {
  getBranchOrderConfig,
  saveBranchOrderConfig,
} from './branch-order-config.util';

describe('branch-order-config.util', () => {
  it('should create missing fulfillment channels when enabled types are expanded', async () => {
    const selectEq = jest.fn().mockResolvedValue({
      data: [{ id: 'ch-pickup', type: 'PICKUP', is_active: true }],
      error: null,
    });
    const orderChannelSelectBuilder = {
      select: jest.fn().mockReturnValue({
        eq: selectEq,
      }),
    };

    const insertSpy = jest.fn().mockResolvedValue({ error: null });
    const orderChannelInsertBuilder = {
      insert: insertSpy,
    };

    const sb = {
      from: jest
        .fn()
        .mockReturnValueOnce(orderChannelSelectBuilder)
        .mockReturnValueOnce(orderChannelInsertBuilder),
    };

    await saveBranchOrderConfig(sb, 'branch-1', {
      enabledFulfillmentTypes: ['PICKUP', 'DINE_IN'],
    });

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_id: 'branch-1',
        type: 'DINE_IN',
        slug: 'branch-1-dine-in',
        is_active: true,
      }),
    );
  });

  it('should fallback to insert without slug when slug insert fails', async () => {
    const selectEq = jest.fn().mockResolvedValue({
      data: [{ id: 'ch-pickup', type: 'PICKUP', is_active: true }],
      error: null,
    });
    const orderChannelSelectBuilder = {
      select: jest.fn().mockReturnValue({
        eq: selectEq,
      }),
    };

    const insertWithSlugSpy = jest.fn().mockResolvedValue({
      error: { message: 'column "slug" does not exist' },
    });
    const insertFallbackSpy = jest.fn().mockResolvedValue({ error: null });

    const sb = {
      from: jest
        .fn()
        .mockReturnValueOnce(orderChannelSelectBuilder)
        .mockReturnValueOnce({ insert: insertWithSlugSpy })
        .mockReturnValueOnce({ insert: insertFallbackSpy }),
    };

    await saveBranchOrderConfig(sb, 'branch-1', {
      enabledFulfillmentTypes: ['PICKUP', 'DELIVERY'],
    });

    expect(insertWithSlugSpy).toHaveBeenCalledTimes(1);
    expect(insertFallbackSpy).toHaveBeenCalledTimes(1);
    expect(insertFallbackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_id: 'branch-1',
        type: 'DELIVERY',
        is_active: true,
      }),
    );
  });

  it('should toggle active flag on existing channels', async () => {
    const selectEq = jest.fn().mockResolvedValue({
      data: [
        { id: 'ch-pickup', type: 'PICKUP', is_active: true },
        { id: 'ch-delivery', type: 'DELIVERY', is_active: false },
      ],
      error: null,
    });
    const orderChannelSelectBuilder = {
      select: jest.fn().mockReturnValue({
        eq: selectEq,
      }),
    };

    const updateEqSpy = jest.fn().mockResolvedValue({ error: null });
    const updateSpy = jest.fn().mockReturnValue({
      eq: updateEqSpy,
    });

    const sb = {
      from: jest
        .fn()
        .mockReturnValueOnce(orderChannelSelectBuilder)
        .mockReturnValueOnce({ update: updateSpy }),
    };

    await saveBranchOrderConfig(sb, 'branch-1', {
      enabledFulfillmentTypes: ['PICKUP', 'DELIVERY'],
    });

    expect(updateSpy).toHaveBeenCalledWith({ is_active: true });
    expect(updateEqSpy).toHaveBeenCalledWith('id', 'ch-delivery');
  });

  it('should persist pickup time config into branch metadata', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { id: 'branch-1', metadata: { existing: true } },
      error: null,
    });
    const selectEq = jest.fn().mockReturnValue({
      maybeSingle,
    });
    const selectBuilder = {
      select: jest.fn().mockReturnValue({
        eq: selectEq,
      }),
    };

    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({
      eq: updateEq,
    });
    const updateBuilder = {
      update,
    };

    const sb = {
      from: jest
        .fn()
        .mockReturnValueOnce(selectBuilder)
        .mockReturnValueOnce(updateBuilder),
    };

    await saveBranchOrderConfig(sb, 'branch-1', {
      pickupTimeConfig: {
        startTime: '09:00',
        endTime: '21:00',
      },
    });

    expect(update).toHaveBeenCalledWith({
      metadata: {
        existing: true,
        pickupTimeConfig: {
          startTime: '09:00',
          endTime: '21:00',
        },
        pickup_time_config: {
          start_time: '09:00',
          end_time: '21:00',
        },
      },
    });
    expect(updateEq).toHaveBeenCalledWith('id', 'branch-1');
  });

  it('should read transfer account and pickup time config from top-level json columns', async () => {
    const orderChannelsActiveEq = jest.fn().mockResolvedValue({
      data: [{ id: 'ch-pickup', type: 'PICKUP', is_active: true }],
      error: null,
    });
    const orderChannelsBranchEq = jest.fn().mockReturnValue({
      eq: orderChannelsActiveEq,
    });
    const orderChannelsBuilder = {
      select: jest.fn().mockReturnValue({
        eq: orderChannelsBranchEq,
      }),
    };

    const branchMaybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'branch-1',
        transfer_account: {
          bank_name: '국민은행',
          account_number: '123-456',
          account_holder: '홍길동',
        },
        pickup_time_config: {
          start_time: '09:00',
          end_time: '21:00',
        },
      },
      error: null,
    });
    const branchBuilder = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: branchMaybeSingle,
        }),
      }),
    };

    const sb = {
      from: jest
        .fn()
        .mockReturnValueOnce(orderChannelsBuilder)
        .mockReturnValueOnce(branchBuilder),
    };

    const result = await getBranchOrderConfig(sb, 'branch-1');

    expect(result.transferAccount).toEqual({
      bankName: '국민은행',
      accountNumber: '123-456',
      accountHolder: '홍길동',
    });
    expect(result.pickupTimeConfig).toEqual({
      startTime: '09:00',
      endTime: '21:00',
    });
  });

  it('should persist branch config into top-level json columns when present', async () => {
    const transferMaybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'branch-1',
        transfer_account: null,
      },
      error: null,
    });
    const pickupMaybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'branch-1',
        pickup_time_config: null,
      },
      error: null,
    });

    const transferSelectBuilder = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: transferMaybeSingle,
        }),
      }),
    };
    const pickupSelectBuilder = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: pickupMaybeSingle,
        }),
      }),
    };

    const transferUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    const pickupUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    const sb = {
      from: jest
        .fn()
        .mockReturnValueOnce(transferSelectBuilder)
        .mockReturnValueOnce({ update: transferUpdate })
        .mockReturnValueOnce(pickupSelectBuilder)
        .mockReturnValueOnce({ update: pickupUpdate }),
    };

    await saveBranchOrderConfig(sb, 'branch-1', {
      transferAccount: {
        bankName: '국민은행',
        accountNumber: '123-456',
        accountHolder: '홍길동',
      },
      pickupTimeConfig: {
        startTime: '09:00',
        endTime: '21:00',
      },
    });

    expect(transferUpdate).toHaveBeenCalledWith({
      transfer_account: {
        bank_name: '국민은행',
        account_number: '123-456',
        account_holder: '홍길동',
      },
    });
    expect(pickupUpdate).toHaveBeenCalledWith({
      pickup_time_config: {
        start_time: '09:00',
        end_time: '21:00',
      },
    });
  });
});
