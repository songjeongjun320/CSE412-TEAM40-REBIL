/**
 * Lightweight Performance Widget for Real-time Monitoring
 *
 * Features:
 * - Compact real-time metrics display
 * - Color-coded performance indicators
 * - Quick access to detailed dashboard
 * - Minimal performance impact
 * - Collapsible design for space optimization
 */

'use client';

import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    useCachePerformance,
    useMemoryMonitoring,
    usePerformanceMonitoring,
} from '@/hooks/usePerformanceMonitoring';

interface PerformanceWidgetProps {
    /** Position the widget */
    position?: 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left';
    /** Show detailed metrics in collapsed view */
    showDetails?: boolean;
    /** Enable drag and drop repositioning */
    draggable?: boolean;
    /** Callback when opening full dashboard */
    onOpenDashboard?: () => void;
}

export function PerformanceWidget({
    position = 'bottom-right',
    showDetails = true,
    draggable = false,
    onOpenDashboard,
}: PerformanceWidgetProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isVisible, setIsVisible] = useState(true);

    const { metrics, alerts } = usePerformanceMonitoring({
        trackAPICalls: true,
        trackRenders: true,
        trackMemory: true,
    });

    const { internalCache } = useCachePerformance();
    const { memoryStats } = useMemoryMonitoring();

    // Format utilities
    const formatTime = (ms: number) => {
        if (ms < 1000) return `${Math.round(ms)}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        if (bytes < 1024) return `${Math.round(bytes)} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Get performance status color
    const getPerformanceStatus = () => {
        const avgResponseTime = metrics.api.averageResponseTime;
        const cacheHitRate = metrics.cache.hitRate;
        const errorRate = metrics.api.errorRate;

        if (errorRate > 5 || avgResponseTime > 1000 || cacheHitRate < 60) {
            return 'critical';
        } else if (errorRate > 2 || avgResponseTime > 500 || cacheHitRate < 75) {
            return 'warning';
        }
        return 'good';
    };

    const performanceStatus = getPerformanceStatus();
    const hasAlerts = alerts.length > 0;

    // Position classes
    const positionClasses = {
        'top-right': 'top-4 right-4',
        'bottom-right': 'bottom-4 right-4',
        'bottom-left': 'bottom-4 left-4',
        'top-left': 'top-4 left-4',
    };

    // Status colors
    const statusColors = {
        good: 'bg-green-500',
        warning: 'bg-yellow-500',
        critical: 'bg-red-500',
    };

    if (!isVisible) {
        return (
            <Button
                className={`fixed ${positionClasses[position]} z-50 rounded-full p-2 shadow-lg`}
                onClick={() => setIsVisible(true)}
                size="sm"
            >
                📊
            </Button>
        );
    }

    return (
        <Card
            className={`fixed ${positionClasses[position]} z-50 shadow-lg transition-all duration-300 ${
                isExpanded ? 'w-80' : 'w-16'
            } ${draggable ? 'cursor-move' : ''}`}
        >
            {!isExpanded ? (
                // Collapsed view
                <div
                    className="p-3 flex items-center justify-center cursor-pointer"
                    onClick={() => setIsExpanded(true)}
                >
                    <div className="relative">
                        <div
                            className={`w-8 h-8 ${statusColors[performanceStatus]} rounded-full flex items-center justify-center`}
                        >
                            <span className="text-white text-sm font-bold">
                                {Math.round(metrics.api.averageResponseTime)}
                            </span>
                        </div>
                        {hasAlerts && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        )}
                    </div>
                </div>
            ) : (
                // Expanded view
                <div className="p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                            <div
                                className={`w-3 h-3 ${statusColors[performanceStatus]} rounded-full`}
                            />
                            <span className="text-sm font-medium">Performance</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            {onOpenDashboard && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onOpenDashboard}
                                    className="p-1 h-auto"
                                >
                                    🔍
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsVisible(false)}
                                className="p-1 h-auto"
                            >
                                ✕
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsExpanded(false)}
                                className="p-1 h-auto"
                            >
                                ➖
                            </Button>
                        </div>
                    </div>

                    {/* Alerts */}
                    {hasAlerts && (
                        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs">
                            <div className="font-medium text-red-800">
                                {alerts.length} Alert{alerts.length !== 1 ? 's' : ''}
                            </div>
                            <div className="text-red-600 truncate">{alerts[0].title}</div>
                        </div>
                    )}

                    {/* Key Metrics */}
                    <div className="space-y-3">
                        {/* API Performance */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">API Response</span>
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-mono">
                                    {formatTime(metrics.api.averageResponseTime)}
                                </span>
                                <Badge
                                    className={`text-xs px-1 py-0 ${
                                        metrics.api.averageResponseTime < 200
                                            ? 'bg-green-100 text-green-800'
                                            : metrics.api.averageResponseTime < 500
                                              ? 'bg-yellow-100 text-yellow-800'
                                              : 'bg-red-100 text-red-800'
                                    }`}
                                >
                                    {metrics.api.totalCalls}
                                </Badge>
                            </div>
                        </div>

                        {/* Cache Performance */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">Cache Hit</span>
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-mono">
                                    {metrics.cache.hitRate.toFixed(1)}%
                                </span>
                                <Badge
                                    className={`text-xs px-1 py-0 ${
                                        metrics.cache.hitRate > 80
                                            ? 'bg-green-100 text-green-800'
                                            : metrics.cache.hitRate > 60
                                              ? 'bg-yellow-100 text-yellow-800'
                                              : 'bg-red-100 text-red-800'
                                    }`}
                                >
                                    {metrics.cache.totalHits + metrics.cache.totalMisses}
                                </Badge>
                            </div>
                        </div>

                        {/* Memory Usage */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">Memory</span>
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-mono">
                                    {formatBytes(memoryStats.heapUsed)}
                                </span>
                                <Badge
                                    className={`text-xs px-1 py-0 ${
                                        memoryStats.percentage < 60
                                            ? 'bg-green-100 text-green-800'
                                            : memoryStats.percentage < 80
                                              ? 'bg-yellow-100 text-yellow-800'
                                              : 'bg-red-100 text-red-800'
                                    }`}
                                >
                                    {memoryStats.percentage.toFixed(0)}%
                                </Badge>
                            </div>
                        </div>

                        {/* Error Rate */}
                        {metrics.api.errorRate > 0 && (
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-600">Error Rate</span>
                                <Badge className="bg-red-100 text-red-800 text-xs">
                                    {metrics.api.errorRate.toFixed(1)}%
                                </Badge>
                            </div>
                        )}

                        {/* Quick Stats */}
                        {showDetails && (
                            <div className="border-t pt-3 mt-3">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <div className="text-gray-500">Render Time</div>
                                        <div className="font-mono">
                                            {formatTime(metrics.render.totalRenderTime)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-gray-500">Components</div>
                                        <div className="font-mono">
                                            {
                                                Object.keys(metrics.render.componentRenderTimes)
                                                    .length
                                            }
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-gray-500">Cache Entries</div>
                                        <div className="font-mono">
                                            {internalCache.total.entryCount}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-gray-500">Cache Size</div>
                                        <div className="font-mono">
                                            {formatBytes(internalCache.storage.used)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Performance Summary */}
                        <div className="border-t pt-3 mt-3">
                            <div className="text-xs text-gray-500 mb-1">Overall Status</div>
                            <div
                                className={`text-sm font-medium ${
                                    performanceStatus === 'good'
                                        ? 'text-green-600'
                                        : performanceStatus === 'warning'
                                          ? 'text-yellow-600'
                                          : 'text-red-600'
                                }`}
                            >
                                {performanceStatus === 'good'
                                    ? '✓ Performing Well'
                                    : performanceStatus === 'warning'
                                      ? '⚠ Needs Attention'
                                      : '⚠ Critical Issues'}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}

/**
 * Minimal Performance Indicator - Ultra lightweight version
 */
export function PerformanceIndicator({ className = '' }: { className?: string }) {
    const { metrics } = usePerformanceMonitoring();

    const getStatusColor = () => {
        const avgResponseTime = metrics.api.averageResponseTime;
        const cacheHitRate = metrics.cache.hitRate;

        if (avgResponseTime > 1000 || cacheHitRate < 60) return 'text-red-500';
        if (avgResponseTime > 500 || cacheHitRate < 75) return 'text-yellow-500';
        return 'text-green-500';
    };

    return (
        <div className={`inline-flex items-center space-x-2 ${className}`}>
            <div className={`w-2 h-2 rounded-full ${getStatusColor().replace('text-', 'bg-')}`} />
            <span className={`text-xs ${getStatusColor()}`}>
                {Math.round(metrics.api.averageResponseTime)}ms
            </span>
            <span className="text-xs text-gray-400">{metrics.cache.hitRate.toFixed(0)}% cache</span>
        </div>
    );
}
