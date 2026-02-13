/** 원화 포맷 (예: 15,000원) */
export function formatWon(amount: number): string {
  if (!Number.isFinite(amount)) return '0원';
  return amount.toLocaleString('ko-KR') + '원';
}

function parseValidDate(iso: string): Date | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** 날짜+시간 포맷 (예: 01. 15. 오후 2:30) */
export function formatDateTime(iso: string): string {
  if (!iso) return '-';
  const date = parseValidDate(iso);
  if (!date) return '-';
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 날짜+시간 전체 포맷 (예: 2026. 01. 15. 오후 2:30) */
export function formatDateTimeFull(iso: string): string {
  if (!iso) return '-';
  const date = parseValidDate(iso);
  if (!date) return '-';
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 상대 시간 (예: 3분 전, 2시간 전) */
export function formatRelativeTime(iso: string): string {
  if (!iso) return '-';
  const date = parseValidDate(iso);
  if (!date) return '-';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;

  return date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

/** 다운로드/고정 포맷 (YYYY-MM-DD HH:mm) */
export function formatYmdHm(iso: string): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '-';

  const pad = (n: number) => String(n).padStart(2, '0');

  return date
    .toLocaleString('sv-SE', {
      timeZone: 'Asia/Seoul',
    })
    .slice(0, 16)
    .replace('T', ' ');
}

/** 전화번호 포맷 (예: 010-1234-5678) */
export function formatPhone(phone: string): string {
  if (!phone) return '-';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  return phone;
}
