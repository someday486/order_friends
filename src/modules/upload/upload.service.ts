import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type {
  CreateBusinessOrderImportBatchDto,
  CreateBusinessOrderImportRowDto,
} from './dto/business-order-import.dto';

export type BusinessOrderImportStatus =
  | '작성중'
  | '확인대기'
  | '출고준비'
  | '부분출고'
  | '정산대기';

export type BusinessOrderImportPaymentStatus =
  | '입금기 차감'
  | '후불 예정'
  | '입금 확인';

export interface BusinessOrderImportRow {
  merchantOrderNo: string;
  productName: string;
  quantity: number;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientZipCode?: string | null;
  deliveryMessage?: string | null;
  productCode?: string | null;
  customerOrderNo?: string | null;
  unitPrice: number | null;
  lineAmount: number | null;
}

export interface BusinessOrderImportBatch {
  id: string;
  brandId?: string;
  displayId?: string;
  createdByUserId: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  fileName: string;
  headerRowIndex: number;
  uploadedAt: string;
  rowCount: number;
  totalQty: number;
  totalAmount: number;
  itemSummary: string;
  rows: BusinessOrderImportRow[];
  status: BusinessOrderImportStatus;
  paymentStatus: BusinessOrderImportPaymentStatus;
}

function normalizeMerchantOrderNo(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export interface UploadResult {
  url: string;
  path: string;
  bucket: string;
}

type ProcurementSupplierRow = {
  id: string;
  brand_id: string;
  name: string;
  supplier_code: string | null;
};

type ProcurementSupplierItemRow = {
  id: string;
  brand_product_id: string;
  supplier_item_name: string;
  supplier_item_code: string | null;
  current_unit_price: number;
};

type ProcurementSupplierItemAliasRow = {
  supplier_item_id: string;
  alias_type: 'NAME' | 'CODE' | 'FREE_TEXT';
  alias_value_normalized: string;
  match_priority: number;
};

type ProcurementImportBatchRow = {
  id: string;
  brand_id: string;
  supplier_id: string;
  created_by: string;
  source_file_name: string;
  source_headers: unknown;
  source_metadata: Record<string, unknown> | null;
  order_date: string;
  header_row_index: number;
  row_count: number;
  matched_row_count: number;
  unmatched_row_count: number;
  conflict_row_count: number;
  total_amount: number;
  uploaded_at: string;
};

type ProcurementImportBatchLineRow = {
  batch_id: string;
  line_no: number;
  merchant_order_no: string;
  customer_order_no: string | null;
  supplier_product_name: string;
  supplier_product_code: string | null;
  quantity: number;
  recipient_name: string;
  recipient_phone: string;
  recipient_postcode: string | null;
  recipient_address: string;
  delivery_message: string | null;
  unit_price_snapshot: number | null;
  line_amount_snapshot: number | null;
};

type BusinessOrderImportBatchMetadata = {
  workflowStatus?: BusinessOrderImportStatus;
  paymentStatus?: BusinessOrderImportPaymentStatus;
  displayId?: string;
  legacySupplierId?: string | null;
};

type SupplierCatalogEntry = {
  supplierItemId: string;
  brandProductId: string;
  currentUnitPrice: number;
  priority: number;
};

type SupplierCatalog = {
  byName: Map<string, SupplierCatalogEntry[]>;
  byCode: Map<string, SupplierCatalogEntry[]>;
};

const DEFAULT_BUSINESS_ORDER_IMPORT_STATUS: BusinessOrderImportStatus =
  '작성중';
const DEFAULT_BUSINESS_ORDER_IMPORT_PAYMENT_STATUS: BusinessOrderImportPaymentStatus =
  '후불 예정';
const BUSINESS_ORDER_IMPORT_BATCH_LIMIT = 50;
const SUPPLIER_ITEM_NAME_PRIORITY = 50;
const SUPPLIER_ITEM_CODE_PRIORITY = 10;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly bucketName = 'product-images';
  private readonly allowedImageMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ];
  private readonly allowedBizCertMimeTypes = [
    ...this.allowedImageMimeTypes,
    'application/pdf',
  ];
  private readonly maxFileSize = 5 * 1024 * 1024;

  constructor(private readonly supabase: SupabaseService) {}

  private normalizeBusinessOrderLookupValue(value: string | null | undefined) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_\-()[\]]+/g, '');
  }

  private isUuid(value: string | null | undefined): boolean {
    return UUID_PATTERN.test(String(value || '').trim());
  }

  private formatUploadedAt(value: string | Date): string {
    const date = value instanceof Date ? value : new Date(value);
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return formatter.format(date).replace(',', '');
  }

  private buildDisplayId(value: Date): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(value);
    const lookup = new Map(parts.map((part) => [part.type, part.value]));

    return `UP-${lookup.get('year')}${lookup.get('month')}${lookup.get(
      'day',
    )}-${lookup.get('hour')}${lookup.get('minute')}${Math.floor(
      Math.random() * 90 + 10,
    )}`;
  }

  private readBatchMetadata(value: unknown): BusinessOrderImportBatchMetadata {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as BusinessOrderImportBatchMetadata;
  }

  private normalizeBusinessOrderImportRow(
    row: CreateBusinessOrderImportRowDto,
  ): BusinessOrderImportRow {
    const merchantOrderNo = String(row.merchantOrderNo || '').trim();
    const productName = String(row.productName || '').trim();
    const recipientName = String(row.recipientName || '').trim();
    const recipientPhone = String(row.recipientPhone || '').trim();
    const recipientAddress = String(row.recipientAddress || '').trim();

    if (
      !merchantOrderNo ||
      !productName ||
      !recipientName ||
      !recipientPhone ||
      !recipientAddress ||
      !Number.isFinite(row.quantity) ||
      row.quantity <= 0
    ) {
      throw new BadRequestException(
        '유효하지 않은 주문 행이 포함되어 있습니다.',
      );
    }

    const normalizedUnitPrice =
      typeof row.unitPrice === 'number' && Number.isFinite(row.unitPrice)
        ? row.unitPrice
        : null;
    const normalizedLineAmount =
      typeof row.lineAmount === 'number' && Number.isFinite(row.lineAmount)
        ? row.lineAmount
        : normalizedUnitPrice == null
          ? null
          : normalizedUnitPrice * row.quantity;

    return {
      merchantOrderNo,
      productName,
      quantity: row.quantity,
      recipientName,
      recipientPhone,
      recipientAddress,
      recipientZipCode: String(row.recipientZipCode || '').trim() || null,
      deliveryMessage: String(row.deliveryMessage || '').trim() || null,
      productCode: String(row.productCode || '').trim() || null,
      customerOrderNo: String(row.customerOrderNo || '').trim() || null,
      unitPrice: normalizedUnitPrice,
      lineAmount: normalizedLineAmount,
    };
  }

  private collectDuplicateMerchantOrderNos(
    rows: BusinessOrderImportRow[],
    existingMerchantOrderNos: string[],
  ): string[] {
    const duplicates = new Set<string>();
    const seenInPayload = new Set<string>();
    const existingKeys = new Set(
      existingMerchantOrderNos.map((merchantOrderNo) =>
        normalizeMerchantOrderNo(merchantOrderNo),
      ),
    );

    rows.forEach((row) => {
      const normalized = normalizeMerchantOrderNo(row.merchantOrderNo);
      if (!normalized) {
        return;
      }

      if (seenInPayload.has(normalized) || existingKeys.has(normalized)) {
        duplicates.add(row.merchantOrderNo);
      }

      seenInPayload.add(normalized);
    });

    return [...duplicates];
  }

  private async resolveAccessibleBrandIds(userId: string): Promise<string[]> {
    const sb = this.supabase.adminClient();

    const [memberBrandsResult, ownedBrandsResult] = await Promise.all([
      sb
        .from('brand_members')
        .select('brand_id')
        .eq('user_id', userId)
        .eq('status', 'ACTIVE'),
      sb.from('brands').select('id').eq('owner_user_id', userId),
    ]);

    if (memberBrandsResult.error) {
      this.logger.error(
        `Failed to fetch brand memberships for user ${userId}`,
        memberBrandsResult.error,
      );
      throw new BadRequestException('브랜드 권한을 확인하지 못했습니다.');
    }

    if (ownedBrandsResult.error) {
      this.logger.error(
        `Failed to fetch owned brands for user ${userId}`,
        ownedBrandsResult.error,
      );
      throw new BadRequestException('브랜드 권한을 확인하지 못했습니다.');
    }

    return [
      ...new Set([
        ...(memberBrandsResult.data ?? []).map((item) => item.brand_id),
        ...(ownedBrandsResult.data ?? []).map((item) => item.id),
      ]),
    ];
  }

  private async resolveImportBrandId(
    userId: string,
    requestedBrandId?: string | null,
  ): Promise<string> {
    const accessibleBrandIds = await this.resolveAccessibleBrandIds(userId);
    const normalizedBrandId = String(requestedBrandId || '').trim();

    if (normalizedBrandId) {
      if (!accessibleBrandIds.includes(normalizedBrandId)) {
        throw new BadRequestException('선택한 브랜드에 접근할 수 없습니다.');
      }

      return normalizedBrandId;
    }

    if (accessibleBrandIds.length === 1) {
      return accessibleBrandIds[0];
    }

    if (accessibleBrandIds.length === 0) {
      throw new BadRequestException(
        'B2B 업로드 권한이 있는 브랜드가 없습니다.',
      );
    }

    throw new BadRequestException('브랜드를 먼저 선택해 주세요.');
  }

  private async loadRecentMerchantOrderNos(
    userId: string,
    brandId: string,
  ): Promise<string[]> {
    const sb = this.supabase.adminClient();

    const batchResult = await sb
      .from('procurement_import_batches')
      .select('id')
      .eq('created_by', userId)
      .eq('brand_id', brandId)
      .order('uploaded_at', { ascending: false })
      .limit(BUSINESS_ORDER_IMPORT_BATCH_LIMIT);

    if (batchResult.error) {
      this.logger.error(
        `Failed to fetch recent import batches for user ${userId}`,
        batchResult.error,
      );
      throw new BadRequestException('이전 업로드 주문을 확인하지 못했습니다.');
    }

    const batchIds = (batchResult.data ?? []).map((item) => item.id);
    if (batchIds.length === 0) {
      return [];
    }

    const lineResult = await sb
      .from('procurement_import_batch_lines')
      .select('merchant_order_no')
      .in('batch_id', batchIds);

    if (lineResult.error) {
      this.logger.error(
        `Failed to fetch recent import lines for user ${userId}`,
        lineResult.error,
      );
      throw new BadRequestException('이전 업로드 주문을 확인하지 못했습니다.');
    }

    return (lineResult.data ?? []).map((item) => item.merchant_order_no);
  }

  private async resolveOrCreateSupplier(
    userId: string,
    brandId: string,
    supplierId: string,
    supplierName: string,
  ): Promise<ProcurementSupplierRow> {
    const sb = this.supabase.adminClient();
    const normalizedSupplierId = String(supplierId || '').trim();
    const normalizedSupplierName = String(supplierName || '').trim();

    if (!normalizedSupplierName) {
      throw new BadRequestException('공급처명이 필요합니다.');
    }

    if (this.isUuid(normalizedSupplierId)) {
      const supplierByIdResult = await sb
        .from('procurement_suppliers')
        .select('id, brand_id, name, supplier_code')
        .eq('id', normalizedSupplierId)
        .eq('brand_id', brandId)
        .maybeSingle();

      if (supplierByIdResult.error) {
        this.logger.error(
          `Failed to fetch supplier ${normalizedSupplierId}`,
          supplierByIdResult.error,
        );
        throw new BadRequestException('공급처 정보를 확인하지 못했습니다.');
      }

      if (supplierByIdResult.data) {
        return supplierByIdResult.data as ProcurementSupplierRow;
      }
    }

    const supplierByNameResult = await sb
      .from('procurement_suppliers')
      .select('id, brand_id, name, supplier_code')
      .eq('brand_id', brandId)
      .eq('name', normalizedSupplierName)
      .maybeSingle();

    if (supplierByNameResult.error) {
      this.logger.error(
        `Failed to fetch supplier by name ${normalizedSupplierName}`,
        supplierByNameResult.error,
      );
      throw new BadRequestException('공급처 정보를 확인하지 못했습니다.');
    }

    if (supplierByNameResult.data) {
      const current = supplierByNameResult.data as ProcurementSupplierRow;
      if (normalizedSupplierId && !this.isUuid(normalizedSupplierId)) {
        const currentCode = String(current.supplier_code || '').trim();
        if (!currentCode || currentCode === normalizedSupplierId) {
          const updateResult = await sb
            .from('procurement_suppliers')
            .update({
              supplier_code: normalizedSupplierId,
              updated_by: userId,
            })
            .eq('id', current.id)
            .select('id, brand_id, name, supplier_code')
            .single();

          if (!updateResult.error && updateResult.data) {
            return updateResult.data as ProcurementSupplierRow;
          }
        }
      }

      return current;
    }

    if (normalizedSupplierId && !this.isUuid(normalizedSupplierId)) {
      const supplierByCodeResult = await sb
        .from('procurement_suppliers')
        .select('id, brand_id, name, supplier_code')
        .eq('brand_id', brandId)
        .eq('supplier_code', normalizedSupplierId)
        .maybeSingle();

      if (supplierByCodeResult.error) {
        this.logger.error(
          `Failed to fetch supplier by code ${normalizedSupplierId}`,
          supplierByCodeResult.error,
        );
        throw new BadRequestException('공급처 정보를 확인하지 못했습니다.');
      }

      if (supplierByCodeResult.data) {
        return supplierByCodeResult.data as ProcurementSupplierRow;
      }
    }

    const insertResult = await sb
      .from('procurement_suppliers')
      .insert({
        brand_id: brandId,
        name: normalizedSupplierName,
        supplier_code:
          normalizedSupplierId && !this.isUuid(normalizedSupplierId)
            ? normalizedSupplierId
            : null,
        created_by: userId,
        updated_by: userId,
      })
      .select('id, brand_id, name, supplier_code')
      .single();

    if (insertResult.error || !insertResult.data) {
      this.logger.error(
        `Failed to create supplier ${normalizedSupplierName}`,
        insertResult.error,
      );
      throw new BadRequestException('공급처를 저장하지 못했습니다.');
    }

    return insertResult.data as ProcurementSupplierRow;
  }

  private addCatalogEntry(
    collection: Map<string, SupplierCatalogEntry[]>,
    key: string,
    entry: SupplierCatalogEntry,
  ): void {
    if (!key) {
      return;
    }

    const current = collection.get(key) ?? [];
    current.push(entry);
    collection.set(key, current);
  }

  private dedupeCatalogEntries(
    entries: SupplierCatalogEntry[],
  ): SupplierCatalogEntry[] {
    const deduped = new Map<string, SupplierCatalogEntry>();

    entries.forEach((entry) => {
      const current = deduped.get(entry.supplierItemId);
      if (!current || entry.priority < current.priority) {
        deduped.set(entry.supplierItemId, entry);
      }
    });

    return [...deduped.values()].sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      return left.supplierItemId.localeCompare(right.supplierItemId);
    });
  }

  private async loadSupplierCatalog(
    brandId: string,
    supplierId: string,
  ): Promise<SupplierCatalog> {
    const sb = this.supabase.adminClient();

    const [itemResult, aliasResult] = await Promise.all([
      sb
        .from('procurement_supplier_items')
        .select(
          'id, brand_product_id, supplier_item_name, supplier_item_code, current_unit_price',
        )
        .eq('brand_id', brandId)
        .eq('supplier_id', supplierId)
        .eq('is_active', true),
      sb
        .from('procurement_supplier_item_aliases')
        .select(
          'supplier_item_id, alias_type, alias_value_normalized, match_priority',
        )
        .eq('brand_id', brandId)
        .eq('supplier_id', supplierId),
    ]);

    if (itemResult.error) {
      this.logger.error(
        `Failed to fetch supplier items for supplier ${supplierId}`,
        itemResult.error,
      );
      throw new BadRequestException('상품 매칭 정보를 불러오지 못했습니다.');
    }

    if (aliasResult.error) {
      this.logger.error(
        `Failed to fetch supplier item aliases for supplier ${supplierId}`,
        aliasResult.error,
      );
      throw new BadRequestException('상품 매칭 정보를 불러오지 못했습니다.');
    }

    const items = (itemResult.data ?? []) as ProcurementSupplierItemRow[];
    const aliases = (aliasResult.data ??
      []) as ProcurementSupplierItemAliasRow[];
    const itemById = new Map(items.map((item) => [item.id, item]));
    const byName = new Map<string, SupplierCatalogEntry[]>();
    const byCode = new Map<string, SupplierCatalogEntry[]>();

    items.forEach((item) => {
      const entry: SupplierCatalogEntry = {
        supplierItemId: item.id,
        brandProductId: item.brand_product_id,
        currentUnitPrice: item.current_unit_price,
        priority: SUPPLIER_ITEM_NAME_PRIORITY,
      };
      this.addCatalogEntry(
        byName,
        this.normalizeBusinessOrderLookupValue(item.supplier_item_name),
        entry,
      );

      if (item.supplier_item_code) {
        this.addCatalogEntry(
          byCode,
          this.normalizeBusinessOrderLookupValue(item.supplier_item_code),
          {
            ...entry,
            priority: SUPPLIER_ITEM_CODE_PRIORITY,
          },
        );
      }
    });

    aliases.forEach((alias) => {
      const item = itemById.get(alias.supplier_item_id);
      if (!item) {
        return;
      }

      const entry: SupplierCatalogEntry = {
        supplierItemId: item.id,
        brandProductId: item.brand_product_id,
        currentUnitPrice: item.current_unit_price,
        priority: alias.match_priority,
      };

      if (alias.alias_type === 'CODE') {
        this.addCatalogEntry(byCode, alias.alias_value_normalized, entry);
        return;
      }

      this.addCatalogEntry(byName, alias.alias_value_normalized, entry);
    });

    return { byName, byCode };
  }

  private resolveSupplierCatalogMatch(
    catalog: SupplierCatalog,
    row: BusinessOrderImportRow,
  ): {
    kind: 'matched' | 'unmatched' | 'conflict';
    entry?: SupplierCatalogEntry;
  } {
    const normalizedProductCode = this.normalizeBusinessOrderLookupValue(
      row.productCode,
    );
    const normalizedProductName = this.normalizeBusinessOrderLookupValue(
      row.productName,
    );
    const codeCandidates = normalizedProductCode
      ? this.dedupeCatalogEntries(
          catalog.byCode.get(normalizedProductCode) ?? [],
        )
      : [];
    const candidates =
      codeCandidates.length > 0
        ? codeCandidates
        : this.dedupeCatalogEntries(
            catalog.byName.get(normalizedProductName) ?? [],
          );

    if (candidates.length === 0) {
      return { kind: 'unmatched' };
    }

    if (candidates.length > 1) {
      return { kind: 'conflict' };
    }

    return {
      kind: 'matched',
      entry: candidates[0],
    };
  }

  private buildImportLineInsertPayloads(
    brandId: string,
    supplierId: string,
    rows: BusinessOrderImportRow[],
    catalog: SupplierCatalog,
  ) {
    let matchedRowCount = 0;
    let unmatchedRowCount = 0;
    let conflictRowCount = 0;
    let totalAmount = 0;

    const lineInserts = rows.map((row, index) => {
      const match = this.resolveSupplierCatalogMatch(catalog, row);
      let matchStatus: 'MATCHED' | 'UNMATCHED' | 'CONFLICT' = 'UNMATCHED';
      let priceSource:
        | 'UNRESOLVED'
        | 'SUPPLIER_ITEM'
        | 'FILE'
        | 'MANUAL'
        | 'PRICE_HISTORY' = 'UNRESOLVED';
      let matchedSupplierItemId: string | null = null;
      let matchedBrandProductId: string | null = null;
      let unitPriceSnapshot: number | null = row.unitPrice;
      let lineAmountSnapshot: number | null = row.lineAmount;

      if (match.kind === 'matched' && match.entry) {
        matchedRowCount += 1;
        matchStatus = 'MATCHED';
        priceSource = 'SUPPLIER_ITEM';
        matchedSupplierItemId = match.entry.supplierItemId;
        matchedBrandProductId = match.entry.brandProductId;
        unitPriceSnapshot = match.entry.currentUnitPrice;
        lineAmountSnapshot = unitPriceSnapshot * row.quantity;
      } else if (match.kind === 'conflict') {
        conflictRowCount += 1;
        matchStatus = 'CONFLICT';
        if (row.unitPrice != null) {
          priceSource = 'FILE';
          lineAmountSnapshot = row.unitPrice * row.quantity;
        }
      } else {
        unmatchedRowCount += 1;
        if (row.unitPrice != null) {
          priceSource = 'FILE';
          lineAmountSnapshot = row.unitPrice * row.quantity;
        }
      }

      totalAmount += lineAmountSnapshot ?? 0;

      return {
        brand_id: brandId,
        supplier_id: supplierId,
        line_no: index + 1,
        merchant_order_no: row.merchantOrderNo,
        customer_order_no: row.customerOrderNo ?? null,
        supplier_product_name: row.productName,
        supplier_product_name_normalized:
          this.normalizeBusinessOrderLookupValue(row.productName),
        supplier_product_code: row.productCode ?? null,
        supplier_product_code_normalized: row.productCode
          ? this.normalizeBusinessOrderLookupValue(row.productCode)
          : null,
        quantity: row.quantity,
        recipient_name: row.recipientName,
        recipient_phone: row.recipientPhone,
        recipient_postcode: row.recipientZipCode ?? null,
        recipient_address: row.recipientAddress,
        delivery_message: row.deliveryMessage ?? null,
        matched_supplier_item_id: matchedSupplierItemId,
        matched_brand_product_id: matchedBrandProductId,
        match_status: matchStatus,
        price_source: priceSource,
        unit_price_snapshot: unitPriceSnapshot,
        line_amount_snapshot: lineAmountSnapshot,
        source_row: {
          merchantOrderNo: row.merchantOrderNo,
          productName: row.productName,
          productCode: row.productCode ?? null,
          customerOrderNo: row.customerOrderNo ?? null,
          quantity: row.quantity,
          recipientName: row.recipientName,
          recipientPhone: row.recipientPhone,
          recipientZipCode: row.recipientZipCode ?? null,
          recipientAddress: row.recipientAddress,
          deliveryMessage: row.deliveryMessage ?? null,
          unitPrice: row.unitPrice,
          lineAmount: row.lineAmount,
        },
      };
    });

    return {
      lineInserts,
      matchedRowCount,
      unmatchedRowCount,
      conflictRowCount,
      totalAmount,
    };
  }

  private resolveImportBatchStatus(
    matchedRowCount: number,
    rowCount: number,
  ): 'UPLOADED' | 'MATCHED' | 'PARTIAL_MATCHED' {
    if (matchedRowCount <= 0) {
      return 'UPLOADED';
    }

    if (matchedRowCount === rowCount) {
      return 'MATCHED';
    }

    return 'PARTIAL_MATCHED';
  }

  private mapImportLineRow(
    row: ProcurementImportBatchLineRow,
  ): BusinessOrderImportRow {
    return {
      merchantOrderNo: row.merchant_order_no,
      productName: row.supplier_product_name,
      quantity: row.quantity,
      recipientName: row.recipient_name,
      recipientPhone: row.recipient_phone,
      recipientAddress: row.recipient_address,
      recipientZipCode: row.recipient_postcode,
      deliveryMessage: row.delivery_message,
      productCode: row.supplier_product_code,
      customerOrderNo: row.customer_order_no,
      unitPrice: row.unit_price_snapshot,
      lineAmount: row.line_amount_snapshot,
    };
  }

  private mapImportBatchRow(
    batchRow: ProcurementImportBatchRow,
    supplierName: string,
    lineRows: ProcurementImportBatchLineRow[],
  ): BusinessOrderImportBatch {
    const metadata = this.readBatchMetadata(batchRow.source_metadata);
    const rows = lineRows
      .sort((left, right) => left.line_no - right.line_no)
      .map((row) => this.mapImportLineRow(row));
    const totalQty = rows.reduce((sum, row) => sum + row.quantity, 0);
    const totalAmount =
      typeof batchRow.total_amount === 'number'
        ? batchRow.total_amount
        : rows.reduce((sum, row) => sum + (row.lineAmount ?? 0), 0);
    const itemSummary =
      rows.length === 0
        ? ''
        : rows.length === 1
          ? rows[0].productName
          : `${rows[0].productName} 외 ${rows.length - 1}건`;

    return {
      id: batchRow.id,
      brandId: batchRow.brand_id,
      displayId:
        metadata.displayId ||
        `UP-${batchRow.id.replaceAll('-', '').slice(0, 10).toUpperCase()}`,
      createdByUserId: batchRow.created_by,
      supplierId: batchRow.supplier_id,
      supplierName,
      orderDate: batchRow.order_date,
      fileName: batchRow.source_file_name,
      headerRowIndex: batchRow.header_row_index,
      uploadedAt: this.formatUploadedAt(batchRow.uploaded_at),
      rowCount: batchRow.row_count || rows.length,
      totalQty,
      totalAmount,
      itemSummary,
      rows,
      status: metadata.workflowStatus ?? DEFAULT_BUSINESS_ORDER_IMPORT_STATUS,
      paymentStatus:
        metadata.paymentStatus ?? DEFAULT_BUSINESS_ORDER_IMPORT_PAYMENT_STATUS,
    };
  }

  private async hydrateImportBatches(
    batchRows: ProcurementImportBatchRow[],
  ): Promise<BusinessOrderImportBatch[]> {
    if (batchRows.length === 0) {
      return [];
    }

    const sb = this.supabase.adminClient();
    const supplierIds = [...new Set(batchRows.map((row) => row.supplier_id))];
    const batchIds = batchRows.map((row) => row.id);

    const [supplierResult, lineResult] = await Promise.all([
      sb.from('procurement_suppliers').select('id, name').in('id', supplierIds),
      sb
        .from('procurement_import_batch_lines')
        .select(
          'batch_id, line_no, merchant_order_no, customer_order_no, supplier_product_name, supplier_product_code, quantity, recipient_name, recipient_phone, recipient_postcode, recipient_address, delivery_message, unit_price_snapshot, line_amount_snapshot',
        )
        .in('batch_id', batchIds)
        .order('line_no', { ascending: true }),
    ]);

    if (supplierResult.error) {
      this.logger.error(
        'Failed to fetch suppliers for import batches',
        supplierResult.error,
      );
      throw new BadRequestException('공급처 정보를 불러오지 못했습니다.');
    }

    if (lineResult.error) {
      this.logger.error('Failed to fetch import batch lines', lineResult.error);
      throw new BadRequestException('업로드 주문 행을 불러오지 못했습니다.');
    }

    const supplierNameById = new Map(
      (supplierResult.data ?? []).map((item) => [item.id, item.name]),
    );
    const lineRowsByBatchId = new Map<
      string,
      ProcurementImportBatchLineRow[]
    >();

    ((lineResult.data ?? []) as ProcurementImportBatchLineRow[]).forEach(
      (row) => {
        const current = lineRowsByBatchId.get(row.batch_id) ?? [];
        current.push(row);
        lineRowsByBatchId.set(row.batch_id, current);
      },
    );

    return batchRows.map((batchRow) =>
      this.mapImportBatchRow(
        batchRow,
        supplierNameById.get(batchRow.supplier_id) ?? '',
        lineRowsByBatchId.get(batchRow.id) ?? [],
      ),
    );
  }

  async listBusinessOrderImportBatches(
    userId: string,
  ): Promise<BusinessOrderImportBatch[]> {
    const sb = this.supabase.adminClient();
    const batchResult = await sb
      .from('procurement_import_batches')
      .select(
        'id, brand_id, supplier_id, created_by, source_file_name, source_headers, source_metadata, order_date, header_row_index, row_count, matched_row_count, unmatched_row_count, conflict_row_count, total_amount, uploaded_at',
      )
      .eq('created_by', userId)
      .order('uploaded_at', { ascending: false })
      .limit(BUSINESS_ORDER_IMPORT_BATCH_LIMIT);

    if (batchResult.error) {
      this.logger.error(
        `Failed to list import batches for user ${userId}`,
        batchResult.error,
      );
      throw new BadRequestException('업로드 주문서를 불러오지 못했습니다.');
    }

    return this.hydrateImportBatches(
      (batchResult.data ?? []) as ProcurementImportBatchRow[],
    );
  }

  async getBusinessOrderImportBatch(
    userId: string,
    batchId: string,
  ): Promise<BusinessOrderImportBatch> {
    const sb = this.supabase.adminClient();
    const batchResult = await sb
      .from('procurement_import_batches')
      .select(
        'id, brand_id, supplier_id, created_by, source_file_name, source_headers, source_metadata, order_date, header_row_index, row_count, matched_row_count, unmatched_row_count, conflict_row_count, total_amount, uploaded_at',
      )
      .eq('id', batchId)
      .eq('created_by', userId)
      .maybeSingle();

    if (batchResult.error) {
      this.logger.error(
        `Failed to load import batch ${batchId} for user ${userId}`,
        batchResult.error,
      );
      throw new BadRequestException('업로드 주문서를 불러오지 못했습니다.');
    }

    if (!batchResult.data) {
      throw new NotFoundException('업로드 주문서를 찾을 수 없습니다.');
    }

    const [hydrated] = await this.hydrateImportBatches([
      batchResult.data as ProcurementImportBatchRow,
    ]);

    return hydrated;
  }

  async createBusinessOrderImportBatch(
    userId: string,
    dto: CreateBusinessOrderImportBatchDto,
  ): Promise<BusinessOrderImportBatch> {
    const rows = dto.rows.map((row) =>
      this.normalizeBusinessOrderImportRow(row),
    );
    if (rows.length === 0) {
      throw new BadRequestException('저장할 주문 행이 없습니다.');
    }

    const brandId = await this.resolveImportBrandId(userId, dto.brandId);
    const supplier = await this.resolveOrCreateSupplier(
      userId,
      brandId,
      dto.supplierId,
      dto.supplierName,
    );
    const existingMerchantOrderNos = await this.loadRecentMerchantOrderNos(
      userId,
      brandId,
    );
    const duplicateMerchantOrderNos = this.collectDuplicateMerchantOrderNos(
      rows,
      existingMerchantOrderNos,
    );
    if (duplicateMerchantOrderNos.length > 0) {
      throw new BadRequestException(
        `중복된 업체주문번호가 있습니다: ${duplicateMerchantOrderNos
          .slice(0, 10)
          .join(', ')}`,
      );
    }

    const normalizedOrderDate = String(dto.orderDate || '').trim();
    const normalizedFileName = String(dto.fileName || '').trim();

    if (!normalizedOrderDate || !normalizedFileName) {
      throw new BadRequestException('업로드 주문서 기본 정보가 부족합니다.');
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedOrderDate)) {
      throw new BadRequestException('주문일자는 YYYY-MM-DD 형식이어야 합니다.');
    }

    const catalog = await this.loadSupplierCatalog(brandId, supplier.id);
    const preparedLines = this.buildImportLineInsertPayloads(
      brandId,
      supplier.id,
      rows,
      catalog,
    );
    const metadata: BusinessOrderImportBatchMetadata = {
      workflowStatus: DEFAULT_BUSINESS_ORDER_IMPORT_STATUS,
      paymentStatus: DEFAULT_BUSINESS_ORDER_IMPORT_PAYMENT_STATUS,
      displayId: this.buildDisplayId(new Date()),
      legacySupplierId: String(dto.supplierId || '').trim() || null,
    };
    const sb = this.supabase.adminClient();
    const batchInsertResult = await sb
      .from('procurement_import_batches')
      .insert({
        brand_id: brandId,
        supplier_id: supplier.id,
        created_by: userId,
        source_type: 'UPLOAD',
        source_file_name: normalizedFileName,
        source_headers: (dto.sourceHeaders ?? []).map((header) =>
          String(header || '').trim(),
        ),
        source_metadata: metadata,
        order_date: normalizedOrderDate,
        header_row_index: dto.headerRowIndex,
        status: this.resolveImportBatchStatus(
          preparedLines.matchedRowCount,
          rows.length,
        ),
        row_count: rows.length,
        matched_row_count: preparedLines.matchedRowCount,
        unmatched_row_count: preparedLines.unmatchedRowCount,
        conflict_row_count: preparedLines.conflictRowCount,
        total_amount: preparedLines.totalAmount,
      })
      .select(
        'id, brand_id, supplier_id, created_by, source_file_name, source_headers, source_metadata, order_date, header_row_index, row_count, matched_row_count, unmatched_row_count, conflict_row_count, total_amount, uploaded_at',
      )
      .single();

    if (batchInsertResult.error || !batchInsertResult.data) {
      this.logger.error(
        `Failed to create import batch for user ${userId}`,
        batchInsertResult.error,
      );
      throw new BadRequestException('주문서를 저장하지 못했습니다.');
    }

    const batchRow = batchInsertResult.data as ProcurementImportBatchRow;

    if (preparedLines.lineInserts.length > 0) {
      const lineInsertResult = await sb
        .from('procurement_import_batch_lines')
        .insert(
          preparedLines.lineInserts.map((line) => ({
            ...line,
            batch_id: batchRow.id,
          })),
        );

      if (lineInsertResult.error) {
        this.logger.error(
          `Failed to create import batch lines for batch ${batchRow.id}`,
          lineInsertResult.error,
        );
        await sb
          .from('procurement_import_batches')
          .delete()
          .eq('id', batchRow.id)
          .eq('created_by', userId);
        throw new BadRequestException(
          '주문서 저장 중 행 데이터를 기록하지 못했습니다.',
        );
      }
    }

    const [hydrated] = await this.hydrateImportBatches([batchRow]);
    return hydrated;
  }

  async updateBusinessOrderImportBatchStatus(
    userId: string,
    batchId: string,
    status: BusinessOrderImportStatus,
  ): Promise<BusinessOrderImportBatch> {
    const sb = this.supabase.adminClient();
    const currentResult = await sb
      .from('procurement_import_batches')
      .select(
        'id, brand_id, supplier_id, created_by, source_file_name, source_headers, source_metadata, order_date, header_row_index, row_count, matched_row_count, unmatched_row_count, conflict_row_count, total_amount, uploaded_at',
      )
      .eq('id', batchId)
      .eq('created_by', userId)
      .maybeSingle();

    if (currentResult.error) {
      this.logger.error(
        `Failed to load import batch ${batchId} before status update`,
        currentResult.error,
      );
      throw new BadRequestException('업로드 주문서를 불러오지 못했습니다.');
    }

    if (!currentResult.data) {
      throw new NotFoundException('업로드 주문서를 찾을 수 없습니다.');
    }

    const metadata = this.readBatchMetadata(currentResult.data.source_metadata);
    const updateResult = await sb
      .from('procurement_import_batches')
      .update({
        source_metadata: {
          ...metadata,
          workflowStatus: status,
          paymentStatus:
            metadata.paymentStatus ??
            DEFAULT_BUSINESS_ORDER_IMPORT_PAYMENT_STATUS,
        },
      })
      .eq('id', batchId)
      .eq('created_by', userId)
      .select(
        'id, brand_id, supplier_id, created_by, source_file_name, source_headers, source_metadata, order_date, header_row_index, row_count, matched_row_count, unmatched_row_count, conflict_row_count, total_amount, uploaded_at',
      )
      .maybeSingle();

    if (updateResult.error) {
      this.logger.error(
        `Failed to update import batch ${batchId} status`,
        updateResult.error,
      );
      throw new BadRequestException('업로드 주문 상태를 변경하지 못했습니다.');
    }

    if (!updateResult.data) {
      throw new NotFoundException('업로드 주문서를 찾을 수 없습니다.');
    }

    const [hydrated] = await this.hydrateImportBatches([
      updateResult.data as ProcurementImportBatchRow,
    ]);

    return hydrated;
  }

  async deleteBusinessOrderImportBatch(
    userId: string,
    batchId: string,
  ): Promise<void> {
    const sb = this.supabase.adminClient();
    const deleteResult = await sb
      .from('procurement_import_batches')
      .delete()
      .eq('id', batchId)
      .eq('created_by', userId)
      .select('id');

    if (deleteResult.error) {
      this.logger.error(
        `Failed to delete import batch ${batchId}`,
        deleteResult.error,
      );
      throw new BadRequestException('업로드 주문서를 삭제하지 못했습니다.');
    }

    if (!deleteResult.data || deleteResult.data.length === 0) {
      throw new NotFoundException('업로드 주문서를 찾을 수 없습니다.');
    }
  }

  private getAllowedMimeTypes(folder: string): string[] {
    if (folder === 'biz-certs') {
      return this.allowedBizCertMimeTypes;
    }

    return this.allowedImageMimeTypes;
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'general',
  ): Promise<UploadResult> {
    this.logger.log(
      `Uploading file: ${file.originalname} to folder: ${folder}`,
    );

    const allowedMimeTypes = this.getAllowedMimeTypes(folder);

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
      );
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds limit. Max size: ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }

    const fileExt = file.originalname.split('.').pop();
    const fileName = `${folder}/${uuidv4()}.${fileExt}`;

    try {
      const client = this.supabase.adminClient();
      const { error } = await client.storage
        .from(this.bucketName)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        this.logger.error(`Failed to upload file: ${error.message}`, error);
        throw new BadRequestException(
          `Failed to upload file: ${error.message}`,
        );
      }

      const { data: urlData } = client.storage
        .from(this.bucketName)
        .getPublicUrl(fileName);

      return {
        url: urlData.publicUrl,
        path: fileName,
        bucket: this.bucketName,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown upload error';
      this.logger.error(`Error uploading file: ${message}`, error as Error);
      throw error;
    }
  }

  async uploadMultipleImages(
    files: Express.Multer.File[],
    folder: string = 'general',
  ): Promise<UploadResult[]> {
    const uploadPromises = files.map((file) => this.uploadImage(file, folder));
    return Promise.all(uploadPromises);
  }

  async deleteImage(filePath: string): Promise<void> {
    this.logger.log(`Deleting image: ${filePath}`);

    try {
      const client = this.supabase.adminClient();
      const { error } = await client.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        this.logger.error(`Failed to delete file: ${error.message}`, error);
        throw new BadRequestException(
          `Failed to delete file: ${error.message}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown delete error';
      this.logger.error(`Error deleting file: ${message}`, error as Error);
      throw error;
    }
  }

  async deleteMultipleImages(filePaths: string[]): Promise<void> {
    try {
      const client = this.supabase.adminClient();
      const { error } = await client.storage
        .from(this.bucketName)
        .remove(filePaths);

      if (error) {
        this.logger.error(`Failed to delete files: ${error.message}`, error);
        throw new BadRequestException(
          `Failed to delete files: ${error.message}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown batch delete error';
      this.logger.error(`Error deleting files: ${message}`, error as Error);
      throw error;
    }
  }
}
