'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
    AdminNotificationCallback,
    CarStatusChangeCallback,
    UnsubscribeFunction,
} from '@/lib/notifications/types';

/**
 * Hook configuration options
 */
interface UseNotificationServiceConfig {
    /** Enable debug logging */
    debug?: boolean;
    /** Auto cleanup on unmount */
    autoCleanup?: boolean;
    /** Maximum number of reconnection attempts */
    maxRetries?: number;
    /** Connection timeout in milliseconds */
    connectionTimeout?: number;
}

/**
 * Subscription reference for tracking and cleanup
 */
interface SubscriptionRef {
    unsubscribe: UnsubscribeFunction;
    channelName: string;
    isActive: boolean;
}

/**
 * Hook return type
 */
interface UseNotificationServiceReturn {
    /** Subscribe to car status changes */
    subscribeToCarStatusChanges: (callback: CarStatusChangeCallback) => UnsubscribeFunction;
    /** Subscribe to admin notifications */
    subscribeToAdminNotifications: (
        adminUserId: string,
        callback: AdminNotificationCallback,
    ) => UnsubscribeFunction;
    /** Force cleanup all subscriptions */
    cleanup: () => void;
    /** Get subscription statistics */
    getSubscriptionStats: () => {
        activeSubscriptions: number;
        totalSubscriptions: number;
        subscriptionDetails: Array<{
            channelName: string;
            isActive: boolean;
        }>;
    };
    /** Check if service is ready */
    isReady: boolean;
    /** Reconnect with exponential backoff */
    reconnect: () => void;
}

/**
 * Enhanced React hook for notification service with proper lifecycle management
 * and memory leak prevention
 */
export function useNotificationService(
    config: UseNotificationServiceConfig = {},
): UseNotificationServiceReturn {
    const { debug = false, autoCleanup = true, maxRetries = 3 } = config;

    // State
    const [isReady, setIsReady] = useState(false);

    // Refs for cleanup tracking
    const subscriptionsRef = useRef<Map<string, SubscriptionRef>>(new Map());
    const cleanupFunctionsRef = useRef<Set<() => void>>(new Set());
    const isUnmountedRef = useRef(false);
    const retryCountRef = useRef(0);
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Import service dynamically to avoid circular dependencies
    const [notificationService, setNotificationService] = useState<any>(null);

    // Initialize service
    useEffect(() => {
        const initService = async () => {
            try {
                const { notificationService: service } = await import('@/lib/notifications');
                if (!isUnmountedRef.current) {
                    setNotificationService(service);
                    setIsReady(true);
                }
            } catch (error) {
                if (debug) {
                    console.error('[useNotificationService] Failed to initialize service:', error);
                }
            }
        };

        initService();

        return () => {
            isUnmountedRef.current = true;
        };
    }, [debug]);

    // Debug logging utility
    const log = useCallback(
        (...args: any[]) => {
            if (debug) {
                console.log('[useNotificationService]', ...args);
            }
        },
        [debug],
    );

    // Subscribe to car status changes
    const subscribeToCarStatusChanges = useCallback(
        (callback: CarStatusChangeCallback): UnsubscribeFunction => {
            if (!notificationService) {
                log('Service not ready, cannot subscribe to car status changes');
                return () => {};
            }

            const channelName = 'car_status_changes';
            const unsubscribe = notificationService.subscribeToCarStatusChanges(callback);

            // Track subscription
            subscriptionsRef.current.set(channelName, {
                unsubscribe,
                channelName,
                isActive: true,
            });

            log('Subscribed to car status changes');

            return () => {
                const subscription = subscriptionsRef.current.get(channelName);
                if (subscription) {
                    subscription.unsubscribe();
                    subscription.isActive = false;
                    subscriptionsRef.current.delete(channelName);
                    log('Unsubscribed from car status changes');
                }
            };
        },
        [notificationService, log],
    );

    // Subscribe to admin notifications
    const subscribeToAdminNotifications = useCallback(
        (adminUserId: string, callback: AdminNotificationCallback): UnsubscribeFunction => {
            if (!notificationService) {
                log('Service not ready, cannot subscribe to admin notifications');
                return () => {};
            }

            const channelName = `admin_notifications_${adminUserId}`;
            const unsubscribe = notificationService.subscribeToAdminNotifications(
                adminUserId,
                callback,
            );

            // Track subscription
            subscriptionsRef.current.set(channelName, {
                unsubscribe,
                channelName,
                isActive: true,
            });

            log('Subscribed to admin notifications for user:', adminUserId);

            return () => {
                const subscription = subscriptionsRef.current.get(channelName);
                if (subscription) {
                    subscription.unsubscribe();
                    subscription.isActive = false;
                    subscriptionsRef.current.delete(channelName);
                    log('Unsubscribed from admin notifications for user:', adminUserId);
                }
            };
        },
        [notificationService, log],
    );

    // Cleanup function
    const cleanup = useCallback(() => {
        log('Cleaning up all subscriptions');
        subscriptionsRef.current.forEach((subscription) => {
            if (subscription.isActive) {
                subscription.unsubscribe();
                subscription.isActive = false;
            }
        });
        subscriptionsRef.current.clear();

        // Clear retry timeout
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
        }

        // Execute cleanup functions
        cleanupFunctionsRef.current.forEach((cleanupFn) => {
            try {
                cleanupFn();
            } catch (error) {
                log('Error during cleanup:', error);
            }
        });
        cleanupFunctionsRef.current.clear();
    }, [log]);

    // Get subscription statistics
    const getSubscriptionStats = useCallback(() => {
        const subscriptions = Array.from(subscriptionsRef.current.values());
        const activeSubscriptions = subscriptions.filter((sub) => sub.isActive).length;

        return {
            activeSubscriptions,
            totalSubscriptions: subscriptions.length,
            subscriptionDetails: subscriptions.map((sub) => ({
                channelName: sub.channelName,
                isActive: sub.isActive,
            })),
        };
    }, []);

    // Reconnect function
    const reconnect = useCallback(() => {
        if (!notificationService) {
            log('Service not ready, cannot reconnect');
            return;
        }

        if (retryCountRef.current >= maxRetries) {
            log('Max retries reached, stopping reconnection attempts');
            return;
        }

        log('Attempting to reconnect...');
        retryCountRef.current++;

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 30000);
        retryTimeoutRef.current = setTimeout(() => {
            if (!isUnmountedRef.current) {
                notificationService.reconnect();
                retryCountRef.current = 0;
            }
        }, delay);
    }, [notificationService, maxRetries, log]);

    // Auto cleanup on unmount
    useEffect(() => {
        if (!autoCleanup) return;

        return () => {
            cleanup();
        };
    }, [autoCleanup, cleanup]);

    return {
        subscribeToCarStatusChanges,
        subscribeToAdminNotifications,
        cleanup,
        getSubscriptionStats,
        isReady,
        reconnect,
    };
}
