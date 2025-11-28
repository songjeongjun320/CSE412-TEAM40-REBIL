/**
 * Core Performance Monitoring System for Rebil Application
 *
 * Features:
 * - Real-time API call tracking and analysis
 * - Cache performance monitoring with hit/miss ratios
 * - Component render performance tracking
 * - Network request optimization insights
 * - Memory usage and resource utilization monitoring
 * - Performance regression detection
 * - Automated alerts and notifications
 */

import { cacheManager } from '../cache/cacheManager';
import type { CacheEvent } from '../cache/types';

// Performance metric types
export interface PerformanceMetrics {
    api: APIMetrics;
    cache: CacheMetrics;
    render: RenderMetrics;
    network: NetworkMetrics;
    memory: MemoryMetrics;
    user: UserExperienceMetrics;
}

export interface APIMetrics {
    totalCalls: number;
    callsByEndpoint: Record<string, number>;
    averageResponseTime: number;
    slowQueries: SlowQuery[];
    errorRate: number;
    optimizationOpportunities: OptimizationOpportunity[];
    reductionMetrics: {
        baselineCalls: number;
        currentCalls: number;
        reductionPercentage: number;
    };
}

export interface CacheMetrics {
    hitRate: number;
    missRate: number;
    totalHits: number;
    totalMisses: number;
    memorySaved: number; // in bytes
    timeSaved: number; // in milliseconds
    cacheByType: Record<string, CacheTypeMetrics>;
    evictionRate: number;
    compressionRatio: number;
}

export interface CacheTypeMetrics {
    hitRate: number;
    size: number;
    entries: number;
    averageAccessTime: number;
    lastAccess: number;
}

export interface RenderMetrics {
    componentRenderTimes: Record<string, number>;
    reRenderCount: Record<string, number>;
    slowComponents: ComponentPerformance[];
    totalRenderTime: number;
    renderOptimizations: string[];
}

export interface ComponentPerformance {
    name: string;
    averageRenderTime: number;
    renderCount: number;
    totalTime: number;
    lastRender: number;
}

export interface NetworkMetrics {
    totalRequests: number;
    totalDataTransferred: number;
    bandwidth: {
        upload: number;
        download: number;
    };
    compressionSavings: number;
    requestsByType: Record<string, number>;
    duplicateRequests: number;
}

export interface MemoryMetrics {
    heapUsed: number;
    heapTotal: number;
    cacheMemoryUsage: number;
    memoryLeaks: MemoryLeak[];
    gcFrequency: number;
}

export interface MemoryLeak {
    component: string;
    growth: number;
    timestamp: number;
    severity: 'low' | 'medium' | 'high';
}

export interface UserExperienceMetrics {
    pageLoadTime: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    firstInputDelay: number;
    cumulativeLayoutShift: number;
    searchResponseTime: number;
    interactionLatency: number;
}

export interface SlowQuery {
    endpoint: string;
    duration: number;
    timestamp: number;
    parameters: Record<string, any>;
    stackTrace?: string;
}

export interface OptimizationOpportunity {
    type: 'redundant_call' | 'cache_miss' | 'slow_query' | 'memory_leak';
    description: string;
    impact: 'low' | 'medium' | 'high';
    recommendation: string;
    estimatedSavings: {
        time?: number;
        memory?: number;
        requests?: number;
    };
}

export interface PerformanceAlert {
    id: string;
    type: 'warning' | 'error' | 'info';
    title: string;
    message: string;
    timestamp: number;
    metrics: Record<string, any>;
    threshold: number;
    currentValue: number;
}

export interface PerformanceConfig {
    enabled: boolean;
    collectRenderMetrics: boolean;
    collectNetworkMetrics: boolean;
    collectMemoryMetrics: boolean;
    alertThresholds: {
        slowQueryThreshold: number; // ms
        lowCacheHitRate: number; // percentage
        highErrorRate: number; // percentage
        memoryUsageThreshold: number; // MB
        renderTimeThreshold: number; // ms
    };
    sampling: {
        apiCalls: number; // percentage
        renders: number; // percentage
        networkRequests: number; // percentage
    };
    retention: {
        metrics: number; // days
        alerts: number; // days
        slowQueries: number; // count
    };
}

class PerformanceMonitor {
    private config: PerformanceConfig;
    private metrics: PerformanceMetrics;
    private alerts: PerformanceAlert[] = [];
    private listeners: Array<(metrics: PerformanceMetrics) => void> = [];
    private intervalId: NodeJS.Timeout | null = null;
    private startTime: number = Date.now();

