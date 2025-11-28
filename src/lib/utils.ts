import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import {
    CancellationPolicy,
    EmergencyCancellationReason,
    EmergencyCancellationResult,
} from '@/types/booking.types';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Emergency cancellation policy
export const CANCELLATION_POLICY: CancellationPolicy = {
    beforeStart: 0.1, // 10%
    during: 0.3, // 30%
    afterStart: 0.5, // 50%
    emergencyReasons: {
        vehicleBreakdown: 0.5, // 50% discount
        medicalEmergency: 0.3, // 70% discount
        naturalDisaster: 0.0, // 100% discount
        familyEmergency: 0.4, // 60% discount
        other: 1.0, // No discount
    },
};

// Emergency cancellation reason labels
export const EMERGENCY_REASON_LABELS: Record<EmergencyCancellationReason, string> = {
    vehicleBreakdown: 'Vehicle Breakdown',
    medicalEmergency: 'Medical Emergency',
    naturalDisaster: 'Natural Disaster',
    familyEmergency: 'Family Emergency',
    other: 'Other',
};

// Emergency cancellation reason descriptions
export const EMERGENCY_REASON_DESCRIPTIONS: Record<EmergencyCancellationReason, string> = {
    vehicleBreakdown: 'Unavoidable cancellation due to mechanical failure of the vehicle',
    medicalEmergency: "Emergency medical situation requiring doctor's diagnosis",
    naturalDisaster: 'Natural disasters, government emergency declarations, etc.',
    familyEmergency: 'Unavoidable cancellation due to family emergency',
    other: 'Other reasons (detailed explanation required)',
};

/**
 * Calculates emergency cancellation fees.
 * @param booking Booking information
 * @param reason Cancellation reason
 * @param currentDate Current date
 * @returns Fee calculation result
 */
export function calculateEmergencyCancellationFee(
    booking: {
        start_date: string;
        end_date: string;
        total_amount: number;
    },
    reason: EmergencyCancellationReason,
    currentDate: Date = new Date(),
): EmergencyCancellationResult {
    const startDate = new Date(booking.start_date);
    const endDate = new Date(booking.end_date);

    // Calculate cancellation timing
    let baseFeeRate = 0;
    if (currentDate < startDate) {
        baseFeeRate = CANCELLATION_POLICY.beforeStart; // 10%
    } else if (currentDate <= endDate) {
        baseFeeRate = CANCELLATION_POLICY.during; // 30%
    } else {
        baseFeeRate = CANCELLATION_POLICY.afterStart; // 50%
    }

    // Apply reason-based discount
    const discount = CANCELLATION_POLICY.emergencyReasons[reason] || 1.0;
    const finalFeeRate = baseFeeRate * discount;

    const fee = Math.round(booking.total_amount * finalFeeRate * 100) / 100;
    const refund = Math.round((booking.total_amount - fee) * 100) / 100;

    return {
        fee,
        refund,
        feeRate: finalFeeRate,
        reason,
    };
}

/**
 * Returns cancellation timing as text.
 * @param booking Booking information
 * @param currentDate Current date
 * @returns Cancellation timing text
 */
