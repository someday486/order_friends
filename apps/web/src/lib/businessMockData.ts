export type BusinessProduct = {
  id: string;
  name: string;
  category: string;
  supplier: string;
  price: number;
  minOrderQty: number;
  shippingFee: string;
  cutoffLabel: string;
  stockLabel: string;
  accentClass: string;
  emoji: string;
  note: string;
};

export type BusinessOrder = {
  id: string;
  merchant: string;
  supplier: string;
  itemSummary: string;
  qty: number;
  amount: number;
  orderedAt: string;
  deliveryDate: string;
  status: '작성중' | '확인대기' | '출고준비' | '부분출고' | '정산대기';
  paymentStatus: '입치기 차감' | '정산 예정' | '입금 확인';
};

export type BusinessSupplier = {
  id: string;
  name: string;
  categories: string[];
  leadTime: string;
  cutoffLabel: string;
  minimumAmount: string;
  paymentTerms: string;
  contact: string;
  rating: string;
};

export type ShipmentPreset = {
  id: string;
  name: string;
  orderHeader: string;
  waybillHeader: string;
  headerRow: number;
  lastUsed: string;
};

export type ReceiptStatus = {
  id: string;
  supplier: string;
  poNumber: string;
  expectedDate: string;
  receivedRate: string;
  issue: string;
};

export const businessTopSummary = {
  deposit: '2,480,000원',
  points: '138,000원',
  paymentPending: '3건',
  unmatchedWaybills: '12건',
};

export const businessProducts: BusinessProduct[] = [
  {
    id: 'prod-1',
    name: '성주 꿀참외 3kg',
    category: '국내 과일',
    supplier: '미남과일',
    price: 28400,
    minOrderQty: 3,
    shippingFee: '무료',
    cutoffLabel: '오전 10:30 마감',
    stockLabel: '재고 안정',
    accentClass: 'from-yellow-300/70 to-amber-500/60',
    emoji: '🍈',
    note: '주 3회 고정 입고 / 당도 보장',
  },
  {
    id: 'prod-2',
    name: '고당도 블러드오렌지 4kg',
    category: '수입 과일',
    supplier: '오렌지허브',
    price: 36800,
    minOrderQty: 2,
    shippingFee: '무료',
    cutoffLabel: '오전 09:00 마감',
    stockLabel: '재고 여유',
    accentClass: 'from-orange-300/70 to-red-400/60',
    emoji: '🍊',
    note: '스토어 POP 제공 / 시즌용 구성',
  },
  {
    id: 'prod-3',
    name: '산지출고 제주 흙당근 5kg',
    category: '채소',
    supplier: '제주구좌밭',
    price: 15400,
    minOrderQty: 5,
    shippingFee: '착불',
    cutoffLabel: '오전 10:30 마감',
    stockLabel: '재고 충분',
    accentClass: 'from-orange-200/80 to-lime-400/50',
    emoji: '🥕',
    note: '대량 주문 시 묶음 출고 가능',
  },
  {
    id: 'prod-4',
    name: '완도 자숙 전복 중 1kg',
    category: '수산',
    supplier: '완도마켓',
    price: 42900,
    minOrderQty: 1,
    shippingFee: '무료',
    cutoffLabel: '오전 09:30 마감',
    stockLabel: '예약 주문',
    accentClass: 'from-sky-200/80 to-cyan-500/60',
    emoji: '🐚',
    note: '입고 후 1일 내 사용 권장',
  },
  {
    id: 'prod-5',
    name: '수제 과일청 베이스 2L',
    category: '가공',
    supplier: '라운지랩',
    price: 19800,
    minOrderQty: 4,
    shippingFee: '3,000원',
    cutoffLabel: '오후 2:00 마감',
    stockLabel: '재고 안정',
    accentClass: 'from-pink-200/80 to-rose-400/60',
    emoji: '🫙',
    note: '카페 운영용 레시피 카드 포함',
  },
  {
    id: 'prod-6',
    name: '수비드 구이용 소고기 2kg',
    category: '축산',
    supplier: '정육허브',
    price: 54800,
    minOrderQty: 2,
    shippingFee: '무료',
    cutoffLabel: '오전 11:00 마감',
    stockLabel: '수량 제한',
    accentClass: 'from-red-200/80 to-stone-500/50',
    emoji: '🥩',
    note: '브랜드 단위 일괄 부착 가능',
  },
];