    // API call tracking
    private apiCallLog: Array<{
        endpoint: string;
        startTime: number;
        endTime?: number;
        duration?: number;
        error?: boolean;
        parameters?: Record<string, any>;
    }> = [];

    // Component render tracking
    private renderLog: Array<{
        component: string;
        startTime: number;
        endTime?: number;
        duration?: number;
    }> = [];

    // Network request tracking
    private networkLog: Array<{
        url: string;
        method: string;
        size: number;
        startTime: number;
        endTime?: number;
        duration?: number;
        fromCache: boolean;
    }> = [];

    // Memory tracking
    private memorySnapshots: Array<{
        timestamp: number;
        heapUsed: number;
        heapTotal: number;
        cacheSize: number;
    }> = [];

    // Baseline metrics for comparison
    private baseline: {
        userProfileCalls: number;
        carTableCalls: number;
        websocketConnections: number;
        totalAPICalls: number;
    } = {
        userProfileCalls: 0,
        carTableCalls: 0,
        websocketConnections: 0,
        totalAPICalls: 0,
    };

    constructor(config: Partial<PerformanceConfig> = {}) {
        this.config = {
            enabled: true,
            collectRenderMetrics: true,
            collectNetworkMetrics: true,
            collectMemoryMetrics: true,
            alertThresholds: {
                slowQueryThreshold: 1000, // 1 second
                lowCacheHitRate: 60, // 60%
                highErrorRate: 5, // 5%
                memoryUsageThreshold: 100, // 100MB
                renderTimeThreshold: 100, // 100ms
            },
            sampling: {
                apiCalls: 100, // Monitor all API calls initially
                renders: 50, // Monitor 50% of renders
                networkRequests: 100, // Monitor all network requests
            },
            retention: {
                metrics: 7, // 7 days
                alerts: 30, // 30 days
                slowQueries: 100, // Keep last 100 slow queries
            },
            ...config,
        };

        this.metrics = this.initializeMetrics();
        this.setupCacheEventListeners();
        this.startMonitoring();

        // Set baseline metrics based on optimization targets
        this.baseline = {
            userProfileCalls: 6, // Target: reduce from 6x to 1x
            carTableCalls: 10, // Target: reduce from 10x to 1x
            websocketConnections: 9, // Target: reduce from 9x to 1-3x
            totalAPICalls: 25, // Approximate baseline total
        };
    }

    private initializeMetrics(): PerformanceMetrics {
        return {
            api: {
                totalCalls: 0,
                callsByEndpoint: {},
                averageResponseTime: 0,
                slowQueries: [],
                errorRate: 0,
                optimizationOpportunities: [],
                reductionMetrics: {
                    baselineCalls: this.baseline.totalAPICalls,
                    currentCalls: 0,
                    reductionPercentage: 0,
                },
            },
            cache: {
                hitRate: 0,
                missRate: 0,
                totalHits: 0,
                totalMisses: 0,
                memorySaved: 0,
                timeSaved: 0,
                cacheByType: {},
                evictionRate: 0,
                compressionRatio: 0,
            },
            render: {
                componentRenderTimes: {},
                reRenderCount: {},
                slowComponents: [],
                totalRenderTime: 0,
                renderOptimizations: [],
            },
            network: {
                totalRequests: 0,
                totalDataTransferred: 0,
                bandwidth: { upload: 0, download: 0 },
                compressionSavings: 0,
                requestsByType: {},
                duplicateRequests: 0,
            },
            memory: {
                heapUsed: 0,
                heapTotal: 0,
                cacheMemoryUsage: 0,
                memoryLeaks: [],
                gcFrequency: 0,
            },
            user: {
                pageLoadTime: 0,
                firstContentfulPaint: 0,
                largestContentfulPaint: 0,
                firstInputDelay: 0,
                cumulativeLayoutShift: 0,
                searchResponseTime: 0,
                interactionLatency: 0,
            },
        };
    }

    private setupCacheEventListeners(): void {
        cacheManager.addEventListener((event: CacheEvent) => {
            this.updateCacheMetrics(event);
        });
    }

