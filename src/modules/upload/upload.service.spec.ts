import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from './upload.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

type TableRow = Record<string, any>;
type TableStore = Record<string, TableRow[]>;

let mockIdSequence = 0;

function nextId(prefix: string) {
  mockIdSequence += 1;
  return `${prefix}-${mockIdSequence}`;
}

class InMemoryQueryBuilder {
  private mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private filters: Array<(row: TableRow) => boolean> = [];
  private orderBy:
    | {
        column: string;
        ascending: boolean;
      }
    | undefined;
  private limitCount: number | undefined;
  private payload: TableRow[] | TableRow | null = null;

  constructor(
    private readonly tables: TableStore,
    private readonly tableName: string,
  ) {}

  select(columns = '*') {
    void columns;
    return this;
  }

  insert(payload: TableRow[] | TableRow) {
    this.mode = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: TableRow) {
    this.mode = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.mode = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    const lookup = new Set(values);
    this.filters.push((row) => lookup.has(row[column]));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = {
      column,
      ascending: options?.ascending ?? true,
    };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    const result = this.execute();
    if (result.error) {
      return Promise.resolve(result);
    }

    const rows = Array.isArray(result.data) ? result.data : [];
    if (rows.length !== 1) {
      return Promise.resolve({
        data: null,
        error: { message: `Expected single row for ${this.tableName}` },
      });
    }

    return Promise.resolve({ data: rows[0], error: null });
  }

  maybeSingle() {
    const result = this.execute();
    if (result.error) {
      return Promise.resolve(result);
    }

    const rows = Array.isArray(result.data) ? result.data : [];
    if (rows.length === 0) {
      return Promise.resolve({ data: null, error: null });
    }
    if (rows.length > 1) {
      return Promise.resolve({
        data: null,
        error: { message: `Expected at most one row for ${this.tableName}` },
      });
    }

    return Promise.resolve({ data: rows[0], error: null });
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: TableRow[];
          error: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private getTable(): TableRow[] {
    if (!this.tables[this.tableName]) {
      this.tables[this.tableName] = [];
    }

    return this.tables[this.tableName];
  }

  private cloneRows(rows: TableRow[]) {
    return rows.map((row) => ({ ...row }));
  }

  private applyFilters(rows: TableRow[]) {
    let next = [...rows];

    if (this.filters.length > 0) {
      next = next.filter((row) => this.filters.every((filter) => filter(row)));
    }

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      next.sort((left, right) => {
        const leftValue = left[column];
        const rightValue = right[column];
        const comparison = String(leftValue ?? '').localeCompare(
          String(rightValue ?? ''),
        );
        return ascending ? comparison : -comparison;
      });
    }

    if (typeof this.limitCount === 'number') {
      next = next.slice(0, this.limitCount);
    }

    return next;
  }

  private executeInsert() {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
    const table = this.getTable();
    const inserted = rows.map((row) => {
      const nextRow = {
        ...row,
        id: row.id ?? nextId(this.tableName),
      };

      if (this.tableName === 'procurement_import_batches') {
        nextRow.uploaded_at = nextRow.uploaded_at ?? new Date().toISOString();
      }

      table.push(nextRow);
      return nextRow;
    });

    return { data: this.cloneRows(inserted), error: null };
  }

  private executeUpdate() {
    const updates = (this.payload ?? {}) as TableRow;
    const matched = this.applyFilters(this.getTable());
    matched.forEach((row) => Object.assign(row, updates));
    return { data: this.cloneRows(matched), error: null };
  }

  private executeDelete() {
    const table = this.getTable();
    const matched = this.applyFilters(table);
    const matchedIds = new Set(matched.map((row) => row.id));

    this.tables[this.tableName] = table.filter(
      (row) => !matchedIds.has(row.id),
    );

    if (this.tableName === 'procurement_import_batches') {
      const batchIdLookup = new Set(matched.map((row) => row.id));
      this.tables.procurement_import_batch_lines = (
        this.tables.procurement_import_batch_lines ?? []
      ).filter((row) => !batchIdLookup.has(row.batch_id));
    }

    return { data: this.cloneRows(matched), error: null };
  }

