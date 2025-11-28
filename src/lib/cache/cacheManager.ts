/**
 * Comprehensive Cache Manager for Rebil Application
 *
 * Features:
 * - Intelligent TTL management with different strategies
 * - Hierarchical caching with smart key generation
 * - Compression for large datasets
 * - Cache metrics and monitoring
 * - Background cleanup and optimization
 * - Memory management with LRU eviction
 */

import type {
    CacheConfig,
    CacheEntry,
    CacheEvent,
    CacheEventListener,
    CacheEventType,
    CacheKeyType,
    CacheManagerConfig,
    CacheMetrics,
    CacheOperationResult,
    CacheStatistics,
    HierarchicalCacheKey,
    InvalidationPattern,
} from './types';

export type {
    CacheEvent,
    HierarchicalCacheKey as CacheKey,
    InvalidationPattern as CacheInvalidationPattern,
} from './types';

// Default cache configurations for different data types
const DEFAULT_CACHE_CONFIGS: Record<CacheKeyType, CacheConfig> = {
    'user-profile': {
        ttl: 15 * 60 * 1000, // 15 minutes
        maxSize: 1000,
        compress: false,
        enableMetrics: true,
    },
    'vehicle-list': {
        ttl: 5 * 60 * 1000, // 5 minutes
        maxSize: 500,
        compress: true,
        enableMetrics: true,
    },
    'vehicle-details': {
        ttl: 10 * 60 * 1000, // 10 minutes
        maxSize: 200,
        compress: true,
        enableMetrics: true,
    },
    'search-results': {
        ttl: 3 * 60 * 1000, // 3 minutes
        maxSize: 100,
        compress: true,
        enableMetrics: true,
    },
    'auth-state': {
        ttl: 30 * 60 * 1000, // 30 minutes
        maxSize: 10,
        compress: false,
        enableMetrics: true,
    },
    'location-data': {
        ttl: 60 * 60 * 1000, // 1 hour
        maxSize: 200,
        compress: false,
        enableMetrics: true,
    },
    'booking-data': {
        ttl: 2 * 60 * 1000, // 2 minutes
        maxSize: 100,
        compress: false,
        enableMetrics: true,
    },
    'admin-data': {
        ttl: 1 * 60 * 1000, // 1 minute
        maxSize: 50,
        compress: false,
        enableMetrics: true,
    },
    'notification-data': {
        ttl: 30 * 1000, // 30 seconds
        maxSize: 100,
        compress: false,
        enableMetrics: true,
    },
};

// Simple compression implementation (can be replaced with more advanced algorithms)
class SimpleCompressor {
    static compress(data: any): string {
        try {
            return JSON.stringify(data);
        } catch {
            return String(data);
        }
    }

    static decompress<T>(compressed: string): T {
        try {
            return JSON.parse(compressed) as T;
        } catch {
            return compressed as unknown as T;
        }
    }

    static shouldCompress(data: any, threshold: number = 1024): boolean {
        const size = JSON.stringify(data).length;
        return size > threshold;
    }
}

export class CacheManager {
    private cache = new Map<string, CacheEntry>();
    private configs: Record<CacheKeyType, CacheConfig>;
    private metrics: Record<CacheKeyType, CacheMetrics> = {} as Record<CacheKeyType, CacheMetrics>;
    private eventListeners: CacheEventListener[] = [];
    private cleanupInterval: NodeJS.Timeout | null = null;
    private metricsInterval: NodeJS.Timeout | null = null;

    constructor(config?: Partial<CacheManagerConfig>) {
        this.configs = { ...DEFAULT_CACHE_CONFIGS, ...config?.configs };
        this.initializeMetrics();
        this.startBackgroundTasks();
    }

    /**
     * Generate a unique cache key from hierarchical key structure
     */
    private generateCacheKey(key: HierarchicalCacheKey): string {
        const parts = [key.type, key.scope];

        if (key.entity) {
            parts.push(key.entity);
        }

        if (key.params) {
            const sortedParams = Object.keys(key.params)
                .sort()
                .map((k) => `${k}:${JSON.stringify(key.params![k])}`)
                .join('|');
            parts.push(sortedParams);
        }

        return parts.join('::');
    }

    /**
     * Get configuration for a specific cache type
     */
    private getConfig(type: CacheKeyType): CacheConfig {
        return this.configs[type] || DEFAULT_CACHE_CONFIGS[type];
    }

