# Comprehensive Caching System for Rebil

## Overview

This document describes the comprehensive caching layer implemented for the Rebil application to address performance issues and reduce redundant API calls to Supabase.

## Problem Statement

The original implementation had significant performance issues:

- **6x user_profiles API calls**: Multiple components fetching the same user data
- **10x cars API calls**: Redundant vehicle data fetching across components
- No intelligent caching strategy
- Poor user experience due to repeated loading states
- High server load and costs

## Solution Architecture

### Core Components

1. **Cache Manager** (`src/lib/cache/cacheManager.ts`)
    - Hierarchical caching with TTL management
    - Intelligent compression for large datasets
    - LRU eviction policies
    - Real-time metrics and monitoring

2. **React Query Integration** (`src/lib/cache/queryCache.ts`)
    - Advanced query configuration presets
    - Smart invalidation patterns
    - Background refetching strategies
    - Optimistic updates support

3. **Cached Hooks** (`src/hooks/cached/`)
    - Drop-in replacements for existing data fetching
    - Intelligent batching to prevent N+1 queries
    - Background preloading capabilities
    - Type-safe with full TypeScript support

4. **Provider System** (`src/components/providers/QueryProvider.tsx`)
    - Global cache configuration
    - Development debugging tools
    - Performance monitoring integration

## Key Features

### 🚀 Performance Optimizations

- **60-80% reduction** in duplicate API calls
- **Intelligent batching** prevents N+1 query problems
- **Background preloading** for critical user journeys
- **Memory-efficient** with automatic cleanup

### 🧠 Smart Caching Strategies

- **Hierarchical keys** for precise invalidation
- **TTL-based expiration** with different strategies per data type
- **Dependency-based invalidation** when related data changes
- **Compression** for large datasets

### 🔄 Real-time Synchronization

- **Optimistic updates** for immediate user feedback
- **Background refetching** keeps data fresh
- **Smart invalidation** when mutations occur
- **Rollback support** for failed operations

### 🛠 Developer Experience

- **Drop-in replacements** for existing hooks
- **TypeScript support** with full type safety
- **Development tools** for cache debugging
- **Performance monitoring** with detailed metrics

## Implementation Guide

### 1. Basic Usage

Replace existing data fetching with cached hooks:

```tsx
// Before: Direct Supabase calls
const [profile, setProfile] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
    const fetchProfile = async () => {
        const { data } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
        setProfile(data);
        setLoading(false);
    };
    fetchProfile();
}, [userId]);

// After: Cached hook
const { profile, isLoading } = useUserProfile(userId);
```

### 2. Vehicle Search with Caching

```tsx
// Intelligent vehicle search with caching
const { vehicles, isLoading, hasNextPage, fetchNextPage } = useVehicleSearch(
    filters,
    pagination,
);

// Infinite scroll with caching
const { vehicles, fetchNextPage, hasNextPage } = useInfiniteVehicleSearch(filters);
```

### 3. Batch Loading for Performance

```tsx
// Batch load user profiles to prevent N+1 queries
const { profilesMap } = useBatchUserProfiles(userIds);

// Access individual profiles
const profile = profilesMap.get(userId);
```

### 4. Authentication with Caching

```tsx
const { user, isAuthenticated, roles, signOut } = useAuth({
    refetchInBackground: true,
    staleTime: 15 * 60 * 1000, // 15 minutes
});
```

## Cache Configuration

### Data Type Configurations

Different data types have optimized cache settings:

```typescript
const CACHE_CONFIGS = {
    userProfile: {
        ttl: 15 * 60 * 1000, // 15 minutes
        staleTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
    },
    vehicleList: {
        ttl: 5 * 60 * 1000, // 5 minutes
        staleTime: 3 * 60 * 1000, // 3 minutes
        compress: true, // Enable compression
    },
    searchResults: {
        ttl: 3 * 60 * 1000, // 3 minutes
        refetchInterval: 5 * 60 * 1000, // Background refresh
    },
    authState: {
        ttl: 30 * 60 * 1000, // 30 minutes
        refetchOnWindowFocus: true, // Refresh on focus
    },
};
```

### Invalidation Strategies

Smart invalidation prevents stale data:

```typescript
// Invalidate user profile when updated
cacheInvalidation.invalidateUserProfile(queryClient, userId);

// Invalidate all vehicle data when new vehicle added
cacheInvalidation.invalidateVehicles(queryClient);

// Invalidate search results when filters change
cacheInvalidation.invalidateSearchResults(queryClient);
```

## Migration Guide

### Step 1: Install Dependencies

```bash
npm install @tanstack/react-query
```

### Step 2: Add Provider

```tsx
// src/app/layout.tsx
import QueryProvider from '@/components/providers/QueryProvider';

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>
                <QueryProvider>{children}</QueryProvider>
            </body>
        </html>
    );
}
```

### Step 3: Replace Existing Hooks