export const businessOrders: BusinessOrder[] = [
  {
    id: 'PO-240331-101',
    merchant: '강남 플래그십',
    supplier: '미남과일',
    itemSummary: '성주 꿀참외 외 3종',
    qty: 18,
    amount: 412800,
    orderedAt: '2026-03-31 08:40',
    deliveryDate: '2026-04-01',
    status: '출고준비',
    paymentStatus: '입치기 차감',
  },
  {
    id: 'PO-240331-102',
    merchant: '송도 카페랩',
    supplier: '제주구좌밭',
    itemSummary: '제주 흙당근 10박스',
    qty: 10,
    amount: 154000,
    orderedAt: '2026-03-31 09:10',
    deliveryDate: '2026-04-01',
    status: '확인대기',
    paymentStatus: '정산 예정',
  },
  {
    id: 'PO-240331-103',
    merchant: '압구정 라운지',
    supplier: '오렌지허브',
    itemSummary: '블러드오렌지 외 2종',
    qty: 7,
    amount: 257600,
    orderedAt: '2026-03-31 09:35',
    deliveryDate: '2026-04-02',
    status: '부분출고',
    paymentStatus: '입금 확인',
  },
  {
    id: 'PO-240331-104',
    merchant: '합정로스터리',
    supplier: '완도마켓',
    itemSummary: '자숙 전복 중 1kg 4세트',
    qty: 4,
    amount: 171600,
    orderedAt: '2026-03-31 10:05',
    deliveryDate: '2026-04-01',
    status: '정산대기',
    paymentStatus: '정산 예정',
  },
];

export const businessSuppliers: BusinessSupplier[] = [
  {
    id: 'sup-1',
    name: '미남과일',
    categories: ['국내 과일', '수입 과일'],
    leadTime: 'D+1',
    cutoffLabel: '오전 10:30',
    minimumAmount: '150,000원',
    paymentTerms: '입치기 우선 차감',
    contact: '010-2000-1020',
    rating: 'OTIF 98%',
  },
  {
    id: 'sup-2',
    name: '제주구좌밭',
    categories: ['채소'],
    leadTime: 'D+1',
    cutoffLabel: '오전 10:30',
    minimumAmount: '100,000원',
    paymentTerms: '월 2회 정산',
    contact: '010-4220-8821',
    rating: 'OTIF 95%',
  },
  {
    id: 'sup-3',
    name: '완도마켓',
    categories: ['수산'],
    leadTime: 'D+2',
    cutoffLabel: '오전 09:30',
    minimumAmount: '200,000원',
    paymentTerms: '후불 7일',
    contact: '010-5550-3400',
    rating: 'OTIF 93%',
  },
];

export const shipmentPresets: ShipmentPreset[] = [
  {
    id: 'preset-1',
    name: '로젠 기본 양식',
    orderHeader: '주문번호',
    waybillHeader: '송장번호',
    headerRow: 1,
    lastUsed: '2026-03-30',
  },
  {
    id: 'preset-2',
    name: '우체국 거래처 CSV',
    orderHeader: '거래처주문번호',
    waybillHeader: '배송장번호',
    headerRow: 1,
    lastUsed: '2026-03-31',
  },
  {
    id: 'preset-3',
    name: 'CJ 고객주문번호형',
    orderHeader: '고객주문번호',
    waybillHeader: '배송장번호',
    headerRow: 2,
    lastUsed: '2026-03-29',
  },
];

export const receiptStatuses: ReceiptStatus[] = [
  {
    id: 'rcv-1',
    supplier: '미남과일',
    poNumber: 'PO-240331-101',
    expectedDate: '2026-04-01 07:30',
    receivedRate: '100%',
    issue: '정상 입고',
  },
  {
    id: 'rcv-2',
    supplier: '제주구좌밭',
    poNumber: 'PO-240331-102',
    expectedDate: '2026-04-01 09:00',
    receivedRate: '60%',
    issue: '부분 입고 / 잔량 대기',
  },
  {
    id: 'rcv-3',
    supplier: '완도마켓',
    poNumber: 'PO-240331-104',
    expectedDate: '2026-04-01 12:00',
    receivedRate: '예정',
    issue: '입고 예정',
  },
];
