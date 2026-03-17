import {
  BUSINESS_HOUR_DAY_KEYS,
  getBusinessHoursForDay,
  type BusinessHourDayKey,
  type WeeklyBusinessHours,
} from '@/lib/business-hours';

export type PickupTimeConfig =
  | {
      startTime?: string | null;
      endTime?: string | null;
    }
  | null
  | undefined;

export type PickupTimeOption = {
  value: string;
  label: string;
};

export type PickupDateOption = {
  value: string;
  label: string;
};

const HALF_HOUR_MINUTES = 30;
const DEFAULT_SLOT_DAYS = 14;

export const HALF_HOUR_TIME_OF_DAY_OPTIONS: PickupTimeOption[] = Array.from(
  { length: (24 * 60) / HALF_HOUR_MINUTES },
  (_, index) => {
    const totalMinutes = index * HALF_HOUR_MINUTES;
    const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    const value = `${hours}:${minutes}`;

    return {
      value,
      label: value,
    };
  },
);

function toMinutes(value: string | null | undefined): number | null {
  if (!value) return null;

  const match = /^([01]\d|2[0-3]):(00|30)$/.exec(value);
  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
}

function roundUpToHalfHour(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);

  const minutes = rounded.getMinutes();
  const remainder = minutes % HALF_HOUR_MINUTES;
  if (remainder !== 0) {
    rounded.setMinutes(minutes + (HALF_HOUR_MINUTES - remainder));
  }

  return rounded;
}

export function hasPickupTimeConfig(
  config: PickupTimeConfig,
  businessHours?: WeeklyBusinessHours,
): boolean {
  return (
    Boolean(config?.startTime && config?.endTime) ||
    hasBusinessHoursConfig(businessHours)
  );
}

function hasBusinessHoursConfig(businessHours?: WeeklyBusinessHours): boolean {
  return BUSINESS_HOUR_DAY_KEYS.some((dayKey) => {
    const day = businessHours?.[dayKey];
    return Boolean(day?.isOpen && day.openTime && day.closeTime);
  });
}

function getDayKey(date: Date): BusinessHourDayKey {
  return BUSINESS_HOUR_DAY_KEYS[(date.getDay() + 6) % 7];
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function formatDateKey(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPickupDateKey(value: string): string | null {
  const date = new Date(value);
  if (!isValidDate(date)) {
    return null;
  }

  return formatDateKey(date);
}

export function buildPickupDateOptions(
  options: PickupTimeOption[],
): PickupDateOption[] {
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
  const seen = new Set<string>();
  const dates: PickupDateOption[] = [];

  for (const option of options) {
    const date = new Date(option.value);
    if (!isValidDate(date)) {
      continue;
    }

    const value = formatDateKey(date);
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    dates.push({
      value,
      label: formatter.format(date),
    });
  }

  return dates;
}

export function filterPickupTimeOptionsByDate(
  options: PickupTimeOption[],
  dateValue: string,
): PickupTimeOption[] {
  if (!dateValue) {
    return [];
  }

  return options.filter(
    (option) => getPickupDateKey(option.value) === dateValue,
  );
}

export function buildPickupTimeOptions(
  config: PickupTimeConfig,
  businessHours?: WeeklyBusinessHours,
  now = new Date(),
  days = DEFAULT_SLOT_DAYS,
): PickupTimeOption[] {
  const firstAvailableSlot = roundUpToHalfHour(now);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const formatter = new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const options: PickupTimeOption[] = [];
  const useBusinessHours = hasBusinessHoursConfig(businessHours);
  const fallbackStartMinutes = toMinutes(config?.startTime);
  const fallbackEndMinutes = toMinutes(config?.endTime);

  if (
    !useBusinessHours &&
    (fallbackStartMinutes === null ||
      fallbackEndMinutes === null ||
      fallbackEndMinutes <= fallbackStartMinutes)
  ) {
    return [];
  }

  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const currentDay = new Date(dayStart);
    currentDay.setDate(dayStart.getDate() + dayOffset);

    const dailySchedule = useBusinessHours
      ? getBusinessHoursForDay(businessHours, getDayKey(currentDay))
      : null;
    const startMinutes = useBusinessHours
      ? toMinutes(dailySchedule?.openTime)
      : fallbackStartMinutes;
    const endMinutes = useBusinessHours
      ? toMinutes(dailySchedule?.closeTime)
      : fallbackEndMinutes;

    if (
      startMinutes === null ||
      endMinutes === null ||
      endMinutes <= startMinutes
    ) {
      continue;
    }

    for (
      let minutes = startMinutes;
      minutes <= endMinutes;
      minutes += HALF_HOUR_MINUTES
    ) {
      const slot = new Date(currentDay);
      slot.setHours(0, 0, 0, 0);
      slot.setMinutes(minutes, 0, 0);

      if (slot.getTime() < firstAvailableSlot.getTime()) {
        continue;
      }

      options.push({
        value: slot.toISOString(),
        label: formatter.format(slot),
      });
    }
  }

  return options;
}