    private updateCacheMetrics(event: CacheEvent): void {
        const { cache } = this.metrics;

        switch (event.type) {
            case 'hit':
                cache.totalHits++;
                cache.hitRate = (cache.totalHits / (cache.totalHits + cache.totalMisses)) * 100;

                // Estimate time saved by cache hit (assume average query time of 200ms)
                cache.timeSaved += 200;
                break;

            case 'miss':
                cache.totalMisses++;
                cache.missRate = (cache.totalMisses / (cache.totalHits + cache.totalMisses)) * 100;
                cache.hitRate = (cache.totalHits / (cache.totalHits + cache.totalMisses)) * 100;
                break;

            case 'compress':
                // Update compression metrics if available
                if (event.metadata?.originalSize && event.metadata?.compressedSize) {
                    const savings = event.metadata.originalSize - event.metadata.compressedSize;
                    cache.memorySaved += savings;
                    cache.compressionRatio =
                        event.metadata.compressedSize / event.metadata.originalSize;
                }
                break;
        }

        // Update cache type metrics
        if (event.metadata?.type) {
            const type = event.metadata.type;
            if (!cache.cacheByType[type]) {
                cache.cacheByType[type] = {
                    hitRate: 0,
                    size: 0,
                    entries: 0,
                    averageAccessTime: 0,
                    lastAccess: event.timestamp,
                };
            }

            const typeMetrics = cache.cacheByType[type];
            typeMetrics.lastAccess = event.timestamp;

            if (event.type === 'hit') {
                typeMetrics.hitRate =
                    (typeMetrics.hitRate * typeMetrics.entries + 1) / (typeMetrics.entries + 1);
            }
        }

        // Check for cache performance alerts
        this.checkCacheAlerts();
    }

    /**
     * Track API call performance
     */
    trackAPICall(endpoint: string, parameters?: Record<string, any>): (error?: boolean) => void {
        if (!this.config.enabled || Math.random() > this.config.sampling.apiCalls / 100) {
            return () => {}; // Return no-op function
        }

        const startTime = performance.now();
        const callLog: {
            endpoint: string;
            startTime: number;
            endTime?: number;
            duration?: number;
            error?: boolean;
            parameters?: Record<string, any>;
        } = {
            endpoint,
            startTime,
            parameters,
        };

        this.apiCallLog.push(callLog);

        return (error?: boolean) => {
            const endTime = performance.now();
            const duration = endTime - startTime;

            callLog.endTime = endTime;
            callLog.duration = duration;
            callLog.error = error;

            this.updateAPIMetrics(endpoint, duration, error);

            // Check for slow queries
            if (duration > this.config.alertThresholds.slowQueryThreshold) {
                this.addSlowQuery(endpoint, duration, parameters);
            }
        };
    }

    private updateAPIMetrics(endpoint: string, duration: number, error?: boolean): void {
        const { api } = this.metrics;

        api.totalCalls++;
        api.callsByEndpoint[endpoint] = (api.callsByEndpoint[endpoint] || 0) + 1;

        // Update average response time
        api.averageResponseTime =
            (api.averageResponseTime * (api.totalCalls - 1) + duration) / api.totalCalls;

        // Update error rate
        if (error) {
            const currentErrors = Math.round((api.errorRate * (api.totalCalls - 1)) / 100);
            api.errorRate = ((currentErrors + 1) / api.totalCalls) * 100;
        } else {
            const currentErrors = Math.round((api.errorRate * (api.totalCalls - 1)) / 100);
            api.errorRate = (currentErrors / api.totalCalls) * 100;
        }

        // Update reduction metrics
        api.reductionMetrics.currentCalls = api.totalCalls;
        api.reductionMetrics.reductionPercentage =
            ((api.reductionMetrics.baselineCalls - api.totalCalls) /
                api.reductionMetrics.baselineCalls) *
            100;

        // Identify optimization opportunities
        this.identifyOptimizationOpportunities();
    }

    private addSlowQuery(
        endpoint: string,
        duration: number,
        parameters?: Record<string, any>,
    ): void {
        const slowQuery: SlowQuery = {
            endpoint,
            duration,
            timestamp: Date.now(),
            parameters: parameters || {},
        };

        this.metrics.api.slowQueries.push(slowQuery);

        // Keep only the most recent slow queries
        if (this.metrics.api.slowQueries.length > this.config.retention.slowQueries) {
            this.metrics.api.slowQueries.shift();
        }

        // Create alert for slow query
        this.createAlert(
            'warning',
            'Slow Query Detected',
            `Query to ${endpoint} took ${duration.toFixed(2)}ms`,
            {
                endpoint,
                duration,
                parameters,
            },
        );
    }

