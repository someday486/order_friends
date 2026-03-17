import type { PickupTimeConfig } from '@/lib/pickup-time';

export const BUSINESS_HOUR_DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type BusinessHourDayKey = (typeof BUSINESS_HOUR_DAY_KEYS)[number];

export type BusinessHourDay = {
  isOpen?: boolean | null;
  openTime?: string | null;
  closeTime?: string | null;
};

export type WeeklyBusinessHours =
  | Partial<Record<BusinessHourDayKey, BusinessHourDay>>
  | null
  | undefined;

export type BusinessHoursFormDay = {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

export type BusinessHoursFormState = Record<
  BusinessHourDayKey,
  BusinessHoursFormDay
>;

export const BUSINESS_HOUR_DAY_LABELS: Record<BusinessHourDayKey, string> = {
  monday: '월',
  tuesday: '화',
  wednesday: '수',
  thursday: '목',
  friday: '금',
  saturday: '토',
  sunday: '일',
};

export function createBusinessHoursFormState(
  businessHours?: WeeklyBusinessHours,
  pickupTimeConfig?: PickupTimeConfig,
): BusinessHoursFormState {
  const fallbackOpenTime = pickupTimeConfig?.startTime ?? '09:00';
  const fallbackCloseTime = pickupTimeConfig?.endTime ?? '18:00';

  return Object.fromEntries(
    BUSINESS_HOUR_DAY_KEYS.map((dayKey) => {
      const source = businessHours?.[dayKey];
      return [
        dayKey,
        {
          isOpen: source?.isOpen ?? false,
          openTime: source?.openTime ?? fallbackOpenTime,
          closeTime: source?.closeTime ?? fallbackCloseTime,
        },
      ];
    }),
  ) as BusinessHoursFormState;
}

export function serializeBusinessHoursForm(
  formState: BusinessHoursFormState,
): WeeklyBusinessHours | null {
  const entries = BUSINESS_HOUR_DAY_KEYS.map(
    (dayKey) =>
      [
        dayKey,
        formState[dayKey].isOpen
          ? {
              isOpen: true,
              openTime: formState[dayKey].openTime,
              closeTime: formState[dayKey].closeTime,
            }
          : {
              isOpen: false,
              openTime: null,
              closeTime: null,
            },
      ] as const,
  );

  const hasAnyOpenDay = entries.some(([, day]) => day.isOpen);
  if (!hasAnyOpenDay) {
    return null;
  }

  return Object.fromEntries(entries) as WeeklyBusinessHours;
}

export function hasBusinessHours(
  businessHours?: WeeklyBusinessHours,
): businessHours is Record<BusinessHourDayKey, BusinessHourDay> {
  return BUSINESS_HOUR_DAY_KEYS.some((dayKey) => businessHours?.[dayKey]);
}

export function formatBusinessHoursSummary(
  businessHours?: WeeklyBusinessHours,
): string[] {
  if (!hasBusinessHours(businessHours)) {
    return [];
  }

  return BUSINESS_HOUR_DAY_KEYS.map((dayKey) => {
    const day = businessHours?.[dayKey];
    if (!day?.isOpen || !day.openTime || !day.closeTime) {
      return `${BUSINESS_HOUR_DAY_LABELS[dayKey]} 휴무`;
    }

    return `${BUSINESS_HOUR_DAY_LABELS[dayKey]} ${day.openTime} - ${day.closeTime}`;
  });
}

export function getBusinessHoursForDay(
  businessHours: WeeklyBusinessHours,
  dayKey: BusinessHourDayKey,
) {
  const day = businessHours?.[dayKey];
  if (!day?.isOpen || !day.openTime || !day.closeTime) {
    return null;
  }

  return {
    openTime: day.openTime,
    closeTime: day.closeTime,
  };
}
