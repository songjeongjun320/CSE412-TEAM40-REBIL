// Message system types

export interface Message {
    id: string;
    booking_id: string;
    sender_id: string;
    receiver_id: string;
    message: string;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
    sender_name?: string;
    receiver_name?: string;
}

export interface Conversation {
    booking_id: string;
    other_user_id: string;
    other_user_name: string;
    vehicle_name: string;
    last_message: string | null;
    last_message_at: string | null;
    unread_count: number;
    booking_status: string;
}

// Request/Response types for API
export interface SendMessageRequest {
    booking_id: string;
    receiver_id: string;
    message: string;
}

export interface SendMessageResponse {
    success: boolean;
    message_id?: string;
    error?: string;
}

export interface GetMessagesResponse {
    success: boolean;
    messages?: Message[];
    error?: string;
}

export interface GetConversationsResponse {
    success: boolean;
    conversations?: Conversation[];
    error?: string;
}

export interface MarkReadResponse {
    success: boolean;
    updated_count?: number;
    error?: string;
}

export interface UnreadCountResponse {
    success: boolean;
    count?: number;
    error?: string;
}

// Query parameters
export interface GetMessagesParams {
    booking_id: string;
    limit?: number;
    offset?: number;
}

export interface GetConversationsParams {
    limit?: number;
    offset?: number;
}

export interface MarkMessagesReadParams {
    booking_id: string;
    message_ids?: string[];
}

// Hook return types
export interface UseMessagesReturn {
    messages: Message[];
    isLoading: boolean;
    error: string | null;
    sendMessage: (message: string, receiver_id: string) => Promise<boolean>;
    markAsRead: (message_ids?: string[]) => Promise<boolean>;
    refetch: () => void;
}

export interface UseConversationsReturn {
    conversations: Conversation[];
    isLoading: boolean;
    error: string | null;
    unreadCount: number;
    refetch: () => void;
    refetchUnreadCount: () => void;
}

// Component props
export interface MessageThreadProps {
    booking_id: string;
    current_user_id: string;
    other_user_id: string;
    other_user_name: string;
    onNewMessage?: (message: Message) => void;
}

export interface MessageInputProps {
    booking_id: string;
    receiver_id: string;
    onMessageSent: () => void;
    disabled?: boolean;
    placeholder?: string;
}

export interface ConversationListProps {
    conversations: Conversation[];
    onConversationSelect: (booking_id: string) => void;
    selectedBookingId?: string | null;
    isLoading?: boolean;
}

export interface MessageNotificationProps {
    unreadCount: number;
    onClick?: () => void;
}

// Utility types
export type MessageStatus = 'sending' | 'sent' | 'read' | 'failed';

export interface MessageWithStatus extends Message {
    status: MessageStatus;
    tempId?: string; // For optimistic updates
}

// Error types
export enum MessageErrorType {
    OFFLINE_BOOKING = 'OFFLINE_BOOKING',
    UNAUTHORIZED = 'UNAUTHORIZED',
    INVALID_MESSAGE = 'INVALID_MESSAGE',
    NETWORK_ERROR = 'NETWORK_ERROR',
    SERVER_ERROR = 'SERVER_ERROR',
}

export interface MessageError {
    type: MessageErrorType;
    message: string;
    details?: any;
}

// Find booking types for messaging between users
export interface FindBookingRequest {
    target_user_id: string;
}

export interface FindBookingResponse {
    success: boolean;
    booking?: {
        booking_id: string;
        booking_status: string;
        vehicle_info: {
            make: string;
            model: string;
            year: number;
        };
        relationship: 'host_to_renter' | 'renter_to_host';
        created_at: string;
    };
    error?: string;
}