    /**
     * Track component render performance
     */
    trackComponentRender(componentName: string): () => void {
        if (
            !this.config.enabled ||
            !this.config.collectRenderMetrics ||
            Math.random() > this.config.sampling.renders / 100
        ) {
            return () => {}; // Return no-op function
        }

        const startTime = performance.now();

        const renderLog: {
            component: string;
            startTime: number;
            endTime?: number;
            duration?: number;
        } = {
            component: componentName,
            startTime,
        };

        this.renderLog.push(renderLog);

        return () => {
            const endTime = performance.now();
            const duration = endTime - startTime;

            renderLog.endTime = endTime;
            renderLog.duration = duration;

            this.updateRenderMetrics(componentName, duration);

            // Check for slow renders
            if (duration > this.config.alertThresholds.renderTimeThreshold) {
                this.createAlert(
                    'warning',
                    'Slow Component Render',
                    `Component ${componentName} took ${duration.toFixed(2)}ms to render`,
                );
            }
        };
    }

    private updateRenderMetrics(componentName: string, duration: number): void {
        const { render } = this.metrics;

        // Update component-specific metrics
        const currentTime = render.componentRenderTimes[componentName] || 0;
        const currentCount = render.reRenderCount[componentName] || 0;

        render.componentRenderTimes[componentName] =
            (currentTime * currentCount + duration) / (currentCount + 1);
        render.reRenderCount[componentName] = currentCount + 1;

        // Update total render time
        render.totalRenderTime += duration;

        // Update slow components list
        const existingIndex = render.slowComponents.findIndex((c) => c.name === componentName);
        const componentPerf: ComponentPerformance = {
            name: componentName,
            averageRenderTime: render.componentRenderTimes[componentName],
            renderCount: render.reRenderCount[componentName],
            totalTime:
                render.componentRenderTimes[componentName] * render.reRenderCount[componentName],
            lastRender: Date.now(),
        };

        if (existingIndex >= 0) {
            render.slowComponents[existingIndex] = componentPerf;
        } else if (componentPerf.averageRenderTime > 50) {
            // 50ms threshold for slow components
            render.slowComponents.push(componentPerf);
        }

        // Sort slow components by average render time
        render.slowComponents.sort((a, b) => b.averageRenderTime - a.averageRenderTime);

        // Keep only top 20 slow components
        if (render.slowComponents.length > 20) {
            render.slowComponents = render.slowComponents.slice(0, 20);
        }
    }

    /**
     * Track network request performance
     */
    trackNetworkRequest(
        url: string,
        method: string,
        size: number,
        fromCache: boolean = false,
    ): void {
        if (
            !this.config.enabled ||
            !this.config.collectNetworkMetrics ||
            Math.random() > this.config.sampling.networkRequests / 100
        ) {
            return;
        }

        const { network } = this.metrics;

        network.totalRequests++;
        network.totalDataTransferred += size;
        network.requestsByType[method] = (network.requestsByType[method] || 0) + 1;

        if (fromCache) {
            network.compressionSavings += size; // Assume cache saves the full request size
        }

        // Check for duplicate requests
        const recentRequests = this.networkLog
            .filter((log) => Date.now() - log.startTime < 10000) // Last 10 seconds
            .filter((log) => log.url === url && log.method === method);

        if (recentRequests.length > 1) {
            network.duplicateRequests++;
            this.createAlert(
                'warning',
                'Duplicate Network Request',
                `Duplicate ${method} request to ${url} detected`,
            );
        }

        this.networkLog.push({
            url,
            method,
            size,
            startTime: Date.now(),
            fromCache,
        });

        // Keep only recent network logs
        if (this.networkLog.length > 1000) {
            this.networkLog = this.networkLog.slice(-500);
        }
    }

