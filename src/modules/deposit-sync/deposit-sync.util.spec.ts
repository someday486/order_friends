import {
  getKstDayUtcRange,
  isIncomingDepositRow,
  normalizeDepositorName,
  parseSheetAmount,
  parseSheetDateTime,
} from './deposit-sync.util';

describe('deposit-sync.util', () => {
  it('normalizes depositor names by trimming spaces and casing', () => {
    expect(normalizeDepositorName(' 김 한나 ')).toBe('김한나');
    expect(normalizeDepositorName('LEE SUK')).toBe('leesuk');
    expect(normalizeDepositorName('')).toBeNull();
  });

  it('parses sheet amounts with commas and currency symbols', () => {
    expect(parseSheetAmount('16,500원')).toBe(16500);
    expect(parseSheetAmount(50000)).toBe(50000);
    expect(parseSheetAmount('')).toBeNull();
  });

  it('keeps only incoming deposit rows', () => {
    expect(isIncomingDepositRow('[Web발신]\n농협 입금16,500원')).toBe(true);
    expect(isIncomingDepositRow('[Web발신]\n농협 출금50,000원')).toBe(false);
  });

  it('parses sheet date strings into KST date and UTC timestamp', () => {
    expect(parseSheetDateTime('March 22, 2026 at 12:20PM')).toEqual({
      depositDate: '2026-03-22',
      depositedAt: '2026-03-22T03:20:00.000Z',
    });
  });

  it('returns KST day range in UTC', () => {
    expect(getKstDayUtcRange('2026-03-22')).toEqual({
      from: '2026-03-21T15:00:00.000Z',
      to: '2026-03-22T15:00:00.000Z',
    });
  });
});
