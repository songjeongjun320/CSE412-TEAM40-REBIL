/**
 * Cache system type definitions for comprehensive application-level caching
 */

import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';

// Base cache configuration interface
export interface CacheConfig {
    /** Time to live in milliseconds */
    ttl: number;
    /** Maximum number of entries to keep in cache */
    maxSize?: number;
    /** Enable compression for large datasets */
    compress?: boolean;
    /** Enable metrics collection */
    enableMetrics?: boolean;
}

// Cache entry with metadata
export interface CacheEntry<T = any> {
    data: T;
    timestamp: number;
    ttl: number;
    size?: number;
    compressed?: boolean;
    accessCount?: number;
    lastAccess?: number;
}

// Cache metrics for monitoring
export interface CacheMetrics {
    hits: number;
    misses: number;
    evictions: number;
    totalSize: number;
    entryCount: number;
    hitRate: number;
    avgAccessTime: number;
}

// Cache invalidation strategies
export type InvalidationStrategy =
    | 'manual'
    | 'time-based'
    | 'dependency-based'
    | 'pattern-based'
    | 'mutation-based';

// Cache key types for different data categories
export type CacheKeyType =
    | 'user-profile'
    | 'vehicle-list'
    | 'vehicle-details'
    | 'search-results'
    | 'auth-state'
    | 'location-data'
    | 'booking-data'
    | 'admin-data'
    | 'notification-data';

// Hierarchical cache key structure
export interface HierarchicalCacheKey {
    type: CacheKeyType;
    scope: string; // e.g., 'user', 'global', 'session'
    entity?: string; // e.g., user ID, vehicle ID
    params?: Record<string, any>; // query parameters
}

// Cache invalidation pattern
export interface InvalidationPattern {
    type: CacheKeyType;
    scope?: string;
    entity?: string;
    pattern?: string | RegExp;
}

// React Query configuration presets
export interface QueryPreset {
    staleTime: number;
    cacheTime: number;
    retry: boolean | number;
    retryDelay: number;
    refetchOnWindowFocus: boolean;
    refetchOnReconnect: boolean;
    refetchInterval?: number;
}

// Pre-defined cache configurations for different data types
export interface CacheConfigs {
    userProfile: CacheConfig & QueryPreset;
    vehicleList: CacheConfig & QueryPreset;
    vehicleDetails: CacheConfig & QueryPreset;
    searchResults: CacheConfig & QueryPreset;
    authState: CacheConfig & QueryPreset;
    locationData: CacheConfig & QueryPreset;
    bookingData: CacheConfig & QueryPreset;
    adminData: CacheConfig & QueryPreset;
    notificationData: CacheConfig & QueryPreset;
}

// Cache warming strategy
export interface CacheWarmingConfig {
    enabled: boolean;
    strategy: 'eager' | 'lazy' | 'background';
    triggers: string[]; // Events that trigger warming
    priority: 'high' | 'medium' | 'low';
}

// Background sync configuration
export interface BackgroundSyncConfig {
    enabled: boolean;
    interval: number; // milliseconds
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential';
}

// Cache preloading configuration
export interface PreloadConfig {
    userProfiles: string[]; // User IDs to preload
    vehicles: string[]; // Vehicle IDs to preload
    searchQueries: SearchQuery[]; // Common search queries to preload
}

// Search query interface for caching
export interface SearchQuery {
    location?: string;
    startDate?: string;
    endDate?: string;
    priceMin?: number;
    priceMax?: number;
    transmission?: string;
    fuelType?: string;
    seats?: number;
    features?: string[];
}

// Cache compression configuration
export interface CompressionConfig {
    enabled: boolean;
    threshold: number; // Size threshold for compression in bytes
    algorithm: 'gzip' | 'lz4' | 'snappy';
    level: number; // Compression level
}

// Performance monitoring configuration
export interface PerformanceConfig {
    enabled: boolean;
    sampleRate: number; // Percentage of operations to monitor
    metricsEndpoint?: string; // Optional endpoint for sending metrics
}

// Cache storage configuration
export interface StorageConfig {
    type: 'memory' | 'indexeddb' | 'localStorage' | 'sessionStorage';
    persistent: boolean;
    maxStorageSize: number; // Maximum storage size in bytes
    cleanupThreshold: number; // Cleanup when reaching this percentage of max size
}

// Complete cache manager configuration
export interface CacheManagerConfig {
    storage: StorageConfig;
    compression: CompressionConfig;
    performance: PerformanceConfig;
    backgroundSync: BackgroundSyncConfig;
    preloading: PreloadConfig;
    warming: CacheWarmingConfig;
    configs: CacheConfigs;
}

// Cache operation result
export interface CacheOperationResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    cached: boolean;
    source: 'cache' | 'network' | 'fallback';
    timing: {
        start: number;
        end: number;
        duration: number;
    };
}

// Query cache options with enhanced features
export interface EnhancedQueryOptions<T = any> extends UseQueryOptions<T> {
    cacheKey: HierarchicalCacheKey;
    invalidationPatterns?: InvalidationPattern[];
    preload?: boolean;
    warmCache?: boolean;
    compression?: boolean;
    backgroundRefresh?: boolean;
    fallbackData?: T;
    optimisticUpdates?: boolean;
}

// Mutation cache options with invalidation patterns
export interface EnhancedMutationOptions<T = any, E = unknown, V = void, C = unknown>
    extends UseMutationOptions<T, E, V, C> {
    invalidationPatterns: InvalidationPattern[];
    optimisticUpdates?: boolean;
    rollbackOnError?: boolean;
    backgroundSync?: boolean;
}

// Cache statistics for monitoring
export interface CacheStatistics {
    total: CacheMetrics;
    byType: Record<CacheKeyType, CacheMetrics>;
    performance: {
        avgQueryTime: number;
        slowQueries: Array<{
            key: string;
            duration: number;
            timestamp: number;
        }>;
    };
    storage: {
        used: number;
        available: number;
        percentage: number;
    };
}

// Event types for cache monitoring
export type CacheEventType =
    | 'hit'
    | 'miss'
    | 'set'
    | 'delete'
    | 'evict'
    | 'warm'
    | 'invalidate'
    | 'compress'
    | 'decompress'
    | 'error';

// Cache event for monitoring and debugging
export interface CacheEvent {
    type: CacheEventType;
    key: string;
    timestamp: number;
    duration?: number;
    size?: number;
    error?: string;
    metadata?: Record<string, any>;
}

// Cache event listener
export type CacheEventListener = (event: CacheEvent) => void;

// Export commonly used types
export type { UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
