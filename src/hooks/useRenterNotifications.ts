'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { CarStatusChange } from '@/lib/notifications/types';

import { useNotificationService } from './useNotificationService';
import { useToast } from './useToast';

interface NewlyAvailableCar {
    id: string;
    make: string;
    model: string;
    year: number;
    daily_rate: number;
    host_id: string;
    updated_at: string;
}

export function useRenterNotifications() {
    const [newlyAvailableCars, setNewlyAvailableCars] = useState<NewlyAvailableCar[]>([]);
    const { addToast } = useToast();
    const isUnmountedRef = useRef(false);

    // Use enhanced notification service
    const { subscribeToCarStatusChanges, cleanup, isReady } = useNotificationService({
        debug: process.env.NODE_ENV === 'development',
        autoCleanup: true,
        maxRetries: 3,
        connectionTimeout: 30000,
    });

    const handleCarStatusChange = useCallback(
        (statusChange: CarStatusChange) => {
            // Prevent updates after unmount
            if (isUnmountedRef.current) return;

            // Only interested in cars that become ACTIVE (available for renting)
            if (statusChange.new_status === 'ACTIVE' && statusChange.old_status !== 'ACTIVE') {
                const newCar: NewlyAvailableCar = {
                    id: statusChange.id,
                    make: statusChange.make,
                    model: statusChange.model,
                    year: statusChange.year,
                    daily_rate: 0, // Will be fetched separately if needed
                    host_id: statusChange.host_id,
                    updated_at: statusChange.updated_at,
                };

                setNewlyAvailableCars((prev) => {
                    // Avoid duplicates
                    if (prev.some((car) => car.id === newCar.id)) {
                        return prev;
                    }
                    return [newCar, ...prev].slice(0, 10); // Keep only latest 10
                });

                // Show toast notification
                addToast({
                    type: 'info',
                    title: 'New Car Available!',
                    description: `${statusChange.make} ${statusChange.model} (${statusChange.year}) is now available for booking`,
                    duration: 8000,
                });
            }
        },
        [addToast],
    );

    const clearNewCarNotification = useCallback((carId: string) => {
        setNewlyAvailableCars((prev) => prev.filter((car) => car.id !== carId));
    }, []);

    const clearAllNewCars = useCallback(() => {
        setNewlyAvailableCars([]);
    }, []);

    // Set up subscriptions when service is ready
    useEffect(() => {
        if (!isReady) return;

        // Subscribe to car status changes
        const unsubscribeFromStatusChanges = subscribeToCarStatusChanges(handleCarStatusChange);

        return () => {
            unsubscribeFromStatusChanges();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReady, subscribeToCarStatusChanges]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isUnmountedRef.current = true;
            cleanup();
        };
    }, [cleanup]);

    return {
        newlyAvailableCars,
        clearNewCarNotification,
        clearAllNewCars,
        isReady,
    };
}
