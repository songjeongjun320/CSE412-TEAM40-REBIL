'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/cached/useAuth';

export interface HostInquiry {
    id: string;
    renter_id: string;
    host_id: string;
    vehicle_id: string;
    message: string;
    inquiry_type: 'general' | 'booking' | 'availability' | 'pricing';
    status: 'pending' | 'responded' | 'closed';
    created_at: string;
    preferred_dates?: {
        start: string;
        end: string;
    };
    renter: {
        id: string;
        full_name: string;
        email: string;
    };
    host: {
        id: string;
        full_name: string;
        email: string;
    };
    vehicle: {
        id: string;
        make: string;
        model: string;
        year: number;
        price_per_day?: number;
    };
}

interface UseHostInquiriesReturn {
    inquiries: HostInquiry[];
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
}

export function useHostInquiries(status: string = 'pending'): UseHostInquiriesReturn {
    const { session } = useAuth();
    const [inquiries, setInquiries] = useState<HostInquiry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchInquiries = useCallback(async () => {
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

            const params = new URLSearchParams({
                role: 'host',
                status,
                limit: '50',
                offset: '0',
            });

            const response = await fetch(`/api/messages/inquiries?${params}`, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch inquiries');
            }

            const data = await response.json();
            // Map the backend data to frontend format
            const mappedInquiries = (data.inquiries || []).map((inquiry: any) => ({
                ...inquiry,
                preferred_dates:
                    inquiry.preferred_start_date && inquiry.preferred_end_date
                        ? {
                              start: inquiry.preferred_start_date,
                              end: inquiry.preferred_end_date,
                          }
                        : undefined,
            }));
            setInquiries(mappedInquiries);
        } catch (err) {
            console.error('Error fetching host inquiries:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch inquiries');
        } finally {
            setIsLoading(false);
        }
    }, [session?.access_token, status]);

    useEffect(() => {
        fetchInquiries();
    }, [fetchInquiries]);

    return {
        inquiries,
        isLoading,
        error,
        refetch: fetchInquiries,
    };
}