    /**
     * Initialize metrics for all cache types
     */
    private initializeMetrics(): void {
        Object.keys(DEFAULT_CACHE_CONFIGS).forEach((type) => {
            this.metrics[type as CacheKeyType] = {
                hits: 0,
                misses: 0,
                evictions: 0,
                totalSize: 0,
                entryCount: 0,
                hitRate: 0,
                avgAccessTime: 0,
            };
        });
    }

    /**
     * Emit cache event to listeners
     */
    private emitEvent(type: CacheEventType, key: string, metadata?: Record<string, any>): void {
        const event: CacheEvent = {
            type,
            key,
            timestamp: Date.now(),
            metadata,
        };

        this.eventListeners.forEach((listener) => {
            try {
                listener(event);
            } catch (error) {
                console.error('Cache event listener error:', error);
            }
        });
    }

    /**
     * Update metrics for cache operations
     */
    private updateMetrics(type: CacheKeyType, operation: 'hit' | 'miss' | 'set' | 'evict'): void {
        const metrics = this.metrics[type];

        switch (operation) {
            case 'hit':
                metrics.hits++;
                break;
            case 'miss':
                metrics.misses++;
                break;
            case 'evict':
                metrics.evictions++;
                break;
        }

        const total = metrics.hits + metrics.misses;
        metrics.hitRate = total > 0 ? (metrics.hits / total) * 100 : 0;
    }

    /**
     * Check if cache entry is expired
     */
    private isExpired(entry: CacheEntry): boolean {
        return Date.now() - entry.timestamp > entry.ttl;
    }

    /**
     * Get cache entry size estimation
     */
    private getEntrySize(entry: CacheEntry): number {
        if (entry.size !== undefined) {
            return entry.size;
        }

        try {
            return JSON.stringify(entry.data).length;
        } catch {
            return 1024; // Default size estimate
        }
    }

    /**
     * Evict least recently used entries when cache is full
     */
    private evictLRU(type: CacheKeyType): void {
        const config = this.getConfig(type);
        if (!config.maxSize) return;

        const entries = Array.from(this.cache.entries())
            .filter(([key]) => key.startsWith(`${type}::`))
            .sort((a, b) => (a[1].lastAccess || 0) - (b[1].lastAccess || 0));

        const excess = entries.length - config.maxSize + 1;

        for (let i = 0; i < excess && i < entries.length; i++) {
            const [key] = entries[i];
            this.cache.delete(key);
            this.updateMetrics(type, 'evict');
            this.emitEvent('evict', key, { reason: 'LRU' });
        }
    }

    /**
     * Set cache entry with compression and size management
     */
    set<T>(key: HierarchicalCacheKey, data: T): CacheOperationResult<T> {
        const start = performance.now();
        const cacheKey = this.generateCacheKey(key);
        const config = this.getConfig(key.type);

        try {
            // Check if compression is needed
            let entryData = data;
            let compressed = false;

            if (config.compress && SimpleCompressor.shouldCompress(data)) {
                entryData = SimpleCompressor.compress(data) as T;
                compressed = true;
                this.emitEvent('compress', cacheKey);
            }

            // Create cache entry
            const entry: CacheEntry<T> = {
                data: entryData,
                timestamp: Date.now(),
                ttl: config.ttl,
                compressed,
                accessCount: 0,
                lastAccess: Date.now(),
            };

            entry.size = this.getEntrySize(entry);

            // Evict if necessary
            this.evictLRU(key.type);

            // Set cache entry
            this.cache.set(cacheKey, entry);
            this.updateMetrics(key.type, 'set');
            this.emitEvent('set', cacheKey, {
                size: entry.size,
                compressed,
                type: key.type,
            });

            const end = performance.now();

            return {
                success: true,
                data,
                cached: true,
                source: 'cache',
                timing: { start, end, duration: end - start },
            };
        } catch (error) {
            const end = performance.now();
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            this.emitEvent('error', cacheKey, { error: errorMessage, operation: 'set' });

            return {
                success: false,
                error: errorMessage,
                cached: false,
                source: 'fallback',
                timing: { start, end, duration: end - start },
            };
        }
    }

