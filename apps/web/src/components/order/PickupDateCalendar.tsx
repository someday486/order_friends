"use client";

import { useMemo, useState } from "react";
import type { PickupDateOption } from "@/lib/pickup-time";

type PickupDateCalendarProps = {
  options: PickupDateOption[];
  selectedDate: string;
  onSelectDate: (value: string) => void;
  disabled?: boolean;
  emptyMessage: string;
};

type CalendarMonth = {
  value: string;
  label: string;
  year: number;
  monthIndex: number;
};

const WEEKDAY_LABELS = [
  "\uC77C",
  "\uC6D4",
  "\uD654",
  "\uC218",
  "\uBAA9",
  "\uAE08",
  "\uD1A0",
];

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function buildMonthLabel(date: Date): string {
  return `${date.getFullYear()}\uB144 ${date.getMonth() + 1}\uC6D4`;
}

export function PickupDateCalendar({
  options,
  selectedDate,
  onSelectDate,
  disabled = false,
  emptyMessage,
}: PickupDateCalendarProps) {
  const enabledDateKeys = useMemo(
    () => new Set(options.map((option) => option.value)),
    [options],
  );

  const monthOptions = useMemo<CalendarMonth[]>(() => {
    const months: CalendarMonth[] = [];
    const seen = new Set<string>();

    for (const option of options) {
      const date = parseDateKey(option.value);
      const monthKey = formatMonthKey(date);

      if (seen.has(monthKey)) {
        continue;
      }

      seen.add(monthKey);
      months.push({
        value: monthKey,
        label: buildMonthLabel(date),
        year: date.getFullYear(),
        monthIndex: date.getMonth(),
      });
    }

    return months;
  }, [options]);

  const [manualMonthKey, setManualMonthKey] = useState("");
  const selectedMonthKey = selectedDate
    ? formatMonthKey(parseDateKey(selectedDate))
    : "";

  const visibleMonthKey = useMemo(() => {
    if (
      selectedMonthKey &&
      monthOptions.some((month) => month.value === selectedMonthKey)
    ) {
      return selectedMonthKey;
    }

    if (
      manualMonthKey &&
      monthOptions.some((month) => month.value === manualMonthKey)
    ) {
      return manualMonthKey;
    }

    return monthOptions[0]?.value ?? "";
  }, [manualMonthKey, monthOptions, selectedMonthKey]);

  const visibleMonth =
    monthOptions.find((month) => month.value === visibleMonthKey) ??
    monthOptions[0] ??
    null;

  const visibleMonthIndex = visibleMonth
    ? monthOptions.findIndex((month) => month.value === visibleMonth.value)
    : -1;

  const todayKey = useMemo(() => formatDateKey(new Date()), []);

  const calendarCells = useMemo(() => {
    if (!visibleMonth) {
      return [];
    }

    const firstDay = new Date(visibleMonth.year, visibleMonth.monthIndex, 1);
    const lastDate = new Date(
      visibleMonth.year,
      visibleMonth.monthIndex + 1,
      0,
    ).getDate();
    const startWeekday = firstDay.getDay();
    const totalCells = Math.ceil((startWeekday + lastDate) / 7) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber = index - startWeekday + 1;
      if (dayNumber < 1 || dayNumber > lastDate) {
        return null;
      }

      const date = new Date(
        visibleMonth.year,
        visibleMonth.monthIndex,
        dayNumber,
      );
      const dateKey = formatDateKey(date);

      return {
        dateKey,
        dayNumber,
        isEnabled: enabledDateKeys.has(dateKey),
        isSelected: selectedDate === dateKey,
        isToday: todayKey === dateKey,
      };
    });
  }, [enabledDateKeys, selectedDate, todayKey, visibleMonth]);

  if (disabled || monthOptions.length === 0 || !visibleMonth) {
    return (
      <div
        data-testid="pickup-date-input"
        className="rounded-2xl border border-border bg-bg-secondary px-4 py-3 text-sm text-text-tertiary"
        aria-disabled="true"
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      data-testid="pickup-date-input"
      className="rounded-2xl border border-border bg-bg-secondary p-3"
    >
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            visibleMonthIndex > 0 &&
            setManualMonthKey(monthOptions[visibleMonthIndex - 1].value)
          }
          disabled={visibleMonthIndex <= 0}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="\uC774\uC804 \uB2EC"
        >
          {"<"}
        </button>

        <div className="text-sm font-semibold text-foreground">
          {visibleMonth.label}
        </div>

        <button
          type="button"
          onClick={() =>
            visibleMonthIndex < monthOptions.length - 1 &&
            setManualMonthKey(monthOptions[visibleMonthIndex + 1].value)
          }
          disabled={
            visibleMonthIndex < 0 ||
            visibleMonthIndex >= monthOptions.length - 1
          }
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="\uB2E4\uC74C \uB2EC"
        >
          {">"}
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[11px] font-semibold text-text-tertiary"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((cell, index) =>
          cell ? (
            <button
              key={cell.dateKey}
              type="button"
              data-testid={`pickup-date-option-${cell.dateKey}`}
              data-date-key={cell.dateKey}
              onClick={() => cell.isEnabled && onSelectDate(cell.dateKey)}
              disabled={!cell.isEnabled}
              aria-pressed={cell.isSelected}
              className={`h-10 rounded-xl text-sm font-semibold transition-colors ${
                cell.isSelected
                  ? "bg-foreground text-background"
                  : cell.isEnabled
                    ? "bg-background text-foreground hover:bg-bg-tertiary"
                    : "bg-transparent text-text-tertiary opacity-35"
              } ${
                cell.isToday && !cell.isSelected
                  ? "ring-1 ring-foreground/25"
                  : ""
              }`}
            >
              {cell.dayNumber}
            </button>
          ) : (
            <div key={`empty-${index}`} className="h-10" />
          ),
        )}
      </div>
    </div>
  );
}
