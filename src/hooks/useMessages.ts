import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useAuth } from '@/hooks/cached/useAuth';
import type {
    GetMessagesResponse,
    MarkReadResponse,
    SendMessageResponse,
    UseMessagesReturn,
} from '@/types/message.types';

export function useMessages(bookingId: string, receiverId: string): UseMessagesReturn {
    const { isAuthenticated } = useAuth();
    const queryClient = useQueryClient();
    const [error, setError] = useState<string | null>(null);

    // Helper function to get auth headers
    const getAuthHeaders = () => {
        // Rely on cookies for authentication instead of Authorization header
        // The middleware will handle setting the proper auth cookies
        return {
            'Content-Type': 'application/json',
        };
    };

    // Fetch messages query
    const {
        data: messagesResponse,
        isLoading,
        error: queryError,
        refetch,
    } = useQuery<GetMessagesResponse>({
        queryKey: ['messages', bookingId],
        queryFn: async () => {
            const response = await fetch(`/api/messages?booking_id=${bookingId}&limit=100`, {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to fetch messages');
            }

            return response.json();
        },
        enabled: !!bookingId && typeof window !== 'undefined' && isAuthenticated, // Only run on client side with valid booking ID and auth
        refetchInterval: 30000, // Refetch every 30 seconds for near real-time updates
        staleTime: 10000, // Consider data stale after 10 seconds
    });

    // Send message mutation
    const sendMessageMutation = useMutation<SendMessageResponse, Error, string>({
        mutationFn: async (message: string) => {
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    booking_id: bookingId,
                    receiver_id: receiverId,
                    message: message.trim(),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send message');
            }

            return response.json();
        },
        onSuccess: () => {
            // Invalidate and refetch messages
            queryClient.invalidateQueries({ queryKey: ['messages', bookingId] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
            queryClient.invalidateQueries({ queryKey: ['unread-count'] });
            setError(null);
        },
        onError: (error) => {
            setError(error.message);
        },
    });

    // Mark messages as read mutation
    const markAsReadMutation = useMutation<MarkReadResponse, Error, string[] | undefined>({
        mutationFn: async (messageIds?: string[]) => {
            // Don't make request if no message IDs provided
            if (!messageIds || messageIds.length === 0) {
                throw new Error('No message IDs provided');
            }

            const response = await fetch('/api/messages/read', {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    booking_id: bookingId,
                    message_ids: messageIds,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to mark messages as read');
            }

            return response.json();
        },
        retry: 1, // Only retry once to prevent infinite loops
        retryDelay: 1000, // Wait 1 second before retry
        onSuccess: (data, messageIds) => {
            // Update messages optimistically
            queryClient.setQueryData(
                ['messages', bookingId],
                (oldData: GetMessagesResponse | undefined) => {
                    if (!oldData || !messageIds || !oldData.messages) return oldData;

                    return {
                        ...oldData,
                        messages: oldData.messages.map((msg) =>
                            messageIds.includes(msg.id) ? { ...msg, is_read: true } : msg,
                        ),
                    };
                },
            );

            // Update unread count optimistically
            queryClient.setQueryData(['unread-count'], (oldData: any) => {
                if (!oldData || !messageIds) return oldData;

                const newCount = Math.max(0, (oldData.count || 0) - messageIds.length);
                return {
                    ...oldData,
                    count: newCount,
                };
            });

            // Update conversations optimistically to reflect new unread count
            queryClient.setQueryData(['conversations'], (oldData: any) => {
                if (!oldData || !messageIds) return oldData;

                return {
                    ...oldData,
                    conversations: oldData.conversations.map((conv: any) =>
                        conv.booking_id === bookingId
                            ? { ...conv, unread_count: 0 } // Set to 0 since we're marking all unread messages as read
                            : conv,
                    ),
                };
            });

            // Invalidate and refetch conversations and unread count for server sync
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
            queryClient.invalidateQueries({ queryKey: ['unread-count'] });
            setError(null);
        },
        onError: (error) => {
            setError(error.message);
        },
    });

    // Send message function
    const sendMessage = useCallback(
        async (message: string): Promise<boolean> => {
            try {
                await sendMessageMutation.mutateAsync(message);
                return true;
            } catch (error) {
                console.error('Failed to send message:', error);
                return false;
            }
        },
        [sendMessageMutation],
    );

    // Mark as read function
    const markAsRead = useCallback(
        async (messageIds?: string[]): Promise<boolean> => {
            // Prevent duplicate calls while one is in progress
            if (markAsReadMutation.isPending) {
                console.log('Mark as read already in progress, skipping...');
                return false;
            }

            // Don't make request if no message IDs provided
            if (!messageIds || messageIds.length === 0) {
                console.log('No message IDs to mark as read');
                return false;
            }

            try {
                await markAsReadMutation.mutateAsync(messageIds);
                return true;
            } catch (error) {
                console.error('Failed to mark messages as read:', error);
                return false;
            }
        },
        [markAsReadMutation],
    );

    return {
        messages: messagesResponse?.messages || [],
        isLoading: isLoading || sendMessageMutation.isPending || markAsReadMutation.isPending,
        error: error || queryError?.message || null,
        sendMessage,
        markAsRead,
        refetch: () => {
            refetch();
            setError(null);
        },
    };
}
