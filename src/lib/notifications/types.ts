import { Database } from '@/types/base/database.types';

type CarStatus = Database['public']['Enums']['car_status'];

/**
 * Car status change notification data
 */
export interface CarStatusChange {
    id: string;
    old_status: CarStatus | null;
    new_status: CarStatus;
    host_id: string;
    make: string;
    model: string;
    year: number;
    updated_at: string;
}

/**
 * Admin notification data for new vehicle submissions
 */
export interface AdminNotification {
    id: string;
    type: 'CAR_SUBMITTED_FOR_APPROVAL' | 'CAR_STATUS_CHANGED';
    car_id: string;
    host_id: string;
    host_name?: string;
    host_email?: string;
    car_make: string;
    car_model: string;
    car_year: number;
    old_status?: CarStatus;
    new_status: CarStatus;
    timestamp: string;
    read: boolean;
}

/**
 * Realtime subscription configuration
 */
export interface SubscriptionConfig {
    table: string;
    filter?: string;
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
}

/**
 * Subscription callback function types
 */
export type CarStatusChangeCallback = (data: CarStatusChange) => void;
export type AdminNotificationCallback = (data: AdminNotification) => void;

/**
 * Error handling configuration
 */
export interface ErrorHandlingConfig {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    enableExponentialBackoff?: boolean;
}

/**
 * Notification service configuration
 */
export interface NotificationServiceConfig {
    errorHandling?: ErrorHandlingConfig;
    debug?: boolean;
    autoReconnect?: boolean;
    maxConnections?: number;
    connectionTimeout?: number;
    cleanupInterval?: number;
    enableHealthCheck?: boolean;
}

/**
 * Subscription cleanup function type
 */
export type UnsubscribeFunction = () => void;

/**
 * Service statistics for debugging and monitoring
 */
export interface ServiceStats {
    reconnectAttempts: number;
    isDestroyed: boolean;
    totalSubscriptions: number;
    activeSubscriptions: number;
    subscriptionDetails: Array<{
        channelName: string;
        isActive: boolean;
        callbackCount: number;
    }>;
}
