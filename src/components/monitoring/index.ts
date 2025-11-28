/**
 * Performance Monitoring Components - Export Index
 *
 * Features:
 * - Centralized export for all monitoring components
 * - Type-safe imports for performance monitoring
 * - Easy integration with existing codebase
 */

// Main monitoring components
export { PerformanceDashboard } from './PerformanceDashboard';
export { PerformanceWidget, PerformanceIndicator } from './PerformanceWidget';
export {
    PerformanceProvider,
    usePerformanceContext,
    withPerformanceTracking,
} from './PerformanceProvider';
export { PerformanceAlerts, PerformanceAlertBadge, CriticalAlertBanner } from './PerformanceAlerts';

// Performance hooks
export {
    usePerformanceMonitoring,
    useAPITracking,
    useComponentTracking,
    usePerformanceBudget,
    useCachePerformance,
} from '../../hooks/usePerformanceMonitoring';

export {
    useOptimizedQuery,
    useOptimizedMutation,
    useComponentPerformanceTracking,
    useSupabasePerformanceTracking,
    useSearchPerformanceTracking,
    useWebSocketPerformanceTracking,
    useVehicleCardPerformance,
    useCacheEffectivenessTracking,
} from '../../hooks/useOptimizedPerformance';

// Core monitoring utilities
export {
    getPerformanceMetrics,
    getOptimizationReport,
} from '../../lib/monitoring/performanceMonitor';

export { cacheManager, createCacheKey, invalidationPatterns } from '../../lib/cache/cacheManager';

// Types
export type {
    PerformanceMetrics,
    APIMetrics,
    CacheMetrics,
    CacheTypeMetrics,
    RenderMetrics,
    ComponentPerformance,
    NetworkMetrics,
    MemoryMetrics,
    MemoryLeak,
    PerformanceConfig,
} from '../../lib/monitoring/performanceMonitor';

export type { CacheEvent, CacheKey, CacheInvalidationPattern } from '../../lib/cache/cacheManager';

// Performance constants and configurations
export const PERFORMANCE_THRESHOLDS = {
    // API Performance
    SLOW_QUERY_THRESHOLD: 1000, // ms
    API_ERROR_RATE_THRESHOLD: 5, // %
    API_RESPONSE_TIME_TARGET: 200, // ms

    // Cache Performance
    LOW_CACHE_HIT_RATE: 60, // %
    CACHE_HIT_RATE_TARGET: 80, // %

    // Memory Performance
    MEMORY_USAGE_WARNING: 75, // % of heap
    MEMORY_USAGE_CRITICAL: 90, // % of heap
    MEMORY_LEAK_THRESHOLD: 10 * 1024 * 1024, // 10MB

    // Render Performance
    SLOW_RENDER_THRESHOLD: 100, // ms
    VEHICLE_CARD_RENDER_TARGET: 50, // ms
    COMPONENT_RENDER_TARGET: 16, // ms (60fps target)

    // Network Performance
    IMAGE_LOAD_THRESHOLD: 2000, // ms
    NETWORK_REQUEST_TIMEOUT: 10000, // ms

    // WebSocket Performance
    WEBSOCKET_LATENCY_WARNING: 500, // ms
    WEBSOCKET_LATENCY_CRITICAL: 1000, // ms

    // User Experience
    FIRST_CONTENTFUL_PAINT_TARGET: 1500, // ms
    LARGEST_CONTENTFUL_PAINT_TARGET: 2500, // ms
    CUMULATIVE_LAYOUT_SHIFT_TARGET: 0.1, // score
} as const;

// Performance budget configurations for different environments
export const PERFORMANCE_BUDGETS = {
    development: {
        maxAPIResponseTime: 500,
        maxRenderTime: 100,
        maxMemoryUsage: 200 * 1024 * 1024, // 200MB
        minCacheHitRate: 70,
    },
    production: {
        maxAPIResponseTime: 200,
        maxRenderTime: 50,
        maxMemoryUsage: 100 * 1024 * 1024, // 100MB
        minCacheHitRate: 85,
    },
    testing: {
        maxAPIResponseTime: 1000,
        maxRenderTime: 200,
        maxMemoryUsage: 500 * 1024 * 1024, // 500MB
        minCacheHitRate: 50,
    },
} as const;

// Default monitoring configurations
export const DEFAULT_MONITORING_CONFIG = {
    enableInDevelopment: true,
    enableInProduction: false, // Should be enabled via environment variable
    enableAPITracking: true,
    enableRenderTracking: true,
    enableWebSocketTracking: true,
    enableMemoryTracking: true,
    enableCacheTracking: true,

    alertThresholds: {
        slowQueryThreshold: PERFORMANCE_THRESHOLDS.SLOW_QUERY_THRESHOLD,
        lowCacheHitRate: PERFORMANCE_THRESHOLDS.LOW_CACHE_HIT_RATE,
        highErrorRate: PERFORMANCE_THRESHOLDS.API_ERROR_RATE_THRESHOLD,
        memoryUsageThreshold: PERFORMANCE_THRESHOLDS.MEMORY_USAGE_WARNING,
        renderTimeThreshold: PERFORMANCE_THRESHOLDS.SLOW_RENDER_THRESHOLD,
    },

    widgetConfig: {
        position: 'bottom-right' as const,
        showDetails: true,
        draggable: false,
    },

    dashboardConfig: {
        detailed: false,
        realTime: true,
        autoRefresh: true,
        refreshInterval: 30000, // 30 seconds
    },

    alertConfig: {
        mode: 'both' as const,
        enableToasts: true,
        maxAlerts: 10,
        autoDismissTime: 300000, // 5 minutes
    },
} as const;