    /**
     * Update memory metrics
     */
    updateMemoryMetrics(): void {
        if (!this.config.enabled || !this.config.collectMemoryMetrics) {
            return;
        }

        const { memory } = this.metrics;

        if (typeof window !== 'undefined' && (window.performance as any)?.memory) {
            const memInfo = (window.performance as any).memory;
            memory.heapUsed = memInfo.usedJSHeapSize;
            memory.heapTotal = memInfo.totalJSHeapSize;
        }

        // Get cache memory usage from cache manager
        const cacheStats = cacheManager.getStatistics();
        memory.cacheMemoryUsage = cacheStats.storage.used;

        // Record memory snapshot
        this.memorySnapshots.push({
            timestamp: Date.now(),
            heapUsed: memory.heapUsed,
            heapTotal: memory.heapTotal,
            cacheSize: memory.cacheMemoryUsage,
        });

        // Keep only recent snapshots (last hour)
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        this.memorySnapshots = this.memorySnapshots.filter(
            (snapshot) => snapshot.timestamp > oneHourAgo,
        );

        // Check for memory leaks
        this.detectMemoryLeaks();

        // Check memory usage alerts
        if (memory.heapUsed > this.config.alertThresholds.memoryUsageThreshold * 1024 * 1024) {
            this.createAlert(
                'warning',
                'High Memory Usage',
                `Heap usage is ${(memory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
            );
        }
    }

    private detectMemoryLeaks(): void {
        if (this.memorySnapshots.length < 10) return;

        const recent = this.memorySnapshots.slice(-10);
        const growth = recent[recent.length - 1].heapUsed - recent[0].heapUsed;
        const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;

        // Check for consistent memory growth over time
        if (growth > 10 * 1024 * 1024 && timeSpan > 5 * 60 * 1000) {
            // 10MB growth over 5 minutes
            const leak: MemoryLeak = {
                component: 'Unknown',
                growth,
                timestamp: Date.now(),
                severity: growth > 50 * 1024 * 1024 ? 'high' : 'medium',
            };

            this.metrics.memory.memoryLeaks.push(leak);

            this.createAlert(
                'error',
                'Potential Memory Leak',
                `Memory usage increased by ${(growth / 1024 / 1024).toFixed(2)}MB over ${Math.round(timeSpan / 60000)} minutes`,
            );
        }
    }

    /**
     * Update user experience metrics
     */
    updateUserExperienceMetrics(): void {
        if (!this.config.enabled || typeof window === 'undefined') {
            return;
        }

        const { user } = this.metrics;

        // Get performance timing if available
        if (window.performance && window.performance.timing) {
            const timing = window.performance.timing;
            user.pageLoadTime = timing.loadEventEnd - timing.navigationStart;
        }

        // Get paint timing if available
        if (window.performance && window.performance.getEntriesByType) {
            const paintEntries = window.performance.getEntriesByType('paint');
            paintEntries.forEach((entry: any) => {
                if (entry.name === 'first-contentful-paint') {
                    user.firstContentfulPaint = entry.startTime;
                }
            });

            // Get LCP if available
            const lcpEntries = window.performance.getEntriesByType('largest-contentful-paint');
            if (lcpEntries.length > 0) {
                user.largestContentfulPaint = lcpEntries[lcpEntries.length - 1].startTime;
            }
        }

        // Calculate search response time from API metrics
        const searchCalls = this.apiCallLog.filter(
            (call) => call.endpoint.includes('search') && call.duration !== undefined,
        );

        if (searchCalls.length > 0) {
            user.searchResponseTime =
                searchCalls.reduce((sum, call) => sum + (call.duration || 0), 0) /
                searchCalls.length;
        }
    }

    private identifyOptimizationOpportunities(): void {
        const opportunities: OptimizationOpportunity[] = [];

        // Check for redundant API calls
        const recentCalls = this.apiCallLog.slice(-100); // Last 100 calls
        const callGroups: Record<string, typeof recentCalls> = {};

        recentCalls.forEach((call) => {
            const key = `${call.endpoint}_${JSON.stringify(call.parameters)}`;
            if (!callGroups[key]) {
                callGroups[key] = [];
            }
            callGroups[key].push(call);
        });

        Object.entries(callGroups).forEach(([, calls]) => {
            if (calls.length > 2) {
                // More than 2 identical calls
                opportunities.push({
                    type: 'redundant_call',
                    description: `${calls.length} identical calls to ${calls[0].endpoint}`,
                    impact: calls.length > 5 ? 'high' : 'medium',
                    recommendation: 'Implement caching or debouncing for this endpoint',
                    estimatedSavings: {
                        requests: calls.length - 1,
                        time: calls.reduce((sum, call) => sum + (call.duration || 0), 0),
                    },
                });
            }
        });

        // Check cache performance
        if (this.metrics.cache.hitRate < this.config.alertThresholds.lowCacheHitRate) {
            opportunities.push({
                type: 'cache_miss',
                description: `Cache hit rate is ${this.metrics.cache.hitRate.toFixed(1)}%`,
                impact: 'high',
                recommendation: 'Review cache configuration and warming strategies',
                estimatedSavings: {
                    time: this.metrics.cache.totalMisses * 200, // Assume 200ms per avoided request
                },
            });
        }

        // Check for slow queries
        const recentSlowQueries = this.metrics.api.slowQueries.slice(-10);
        if (recentSlowQueries.length > 3) {
            opportunities.push({
                type: 'slow_query',
                description: `${recentSlowQueries.length} slow queries in recent activity`,
                impact: 'medium',
                recommendation: 'Optimize database queries and add proper indexing',
                estimatedSavings: {
                    time: recentSlowQueries.reduce((sum, query) => sum + query.duration, 0),
                },
            });
        }

        this.metrics.api.optimizationOpportunities = opportunities;
    }

    private checkCacheAlerts(): void {
        const { cache } = this.metrics;

        if (
            cache.hitRate < this.config.alertThresholds.lowCacheHitRate &&
            cache.totalHits + cache.totalMisses > 10
        ) {
            this.createAlert(
                'warning',
                'Low Cache Hit Rate',
                `Cache hit rate is ${cache.hitRate.toFixed(1)}%`,
            );
        }
    }

    private createAlert(
        type: 'warning' | 'error' | 'info',
        title: string,
        message: string,
        metrics?: Record<string, any>,
    ): void {
        const alert: PerformanceAlert = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            title,
            message,
            timestamp: Date.now(),
            metrics: metrics || {},
            threshold: 0,
            currentValue: 0,
        };

        this.alerts.push(alert);

        // Keep only recent alerts
        const cutoff = Date.now() - this.config.retention.alerts * 24 * 60 * 60 * 1000;
        this.alerts = this.alerts.filter((alert) => alert.timestamp > cutoff);

        // Notify listeners
        this.notifyListeners();
    }

    private startMonitoring(): void {
        if (!this.config.enabled) return;

        // Update metrics every 30 seconds
        this.intervalId = setInterval(() => {
            this.updateMemoryMetrics();
            this.updateUserExperienceMetrics();
            this.notifyListeners();
        }, 30000);
    }

    private notifyListeners(): void {
        this.listeners.forEach((listener) => {
            try {
                listener(this.metrics);
            } catch {
                console.error('Performance monitor listener error');
            }
        });
    }

    /**
     * Get current performance metrics
     */
    getMetrics(): PerformanceMetrics {
        return { ...this.metrics };
    }

    /**
     * Get performance alerts
     */
    getAlerts(): PerformanceAlert[] {
        return [...this.alerts];
    }

    /**
     * Subscribe to metrics updates
     */
    subscribe(listener: (metrics: PerformanceMetrics) => void): () => void {
        this.listeners.push(listener);

        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    /**
     * Get optimization report
     */
    getOptimizationReport(): {
        summary: {
            totalCallReduction: number;
            averageResponseTime: number;
            cacheEffectiveness: number;
            potentialTimeSavings: number;
        };
        opportunities: OptimizationOpportunity[];
        alerts: PerformanceAlert[];
    } {
        const { api, cache } = this.metrics;

        return {
            summary: {
                totalCallReduction: api.reductionMetrics.reductionPercentage,
                averageResponseTime: api.averageResponseTime,
                cacheEffectiveness: cache.hitRate,
                potentialTimeSavings:
                    cache.timeSaved +
                    api.optimizationOpportunities.reduce(
                        (sum, opp) => sum + (opp.estimatedSavings.time || 0),
                        0,
                    ),
            },
            opportunities: api.optimizationOpportunities,
            alerts: this.getAlerts(),
        };
    }

    /**
     * Clear all metrics and reset
     */
    reset(): void {
        this.metrics = this.initializeMetrics();
        this.alerts = [];
        this.apiCallLog = [];
        this.renderLog = [];
        this.networkLog = [];
        this.memorySnapshots = [];
    }

    /**
     * Destroy monitor and cleanup resources
     */
    destroy(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.listeners = [];
        this.reset();
    }
}

// Create and export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export convenience functions
export const trackAPICall = (endpoint: string, parameters?: Record<string, any>) =>
    performanceMonitor.trackAPICall(endpoint, parameters);

export const trackComponentRender = (componentName: string) =>
    performanceMonitor.trackComponentRender(componentName);

export const trackNetworkRequest = (
    url: string,
    method: string,
    size: number,
    fromCache?: boolean,
) => performanceMonitor.trackNetworkRequest(url, method, size, fromCache);

export const getPerformanceMetrics = () => performanceMonitor.getMetrics();

export const getOptimizationReport = () => performanceMonitor.getOptimizationReport();
