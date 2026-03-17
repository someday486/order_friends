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
          businessHours: null,
          business_hours: null,
        },
        pickup_time_config: {
          start_time: '09:00',
          end_time: '21:00',
          businessHours: null,
          business_hours: null,
        },
      },
    });
    expect(updateEq).toHaveBeenCalledWith('id', 'branch-1');
  });

  it('should persist business hours into branch metadata', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { id: 'branch-1', metadata: { existing: true } },
      error: null,
    });
    const selectBuilder = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle,
        }),
      }),
    };

    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({
      eq: updateEq,
    });

    const sb = {
      from: jest
        .fn()
        .mockReturnValueOnce(selectBuilder)
        .mockReturnValueOnce({ update }),
    };

    await saveBranchOrderConfig(sb, 'branch-1', {
      businessHours: {
        monday: {
          isOpen: false,
          openTime: null,
          closeTime: null,
        },
        tuesday: {
          isOpen: true,
          openTime: '09:00',
          closeTime: '18:00',
        },
      },
    });

    expect(update).toHaveBeenCalledWith({
      metadata: {
        existing: true,
        businessHours: {
          monday: {
            isOpen: false,
            openTime: null,
            closeTime: null,
          },
          tuesday: {
            isOpen: true,
            openTime: '09:00',
            closeTime: '18:00',
          },
        },
        business_hours: {
          monday: {
            is_open: false,
            open_time: null,
            close_time: null,
          },
          tuesday: {
            is_open: true,
            open_time: '09:00',
            close_time: '18:00',
          },
        },
        weeklySchedule: {
          monday: {
            isOpen: false,
            openTime: null,
            closeTime: null,
          },
          tuesday: {
            isOpen: true,
            openTime: '09:00',
            closeTime: '18:00',
          },
        },
        weekly_schedule: {
          monday: {
            is_open: false,
            open_time: null,
            close_time: null,
          },
          tuesday: {
            is_open: true,
            open_time: '09:00',
            close_time: '18:00',
          },
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

  it('should read business hours from metadata', async () => {
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
        metadata: {
          businessHours: {
            monday: {
              isOpen: false,
              openTime: null,
              closeTime: null,
            },
            tuesday: {
              isOpen: true,
              openTime: '09:00',
              closeTime: '18:00',
            },
          },
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

    expect(result.businessHours).toEqual({
      monday: {
        isOpen: false,
        openTime: null,
        closeTime: null,
      },
      tuesday: {
        isOpen: true,
        openTime: '09:00',
        closeTime: '18:00',
      },
    });
  });

  it('should read business hours from pickup_time_config json column', async () => {
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
        pickup_time_config: {
          start_time: '09:00',
          end_time: '21:00',
          business_hours: {
            monday: {
              is_open: false,
              open_time: null,
              close_time: null,
            },
            tuesday: {
              is_open: true,
              open_time: '09:00',
              close_time: '18:00',
            },
          },
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

    expect(result.businessHours).toEqual({
      monday: {
        isOpen: false,
        openTime: null,
        closeTime: null,
      },
      tuesday: {
        isOpen: true,
        openTime: '09:00',
        closeTime: '18:00',
      },
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
        businessHours: null,
        business_hours: null,
      },
    });
  });

  it('should persist business hours into pickup_time_config when that is the available config column', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'branch-1',
        pickup_time_config: {
          start_time: '09:00',
          end_time: '21:00',
        },
      },
      error: null,
    });

    const selectBuilder = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle,
        }),
      }),
    };

    const update = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    const sb = {
      from: jest
        .fn()
        .mockReturnValueOnce(selectBuilder)
        .mockReturnValueOnce({ update }),
    };

    await saveBranchOrderConfig(sb, 'branch-1', {
      businessHours: {
        monday: {
          isOpen: false,
          openTime: null,
          closeTime: null,
        },
        tuesday: {
          isOpen: true,
          openTime: '09:00',
          closeTime: '18:00',
        },
      },
    });

    expect(update).toHaveBeenCalledWith({
      pickup_time_config: {
        start_time: '09:00',
        end_time: '21:00',
        businessHours: {
          monday: {
            isOpen: false,
            openTime: null,
            closeTime: null,
          },
          tuesday: {
            isOpen: true,
            openTime: '09:00',
            closeTime: '18:00',
          },
        },
        business_hours: {
          monday: {
            is_open: false,
            open_time: null,
            close_time: null,
          },
          tuesday: {
            is_open: true,
            open_time: '09:00',
            close_time: '18:00',
          },
        },
      },
    });
  });

  it('should read order notice from top-level text column', async () => {
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
        order_notice: '포장은 20분 전에 미리 주문해 주세요.',
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

    expect(result.orderNotice).toBe('포장은 20분 전에 미리 주문해 주세요.');
  });

  it('should persist order notice into top-level text column when present', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'branch-1',
        order_notice: null,
      },
      error: null,
    });

    const selectBuilder = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle,
        }),
      }),
    };

    const update = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    const sb = {
      from: jest
        .fn()
        .mockReturnValueOnce(selectBuilder)
        .mockReturnValueOnce({ update }),
    };

    await saveBranchOrderConfig(sb, 'branch-1', {
      orderNotice: '재료 소진 시 일부 메뉴가 조기 마감될 수 있습니다.',
    });

    expect(update).toHaveBeenCalledWith({
      order_notice: '재료 소진 시 일부 메뉴가 조기 마감될 수 있습니다.',
    });
  });

  it('should fallback to metadata when direct order notice update fails', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'branch-1',
        order_notice: null,
        metadata: { existing: true },
      },
      error: null,
    });

    const selectBuilder = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle,
        }),
      }),
    };

    const directUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        error: { message: 'column "order_notice" does not exist' },
      }),
    });
    const metadataUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    const sb = {
      from: jest
        .fn()
        .mockReturnValueOnce(selectBuilder)
        .mockReturnValueOnce({ update: directUpdate })
        .mockReturnValueOnce({ update: metadataUpdate }),
    };

    await saveBranchOrderConfig(sb, 'branch-1', {
      orderNotice: '공지사항 테스트',
    });

    expect(directUpdate).toHaveBeenCalledWith({
      order_notice: '공지사항 테스트',
    });
    expect(metadataUpdate).toHaveBeenCalledWith({
      metadata: {
        existing: true,
        orderNotice: '공지사항 테스트',
        order_notice: '공지사항 테스트',
        notice: '공지사항 테스트',
        announcement: '공지사항 테스트',
      },
    });
  });
});