    /**
     * Get cache entry with decompression and access tracking
     */
    get<T>(key: HierarchicalCacheKey): CacheOperationResult<T> {
        const start = performance.now();
        const cacheKey = this.generateCacheKey(key);

        const entry = this.cache.get(cacheKey) as CacheEntry<T> | undefined;

        if (!entry) {
            this.updateMetrics(key.type, 'miss');
            this.emitEvent('miss', cacheKey, { type: key.type });

            const end = performance.now();
            return {
                success: false,
                cached: false,
                source: 'network',
                timing: { start, end, duration: end - start },
            };
        }

        // Check expiration
        if (this.isExpired(entry)) {
            this.cache.delete(cacheKey);
            this.updateMetrics(key.type, 'miss');
            this.emitEvent('miss', cacheKey, { type: key.type, reason: 'expired' });

            const end = performance.now();
            return {
                success: false,
                cached: false,
                source: 'network',
                timing: { start, end, duration: end - start },
            };
        }

        try {
            // Update access tracking
            entry.accessCount = (entry.accessCount || 0) + 1;
            entry.lastAccess = Date.now();

            // Decompress if needed
            let data = entry.data;
            if (entry.compressed) {
                data = SimpleCompressor.decompress<T>(entry.data as string);
                this.emitEvent('decompress', cacheKey);
            }

            this.updateMetrics(key.type, 'hit');
            this.emitEvent('hit', cacheKey, {
                type: key.type,
                accessCount: entry.accessCount,
            });

            const end = performance.now();

            return {
                success: true,
                data,
                cached: true,
                source: 'cache',
                timing: { start, end, duration: end - start },
            };
        } catch (error) {
            const end = performance.now();
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            this.emitEvent('error', cacheKey, { error: errorMessage, operation: 'get' });

            return {
                success: false,
                error: errorMessage,
                cached: false,
                source: 'fallback',
                timing: { start, end, duration: end - start },
            };
        }
    }

    /**
     * Delete specific cache entry
     */
    delete(key: HierarchicalCacheKey): boolean {
        const cacheKey = this.generateCacheKey(key);
        const deleted = this.cache.delete(cacheKey);

        if (deleted) {
            this.emitEvent('delete', cacheKey, { type: key.type });
        }

        return deleted;
    }

    /**
     * Invalidate cache entries matching patterns
     */
    invalidate(patterns: InvalidationPattern[]): number {
        let invalidatedCount = 0;

        for (const pattern of patterns) {
            const keysToDelete: string[] = [];

            for (const [cacheKey] of this.cache.entries()) {
                const keyParts = cacheKey.split('::');
                const [type, scope, entity] = keyParts;

                // Match type
                if (pattern.type !== type) continue;

                // Match scope if specified
                if (pattern.scope && pattern.scope !== scope) continue;

                // Match entity if specified
                if (pattern.entity && pattern.entity !== entity) continue;

                // Match pattern if specified
                if (pattern.pattern) {
                    const regex =
                        pattern.pattern instanceof RegExp
                            ? pattern.pattern
                            : new RegExp(pattern.pattern);

                    if (!regex.test(cacheKey)) continue;
                }

                keysToDelete.push(cacheKey);
            }

            // Delete matched keys
            keysToDelete.forEach((key) => {
                this.cache.delete(key);
                this.emitEvent('invalidate', key, { pattern: pattern.type });
                invalidatedCount++;
            });
        }

        return invalidatedCount;
    }

    /**
     * Clear all cache entries for a specific type
     */
    clearType(type: CacheKeyType): number {
        let clearedCount = 0;
        const keysToDelete: string[] = [];

        for (const [cacheKey] of this.cache.entries()) {
            if (cacheKey.startsWith(`${type}::`)) {
                keysToDelete.push(cacheKey);
            }
        }

        keysToDelete.forEach((key) => {
            this.cache.delete(key);
            clearedCount++;
        });

        this.emitEvent('invalidate', type, { cleared: clearedCount });
        return clearedCount;
    }

    /**
     * Clear all cache entries
     */
    clearAll(): void {
        this.cache.clear();
        this.initializeMetrics();
        this.emitEvent('invalidate', 'all');
    }

