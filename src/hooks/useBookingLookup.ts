import { useCallback, useState } from 'react';

interface BookingInfo {
    booking_id: string;
    booking_status: string;
    vehicle_info: {
        make: string;
        model: string;
        year: number;
    };
    relationship: 'host_to_renter' | 'renter_to_host';
    created_at: string;
}

interface BookingLookupState {
    booking: BookingInfo | null;
    isLoading: boolean;
    error: string | null;
    hasSearched: boolean;
}

interface UseBookingLookupReturn extends BookingLookupState {
    findBooking: (otherUserId: string) => Promise<void>;
    reset: () => void;
}

export function useBookingLookup(): UseBookingLookupReturn {
    const [state, setState] = useState<BookingLookupState>({
        booking: null,
        isLoading: false,
        error: null,
        hasSearched: false,
    });

    const findBooking = useCallback(async (otherUserId: string) => {
        console.log('[BookingLookup] Starting booking lookup for user ID:', otherUserId);

        if (!otherUserId) {
            console.error('[BookingLookup] Error: Other user ID is required');
            setState((prev) => ({
                ...prev,
                error: 'Other user ID is required',
                hasSearched: true,
            }));
            return;
        }

        // Validate that the ID looks like a UUID
        const uuidPattern =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(otherUserId)) {
            console.error('[BookingLookup] Error: Invalid UUID format:', otherUserId);
            setState((prev) => ({
                ...prev,
                error: `Invalid user ID format. Expected UUID, got: ${otherUserId}`,
                hasSearched: true,
            }));
            return;
        }

        console.log('[BookingLookup] Valid UUID format confirmed, starting API request...');

        setState((prev) => ({
            ...prev,
            isLoading: true,
            error: null,
            hasSearched: false,
        }));

        try {
            const requestBody = { target_user_id: otherUserId };
            console.log('[BookingLookup] API request body:', requestBody);

            const response = await fetch('/api/messages/find-booking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            console.log('[BookingLookup] API response status:', response.status);

            const data = await response.json();
            console.log('[BookingLookup] API response data:', data);

            if (!response.ok) {
                // If no booking found, that's not an error, just no booking
                if (response.status === 404) {
                    console.log('[BookingLookup] No booking found between users (404)');
                    setState((prev) => ({
                        ...prev,
                        booking: null,
                        isLoading: false,
                        hasSearched: true,
                    }));
                    return;
                }
                console.error('[BookingLookup] API error:', data.error);
                throw new Error(data.error || 'Failed to find booking');
            }

            console.log('[BookingLookup] Booking found successfully:', data.booking);
            setState((prev) => ({
                ...prev,
                booking: data.booking,
                isLoading: false,
                hasSearched: true,
            }));
        } catch (error) {
            console.error('[BookingLookup] Exception during booking lookup:', error);
            setState((prev) => ({
                ...prev,
                booking: null,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Failed to find booking',
                hasSearched: true,
            }));
        }
    }, []);

    const reset = useCallback(() => {
        setState({
            booking: null,
            isLoading: false,
            error: null,
            hasSearched: false,
        });
    }, []);

    return {
        ...state,
        findBooking,
        reset,
    };
}
