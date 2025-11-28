'use client';

import { createClient } from '@/lib/supabase/supabaseClient';

export interface VehicleCalendarDay {
    date: string; // YYYY-MM-DD
    is_available: boolean;
    status: string;
    details?: Record<string, unknown> | null;
}

export async function getVehicleCalendar(
    carId: string,
    year: number,
    month: number,
): Promise<VehicleCalendarDay[]> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_vehicle_calendar', {
        p_car_id: carId,
        p_year: year,
        p_month: month,
    });

    if (error) {
        // Standardize thrown error for caller
        const err = new Error(
            `Failed to load availability calendar: ${error.message || 'Unknown error'}`,
        );
        // @ts-expect-error attach raw error for diagnostics
        err.raw = error;
        throw err;
    }

    return (data || []) as VehicleCalendarDay[];
}

export function toDateKey(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = `${date.getMonth() + 1}`.padStart(2, '0');
    const dd = `${date.getDate()}`.padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export function addDays(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
}

export function startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}
