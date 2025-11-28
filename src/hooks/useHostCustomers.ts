'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/cached/useAuth';

export interface HostCustomer {
    renter_id: string;
    renter_email: string;
    renter_name: string;
    total_bookings: number;
    completed_bookings: number;
    total_spent: number;
    average_rating: number;
    last_booking_date: string;
    renter_score: number;
    cancellation_rate: number;
    bookings_with_this_host: number;
}

interface UseHostCustomersReturn {
    customers: HostCustomer[];
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
}

export function useHostCustomers(): UseHostCustomersReturn {
    const { session } = useAuth();
    const [customers, setCustomers] = useState<HostCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCustomers = useCallback(async () => {
        if (!session?.access_token) {
            setError('Authentication required');
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            };

            const response = await fetch('/api/messages/customers', {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch customers');
            }

            const data = await response.json();

            // Validate and filter customers to ensure required fields are present
            const validCustomers = (data.customers || []).filter((customer: HostCustomer) => {
                if (!customer.renter_id) {
                    console.error('[useHostCustomers] Customer missing renter_id:', customer);
                    return false;
                }
                if (!customer.renter_email) {
                    console.error('[useHostCustomers] Customer missing renter_email:', customer);
                    return false;
                }
                return true;
            });

            console.log(
                `[useHostCustomers] Loaded ${validCustomers.length} valid customers out of ${data.customers?.length || 0} total`,
            );
            setCustomers(validCustomers);
        } catch (err) {
            console.error('Error fetching host customers:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch customers');
        } finally {
            setIsLoading(false);
        }
    }, [session?.access_token]);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    return {
        customers,
        isLoading,
        error,
        refetch: fetchCustomers,
    };
}
