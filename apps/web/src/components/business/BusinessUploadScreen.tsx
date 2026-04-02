'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  ShieldCheck,
  TableProperties,
  UploadCloud,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useSelectedBrand } from '@/hooks/useSelectedBrand';
import { saveBusinessOrderImportBatch } from '@/lib/businessOrderImportStorage';

type FileKind = 'csv' | 'xlsx';
type UploadMode = 'common' | 'custom';
type OrderFieldKey =
  | 'merchantOrderNo'
  | 'productName'
  | 'quantity'
  | 'ordererName'
  | 'ordererPhone'
  | 'recipientName'
  | 'recipientPhone'
  | 'recipientZipCode'
  | 'recipientAddress'
  | 'deliveryMessage'
  | 'unitPrice'
  | 'courierName'
  | 'waybillNo'
  | 'productCode'
  | 'customerOrderNo';

type ParsedImportFile = {
  fileName: string;
  fileKind: FileKind;
  sheetName?: string;
  rows: string[][];
};

type ColumnOption = {
  index: number;
  label: string;
  displayLabel: string;
};

type FieldMapping = Partial<Record<OrderFieldKey, number>>;

type RowValidation = {
  rowIndex: number;
  merchantOrderNo: string;
  productName: string;
  quantity: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  missingFields: string[];
};

type OrderFieldDefinition = {
  key: OrderFieldKey;
  label: string;
  required: boolean;
  sampleHeader: string;
  candidates: string[];
};

type SupplierOption = {
  id: string;
  name: string;
  description: string;
};

const SUPPLIER_OPTIONS: SupplierOption[] = [
  { id: 'sup-1', name: '미남과일', description: '국내과일 · 오전 10:30 마감' },
  { id: 'sup-2', name: '제주굿소싱', description: '농산물 · 오전 10:30 마감' },
  { id: 'sup-3', name: '완도마켓', description: '수산 · 오전 09:30 마감' },
];

const ORDER_FIELD_DEFINITIONS: OrderFieldDefinition[] = [
  {
    key: 'merchantOrderNo',
    label: '업체주문번호',
    required: true,
    sampleHeader: '업체주문번호',
    candidates: ['업체주문번호', '거래처주문번호', '주문번호', 'order number'],
  },
  {
    key: 'productName',
    label: '품목명',
    required: true,
    sampleHeader: '품목명',
    candidates: ['품목명', '상품명', '상품', 'product'],
  },
  {
    key: 'quantity',
    label: '수량',
    required: true,
    sampleHeader: '수량',
    candidates: ['수량', 'qty', 'quantity'],
  },
  {
    key: 'ordererName',
    label: '주문자성명',
    required: false,
    sampleHeader: '주문자성명',
    candidates: ['주문자성명', '주문자명', '주문자'],
  },
  {
    key: 'ordererPhone',
    label: '주문자전화번호',
    required: false,
    sampleHeader: '주문자전화번호',
    candidates: ['주문자전화번호', '주문자휴대폰', '주문자연락처'],
  },
  {
    key: 'recipientName',
    label: '받는분성명',
    required: true,
    sampleHeader: '받는분성명',
    candidates: ['받는분성명', '수령인', '받는분', '받는사람'],
  },
  {
    key: 'recipientPhone',
    label: '받는분전화번호',
    required: true,
    sampleHeader: '받는분전화번호',
    candidates: ['받는분전화번호', '수령인전화번호', '받는분연락처'],
  },
  {
    key: 'recipientZipCode',
    label: '받는분우편번호',
    required: false,
    sampleHeader: '받는분우편번호',
    candidates: ['받는분우편번호', '우편번호', 'zipcode', 'zip code'],
  },
  {
    key: 'recipientAddress',
    label: '받는분주소(전체, 분할)',
    required: true,
    sampleHeader: '받는분주소(전체, 분할)',
    candidates: ['받는분주소(전체,분할)', '받는분주소(전체, 분할)', '주소', '받는분주소', '배송주소'],
  },
  {
    key: 'deliveryMessage',
    label: '배송메시지1',
    required: false,
    sampleHeader: '배송메시지1',
    candidates: ['배송메시지1', '배송메시지', '요청사항'],
  },
  {
    key: 'unitPrice',
    label: '공급가',
    required: false,
    sampleHeader: '공급가',
    candidates: ['공급가', '단가', 'price'],
  },
  {
    key: 'courierName',
    label: '택배사',
    required: false,
    sampleHeader: '택배사',
    candidates: ['택배사', '배송사', 'courier'],
  },
  {
    key: 'waybillNo',
    label: '송장번호',
    required: false,
    sampleHeader: '송장번호',
    candidates: ['송장번호', '운송장번호', 'tracking number'],
  },
  {
    key: 'productCode',
    label: '코드',
    required: false,
    sampleHeader: '코드',
    candidates: ['코드', '상품코드', 'product code'],
  },
  {
    key: 'customerOrderNo',
    label: '고객주문번호',
    required: false,
    sampleHeader: '고객주문번호',
    candidates: ['고객주문번호', '고객주문', 'customer order no'],
  },
];

