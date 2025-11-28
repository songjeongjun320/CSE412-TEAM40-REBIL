/**
 * Performance Dashboard Component for Rebil Application
 *
 * Features:
 * - Real-time performance metrics visualization
 * - API response time monitoring
 * - Cache performance tracking
 * - Memory usage monitoring
 * - Component render performance
 * - Optimization recommendations
 * - Alert management
 * - Performance budgets tracking
 */

'use client';

import React, { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    useCachePerformance,
    useMemoryMonitoring,
    usePerformanceBudget,
    usePerformanceMonitoring,
} from '@/hooks/usePerformanceMonitoring';

interface PerformanceDashboardProps {
    /** Show detailed metrics */
    detailed?: boolean;
    /** Enable real-time updates */
    realTime?: boolean;
    /** Performance budgets to track */
    budgets?: {
        maxAPIResponseTime?: number;
        maxRenderTime?: number;
        maxMemoryUsage?: number;
        minCacheHitRate?: number;
    };
}

export function PerformanceDashboard({
    detailed = false,
    budgets = {
        maxAPIResponseTime: 200,
        maxRenderTime: 50,
        maxMemoryUsage: 100 * 1024 * 1024, // 100MB
        minCacheHitRate: 80,
    },
}: PerformanceDashboardProps) {
    const [activeTab, setActiveTab] = useState('overview');

    const {
        metrics,
        alerts,
        opportunities,
        isMonitoring,
        summary,
        startMonitoring,
        stopMonitoring,
        resetMetrics,
    } = usePerformanceMonitoring({
        trackAPICalls: true,
        trackRenders: true,
        trackMemory: true,
        trackWebSocket: true,
    });

    const { internalCache, reactQueryCache, clearAllCaches } = useCachePerformance();
    const { memoryStats } = useMemoryMonitoring();
    const budgetStatus = usePerformanceBudget(budgets);

    // Format numbers for display
    const formatNumber = (num: number, decimals = 2) => {
        if (num === 0) return '0';
        if (num < 1) return num.toFixed(decimals);
        return num.toLocaleString(undefined, { maximumFractionDigits: decimals });
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatTime = (ms: number) => {
        if (ms < 1000) return `${Math.round(ms)}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    // Get status color for metrics
    const getStatusColor = (status: 'pass' | 'warn' | 'fail') => {
        switch (status) {
            case 'pass':
                return 'bg-green-100 text-green-800';
            case 'warn':
                return 'bg-yellow-100 text-yellow-800';
            case 'fail':
                return 'bg-red-100 text-red-800';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Performance Dashboard</h2>
                    <p className="text-gray-600">
                        Real-time monitoring of application performance and optimization
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                        <div
                            className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-green-500' : 'bg-red-500'}`}
                        />
                        <span className="text-sm text-gray-600">
                            {isMonitoring ? 'Monitoring Active' : 'Monitoring Paused'}
                        </span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={isMonitoring ? stopMonitoring : startMonitoring}
                    >
                        {isMonitoring ? 'Pause' : 'Start'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={resetMetrics}>
                        Reset
                    </Button>
                </div>
            </div>

            {/* Performance Budget Status */}
            <Card className="p-4">
                <h3 className="text-lg font-semibold mb-4">Performance Budgets</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">API Response</span>
                        <Badge className={getStatusColor(budgetStatus.apiResponseTime)}>
                            {budgetStatus.apiResponseTime}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Render Time</span>
                        <Badge className={getStatusColor(budgetStatus.renderTime)}>
                            {budgetStatus.renderTime}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Memory Usage</span>
                        <Badge className={getStatusColor(budgetStatus.memoryUsage)}>
                            {budgetStatus.memoryUsage}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Cache Hit Rate</span>
                        <Badge className={getStatusColor(budgetStatus.cacheHitRate)}>
                            {budgetStatus.cacheHitRate}
                        </Badge>
                    </div>
                </div>
            </Card>

            {/* Main Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* API Performance */}
                <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-600">API Performance</h3>
                        <span className="text-2xl">⚡</span>
                    </div>
                    <div className="space-y-2">
                        <div>
                            <div className="text-2xl font-bold text-gray-900">
                                {formatTime(metrics.api.averageResponseTime)}
                            </div>
                            <div className="text-xs text-gray-500">Avg Response Time</div>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>Total Calls: {formatNumber(metrics.api.totalCalls)}</span>
                            <span>Errors: {formatNumber(metrics.api.errorRate, 1)}%</span>
                        </div>
                        {summary.totalCallReduction > 0 && (
                            <div className="text-xs text-green-600">
                                ↓ {formatNumber(summary.totalCallReduction, 1)}% reduction achieved
                            </div>
                        )}
                    </div>
                </Card>

                {/* Cache Performance */}
                <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-600">Cache Performance</h3>
                        <span className="text-2xl">📊</span>
                    </div>
                    <div className="space-y-2">
                        <div>
                            <div className="text-2xl font-bold text-gray-900">
                                {formatNumber(metrics.cache.hitRate, 1)}%
                            </div>
                            <div className="text-xs text-gray-500">Hit Rate</div>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>Hits: {formatNumber(metrics.cache.totalHits)}</span>
                            <span>Misses: {formatNumber(metrics.cache.totalMisses)}</span>
                        </div>
                        <div className="text-xs text-green-600">
                            Time saved: {formatTime(metrics.cache.timeSaved)}
                        </div>
                    </div>
                </Card>

                {/* Memory Usage */}
                <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-600">Memory Usage</h3>
                        <span className="text-2xl">🧠</span>
                    </div>
                    <div className="space-y-2">
                        <div>
                            <div className="text-2xl font-bold text-gray-900">
                                {formatBytes(memoryStats.heapUsed)}
                            </div>
                            <div className="text-xs text-gray-500">Heap Used</div>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>Total: {formatBytes(memoryStats.heapTotal)}</span>
                            <span>{formatNumber(memoryStats.percentage, 1)}%</span>
                        </div>
                        <div className="text-xs text-blue-600">
                            Cache: {formatBytes(memoryStats.cacheUsage)}
                        </div>
                    </div>
                </Card>

                {/* Render Performance */}
                <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-600">Render Performance</h3>
                        <span className="text-2xl">🎨</span>
                    </div>
                    <div className="space-y-2">
                        <div>
                            <div className="text-2xl font-bold text-gray-900">
                                {formatTime(metrics.render.totalRenderTime)}
                            </div>
                            <div className="text-xs text-gray-500">Total Render Time</div>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>
                                Components:{' '}
                                {Object.keys(metrics.render.componentRenderTimes).length}
                            </span>
                            <span>Slow: {metrics.render.slowComponents.length}</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
                <Card className="p-4">
                    <h3 className="text-lg font-semibold mb-4">Performance Alerts</h3>
                    <div className="space-y-3">
                        {alerts.slice(0, 5).map((alert) => (
                            <Alert key={alert.id} className="p-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="font-medium">{alert.title}</div>
                                        <div className="text-sm text-gray-600 mt-1">
                                            {alert.message}
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {new Date(alert.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>
                            </Alert>
                        ))}
                        {alerts.length > 5 && (
                            <div className="text-sm text-gray-500 text-center">
                                +{alerts.length - 5} more alerts
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* Detailed Metrics */}
            {detailed && (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="api">API Details</TabsTrigger>
                        <TabsTrigger value="cache">Cache Details</TabsTrigger>
                        <TabsTrigger value="optimizations">Optimizations</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                        <Card className="p-4">
                            <h3 className="text-lg font-semibold mb-4">Performance Summary</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-sm text-gray-600">
                                        Total API Call Reduction
                                    </div>
                                    <div className="text-xl font-bold text-green-600">
                                        {formatNumber(summary.totalCallReduction, 1)}%
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-gray-600">Cache Effectiveness</div>
                                    <div className="text-xl font-bold text-blue-600">
                                        {formatNumber(summary.cacheEffectiveness, 1)}%
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-gray-600">
                                        Potential Time Savings
                                    </div>
                                    <div className="text-xl font-bold text-purple-600">
                                        {formatTime(summary.potentialTimeSavings)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-gray-600">
                                        Average Response Time
                                    </div>
                                    <div className="text-xl font-bold text-gray-900">
                                        {formatTime(summary.averageResponseTime)}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </TabsContent>

                    <TabsContent value="api" className="space-y-4">
                        <Card className="p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">API Call Details</h3>
                                <span className="text-sm text-gray-500">
                                    Total: {formatNumber(metrics.api.totalCalls)} calls
                                </span>
                            </div>

                            {/* API Calls by Endpoint */}
                            <div className="space-y-3">
                                {Object.entries(metrics.api.callsByEndpoint)
                                    .sort(([, a], [, b]) => b - a)
                                    .slice(0, 10)
                                    .map(([endpoint, count]) => (
                                        <div
                                            key={endpoint}
                                            className="flex items-center justify-between"
                                        >
                                            <span className="text-sm font-mono text-gray-600">
                                                {endpoint}
                                            </span>
                                            <div className="flex items-center space-x-2">
                                                <div className="text-sm font-medium">
                                                    {formatNumber(count)}
                                                </div>
                                                <div className="w-20 bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="bg-blue-500 h-2 rounded-full"
                                                        style={{
                                                            width: `${Math.min(100, (count / Math.max(...Object.values(metrics.api.callsByEndpoint))) * 100)}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>

                            {/* Slow Queries */}
                            {metrics.api.slowQueries.length > 0 && (
                                <div className="mt-6">
                                    <h4 className="text-md font-semibold mb-3">
                                        Recent Slow Queries
                                    </h4>
                                    <div className="space-y-2">
                                        {metrics.api.slowQueries.slice(0, 5).map((query, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between p-2 bg-yellow-50 rounded"
                                            >
                                                <span className="text-sm font-mono text-gray-600">
                                                    {query.endpoint}
                                                </span>
                                                <div className="text-sm font-medium text-red-600">
                                                    {formatTime(query.duration)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>
                    </TabsContent>

                    <TabsContent value="cache" className="space-y-4">
                        <Card className="p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">Cache Performance Details</h3>
                                <Button variant="outline" size="sm" onClick={clearAllCaches}>
                                    Clear All Caches
                                </Button>
                            </div>

                            {/* Internal Cache Stats */}
                            <div className="mb-6">
                                <h4 className="text-md font-semibold mb-3">Internal Cache</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <div className="text-sm text-gray-600">Hit Rate</div>
                                        <div className="text-lg font-bold text-green-600">
                                            {formatNumber(internalCache.total.hitRate, 1)}%
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-600">Entries</div>
                                        <div className="text-lg font-bold">
                                            {formatNumber(internalCache.total.entryCount)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-600">Memory Used</div>
                                        <div className="text-lg font-bold">
                                            {formatBytes(internalCache.storage.used)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-600">Memory Saved</div>
                                        <div className="text-lg font-bold text-green-600">
                                            {formatBytes(metrics.cache.memorySaved)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* React Query Cache Stats */}
                            <div>
                                <h4 className="text-md font-semibold mb-3">React Query Cache</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <div className="text-sm text-gray-600">Total Queries</div>
                                        <div className="text-lg font-bold">
                                            {formatNumber(reactQueryCache.totalQueries)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-600">Stale Queries</div>
                                        <div className="text-lg font-bold text-yellow-600">
                                            {formatNumber(reactQueryCache.staleQueries)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-600">Error Queries</div>
                                        <div className="text-lg font-bold text-red-600">
                                            {formatNumber(reactQueryCache.errorQueries)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-600">Loading Queries</div>
                                        <div className="text-lg font-bold text-blue-600">
                                            {formatNumber(reactQueryCache.loadingQueries)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cache by Type */}
                            <div className="mt-6">
                                <h4 className="text-md font-semibold mb-3">Cache by Type</h4>
                                <div className="space-y-2">
                                    {Object.entries(internalCache.byType).map(
                                        ([type, typeStats]) => (
                                            <div
                                                key={type}
                                                className="flex items-center justify-between p-2 bg-gray-50 rounded"
                                            >
                                                <span className="text-sm font-medium">{type}</span>
                                                <div className="flex items-center space-x-4">
                                                    <span className="text-sm">
                                                        Hit Rate:{' '}
                                                        {formatNumber(typeStats.hitRate, 1)}%
                                                    </span>
                                                    <span className="text-sm">
                                                        Entries:{' '}
                                                        {formatNumber(typeStats.entryCount)}
                                                    </span>
                                                    <span className="text-sm">
                                                        Size: {formatBytes(typeStats.totalSize)}
                                                    </span>
                                                </div>
                                            </div>
                                        ),
                                    )}
                                </div>
                            </div>
                        </Card>
                    </TabsContent>

                    <TabsContent value="optimizations" className="space-y-4">
                        <Card className="p-4">
                            <h3 className="text-lg font-semibold mb-4">
                                Optimization Opportunities
                            </h3>
                            {opportunities.length > 0 ? (
                                <div className="space-y-4">
                                    {opportunities.map((opportunity, index) => (
                                        <div key={index} className="border rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <Badge
                                                    className={
                                                        opportunity.impact === 'high'
                                                            ? 'bg-red-100 text-red-800'
                                                            : opportunity.impact === 'medium'
                                                              ? 'bg-yellow-100 text-yellow-800'
                                                              : 'bg-blue-100 text-blue-800'
                                                    }
                                                >
                                                    {opportunity.impact} impact
                                                </Badge>
                                                <span className="text-xs text-gray-500 uppercase">
                                                    {opportunity.type.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <div className="text-sm font-medium mb-1">
                                                {opportunity.description}
                                            </div>
                                            <div className="text-sm text-gray-600 mb-2">
                                                {opportunity.recommendation}
                                            </div>
                                            {opportunity.estimatedSavings && (
                                                <div className="text-xs text-green-600">
                                                    Estimated savings:
                                                    {opportunity.estimatedSavings.time &&
                                                        ` ${formatTime(opportunity.estimatedSavings.time)}`}
                                                    {opportunity.estimatedSavings.requests &&
                                                        ` ${opportunity.estimatedSavings.requests} requests`}
                                                    {opportunity.estimatedSavings.memory &&
                                                        ` ${formatBytes(opportunity.estimatedSavings.memory)}`}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 py-8">
                                    No optimization opportunities identified at this time.
                                    <br />
                                    Your application is performing well!
                                </div>
                            )}
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
