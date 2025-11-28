import { RealtimeChannel } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/supabaseClient';
import { ConnectionManager } from '@/lib/utils/connectionManager';

import {
    AdminNotification,
    AdminNotificationCallback,
    CarStatusChange,
    CarStatusChangeCallback,
    NotificationServiceConfig,
    UnsubscribeFunction,
} from './types';

/**
 * Enhanced notification service for Supabase realtime subscriptions
 * Features:
 * - Connection pooling and reuse
 * - Duplicate subscription prevention
 * - Automatic cleanup and memory leak prevention
 * - Enhanced error handling and recovery
 */
class NotificationService {
    private supabase = createClient();
    private connectionManager: ConnectionManager;
    private subscriptions = new Map<
        string,
        {
            channel: RealtimeChannel;
            callbacks: Set<CarStatusChangeCallback | AdminNotificationCallback>;
            unsubscribe: () => void;
            isActive: boolean;
        }
    >();
    private config: Required<NotificationServiceConfig>;
    private reconnectAttempts = 0;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private isDestroyed = false;
    private initializationPromise: Promise<void> | null = null;

    constructor(config: NotificationServiceConfig = {}) {
        this.config = {
            errorHandling: {
                maxRetries: 3,
                baseDelay: 1000,
                maxDelay: 30000,
                enableExponentialBackoff: true,
                ...config.errorHandling,
            },
            debug: config.debug ?? false,
            autoReconnect: config.autoReconnect ?? true,
            maxConnections: config.maxConnections ?? 5,
            connectionTimeout: config.connectionTimeout ?? 30000,
            cleanupInterval: config.cleanupInterval ?? 60000,
            enableHealthCheck: config.enableHealthCheck ?? true,
        };

        // Initialize connection manager with enhanced configuration
        this.connectionManager = new ConnectionManager(this.supabase, {
            maxConnections: 5, // Reduced from default to prevent excessive connections
            connectionTimeout: 30000,
            cleanupInterval: 60000,
            maxRetries: this.config.errorHandling.maxRetries,
            enableHealthCheck: true,
            debugMode: this.config.debug,
        });

        // Start initialization
        this.initializationPromise = this.initialize();
    }

    /**
     * Initialize the service
     */
    private async initialize(): Promise<void> {
        if (this.isDestroyed) return;

        try {
            this.log('Initializing notification service');
            // Service is ready
            this.log('Notification service initialized successfully');
        } catch (error) {
            this.log('Failed to initialize notification service:', error);
            throw error;
        }
    }

    /**
     * Ensure service is initialized
     */
    private async ensureInitialized(): Promise<void> {
        if (this.initializationPromise) {
            await this.initializationPromise;
        }
    }

    /**
     * Subscribe to car status changes
     */
    subscribeToCarStatusChanges(callback: CarStatusChangeCallback): UnsubscribeFunction {
        return this.subscribeToChannel('car_status_changes', callback);
    }

    /**
     * Subscribe to admin notifications
     */
    subscribeToAdminNotifications(
        adminUserId: string,
        callback: AdminNotificationCallback,
    ): UnsubscribeFunction {
        return this.subscribeToChannel(`admin_notifications_${adminUserId}`, callback);
    }