const COMMON_TEMPLATE_HEADERS = ORDER_FIELD_DEFINITIONS.map(
  (definition) => definition.sampleHeader,
);

const PRIVACY_CONSENT_COPY = [
  '[개인정보 제3자 제공 동의]',
  '본 발주서를 제출하는 경우 디자인 위탁판매 이용약관 및 개인정보 처리방침에 동의한 것으로 간주됩니다.',
  '또한 배송 업무 수행을 위하여 입력된 고객 정보가 디자인 및 협력 출고처, 공급업체 및 물류 수행 업체(택배사 등)에 전달될 수 있음에 동의합니다.',
  '본 문구에 명시되지 않은 개인정보 처리, 발주, 배송 및 기타 서비스 이용과 관련된 사항은 오더프렌즈 이용약관 및 개인정보처리방침에 따릅니다.',
].join('\n\n');

function getTodayYmd() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}

function normalizeHeader(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s_\-()[\]]+/g, '');
}

function detectDelimiter(text: string) {
  const sample = text
    .split(/\r?\n/)
    .slice(0, 5)
    .join('\n');

  const scores = [
    { delimiter: ',', count: (sample.match(/,/g) || []).length },
    { delimiter: '\t', count: (sample.match(/\t/g) || []).length },
    { delimiter: ';', count: (sample.match(/;/g) || []).length },
  ];

  return scores.sort((a, b) => b.count - a.count)[0]?.delimiter || ',';
}

function parseDelimitedText(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';

      if (char === '\r' && next === '\n') {
        index += 1;
      }
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows.map((currentRow) => currentRow.map((cell) => String(cell ?? '')));
}

function toCellText(value: unknown): string {
  if (value == null) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toLocaleString('ko-KR');
  }
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') {
      return value.text;
    }
    if ('result' in value) {
      return toCellText(value.result);
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText
        .map((entry) =>
          typeof entry === 'object' && entry && 'text' in entry
            ? String(entry.text || '')
            : '',
        )
        .join('');
    }
  }

  return String(value);
}

async function parseSpreadsheetFile(file: File): Promise<ParsedImportFile> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) {
    const text = await file.text();
    const delimiter = detectDelimiter(text);

    return {
      fileName: file.name,
      fileKind: 'csv',
      rows: parseDelimitedText(text, delimiter),
    };
  }

  if (lowerName.endsWith('.xlsx')) {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();

    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('첫 번째 시트를 찾을 수 없습니다.');
    }

    const rows: string[][] = [];
    let maxColumns = 0;

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.from({ length: row.cellCount }, (_, index) =>
        toCellText(row.getCell(index + 1).value),
      );

      while (values.length > 0 && values[values.length - 1] === '') {
        values.pop();
      }

      maxColumns = Math.max(maxColumns, values.length);
      rows.push(values);
    });

    return {
      fileName: file.name,
      fileKind: 'xlsx',
      sheetName: worksheet.name,
      rows: rows.map((row) => [
        ...row,
        ...Array.from({ length: Math.max(0, maxColumns - row.length) }, () => ''),
      ]),
    };
  }

  throw new Error('현재는 CSV와 XLSX 파일만 지원합니다. XLS 형식은 다음 단계에서 확장할게요.');
}

async function downloadCommonTemplate() {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('주문서양식');

  worksheet.addRow(COMMON_TEMPLATE_HEADERS);
  worksheet.addRow([
    'OF-240331-001',
    '성주 꿀참외 3kg',
    '2',
    '홍길동',
    '010-1234-5678',
    '김수령',
    '010-2345-6789',
    '03333',
    '서울 은평구 응암로21가길 10-1 504호',
    '문 앞에 놓아주세요',
    '28400',
    '한진',
    '',
    'FRUIT-001',
    'CUST-240331-001',
  ]);

  worksheet.columns = COMMON_TEMPLATE_HEADERS.map((header) => ({
    header,
    width: Math.max(header.length + 4, 16),
  }));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'sample.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getColumnLetter(index: number) {
  let current = index + 1;
  let result = '';

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
}

