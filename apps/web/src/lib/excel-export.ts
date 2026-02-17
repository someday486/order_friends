import ExcelJS from 'exceljs';

const escapeExcelFormula = (value: string): string => {
  // Prevent formula injection when exporting untrusted cell text.
  if (/^[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
};

const toCellValue = (value: unknown): string | number | boolean => {
  if (value == null) return '';
  if (typeof value === 'string') return escapeExcelFormula(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  return escapeExcelFormula(JSON.stringify(value));
};

/**
 * 데이터를 엑셀 파일로 다운로드합니다.
 *
 * @param data 테이블 데이터 배열 (각 객체의 키가 컬럼 헤더)
 * @param filename 파일명(확장자 제외)
 * @param sheetName 시트명(기본값 "Sheet1")
 */
export async function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Sheet1',
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (data.length === 0) {
    worksheet.addRow([]);
  } else {
    const headers = Object.keys(data[0]);
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.min(Math.max(header.length + 2, 12), 40),
    }));

    for (const row of data) {
      const normalized: Record<string, string | number | boolean> = {};
      for (const header of headers) {
        normalized[header] = toCellValue(row[header]);
      }
      worksheet.addRow(normalized);
    }

    headers.forEach((header, index) => {
      const maxLen = Math.max(
        header.length,
        ...data.map((row) => String(toCellValue(row[header])).length),
      );
      worksheet.getColumn(index + 1).width = Math.min(maxLen + 2, 40);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${filename}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
