/**
 * Performance Alert System for Rebil Application
 *
 * Features:
 * - Real-time performance alerts and notifications
 * - Configurable alert thresholds
 * - Alert filtering and categorization
 * - Toast notifications for critical issues
 * - Alert history and tracking
 * - Integration with performance monitoring system
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { useToast } from '@/hooks/useToast';
import type { PerformanceAlert } from '@/lib/monitoring/performanceMonitor';

interface PerformanceAlertsProps {
    /** Show alerts inline or as notifications */
    mode?: 'inline' | 'notifications' | 'both';
    /** Enable toast notifications for critical alerts */
    enableToasts?: boolean;
    /** Maximum number of alerts to display */
    maxAlerts?: number;
    /** Auto-dismiss alerts after this time (ms) */
    autoDismissTime?: number;
    /** Custom alert filtering */
    alertFilter?: (alert: PerformanceAlert) => boolean;
    /** Custom alert priority ordering */
    priorityOrder?: ('error' | 'warning' | 'info')[];
}

export function PerformanceAlerts({
    mode = 'both',
    enableToasts = true,
    maxAlerts = 10,
    autoDismissTime = 10000,
    alertFilter,
    priorityOrder = ['error', 'warning', 'info'],
}: PerformanceAlertsProps) {
    const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
    const [alertCounts, setAlertCounts] = useState<Record<string, number>>({});

    const { alerts } = usePerformanceMonitoring();
    const { addToast } = useToast();

    // Filter and sort alerts
    const filteredAlerts = React.useMemo(() => {
        let filtered = alerts.filter((alert) => !dismissedAlerts.has(alert.id));

        if (alertFilter) {
            filtered = filtered.filter(alertFilter);
        }

        // Sort by priority and timestamp
        return filtered
            .sort((a, b) => {
                const priorityA = priorityOrder.indexOf(a.type);
                const priorityB = priorityOrder.indexOf(b.type);

                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }

                return b.timestamp - a.timestamp;
            })
            .slice(0, maxAlerts);
    }, [alerts, dismissedAlerts, alertFilter, priorityOrder, maxAlerts]);

    // Handle new alerts with toast notifications
    useEffect(() => {
        const newAlerts = alerts.filter(
            (alert) => !dismissedAlerts.has(alert.id) && Date.now() - alert.timestamp < 5000, // Within last 5 seconds
        );

        newAlerts.forEach((alert) => {
            if (enableToasts && (mode === 'notifications' || mode === 'both')) {
                // Count occurrences of similar alerts
                const similarAlerts = alerts.filter(
                    (a) =>
                        a.title === alert.title && Math.abs(a.timestamp - alert.timestamp) < 60000, // Within 1 minute
                );

                if (similarAlerts.length === 1) {
                    // First occurrence
                    addToast({
                        title: `Performance ${alert.type.toUpperCase()}`,
                        description: alert.message,
                        type: alert.type,
                        duration: alert.type === 'error' ? 10000 : 5000,
                    });
                } else if (similarAlerts.length % 5 === 0) {
                    // Every 5th occurrence
                    addToast({
                        title: `Repeated Performance Issue`,
                        description: `${alert.title} has occurred ${similarAlerts.length} times`,
                        type: 'error',
                        duration: 10000,
                    });
                }
            }

            // Update alert counts
            setAlertCounts((prev) => ({
                ...prev,
                [alert.title]: (prev[alert.title] || 0) + 1,
            }));
        });
    }, [alerts, dismissedAlerts, enableToasts, mode, addToast]);

    // Auto-dismiss old alerts
    useEffect(() => {
        if (autoDismissTime > 0) {
            const interval = setInterval(() => {
                const cutoff = Date.now() - autoDismissTime;
                const oldAlerts = alerts.filter((alert) => alert.timestamp < cutoff);

                if (oldAlerts.length > 0) {
                    setDismissedAlerts((prev) => {
                        const newDismissed = new Set(prev);
                        oldAlerts.forEach((alert) => newDismissed.add(alert.id));
                        return newDismissed;
                    });
                }
            }, 5000);

            return () => clearInterval(interval);
        }
    }, [autoDismissTime, alerts]);

    const dismissAlert = useCallback((alertId: string) => {
        setDismissedAlerts((prev) => new Set(prev).add(alertId));
    }, []);

    const dismissAllAlerts = useCallback(() => {
        setDismissedAlerts(new Set(alerts.map((alert) => alert.id)));
    }, [alerts]);

    const getAlertIcon = (type: PerformanceAlert['type']) => {
        switch (type) {
            case 'error':
                return '🚨';
            case 'warning':
                return '⚠️';
            case 'info':
                return 'ℹ️';
            default:
                return '📊';
        }
    };

    const getAlertColor = (type: PerformanceAlert['type']) => {
        switch (type) {
            case 'error':
                return 'border-red-500 bg-red-50';
            case 'warning':
                return 'border-yellow-500 bg-yellow-50';
            case 'info':
                return 'border-blue-500 bg-blue-50';
            default:
                return 'border-gray-500 bg-gray-50';
        }
    };

    if (!filteredAlerts.length && mode !== 'both') {
        return null;
    }

    if (mode === 'notifications') {
        // Notifications are handled via useEffect with toast system
        return null;
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-gray-900">Performance Alerts</h3>
                    {filteredAlerts.length > 0 && (
                        <Badge variant="outline" className="bg-red-100 text-red-800">
                            {filteredAlerts.length} active
                        </Badge>
                    )}
                </div>
                {filteredAlerts.length > 0 && (
                    <Button variant="outline" size="sm" onClick={dismissAllAlerts}>
                        Dismiss All
                    </Button>
                )}
            </div>

            {/* Alert Summary */}
            {Object.keys(alertCounts).length > 0 && (
                <Card className="p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Alert Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        {Object.entries(alertCounts)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 6)
                            .map(([title, count]) => (
                                <div key={title} className="flex justify-between">
                                    <span className="text-gray-600 truncate">{title}</span>
                                    <span className="font-medium text-gray-900">{count}</span>
                                </div>
                            ))}
                    </div>
                </Card>
            )}

            {/* Alert List */}
            {filteredAlerts.length > 0 ? (
                <div className="space-y-3">
                    {filteredAlerts.map((alert) => (
                        <Alert key={alert.id} className={`${getAlertColor(alert.type)} border-l-4`}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-3">
                                    <span className="text-lg">{getAlertIcon(alert.type)}</span>
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <h4 className="font-medium text-gray-900">
                                                {alert.title}
                                            </h4>
                                            <Badge
                                                variant="outline"
                                                className={`text-xs ${
                                                    alert.type === 'error'
                                                        ? 'border-red-500 text-red-700'
                                                        : alert.type === 'warning'
                                                          ? 'border-yellow-500 text-yellow-700'
                                                          : 'border-blue-500 text-blue-700'
                                                }`}
                                            >
                                                {alert.type}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-gray-700 mb-2">
                                            {alert.message}
                                        </p>

                                        {/* Alert Metadata */}
                                        {Object.keys(alert.metrics).length > 0 && (
                                            <div className="text-xs text-gray-500 space-y-1">
                                                {Object.entries(alert.metrics).map(
                                                    ([key, value]) => (
                                                        <div
                                                            key={key}
                                                            className="flex justify-between"
                                                        >
                                                            <span className="capitalize">
                                                                {key.replace(/_/g, ' ')}:
                                                            </span>
                                                            <span className="font-mono">
                                                                {typeof value === 'number'
                                                                    ? value.toFixed(2)
                                                                    : String(value)}
                                                            </span>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        )}

                                        <div className="text-xs text-gray-400 mt-2">
                                            {new Date(alert.timestamp).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => dismissAlert(alert.id)}
                                    className="ml-2 opacity-70 hover:opacity-100"
                                >
                                    ✕
                                </Button>
                            </div>
                        </Alert>
                    ))}
                </div>
            ) : (
                <Card className="p-8 text-center">
                    <div className="text-4xl mb-3">✅</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">All Good!</h3>
                    <p className="text-gray-600">
                        No performance alerts at this time. Your application is running smoothly.
                    </p>
                </Card>
            )}

            {/* Performance Tips */}
            {filteredAlerts.length > 0 && (
                <Card className="p-4 bg-blue-50 border-blue-200">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">
                        💡 Performance Tips
                    </h4>
                    <div className="text-sm text-blue-800 space-y-1">
                        {alerts.some((a) => a.title.includes('Slow')) && (
                            <div>• Consider implementing caching for frequently accessed data</div>
                        )}
                        {alerts.some((a) => a.title.includes('Memory')) && (
                            <div>
                                • Check for memory leaks in components that re-render frequently
                            </div>
                        )}
                        {alerts.some((a) => a.title.includes('Cache')) && (
                            <div>• Review cache configuration and warming strategies</div>
                        )}
                        {alerts.some((a) => a.title.includes('Network')) && (
                            <div>• Optimize network requests with batching and deduplication</div>
                        )}
                        <div>• Use the Performance Dashboard for detailed analysis</div>
                    </div>
                </Card>
            )}
        </div>
    );
}

/**
 * Compact Alert Badge Component
 */
export function PerformanceAlertBadge({
    onClick,
    className = '',
}: {
    onClick?: () => void;
    className?: string;
}) {
    const { alerts } = usePerformanceMonitoring();

    const alertCounts = React.useMemo(() => {
        const counts = { error: 0, warning: 0, info: 0 };
        alerts.forEach((alert) => {
            if (counts.hasOwnProperty(alert.type)) {
                counts[alert.type as keyof typeof counts]++;
            }
        });
        return counts;
    }, [alerts]);

    const totalAlerts = alertCounts.error + alertCounts.warning + alertCounts.info;

    if (totalAlerts === 0) {
        return null;
    }

    const getStatusColor = () => {
        if (alertCounts.error > 0) return 'bg-red-500 text-white';
        if (alertCounts.warning > 0) return 'bg-yellow-500 text-white';
        return 'bg-blue-500 text-white';
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={onClick}
            className={`${getStatusColor()} border-0 hover:opacity-80 ${className}`}
        >
            <span className="text-sm font-medium">
                {totalAlerts} Alert{totalAlerts !== 1 ? 's' : ''}
            </span>
            {alertCounts.error > 0 && (
                <Badge className="ml-2 bg-red-700 text-white text-xs">{alertCounts.error}</Badge>
            )}
        </Button>
    );
}

/**
 * Critical Alert Banner - Shows only critical alerts
 */
export function CriticalAlertBanner() {
    const { alerts } = usePerformanceMonitoring();
    const [isDismissed, setIsDismissed] = useState(false);

    const criticalAlerts = React.useMemo(
        () =>
            alerts
                .filter(
                    (alert) => alert.type === 'error' && Date.now() - alert.timestamp < 300000, // Within last 5 minutes
                )
                .slice(0, 3),
        [alerts],
    );

    if (criticalAlerts.length === 0 || isDismissed) {
        return null;
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white p-3">
            <div className="container mx-auto flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <span className="text-xl">🚨</span>
                    <div>
                        <div className="font-semibold">Critical Performance Issues Detected</div>
                        <div className="text-sm opacity-90">
                            {criticalAlerts.length} critical alert
                            {criticalAlerts.length !== 1 ? 's' : ''} -
                            {criticalAlerts.map((a) => a.title).join(', ')}
                        </div>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsDismissed(true)}
                    className="text-white hover:bg-red-700"
                >
                    Dismiss
                </Button>
            </div>
        </div>
    );
}