function getInitialHeaderRowIndex(rows: string[][]) {
  const topRows = rows.slice(0, Math.min(rows.length, 5));
  let bestIndex = 0;
  let bestScore = -1;

  topRows.forEach((row, index) => {
    const filledCount = row.filter((cell) => String(cell || '').trim() !== '').length;
    const textLikeCount = row.filter((cell) => {
      const value = String(cell || '').trim();
      return value !== '' && Number.isNaN(Number(value));
    }).length;

    const score = filledCount * 10 + textLikeCount;
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });

  return bestIndex;
}

function buildHeaderOptions(rows: string[][], headerRowIndex: number): ColumnOption[] {
  const headerRow = rows[headerRowIndex] || [];

  return headerRow.map((header, index) => {
    const safeLabel = String(header || '').trim();
    const columnLetter = getColumnLetter(index);

    return {
      index,
      label: safeLabel,
      displayLabel: `${columnLetter}열 · ${safeLabel || '빈 열'}`,
    };
  });
}

function autoDetectFieldMapping(headerOptions: ColumnOption[]): FieldMapping {
  const mapping: FieldMapping = {};

  ORDER_FIELD_DEFINITIONS.forEach((definition) => {
    const normalizedCandidates = definition.candidates.map(normalizeHeader);
    const matched = headerOptions.find((option) => {
      const normalizedLabel = normalizeHeader(option.label);
      return normalizedCandidates.includes(normalizedLabel);
    });

    if (matched) {
      mapping[definition.key] = matched.index;
    }
  });

  return mapping;
}

function getMappedValue(
  row: string[],
  mapping: FieldMapping,
  key: OrderFieldKey,
): string {
  const index = mapping[key];
  if (typeof index !== 'number') {
    return '';
  }

  return String(row[index] || '').trim();
}

function validateRows(
  rows: string[][],
  mapping: FieldMapping,
  startRowIndex: number,
): RowValidation[] {
  const validations: RowValidation[] = [];

  rows.forEach((row, index) => {
    const hasAnyValue = row.some((cell) => String(cell || '').trim() !== '');
    if (!hasAnyValue) {
      return;
    }

    const merchantOrderNo = getMappedValue(row, mapping, 'merchantOrderNo');
    const productName = getMappedValue(row, mapping, 'productName');
    const quantity = getMappedValue(row, mapping, 'quantity');
    const recipientName = getMappedValue(row, mapping, 'recipientName');
    const recipientPhone = getMappedValue(row, mapping, 'recipientPhone');
    const recipientAddress = getMappedValue(row, mapping, 'recipientAddress');

    const missingFields: string[] = [];

    if (!merchantOrderNo) missingFields.push('업체주문번호');
    if (!productName) missingFields.push('품목명');
    if (!quantity) {
      missingFields.push('수량');
    } else {
      const normalizedQuantity = Number(quantity.replace(/,/g, ''));
      if (Number.isNaN(normalizedQuantity) || normalizedQuantity <= 0) {
        missingFields.push('수량(숫자)');
      }
    }
    if (!recipientName) missingFields.push('받는분성명');
    if (!recipientPhone) missingFields.push('받는분전화번호');
    if (!recipientAddress) missingFields.push('받는분주소');

    validations.push({
      rowIndex: startRowIndex + index + 1,
      merchantOrderNo,
      productName,
      quantity,
      recipientName,
      recipientPhone,
      recipientAddress,
      missingFields,
    });
  });

  return validations;
}

function getRowSummary(row: RowValidation) {
  if (row.missingFields.length === 0) {
    return '검증 완료';
  }

  return `누락: ${row.missingFields.join(', ')}`;
}

function extractApiErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return '주문서 저장 중 오류가 발생했습니다.';
  }

  const raw = error.message;
  const jsonStart = raw.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        message?: string | string[];
      };
      if (Array.isArray(parsed.message)) {
        return parsed.message.join(', ');
      }
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message;
      }
    } catch {
      return raw;
    }
  }

  return raw;
}

