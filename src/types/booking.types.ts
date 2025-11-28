// Enhanced booking validation system types

export interface BookingValidationResponse {
    booking_id: string | null;
    success: boolean;
    status: string | null;
    approval_type: string | null;
    message: string;
    details: Record<string, unknown>;
}

export interface AvailabilityCheckResponse {
    is_available: boolean;
    conflict_message?: string;
    conflict_type?: string;
    conflicting_bookings?: Array<{
        id: string;
        start_date: string;
        end_date: string;
        status: string;
    }>;
}

export interface ConflictCheckResponse {
    has_conflict: boolean;
    conflict_count: number;
    conflicting_bookings: Array<{
        id: string;
        start_date: string;
        end_date: string;
        status: string;
    }>;
}

export interface AutoApprovalResponse {
    is_eligible: boolean;
    approval_score: number;
    eligibility_details: {
        reason?: string;
        advance_hours?: number;
        amount_check?: boolean;
        verification_score?: number;
        booking_history_score?: number;
        cancellation_rate?: number;
        dispute_count?: number;
        calculated_score?: number;
    };
}

export type BookingStatus =
    | 'PENDING'
    | 'AUTO_APPROVED'
    | 'CONFIRMED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'DISPUTED';

export interface EnhancedBookingData {
    car_id: string;
    renter_id: string;
    host_id: string;
    start_date: string;
    end_date: string;
    pickup_location: Record<string, unknown>;
    dropoff_location: Record<string, unknown>;
    insurance_type: string;
    daily_rate: number;
    total_days: number;
    subtotal: number;
    insurance_fee: number;
    service_fee: number;
    delivery_fee: number;
    total_amount: number;
    security_deposit: number;
    special_instructions?: string;
}

// Emergency cancellation types
export type EmergencyCancellationReason =
    | 'vehicleBreakdown'
    | 'medicalEmergency'
    | 'naturalDisaster'
    | 'familyEmergency'
    | 'other';

export interface CancellationPolicy {
    // Cancellation fees based on timing
    beforeStart: number; // Before start: 10%
    during: number; // During rental: 30%
    afterStart: number; // After start: 50%

    // Special discount fees by reason
    emergencyReasons: {
        vehicleBreakdown: number; // Vehicle breakdown: 50% discount
        medicalEmergency: number; // Medical emergency: 70% discount
        naturalDisaster: number; // Natural disaster: 100% discount
        familyEmergency: number; // Family emergency: 60% discount
        other: number; // Other: No discount
    };
}

export interface EmergencyCancellationResult {
    fee: number;
    refund: number;
    feeRate: number;
    reason: EmergencyCancellationReason;
}

export interface EmergencyCancelModalProps {
    booking: any; // Will be ExtendedBooking from the component
    onClose: () => void;
    onConfirm: (reason: EmergencyCancellationReason, details: string) => void;
    loading: boolean;
}