  private executeSelect() {
    return {
      data: this.cloneRows(this.applyFilters(this.getTable())),
      error: null,
    };
  }

  private execute() {
    if (this.mode === 'insert') {
      return this.executeInsert();
    }

    if (this.mode === 'update') {
      return this.executeUpdate();
    }

    if (this.mode === 'delete') {
      return this.executeDelete();
    }

    return this.executeSelect();
  }
}

describe('UploadService', () => {
  let service: UploadService;
  let tables: TableStore;

  const mockStorageClient = {
    upload: jest.fn(),
    remove: jest.fn(),
    getPublicUrl: jest.fn(),
  };

  let adminClientMock: jest.Mock;

  const createAdminClient = () => ({
    storage: {
      from: jest.fn().mockReturnValue(mockStorageClient),
    },
    from: jest.fn(
      (tableName: string) => new InMemoryQueryBuilder(tables, tableName),
    ),
  });

  const createDto = () => ({
    brandId: 'brand-1',
    supplierId: 'sup-1',
    supplierName: '공급처',
    orderDate: '2026-03-31',
    fileName: 'sample.xlsx',
    headerRowIndex: 0,
    sourceHeaders: ['업체주문번호', '품목명', '수량'],
    rows: [
      {
        merchantOrderNo: 'OF-001',
        productName: '제주 감귤',
        quantity: 2,
        recipientName: '홍길동',
        recipientPhone: '010-1111-2222',
        recipientAddress: '서울 중구 1',
        recipientZipCode: '04524',
        deliveryMessage: '문 앞에 놔주세요',
        productCode: 'FRUIT-001',
        customerOrderNo: 'CUST-1',
        unitPrice: 15000,
        lineAmount: 30000,
      },
    ],
  });

  beforeEach(async () => {
    mockIdSequence = 0;
    tables = {
      brand_members: [
        { brand_id: 'brand-1', user_id: 'user-1', status: 'ACTIVE' },
      ],
      brands: [{ id: 'brand-1', owner_user_id: 'owner-1' }],
      procurement_suppliers: [],
      procurement_supplier_items: [],
      procurement_supplier_item_aliases: [],
      procurement_import_batches: [],
      procurement_import_batch_lines: [],
    };

    adminClientMock = jest.fn(() => createAdminClient());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: SupabaseService,
          useValue: {
            adminClient: adminClientMock,
          },
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
    jest.clearAllMocks();
  });

  describe('uploadImage', () => {
    const createMockFile = (
      mimetype: string,
      size: number,
      originalname: string,
    ): Express.Multer.File => ({
      fieldname: 'file',
      originalname,
      encoding: '7bit',
      mimetype,
      size,
      buffer: Buffer.from('test'),
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    });

    it('uploads a valid image', async () => {
      const mockFile = createMockFile('image/jpeg', 1024, 'test.jpg');

      mockStorageClient.upload.mockResolvedValue({
        data: { path: 'general/mock.jpg' },
        error: null,
      });
      mockStorageClient.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/general/mock.jpg' },
      });

      const result = await service.uploadImage(mockFile);

      expect(result.bucket).toBe('product-images');
      expect(result.path).toMatch(/^general\/.+\.jpg$/);
    });

    it('rejects invalid file type', async () => {
      const mockFile = createMockFile('application/pdf', 1024, 'test.pdf');

      await expect(service.uploadImage(mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('business order imports', () => {
    it('creates and lists procurement-backed import batches', async () => {
      const created = await service.createBusinessOrderImportBatch(
        'user-1',
        createDto(),
      );

      const listed = await service.listBusinessOrderImportBatches('user-1');

      expect(created.supplierName).toBe('공급처');
      expect(created.displayId).toMatch(/^UP-/);
      expect(created.status).toBe('작성중');
      expect(created.paymentStatus).toBe('후불 예정');
      expect(created.totalQty).toBe(2);
      expect(created.totalAmount).toBe(30000);
      expect(listed).toHaveLength(1);
      expect(listed[0].id).toBe(created.id);
      expect(tables.procurement_import_batches).toHaveLength(1);
      expect(tables.procurement_import_batch_lines).toHaveLength(1);
    });

    it('returns a single business order import batch by id', async () => {
      const created = await service.createBusinessOrderImportBatch(
        'user-1',
        createDto(),
      );

      const found = await service.getBusinessOrderImportBatch(
        'user-1',
        created.id,
      );

      expect(found.id).toBe(created.id);
      expect(found.fileName).toBe('sample.xlsx');
      expect(found.rows[0].customerOrderNo).toBe('CUST-1');
    });

    it('updates business order import batch status in metadata', async () => {
      const created = await service.createBusinessOrderImportBatch(
        'user-1',
        createDto(),
      );

      const updated = await service.updateBusinessOrderImportBatchStatus(
        'user-1',
        created.id,
        '확인대기',
      );

      expect(updated.status).toBe('확인대기');
      expect(
        tables.procurement_import_batches[0].source_metadata.workflowStatus,
      ).toBe('확인대기');
    });

    it('deletes a business order import batch and cascades lines', async () => {
      const created = await service.createBusinessOrderImportBatch(
        'user-1',
        createDto(),
      );

      await service.deleteBusinessOrderImportBatch('user-1', created.id);

      await expect(
        service.getBusinessOrderImportBatch('user-1', created.id),
      ).rejects.toThrow('업로드 주문서를 찾을 수 없습니다.');
      expect(tables.procurement_import_batches).toHaveLength(0);
      expect(tables.procurement_import_batch_lines).toHaveLength(0);
    });

    it('rejects duplicate merchant order numbers from previous uploads', async () => {
      await service.createBusinessOrderImportBatch('user-1', createDto());

      await expect(
        service.createBusinessOrderImportBatch('user-1', createDto()),
      ).rejects.toThrow(/중복된 업체주문번호/);
    });

    it('rejects duplicate merchant order numbers inside the same upload', async () => {
      const duplicatedDto = {
        ...createDto(),
        rows: [
          ...createDto().rows,
          {
            ...createDto().rows[0],
            productName: '한라봉',
          },
        ],
      };

      await expect(
        service.createBusinessOrderImportBatch('user-1', duplicatedDto as any),
      ).rejects.toThrow(/중복된 업체주문번호/);
    });

    it('rejects invalid business order import rows', async () => {
      const invalidDto = {
        ...createDto(),
        rows: [
          {
            merchantOrderNo: '',
            productName: '제주 감귤',
            quantity: 0,
            recipientName: '홍길동',
            recipientPhone: '010-1111-2222',
            recipientAddress: '서울 중구 1',
          },
        ],
      };

      await expect(
        service.createBusinessOrderImportBatch('user-1', invalidDto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('uses matched supplier item price when alias mapping exists', async () => {
      tables.procurement_suppliers.push({
        id: 'supplier-1',
        brand_id: 'brand-1',
        name: '공급처',
        supplier_code: 'sup-1',
      });
      tables.procurement_supplier_items.push({
        id: 'item-1',
        brand_id: 'brand-1',
        supplier_id: 'supplier-1',
        brand_product_id: 'brand-product-1',
        supplier_item_name: '성주 꿀참외 3kg',
        supplier_item_code: 'MATCH-001',
        current_unit_price: 28400,
        is_active: true,
      });
      tables.procurement_supplier_item_aliases.push({
        id: 'alias-1',
        brand_id: 'brand-1',
        supplier_id: 'supplier-1',
        supplier_item_id: 'item-1',
        alias_type: 'NAME',
        alias_value_normalized: '제주감귤',
        match_priority: 1,
      });

      const created = await service.createBusinessOrderImportBatch(
        'user-1',
        createDto(),
      );

      expect(created.supplierId).toBe('supplier-1');
      expect(created.rows[0].unitPrice).toBe(28400);
      expect(created.rows[0].lineAmount).toBe(56800);
      expect(created.totalAmount).toBe(56800);
      expect(tables.procurement_import_batches[0].matched_row_count).toBe(1);
      expect(tables.procurement_import_batch_lines[0].match_status).toBe(
        'MATCHED',
      );
      expect(tables.procurement_import_batch_lines[0].price_source).toBe(
        'SUPPLIER_ITEM',
      );
    });
  });
});
