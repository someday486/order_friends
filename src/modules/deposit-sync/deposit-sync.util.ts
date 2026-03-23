export type DepositMatchStatus = 'PENDING' | 'AUTO_MATCHED';

const ENGLISH_MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function normalizeDepositorName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, '').toLowerCase();
}

export function parseSheetAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value !== 'string') return null;

  const digits = value.replace(/[^\d-]/g, '');
  if (!digits) return null;

  const amount = Number(digits);
  if (!Number.isFinite(amount)) return null;
  return Math.trunc(amount);
}

export function isIncomingDepositRow(rawText: unknown): boolean {
  if (typeof rawText !== 'string') return false;
  const trimmed = rawText.trim();
  if (!trimmed) return false;
  return trimmed.includes('입금') && !trimmed.includes('출금');
}

export function parseSheetDateTime(value: unknown): {
  depositDate: string;
  depositedAt: string;
} | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const englishMatch = trimmed.match(
      /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+at\s+(\d{1,2}):(\d{2})(AM|PM)$/i,
    );

    if (englishMatch) {
      const monthName = englishMatch[1].toLowerCase();
      const month = ENGLISH_MONTHS[monthName];
      const day = Number(englishMatch[2]);
      const year = Number(englishMatch[3]);
      let hour = Number(englishMatch[4]);
      const minute = Number(englishMatch[5]);
      const period = englishMatch[6].toUpperCase();

      if (!month) return null;
      if (period === 'PM' && hour < 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;

      const depositDate = `${year}-${pad(month)}-${pad(day)}`;
      const utcMs = Date.UTC(year, month - 1, day, hour - 9, minute);
      return {
        depositDate,
        depositedAt: new Date(utcMs).toISOString(),
      };
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return {
        depositDate: formatter.format(parsed),
        depositedAt: parsed.toISOString(),
      };
    }
  }

  return null;
}

export function getKstDayUtcRange(dateYmd: string): {
  from: string;
  to: string;
} {
  const from = new Date(`${dateYmd}T00:00:00+09:00`);
  const to = new Date(`${dateYmd}T00:00:00+09:00`);
  to.setUTCDate(to.getUTCDate() + 1);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}