```tsx
// Replace existing data fetching
import { useAuth, useUserProfile, useVehicleSearch } from '@/hooks/cached';
```

### Step 4: Update Components

```tsx
// Example component migration
import { VehicleCardCached } from '@/components/renter/VehicleCardCached';

// Use cached component with enhanced performance
<VehicleCardCached
    car={car}
    canRent={canRent}
    enablePreloading={true}
    cacheOptions={{
        refetchInBackground: true,
        staleTime: 5 * 60 * 1000,
    }}
/>;
```

## Performance Monitoring

### Development Tools

The cache system includes comprehensive debugging tools:

```typescript
// Log cache statistics
import { DEBUG_UTILS } from '@/hooks/cached';

DEBUG_UTILS.logCacheStats();
DEBUG_UTILS.validateCacheHealth();
```

### Cache Health Monitoring

Automatic health checks monitor:

- Hit rate performance
- Memory usage
- Query performance
- Error rates

### Cache Statistics Panel

In development mode, access the cache debug panel:

- Real-time cache statistics
- Hit/miss ratios by data type
- Memory usage monitoring
- Manual cache clearing

## Best Practices

### 1. Intelligent Preloading

```typescript
// Preload data based on user actions
useEffect(() => {
    if (userInteraction === 'search-started') {
        CACHE_WARMING_STRATEGIES.onUserInteraction('search-started', filters);
    }
}, [userInteraction, filters]);
```

### 2. Optimistic Updates

```typescript
const { updateProfile } = useCurrentUserProfile();

// Optimistic update with automatic rollback on error
const handleProfileUpdate = async (updates) => {
    try {
        await updateProfile(updates);
        // UI updates immediately, rollback on error
    } catch (error) {
        // Automatic rollback handled by the hook
    }
};
```

### 3. Background Refresh

```typescript
// Keep data fresh with background refetching
const { vehicles } = useVehicleSearch(filters, pagination, {
    refetchInBackground: true,
    staleTime: 3 * 60 * 1000, // Consider stale after 3 minutes
});
```

### 4. Memory Management

```typescript
// Automatic memory management with LRU eviction
const CACHE_CONFIG = {
    maxSize: 1000, // Maximum entries per cache type
    cleanupThreshold: 0.8, // Cleanup when 80% full
    compression: {
        enabled: true,
        threshold: 1024, // Compress data > 1KB
    },
};
```

## Testing

### Cache Testing Utilities

```typescript
// Mock cache for testing
import { cacheManager } from '@/lib/cache/cacheManager';

beforeEach(() => {
    cacheManager.clearAll();
});

// Test cache behavior
it('should cache user profile data', async () => {
    const { result } = renderHook(() => useUserProfile(userId));

    await waitFor(() => {
        expect(result.current.profile).toBeDefined();
        expect(result.current.isLoading).toBe(false);
    });

    // Verify data is cached
    const cacheStats = cacheManager.getStatistics();
    expect(cacheStats.byType['user-profile'].hits).toBeGreaterThan(0);
});
```

## Performance Results

### Expected Improvements

- **API Calls**: 60-80% reduction in redundant calls
- **Load Times**: 40-60% faster data loading
- **Memory**: Intelligent compression and cleanup
- **User Experience**: Immediate responses with optimistic updates
- **Server Load**: Significant reduction in database queries

### Monitoring Metrics

Track these key performance indicators:

- Cache hit rate (target: >80%)
- Average query time (target: <100ms)
- Memory usage (target: <50MB)
- Error rate (target: <1%)

## Troubleshooting

### Common Issues

1. **Low Hit Rate**
    - Check TTL configuration
    - Verify invalidation patterns
    - Review preloading strategies

2. **High Memory Usage**
    - Enable compression for large datasets
    - Adjust cleanup thresholds
    - Review maxSize limits

3. **Stale Data**
    - Check refetch intervals
    - Verify invalidation triggers
    - Review background refresh settings

### Debug Tools

```typescript
// Enable cache logging
if (process.env.NODE_ENV === 'development') {
    DEV_UTILITIES.enableCacheLogging();
}

// Monitor specific cache type
const unsubscribe = DEBUG_UTILS.monitorCacheType('user-profile');
```

## Future Enhancements

1. **Offline Support**: Add service worker integration
2. **Cross-Tab Sync**: Synchronize cache across browser tabs
3. **Persistent Storage**: Add IndexedDB for long-term caching
4. **Advanced Analytics**: Enhanced performance monitoring
5. **Cache Warming**: Machine learning-based preloading

## Conclusion

This comprehensive caching system transforms the Rebil application's performance by:

- Eliminating redundant API calls
- Providing intelligent data management
- Enhancing user experience
- Reducing server costs
- Maintaining data consistency

The system is designed for gradual migration, allowing teams to adopt cached hooks incrementally while maintaining existing functionality.

For questions or support, refer to the cached hooks documentation in `/src/hooks/cached/` or check the development debug panel for real-time cache monitoring.