export function getCancellationTimingText(
    booking: {
        start_date: string;
        end_date: string;
    },
    currentDate: Date = new Date(),
): string {
    const startDate = new Date(booking.start_date);
    const endDate = new Date(booking.end_date);

    if (currentDate < startDate) {
        const daysUntilStart = Math.ceil(
            (startDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        return `${daysUntilStart} days before rental start`;
    } else if (currentDate <= endDate) {
        return 'Rental in progress';
    } else {
        const daysAfterEnd = Math.ceil(
            (currentDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        return `${daysAfterEnd} days after rental end`;
    }
}

/**
 * Converts fee rate to percentage text.
 * @param rate Fee rate (0.0 ~ 1.0)
 * @returns Percentage text
 */
export function formatFeeRate(rate: number): string {
    return `${Math.round(rate * 100)}%`;
}

/**
 * Format amount in Indonesian Rupiah with comma separators.
 * @param amount Amount to format
 * @returns Formatted currency string (e.g., "Rp 150,000")
 */
export function formatCurrency(amount: number): string {
    return `Rp ${amount.toLocaleString('en-US')}`;
}

/**
 * Daily rate text formatting.
 * @param amount Daily rate amount
 * @returns Formatted daily rate text (e.g., "Rp 150,000/day")
 */
export function formatDailyRate(amount: number): string {
    return `${formatCurrency(amount)}/day`;
}

/**
 * Converts USD to IDR (using fixed exchange rate)
 * @param usdAmount USD amount
 * @returns IDR amount
 */
export function convertUSDToIDR(usdAmount: number): number {
    const exchangeRate = 15500; // 1 USD = 15,500 IDR (approximate)
    return Math.round(usdAmount * exchangeRate);
}

/**
 * Calculates optimized pricing based on daily rates.
 * Applies weekly/monthly discounts.
 * @param dailyRate Daily rate
 * @param days Rental days
 * @returns Calculated pricing information
 * @deprecated Use calculateTieredRent instead for new tiered pricing system
 */
export function calculateOptimizedRent(
    dailyRate: number,
    days: number,
): {
    subtotal: number;
    effectiveRate: number;
    discountApplied: string | null;
    originalCost: number;
    savings: number;
} {
    const originalCost = dailyRate * days;
    let subtotal = originalCost;
    let discountApplied: string | null = null;
    let effectiveRate = dailyRate;

    if (days >= 30) {
        // Monthly discount: 20% off for 30+ days
        subtotal = Math.round(dailyRate * days * 0.8);
        effectiveRate = Math.round(dailyRate * 0.8);
        discountApplied = 'Monthly discount (20%)';
    } else if (days >= 7) {
        // Weekly discount: 10% off for 7-29 days
        subtotal = Math.round(dailyRate * days * 0.9);
        effectiveRate = Math.round(dailyRate * 0.9);
        discountApplied = 'Weekly discount (10%)';
    }

    const savings = originalCost - subtotal;

    return {
        subtotal,
        effectiveRate,
        discountApplied,
        originalCost,
        savings,
    };
}

/**
 * Calculates pricing using new tiered pricing system.
 * Uses host-set weekly/monthly daily rates.
 * @param dailyRate Basic daily rate (1-6 days)
 * @param weeklyDailyRate Weekly daily rate (7-29 days), null if using basic rate
 * @param monthlyDailyRate Monthly daily rate (30+ days), null if using weekly or basic rate
 * @param days Rental days
 * @returns Calculated pricing information
 */
export function calculateTieredRent(
    dailyRate: number,
    weeklyDailyRate: number | null,
    monthlyDailyRate: number | null,
    days: number,
): {
    subtotal: number;
    effectiveRate: number;
    rateType: 'daily' | 'weekly' | 'monthly';
    discountApplied: string | null;
    originalCost: number;
    savings: number;
} {
    const originalCost = dailyRate * days;
    let effectiveRate: number;
    let rateType: 'daily' | 'weekly' | 'monthly';
    let discountApplied: string | null = null;

    // Determine which rate to use based on duration and availability
    if (days >= 30 && monthlyDailyRate !== null) {
        effectiveRate = monthlyDailyRate;
        rateType = 'monthly';
        const discountPercent = Math.round(((dailyRate - monthlyDailyRate) / dailyRate) * 100);
        discountApplied = `Monthly discount (${discountPercent}%)`;
    } else if (days >= 7 && weeklyDailyRate !== null) {
        effectiveRate = weeklyDailyRate;
        rateType = 'weekly';
        const discountPercent = Math.round(((dailyRate - weeklyDailyRate) / dailyRate) * 100);
        discountApplied = `Weekly discount (${discountPercent}%)`;
    } else {
        effectiveRate = dailyRate;
        rateType = 'daily';
    }

    const subtotal = Math.round(effectiveRate * days);
    const savings = originalCost - subtotal;

    return {
        subtotal,
        effectiveRate,
        rateType,
        discountApplied,
        originalCost,
        savings,
    };
}
