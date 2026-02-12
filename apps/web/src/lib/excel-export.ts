import * as XLSX from 'xlsx';

const toCellString = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return value.toString();
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
};

/**
 * 데이터를 엑셀 파일로 다운로드합니다.
 *
 * @param data - 내보낼 데이터 배열 (각 객체의 키가 컬럼 헤더가 됨)
 * @param filename - 파일명 (확장자 제외)
 * @param sheetName - 시트명 (기본값: "Sheet1")
 */
export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Sheet1',
) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // 컬럼 너비 자동 조절
  const colWidths = Object.keys(data[0] || {}).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...data.map((row) => toCellString(row[key]).length),
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