export default function BusinessUploadScreen() {
  const router = useRouter();
  const { brandId } = useSelectedBrand();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadMode, setUploadMode] = useState<UploadMode>('common');
  const [supplierId, setSupplierId] = useState<string>(SUPPLIER_OPTIONS[0]?.id ?? '');
  const [orderDate, setOrderDate] = useState(getTodayYmd());
  const [consentChecked, setConsentChecked] = useState(true);
  const [parsedFile, setParsedFile] = useState<ParsedImportFile | null>(null);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const headerRowCandidates = useMemo(() => {
    if (!parsedFile) return [];

    return parsedFile.rows.slice(0, Math.min(parsedFile.rows.length, 5)).map((row, index) => ({
      index,
      label: `${index + 1}행 · ${
        row
          .filter((cell) => String(cell || '').trim() !== '')
          .slice(0, 4)
          .join(' | ') || '빈 행'
      }`,
    }));
  }, [parsedFile]);

  const headerOptions = useMemo(() => {
    if (!parsedFile) return [];
    return buildHeaderOptions(parsedFile.rows, headerRowIndex);
  }, [parsedFile, headerRowIndex]);

  const dataRows = useMemo(() => {
    if (!parsedFile) return [];
    return parsedFile.rows
      .slice(headerRowIndex + 1)
      .filter((row) => row.some((cell) => String(cell || '').trim() !== ''));
  }, [parsedFile, headerRowIndex]);

  const commonAutoMapping = useMemo(
    () => autoDetectFieldMapping(headerOptions),
    [headerOptions],
  );

  const effectiveMapping = uploadMode === 'common' ? commonAutoMapping : fieldMapping;

  const missingRequiredMappings = useMemo(() => {
    return ORDER_FIELD_DEFINITIONS.filter(
      (definition) =>
        definition.required && typeof effectiveMapping[definition.key] !== 'number',
    );
  }, [effectiveMapping]);

  const rowValidation = useMemo(() => {
    if (!parsedFile || missingRequiredMappings.length > 0) {
      return [];
    }

    return validateRows(dataRows, effectiveMapping, headerRowIndex + 1);
  }, [dataRows, effectiveMapping, headerRowIndex, missingRequiredMappings.length, parsedFile]);

  const validRows = rowValidation.filter((row) => row.missingFields.length === 0);
  const invalidRows = rowValidation.filter((row) => row.missingFields.length > 0);
  const uploadReady =
    Boolean(parsedFile) &&
    Boolean(supplierId) &&
    consentChecked &&
    missingRequiredMappings.length === 0 &&
    invalidRows.length === 0 &&
    validRows.length > 0;

  const selectedSupplier = SUPPLIER_OPTIONS.find((option) => option.id === supplierId);

  async function handleSelectedFile(file: File) {
    try {
      setIsParsing(true);
      const nextFile = await parseSpreadsheetFile(file);

      if (nextFile.rows.length < 2) {
        throw new Error('헤더와 데이터가 포함된 파일을 올려주세요.');
      }

      const nextHeaderIndex = getInitialHeaderRowIndex(nextFile.rows);
      const nextHeaderOptions = buildHeaderOptions(nextFile.rows, nextHeaderIndex);

      setParsedFile(nextFile);
      setHeaderRowIndex(nextHeaderIndex);
      setFieldMapping(autoDetectFieldMapping(nextHeaderOptions));

      toast.success(`${file.name} 파일을 불러왔습니다.`);
    } catch (error) {
      toast.error(extractApiErrorMessage(error));
    } finally {
      setIsParsing(false);
      setIsDragging(false);
    }
  }

  function handleHeaderRowChange(nextIndex: number) {
    if (!parsedFile) return;

    setHeaderRowIndex(nextIndex);
    setFieldMapping(autoDetectFieldMapping(buildHeaderOptions(parsedFile.rows, nextIndex)));
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    void handleSelectedFile(nextFile);
    event.currentTarget.value = '';
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const nextFile = event.dataTransfer.files?.[0];

    if (!nextFile) return;

    void handleSelectedFile(nextFile);
  }

  function handlePrimaryAction() {
    if (!uploadReady || !parsedFile || !selectedSupplier || isSubmitting) return;
    void handleServerSave();
  }

  async function handleServerSave() {
    if (!uploadReady || !parsedFile || !selectedSupplier || isSubmitting) return;

    try {
      setIsSubmitting(true);

      const importedRows = validRows.map((row) => {
        const sourceRow = dataRows[row.rowIndex - (headerRowIndex + 2)] || [];
        const unitPriceText = getMappedValue(
          sourceRow,
          effectiveMapping,
          'unitPrice',
        );
        const normalizedUnitPrice = unitPriceText
          ? Number(unitPriceText.replace(/[^\d.-]/g, ''))
          : Number.NaN;
        const unitPrice = Number.isNaN(normalizedUnitPrice)
          ? null
          : normalizedUnitPrice;

        return {
          merchantOrderNo: row.merchantOrderNo,
          productName: row.productName,
          quantity: Number(row.quantity.replace(/,/g, '')),
          recipientName: row.recipientName,
          recipientPhone: row.recipientPhone,
          recipientAddress: row.recipientAddress,
          recipientZipCode:
            getMappedValue(sourceRow, effectiveMapping, 'recipientZipCode') ||
            null,
          deliveryMessage:
            getMappedValue(sourceRow, effectiveMapping, 'deliveryMessage') ||
            null,
          productCode:
            getMappedValue(sourceRow, effectiveMapping, 'productCode') || null,
          customerOrderNo:
            getMappedValue(sourceRow, effectiveMapping, 'customerOrderNo') ||
            null,
          unitPrice,
          lineAmount:
            unitPrice == null
              ? null
              : unitPrice * Number(row.quantity.replace(/,/g, '')),
        };
      });

      await saveBusinessOrderImportBatch({
        brandId: brandId ?? undefined,
        supplierId,
        supplierName: selectedSupplier.name,
        orderDate,
        fileName: parsedFile.fileName,
        headerRowIndex,
        sourceHeaders: parsedFile.rows[headerRowIndex]?.map((cell) =>
          String(cell || '').trim(),
        ),
        rows: importedRows,
      });

      toast.success(`${validRows.length}건 주문서를 저장했고 주문내역으로 이동합니다.`);
      router.push('/business/orders/history?source=upload');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '주문서 저장 중 오류가 발생했습니다.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="overflow-hidden rounded-[28px] border border-border bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_26%),linear-gradient(180deg,_rgba(255,255,255,0.55),_rgba(255,255,255,0))] p-6 md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">
              Bulk Order Upload
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground md:text-[28px]">
              주문서업로드(엑셀/CSV)
            </h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-5 text-text-secondary">
              거래처별 양식이 달라도 같은 화면에서 업로드하고, 필수 컬럼과 누락 데이터를 먼저 검증할 수 있게 정리했습니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void downloadCommonTemplate()}
              className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm"
            >
              <Download size={16} />
              sample.xlsx 다운로드
            </button>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background/80 px-4 py-3 text-[13px] text-text-secondary">
              <ShieldCheck size={16} />
              CSV / XLSX 지원
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <GuideStep
            step="01"
            title="기본 설정"
            description="거래처, 주문일자, 업로드 방식을 먼저 정합니다."
          />
          <GuideStep
            step="02"
            title="파일 업로드"
            description="공통양식은 바로 검증하고, 커스텀은 헤더를 매핑합니다."
          />
          <GuideStep
            step="03"
            title="검증 확인"
            description="누락 데이터와 미리보기를 보고 저장 준비 상태를 확인합니다."
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="rounded-[28px] p-0">
          <CardHeader className="border-b border-border px-6 py-5">
            <CardTitle className="mb-0 text-[22px] font-black tracking-tight">
              주문서 설정
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5 px-6 py-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SetupBlock label="거래처명" hint={selectedSupplier?.description}>
                <select
                  className="input-field h-12 text-sm"
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                >
                  {SUPPLIER_OPTIONS.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </SetupBlock>

              <SetupBlock
                label="업로드방식"
                hint={
                  uploadMode === 'common'
                    ? '공통 주문서 헤더를 그대로 사용합니다.'
                    : '거래처 양식을 그대로 올리고 헤더를 지정합니다.'
                }
              >
                <div className="grid grid-cols-2 gap-2">
                  <ChoicePill
                    active={uploadMode === 'common'}
                    label="공통양식"
                    onClick={() => setUploadMode('common')}
                  />
                  <ChoicePill
                    active={uploadMode === 'custom'}
                    label="커스텀파일"
                    onClick={() => setUploadMode('custom')}
                  />
                </div>
              </SetupBlock>

              <SetupBlock label="주문일자" hint="기본값은 오늘 날짜입니다.">
                <input
                  type="date"
                  value={orderDate}
                  onChange={(event) => setOrderDate(event.target.value)}
                  className="input-field h-12 text-sm"
                />
              </SetupBlock>
            </div>

            <div className="rounded-[24px] border border-border bg-bg-secondary p-4 md:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-foreground">
                    개인정보 제3자 제공 동의
                  </div>
                  <div className="mt-1 text-[13px] leading-5 text-text-secondary">
                    제출 전 문구를 확인하고 동의 여부를 체크해 주세요.
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(event) => setConsentChecked(event.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  동의 완료
                </label>
              </div>

              <textarea
                className="input-field mt-4 min-h-[144px] resize-y py-3 text-[13px] leading-5"
                value={PRIVACY_CONSENT_COPY}
                readOnly
              />
            </div>

            <div className="rounded-[24px] border border-border bg-bg-secondary p-4 md:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-foreground">파일 업로드</div>
                  <div className="mt-1 text-[13px] leading-5 text-text-secondary">
                    CSV, XLSX 파일을 지원합니다. 공통양식은 자동 검증되고 커스텀 파일은 아래 단계에서 헤더를 지정합니다.
                  </div>
                </div>

                {parsedFile ? (
                  <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-secondary">
                    <Badge variant="success">{parsedFile.fileKind.toUpperCase()}</Badge>
                    <span className="font-semibold text-foreground">{parsedFile.fileName}</span>
                  </div>
                ) : null}
              </div>

              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (event.currentTarget === event.target) {
                    setIsDragging(false);
                  }
                }}
                onDrop={handleDrop}
                className={`mt-4 rounded-[24px] border border-dashed px-6 py-8 transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-border bg-background/70'
                }`}
              >
                <div className="flex min-h-[160px] flex-col items-center justify-center text-center">
                  <UploadCloud size={34} className="text-text-tertiary" />
                  <div className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">
                    파일을 끌어다 놓거나 버튼으로 선택하세요
                  </div>
                  <div className="mt-2 max-w-2xl text-[13px] leading-5 text-text-secondary">
                    {isParsing
                      ? '파일을 읽는 중입니다...'
                      : '거래처 양식 그대로 올려도 되고, sample.xlsx로 공통양식을 내려받아 작성해도 됩니다.'}
                  </div>

                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm"
                      disabled={isParsing}
                    >
                      <FileUp size={16} />
                      업로드 파일 선택
                    </button>
                    <button
                      type="button"
                      onClick={() => void downloadCommonTemplate()}
                      className="btn-secondary inline-flex items-center gap-2 px-5 py-3 text-sm"
                    >
                      <Download size={16} />
                      샘플 다운로드
                    </button>
                  </div>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.xlsx"
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[28px] p-0">
            <CardHeader className="border-b border-border px-5 py-4">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-text-secondary" />
                <CardTitle className="mb-0">빠른 가이드</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-5 py-5">
              <InfoLine label="공통양식" value="sample.xlsx 사용 시 자동 검증" />
              <InfoLine label="커스텀파일" value="헤더 행 선택 후 컬럼 매핑" />
              <InfoLine label="필수값" value="업체주문번호 · 품목명 · 수량 · 받는분 정보" />
            </CardContent>
          </Card>

          <Card className="rounded-[28px] p-0">
            <CardHeader className="border-b border-border px-5 py-4">
              <CardTitle className="mb-0">현재 설정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-5 py-5">
              <InfoLine label="거래처" value={selectedSupplier?.name || '-'} />
              <InfoLine
                label="방식"
                value={uploadMode === 'common' ? '공통양식 자동 인식' : '커스텀 헤더 지정'}
              />
              <InfoLine label="동의" value={consentChecked ? '확인 완료' : '체크 필요'} />
              <InfoLine
                label="업로드"
                value={parsedFile ? parsedFile.fileName : '아직 파일 없음'}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {parsedFile ? (
        <section className="space-y-6">
          <Card className="rounded-[28px] p-0">
            <CardHeader className="border-b border-border px-6 py-5">
              <div className="mb-2 flex items-center gap-2">
                <TableProperties size={18} className="text-text-secondary" />
                <CardTitle className="mb-0">헤더 확인 및 검증 준비</CardTitle>
              </div>
              <div className="text-[13px] leading-5 text-text-secondary">
                헤더 행을 고른 뒤 매핑과 누락 데이터를 확인하세요. 공통양식은 자동으로 필수 컬럼을 잡아줍니다.
              </div>
            </CardHeader>

            <CardContent className="space-y-6 px-6 py-6">
              <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="rounded-[24px] border border-border bg-bg-secondary p-4">
                  <div className="mb-3 text-[13px] font-semibold text-foreground">헤더 행 선택</div>
                  <select
                    className="input-field h-12 text-sm"
                    value={headerRowIndex}
                    onChange={(event) => handleHeaderRowChange(Number(event.target.value))}
                  >
                    {headerRowCandidates.map((candidate) => (
                      <option key={candidate.index} value={candidate.index}>
                        {candidate.label}
                      </option>
                    ))}
                  </select>

                  <div className="mt-4 space-y-2">
                    <InfoLine label="선택 헤더" value={`${headerRowIndex + 1}행`} />
                    <InfoLine label="데이터 행" value={`${dataRows.length}건`} />
                    <InfoLine
                      label="파일"
                      value={
                        parsedFile.sheetName
                          ? `${parsedFile.fileName} · ${parsedFile.sheetName}`
                          : parsedFile.fileName
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    <MetricCard label="정상 행" value={`${validRows.length}건`} tone="success" />
                    <MetricCard label="보정 필요" value={`${invalidRows.length}건`} tone="warning" />
                    <MetricCard
                      label="필수 매핑"
                      value={
                        missingRequiredMappings.length > 0
                          ? `${missingRequiredMappings.length}개 미지정`
                          : '완료'
                      }
                      tone={missingRequiredMappings.length > 0 ? 'warning' : 'info'}
                    />
                    <MetricCard
                      label="검증 상태"
                      value={uploadReady ? '저장 준비 완료' : '확인 필요'}
                      tone={uploadReady ? 'success' : 'neutral'}
                    />
                  </div>

                  <div
                    className={`rounded-[24px] border px-4 py-4 text-[13px] leading-5 ${
                      missingRequiredMappings.length > 0 || invalidRows.length > 0
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    }`}
                  >
                    {missingRequiredMappings.length > 0
                      ? `필수 컬럼 매핑이 부족합니다: ${missingRequiredMappings.map((item) => item.label).join(', ')}`
                      : invalidRows.length > 0
                      ? `업로드는 가능하지만 누락 데이터가 ${invalidRows.length}건 있습니다. 미리보기에서 확인 후 보정해 주세요.`
                      : '필수 컬럼과 데이터가 정상적으로 확인되었습니다.'}
                  </div>
                </div>
              </div>

              {uploadMode === 'custom' ? (
                <div className="rounded-[24px] border border-border bg-bg-secondary p-5">
                  <div className="mb-4">
                    <div className="text-[13px] font-semibold text-foreground">컬럼 매핑</div>
                    <div className="mt-1 text-[13px] leading-5 text-text-secondary">
                      거래처 양식의 열을 오더프렌즈 주문서 필드에 연결합니다.
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {ORDER_FIELD_DEFINITIONS.map((definition) => (
                      <FieldBlock
                        key={definition.key}
                        definition={definition}
                        value={fieldMapping[definition.key]}
                        options={headerOptions}
                        onChange={(nextValue) =>
                          setFieldMapping((current) => ({
                            ...current,
                            [definition.key]: nextValue,
                          }))
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-border bg-bg-secondary px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="info">공통양식 자동 매핑</Badge>
                    <span className="text-[13px] text-text-secondary">
                      공통 주문서 헤더명을 기준으로 필수 컬럼을 자동 인식했습니다.
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[28px] p-0">
            <CardHeader className="border-b border-border px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="mb-0">주문서 미리보기</CardTitle>
                  <div className="mt-1 text-[13px] leading-5 text-text-secondary">
                    최대 8행까지 표시하며, 누락 항목이 있는 행은 상태 배지로 표시합니다.
                  </div>
                </div>
                <Badge variant="default">{rowValidation.length}행 검증됨</Badge>
              </div>
            </CardHeader>

            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-background/80 text-left text-text-secondary">
                      <th className="border-b border-border px-4 py-3 font-semibold">행</th>
                      <th className="border-b border-border px-4 py-3 font-semibold">업체주문번호</th>
                      <th className="border-b border-border px-4 py-3 font-semibold">품목명</th>
                      <th className="border-b border-border px-4 py-3 font-semibold">수량</th>
                      <th className="border-b border-border px-4 py-3 font-semibold">받는분</th>
                      <th className="border-b border-border px-4 py-3 font-semibold">연락처</th>
                      <th className="border-b border-border px-4 py-3 font-semibold">주소</th>
                      <th className="border-b border-border px-4 py-3 font-semibold">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowValidation.slice(0, 8).map((row) => (
                      <tr
                        key={`${row.rowIndex}-${row.merchantOrderNo}-${row.productName}`}
                        className="align-top"
                      >
                        <td className="border-b border-border px-4 py-3 text-text-tertiary">
                          {row.rowIndex}
                        </td>
                        <td className="border-b border-border px-4 py-3 font-medium text-foreground">
                          {row.merchantOrderNo || '-'}
                        </td>
                        <td className="border-b border-border px-4 py-3 text-foreground">
                          {row.productName || '-'}
                        </td>
                        <td className="border-b border-border px-4 py-3 text-foreground">
                          {row.quantity || '-'}
                        </td>
                        <td className="border-b border-border px-4 py-3 text-foreground">
                          {row.recipientName || '-'}
                        </td>
                        <td className="border-b border-border px-4 py-3 text-foreground">
                          {row.recipientPhone || '-'}
                        </td>
                        <td className="border-b border-border px-4 py-3 text-foreground">
                          <div className="max-w-[360px] whitespace-normal break-words">
                            {row.recipientAddress || '-'}
                          </div>
                        </td>
                        <td className="border-b border-border px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              row.missingFields.length === 0
                                ? 'bg-emerald-500/15 text-emerald-700'
                                : 'bg-amber-500/15 text-amber-700'
                            }`}
                          >
                            {getRowSummary(row)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-5">
                <div className="flex items-start gap-3 text-[13px] text-text-secondary">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <div className="leading-5">
                    {missingRequiredMappings.length > 0
                      ? '필수 컬럼을 먼저 지정해야 업로드 검증을 완료할 수 있습니다.'
                      : invalidRows.length > 0
                      ? '누락 행은 업로드 전에 보정하거나 제외해야 합니다.'
                      : '현재 파일은 저장 가능한 형태로 검증되었습니다.'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handlePrimaryAction()}
                  disabled={!uploadReady || isSubmitting}
                  className="btn-primary h-12 px-6 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? '저장 중...' : '주문서 저장'}
                </button>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function SetupBlock({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-border bg-bg-secondary p-4">
      <div className="text-[13px] font-semibold text-foreground">{label}</div>
      {hint ? <div className="mt-1 text-[13px] leading-5 text-text-secondary">{hint}</div> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ChoicePill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-[13px] font-semibold transition-colors ${
        active
          ? 'border-primary bg-primary/5 text-foreground'
          : 'border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
      }`}
    >
      {label}
    </button>
  );
}

function GuideStep({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-border bg-background/70 px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-tertiary">
        Step {step}
      </div>
      <div className="mt-2 text-[13px] font-semibold text-foreground">{title}</div>
      <div className="mt-1 text-[13px] leading-5 text-text-secondary">{description}</div>
    </div>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-background/70 px-3 py-3 text-[13px] md:flex-row md:items-center md:justify-between">
      <span className="text-text-secondary">{label}</span>
      <span className="text-left font-semibold text-foreground md:text-right">{value}</span>
    </div>
  );
}

function FieldBlock({
  definition,
  value,
  options,
  onChange,
}: {
  definition: OrderFieldDefinition;
  value: number | undefined;
  options: ColumnOption[];
  onChange: (nextValue: number | undefined) => void;
}) {
  return (
    <div className="rounded-[24px] border border-border bg-background p-4">
      <div className="mb-1 flex items-center gap-2">
        <div className="text-[13px] font-semibold text-foreground">{definition.label}</div>
        {definition.required ? <Badge variant="warning">필수</Badge> : null}
      </div>
      <div className="mb-3 text-xs leading-5 text-text-secondary">
        예시 헤더: {definition.sampleHeader}
      </div>
      <select
        className="input-field h-11 text-[13px]"
        value={typeof value === 'number' ? String(value) : ''}
        onChange={(event) =>
          onChange(event.target.value === '' ? undefined : Number(event.target.value))
        }
      >
        <option value="">열 선택</option>
        {options.map((option) => (
          <option key={`${definition.key}-${option.index}`} value={option.index}>
            {option.displayLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'success' | 'warning' | 'info';
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50'
      : tone === 'warning'
      ? 'border-amber-200 bg-amber-50'
      : tone === 'info'
      ? 'border-sky-200 bg-sky-50'
      : 'border-border bg-bg-secondary';

  return (
    <div className={`rounded-[24px] border p-4 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
        {label}
      </div>
      <div className="mt-3 break-keep text-[15px] font-black text-foreground">{value}</div>
    </div>
  );
}