    /**
     * Get cache statistics
     */
    getStatistics(): CacheStatistics {
        const totalMetrics: CacheMetrics = {
            hits: 0,
            misses: 0,
            evictions: 0,
            totalSize: 0,
            entryCount: this.cache.size,
            hitRate: 0,
            avgAccessTime: 0,
        };

        // Calculate total size
        let totalSize = 0;
        for (const [, entry] of this.cache.entries()) {
            totalSize += this.getEntrySize(entry);
        }
        totalMetrics.totalSize = totalSize;

        // Aggregate metrics
        Object.values(this.metrics).forEach((metric) => {
            totalMetrics.hits += metric.hits;
            totalMetrics.misses += metric.misses;
            totalMetrics.evictions += metric.evictions;
        });

        const totalRequests = totalMetrics.hits + totalMetrics.misses;
        totalMetrics.hitRate = totalRequests > 0 ? (totalMetrics.hits / totalRequests) * 100 : 0;

        return {
            total: totalMetrics,
            byType: { ...this.metrics },
            performance: {
                avgQueryTime: 0, // Could be calculated from timing data
                slowQueries: [], // Could be tracked if needed
            },
            storage: {
                used: totalSize,
                available: Number.MAX_SAFE_INTEGER, // Memory-based, effectively unlimited
                percentage: 0,
            },
        };
    }

    /**
     * Add event listener for cache events
     */
    addEventListener(listener: CacheEventListener): () => void {
        this.eventListeners.push(listener);

        // Return unsubscribe function
        return () => {
            const index = this.eventListeners.indexOf(listener);
            if (index > -1) {
                this.eventListeners.splice(index, 1);
            }
        };
    }

    /**
     * Start background tasks for cleanup and metrics
     */
    private startBackgroundTasks(): void {
        // Cleanup expired entries every 5 minutes
        this.cleanupInterval = setInterval(
            () => {
                this.cleanupExpired();
            },
            5 * 60 * 1000,
        );

        // Update metrics every minute
        this.metricsInterval = setInterval(() => {
            this.updateAllMetrics();
        }, 60 * 1000);
    }

    /**
     * Clean up expired cache entries
     */
    private cleanupExpired(): void {
        let cleanedCount = 0;
        const keysToDelete: string[] = [];

        for (const [key, entry] of this.cache.entries()) {
            if (this.isExpired(entry)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach((key) => {
            this.cache.delete(key);
            cleanedCount++;
        });

        if (cleanedCount > 0) {
            this.emitEvent('invalidate', 'cleanup', { cleanedCount });
        }
    }

    /**
     * Update all metrics
     */
    private updateAllMetrics(): void {
        // Update entry counts and sizes
        Object.keys(this.metrics).forEach((type) => {
            const cacheType = type as CacheKeyType;
            let entryCount = 0;
            let totalSize = 0;

            for (const [key, entry] of this.cache.entries()) {
                if (key.startsWith(`${cacheType}::`)) {
                    entryCount++;
                    totalSize += this.getEntrySize(entry);
                }
            }

            this.metrics[cacheType].entryCount = entryCount;
            this.metrics[cacheType].totalSize = totalSize;
        });
    }

    /**
     * Warm cache with frequently accessed data
     */
    warmCache(key: HierarchicalCacheKey, dataFetcher: () => Promise<any>): Promise<void> {
        return dataFetcher()
            .then((data) => {
                this.set(key, data);
                this.emitEvent('warm', this.generateCacheKey(key), { type: key.type });
            })
            .catch((error) => {
                this.emitEvent('error', this.generateCacheKey(key), {
                    error: error.message,
                    operation: 'warm',
                });
            });
    }

    /**
     * Destroy cache manager and cleanup resources
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = null;
        }

        this.clearAll();
        this.eventListeners.length = 0;
    }
}

// Create and export singleton instance
export const cacheManager = new CacheManager();

// Export cache key helpers
export const createCacheKey = (
    type: CacheKeyType,
    scope: string,
    entity?: string,
    params?: Record<string, any>,
): HierarchicalCacheKey => ({
    type,
    scope,
    entity,
    params,
});

// Export common invalidation patterns
export const invalidationPatterns = {
    userProfile: (userId: string): InvalidationPattern => ({
        type: 'user-profile',
        entity: userId,
    }),

    vehiclesByHost: (hostId: string): InvalidationPattern => ({
        type: 'vehicle-list',
        pattern: `::.*host:${hostId}`,
    }),

    searchResults: (): InvalidationPattern => ({
        type: 'search-results',
    }),

    authState: (userId?: string): InvalidationPattern => ({
        type: 'auth-state',
        entity: userId,
    }),

    allVehicleData: (): InvalidationPattern[] => [
        { type: 'vehicle-list' },
        { type: 'vehicle-details' },
        { type: 'search-results' },
    ],
};
