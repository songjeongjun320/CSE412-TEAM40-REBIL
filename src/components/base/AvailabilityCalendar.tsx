'use client';

import { useEffect, useMemo, useState } from 'react';

import {
    VehicleCalendarDay,
    addDays,
    endOfMonth,
    getVehicleCalendar,
    startOfMonth,
    toDateKey,
} from '@/lib/availability';

interface AvailabilityCalendarProps {
    carId: string;
    // Controlled selection (YYYY-MM-DD)
    startDate?: string;
    endDate?: string;
    onChange: (range: { startDate: string; endDate: string } | null) => void;
    monthsToShow?: number; // default 2
    // How many months ahead from the current month users can browse (inclusive). Default: 12 months
    maxMonthsAhead?: number;
    className?: string;
}

type DayCell = {
    date: Date;
    inCurrentMonth: boolean;
    disabled: boolean;
    isStart: boolean;
    isEnd: boolean;
    inRange: boolean;
};

export default function AvailabilityCalendar({
    carId,
    startDate,
    endDate,
    onChange,
    monthsToShow = 2,
    maxMonthsAhead = 12,
    className,
}: AvailabilityCalendarProps) {
    const [anchorMonth, setAnchorMonth] = useState<Date>(startOfMonth(new Date()));
    const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load availability for all months in view
    useEffect(() => {
        let isCancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const months: Date[] = Array.from({ length: monthsToShow }, (_, i) =>
                    startOfMonth(
                        new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + i, 1),
                    ),
                );

                const calendars = await Promise.all(
                    months.map((m) => getVehicleCalendar(carId, m.getFullYear(), m.getMonth() + 1)),
                );

                if (isCancelled) return;
                const map: Record<string, boolean> = {};
                calendars.forEach((days) => {
                    (days as VehicleCalendarDay[]).forEach((d) => {
                        if (!d.is_available) {
                            map[d.date] = true;
                        }
                    });
                });
                setBusyMap(map);
            } catch (e: any) {
                if (!isCancelled) setError(e?.message || 'Failed to load availability');
            } finally {
                if (!isCancelled) setLoading(false);
            }
        };
        load();
        return () => {
            isCancelled = true;
        };
    }, [carId, anchorMonth, monthsToShow]);

    const selectedStart = useMemo(
        () => (startDate ? new Date(`${startDate}T00:00:00`) : null),
        [startDate],
    );
    const selectedEnd = useMemo(
        () => (endDate ? new Date(`${endDate}T00:00:00`) : null),
        [endDate],
    );

    const monthGrids = useMemo(() => {
        const months: { label: string; cells: DayCell[] }[] = [];
        for (let i = 0; i < monthsToShow; i += 1) {
            const monthStart = startOfMonth(
                new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + i, 1),
            );
            const monthEnd = endOfMonth(monthStart);

            const firstWeekday = new Date(
                monthStart.getFullYear(),
                monthStart.getMonth(),
                1,
            ).getDay();
            const prefixDays = (firstWeekday + 6) % 7; // make Monday=0

            const totalDays = monthEnd.getDate();
            const cells: DayCell[] = [];

            // previous month spill
            for (let p = 0; p < prefixDays; p += 1) {
                const d = new Date(monthStart);
                d.setDate(d.getDate() - (prefixDays - p));
                cells.push({
                    date: d,
                    inCurrentMonth: false,
                    disabled: true,
                    isStart: false,
                    isEnd: false,
                    inRange: false,
                });
            }

            // current month days
            for (let day = 1; day <= totalDays; day += 1) {
                const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
                const disabled = !!busyMap[toDateKey(d)] || d < new Date(new Date().toDateString());
                const isStart = !!selectedStart && d.getTime() === selectedStart.getTime();
                const isEnd = !!selectedEnd && d.getTime() === selectedEnd.getTime();
                const inRange =
                    !!selectedStart && !!selectedEnd && d > selectedStart && d < selectedEnd;
                cells.push({
                    date: d,
                    inCurrentMonth: true,
                    disabled,
                    isStart,
                    isEnd,
                    inRange,
                });
            }

            // next month spill to complete 6 weeks (42 cells)
            while (cells.length % 7 !== 0 || cells.length < 42) {
                const last = cells[cells.length - 1]?.date || monthEnd;
                const d = addDays(last, 1);
                cells.push({
                    date: d,
                    inCurrentMonth: false,
                    disabled: true,
                    isStart: false,
                    isEnd: false,
                    inRange: false,
                });
            }

            months.push({
                label: monthStart.toLocaleString(undefined, {
                    month: 'long',
                    year: 'numeric',
                }),
                cells,
            });
        }
        return months;
    }, [anchorMonth, monthsToShow, busyMap, selectedStart, selectedEnd]);

    function handleSelect(day: DayCell): void {
        if (!day.inCurrentMonth || day.disabled) return;
        const key = toDateKey(day.date);

        // If no start -> set start
        if (!selectedStart || (selectedStart && selectedEnd)) {
            onChange({ startDate: key, endDate: '' });
            return;
        }

        // If selecting end, ensure end after start and all days in between not disabled
        if (selectedStart && !selectedEnd) {
            if (day.date <= selectedStart) return; // must be after

            // verify no disabled day within the range
            let cur = new Date(selectedStart);
            let valid = true;
            while (cur < day.date) {
                const curKey = toDateKey(cur);
                if (busyMap[curKey]) {
                    valid = false;
                    break;
                }
                cur = addDays(cur, 1);
            }
            if (!valid) return;
            onChange({ startDate: toDateKey(selectedStart), endDate: key });
        }
    }

    const todayStartOfMonth = startOfMonth(new Date());
    const lastAllowedMonth = startOfMonth(
        new Date(
            todayStartOfMonth.getFullYear(),
            todayStartOfMonth.getMonth() + (maxMonthsAhead - 1),
            1,
        ),
    );

    const canGoPrev = anchorMonth > todayStartOfMonth;
    const lastVisibleMonth = startOfMonth(
        new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + (monthsToShow - 1), 1),
    );
    const canGoNext = lastVisibleMonth < lastAllowedMonth;

    return (
        <div className={className}>
            <div className="flex items-center justify-between mb-3">
                <button
                    type="button"
                    onClick={() =>
                        canGoPrev &&
                        setAnchorMonth(
                            new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() - 1, 1),
                        )
                    }
                    disabled={!canGoPrev}
                    className={`px-3 py-1 rounded-md border-2 text-sm font-bold ${
                        canGoPrev
                            ? 'border-gray-800 text-gray-800 hover:bg-gray-800 hover:text-white'
                            : 'border-gray-300 text-gray-400 cursor-not-allowed'
                    }`}
                >
                    ←
                </button>
                <div className="text-sm text-gray-600">
                    {loading ? 'Loading availability...' : error ? error : ''}
                </div>
                <button
                    type="button"
                    onClick={() =>
                        canGoNext &&
                        setAnchorMonth(
                            new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + 1, 1),
                        )
                    }
                    disabled={!canGoNext}
                    className={`px-3 py-1 rounded-md border-2 text-sm font-bold ${
                        canGoNext
                            ? 'border-gray-800 text-gray-800 hover:bg-gray-800 hover:text-white'
                            : 'border-gray-300 text-gray-400 cursor-not-allowed'
                    }`}
                >
                    →
                </button>
            </div>

            <div
                className={`${monthsToShow === 1 ? 'grid grid-cols-1' : monthsToShow === 2 ? 'grid grid-cols-2' : 'grid grid-cols-3'} gap-6`}
            >
                {monthGrids.map((m, idx) => (
                    <div
                        key={`${m.label}-${idx}`}
                        className="border-2 border-gray-400 rounded-xl p-3 shadow-sm"
                    >
                        <div className="text-center font-semibold text-black mb-2">{m.label}</div>
                        <div className="grid grid-cols-7 gap-1 text-xs text-gray-500 mb-1">
                            {'Mon Tue Wed Thu Fri Sat Sun'.split(' ').map((d) => (
                                <div key={d} className="text-center">
                                    {d}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {m.cells.map((c) => {
                                const key = toDateKey(c.date);
                                const base =
                                    'relative aspect-square flex items-center justify-center rounded-md select-none';
                                const offMonth = c.inCurrentMonth ? '' : ' text-gray-300';
                                const disabled = c.disabled ? ' cursor-not-allowed opacity-40' : '';
                                const selected =
                                    c.isStart || c.isEnd
                                        ? ' bg-black text-white'
                                        : c.inRange
                                          ? ' bg-gray-200 text-black'
                                          : ' bg-white text-black';
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => handleSelect(c)}
                                        disabled={c.disabled}
                                        className={`${base}${offMonth}${disabled}${selected} border border-gray-200`}
                                        aria-disabled={c.disabled}
                                        aria-label={key}
                                    >
                                        {c.date.getDate()}
                                        {c.disabled && c.inCurrentMonth ? (
                                            <span className="absolute w-6 h-px bg-gray-500 rotate-[-20deg]"></span>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
