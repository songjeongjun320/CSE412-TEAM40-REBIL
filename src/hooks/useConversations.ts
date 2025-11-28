import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/hooks/cached/useAuth';
import type {
    GetConversationsResponse,
    UnreadCountResponse,
    UseConversationsReturn,
} from '@/types/message.types';

export function useConversations(): UseConversationsReturn {
    const { isAuthenticated } = useAuth();

    // Helper function to get auth headers
    const getAuthHeaders = (): Record<string, string> => {
        // Rely on cookies for authentication instead of Authorization header
        // The middleware will handle setting the proper auth cookies
        return {
            'Content-Type': 'application/json',
        };
    };

    // Fetch conversations query
    const {
        data: conversationsResponse,
        isLoading: conversationsLoading,
        error: conversationsError,
        refetch: refetchConversations,
    } = useQuery<GetConversationsResponse>({
        queryKey: ['conversations'],
        queryFn: async () => {
            const response = await fetch('/api/messages/conversations?limit=50', {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to fetch conversations');
            }

            return response.json();
        },
        enabled: typeof window !== 'undefined' && isAuthenticated, // Only run on client side when authenticated
        refetchInterval: 60000, // Refetch every minute
        staleTime: 30000, // Consider data stale after 30 seconds
    });

    // Fetch unread count query
    const {
        data: unreadCountResponse,
        error: unreadCountError,
        refetch: refetchUnreadCount,
    } = useQuery<UnreadCountResponse>({
        queryKey: ['unread-count'],
        queryFn: async () => {
            const response = await fetch('/api/messages/unread-count', {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to fetch unread count');
            }

            return response.json();
        },
        enabled: typeof window !== 'undefined' && isAuthenticated, // Only run on client side when authenticated
        refetchInterval: 30000, // Refetch every 30 seconds
        staleTime: 10000, // Consider data stale after 10 seconds
    });

    const error = conversationsError?.message || unreadCountError?.message || null;

    return {
        conversations: conversationsResponse?.conversations || [],
        isLoading: conversationsLoading,
        error,
        unreadCount: unreadCountResponse?.count || 0,
        refetch: () => {
            refetchConversations();
            refetchUnreadCount();
        },
        refetchUnreadCount,
    };
}