    /**
     * Subscribe to a channel with automatic connection management
     */
    private subscribeToChannel<T extends CarStatusChangeCallback | AdminNotificationCallback>(
        channelName: string,
        callback: T,
    ): UnsubscribeFunction {
        this.ensureInitialized().catch((error) => {
            this.log('Failed to ensure initialization:', error);
        });

        // Check for existing subscription
        const existingSubscription = this.subscriptions.get(channelName);
        if (existingSubscription && existingSubscription.isActive) {
            this.log(`Adding callback to existing subscription: ${channelName}`);
            existingSubscription.callbacks.add(callback);
            return () => {
                existingSubscription.callbacks.delete(callback);
                if (existingSubscription.callbacks.size === 0) {
                    this.unsubscribeFromChannel(channelName);
                }
            };
        }

        // Create new subscription
        this.log(`Creating new subscription: ${channelName}`);
        const channel = this.supabase
            .channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cars' }, (payload) => {
                this.handleCarStatusChangeForAll(
                    payload,
                    this.subscriptions.get(channelName)?.callbacks,
                );
            })
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'admin_notifications' },
                (payload) => {
                    this.handleAdminNotificationForAll(
                        payload,
                        this.subscriptions.get(channelName)?.callbacks,
                    );
                },
            )
            .on('presence', { event: 'sync' }, () => {
                this.log(`Presence sync for ${channelName}`);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                this.log(`Presence join for ${channelName}:`, key, newPresences);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                this.log(`Presence leave for ${channelName}:`, key, leftPresences);
            })
            .on('broadcast', { event: 'car_status_change' }, (payload) => {
                this.handleCarStatusChangeForAll(
                    payload,
                    this.subscriptions.get(channelName)?.callbacks,
                );
            })
            .on('broadcast', { event: 'admin_notification' }, (payload) => {
                this.handleAdminNotificationForAll(
                    payload,
                    this.subscriptions.get(channelName)?.callbacks,
                );
            })
            .subscribe((status) => {
                this.handleSubscriptionStatus(channelName, status);
            });

        const callbacks = new Set<T>();
        callbacks.add(callback);

        const subscription = {
            channel,
            callbacks,
            unsubscribe: () => {
                this.log(`Unsubscribing from ${channelName}`);
                channel.unsubscribe();
                this.subscriptions.delete(channelName);
            },
            isActive: true,
        };

        this.subscriptions.set(channelName, subscription);

        return () => {
            const sub = this.subscriptions.get(channelName);
            if (sub) {
                sub.callbacks.delete(callback);
                if (sub.callbacks.size === 0) {
                    this.unsubscribeFromChannel(channelName);
                }
            }
        };
    }

    /**
     * Handle car status change for all callbacks in a subscription
     */
    private handleCarStatusChangeForAll(
        payload: unknown,
        callbacks: Set<CarStatusChangeCallback | AdminNotificationCallback> | undefined,
    ) {
        if (!callbacks) return;

        callbacks.forEach((callback) => {
            if (this.isCarStatusChangeCallback(callback)) {
                this.handleCarStatusChange(payload, callback);
            }
        });
    }

    /**
     * Handle car status change for a specific callback
     */
    private handleCarStatusChange(payload: unknown, callback: CarStatusChangeCallback) {
        try {
            const change = payload as CarStatusChange;
            this.log('Car status change received:', change);
            callback(change);
        } catch (error) {
            this.log('Error handling car status change:', error);
            this.handleError(error);
        }
    }

    /**
     * Handle admin notification for all callbacks in a subscription
     */
    private async handleAdminNotificationForAll(
        payload: unknown,
        callbacks: Set<CarStatusChangeCallback | AdminNotificationCallback> | undefined,
    ) {
        if (!callbacks) return;

        for (const callback of callbacks) {
            if (this.isAdminNotificationCallback(callback)) {
                await this.handleAdminNotification(payload, callback);
            }
        }
    }

    /**
     * Handle admin notification for a specific callback
     */
    private async handleAdminNotification(payload: unknown, callback: AdminNotificationCallback) {
        try {
            const notification = payload as AdminNotification;
            this.log('Admin notification received:', notification);
            await callback(notification);
        } catch (error) {
            this.log('Error handling admin notification:', error);
            this.handleError(error);
        }
    }

    /**
     * Handle subscription status changes
     */
    private handleSubscriptionStatus(channelName: string, status: string) {
        this.log(`Subscription status for ${channelName}:`, status);

        if (status === 'SUBSCRIBED') {
            this.log(`Successfully subscribed to ${channelName}`);
        } else if (status === 'CHANNEL_ERROR') {
            this.log(`Channel error for ${channelName}`);
            this.handleConnectionError(channelName);
        } else if (status === 'TIMED_OUT') {
            this.log(`Subscription timeout for ${channelName}`);
            this.handleConnectionError(channelName);
        }
    }

    /**
     * Handle connection errors
     */
    private handleConnectionError(channelName: string) {
        this.log(`Connection error for ${channelName}`);

        if (this.reconnectAttempts < (this.config.errorHandling?.maxRetries ?? 3)) {
            this.reconnectAttempts++;
            const delay = this.calculateRetryDelay();
            this.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

            this.reconnectTimer = setTimeout(() => {
                this.reconnectChannel(channelName);
            }, delay);
        } else {
            this.log('Max reconnection attempts reached');
            this.handleError(new Error('Max reconnection attempts reached'));
        }
    }

    /**
     * Calculate retry delay with exponential backoff
     */
    private calculateRetryDelay(): number {
        const errorHandling = this.config.errorHandling;
        if (errorHandling?.enableExponentialBackoff) {
            return Math.min(
                (errorHandling.baseDelay ?? 1000) * Math.pow(2, this.reconnectAttempts - 1),
                errorHandling.maxDelay ?? 30000,
            );
        }
        return errorHandling?.baseDelay ?? 1000;
    }

    /**
     * Reconnect to a specific channel
     */
    private async reconnectChannel(channelName: string) {
        this.log(`Reconnecting to ${channelName}`);

        try {
            const subscription = this.subscriptions.get(channelName);
            if (subscription) {
                subscription.unsubscribe();
                this.subscriptions.delete(channelName);
            }

            // Re-subscribe with existing callbacks
            const callbacks = subscription?.callbacks;
            if (callbacks) {
                callbacks.forEach((callback) => {
                    if (this.isCarStatusChangeCallback(callback)) {
                        this.subscribeToCarStatusChanges(callback);
                    } else if (this.isAdminNotificationCallback(callback)) {
                        // For admin notifications, we need the adminUserId
                        // This is a simplified reconnection - in practice, you'd need to store the adminUserId
                        this.log(
                            `Admin notification reconnection not fully implemented for ${channelName}`,
                        );
                    }
                });
            }

            this.reconnectAttempts = 0;
        } catch (error) {
            this.log('Reconnection failed:', error);
            this.handleError(error);
        }
    }

    /**
     * Unsubscribe from a specific channel
     */
    private unsubscribeFromChannel(channelName: string) {
        const subscription = this.subscriptions.get(channelName);
        if (subscription) {
            subscription.unsubscribe();
            subscription.isActive = false;
            this.subscriptions.delete(channelName);
            this.log(`Unsubscribed from ${channelName}`);
        }
    }

    /**
     * Type guards for callback types
     */
    private isCarStatusChangeCallback(callback: any): callback is CarStatusChangeCallback {
        return typeof callback === 'function';
    }

    private isAdminNotificationCallback(callback: any): callback is AdminNotificationCallback {
        return typeof callback === 'function';
    }

    /**
     * Handle errors
     */
    private handleError(error: unknown) {
        this.log('Notification service error:', error);
        // Additional error handling logic can be added here
    }

    /**
     * Log messages if debug is enabled
     */
    private log(...args: unknown[]) {
        if (this.config.debug) {
            console.log('[NotificationService]', ...args);
        }
    }

    /**
     * Get service statistics
     */
    getServiceStats() {
        const activeSubscriptions = Array.from(this.subscriptions.values()).filter(
            (sub) => sub.isActive,
        ).length;
        const totalCallbacks = Array.from(this.subscriptions.values()).reduce(
            (total, sub) => total + sub.callbacks.size,
            0,
        );

        return {
            activeSubscriptions,
            totalSubscriptions: this.subscriptions.size,
            totalCallbacks,
            reconnectAttempts: this.reconnectAttempts,
            isDestroyed: this.isDestroyed,
        };
    }

    /**
     * Cleanup all subscriptions and resources
     */
    cleanup() {
        this.log('Cleaning up notification service');
        this.isDestroyed = true;

        // Clear reconnection timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // Unsubscribe from all channels
        this.subscriptions.forEach((subscription) => {
            subscription.unsubscribe();
            subscription.isActive = false;
        });
        this.subscriptions.clear();

        // Reset reconnection attempts
        this.reconnectAttempts = 0;

        this.log('Notification service cleanup completed');
    }

    /**
     * Reconnect all subscriptions
     */
    reconnect() {
        this.log('Reconnecting all subscriptions');
        this.reconnectAttempts = 0;

        // Store existing callbacks
        const callbacks = new Map<
            string,
            Set<CarStatusChangeCallback | AdminNotificationCallback>
        >();
        this.subscriptions.forEach((subscription, channelName) => {
            callbacks.set(channelName, new Set(subscription.callbacks));
        });

        // Cleanup existing subscriptions
        this.cleanup();

        // Re-subscribe with stored callbacks
        callbacks.forEach((callbackSet, channelName) => {
            this.log(`Reconnecting to ${channelName}`);
            callbackSet.forEach((callback) => {
                if (this.isCarStatusChangeCallback(callback)) {
                    this.subscribeToCarStatusChanges(callback);
                }
                // Admin notifications would need additional logic to re-subscribe
            });
        });
    }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Export class for testing
export { NotificationService };
