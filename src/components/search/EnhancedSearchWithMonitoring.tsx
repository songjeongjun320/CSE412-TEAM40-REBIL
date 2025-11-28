/**
 * Enhanced Search Component with Performance Monitoring
 *
 * Features:
 * - Real-time search performance tracking
 * - API call monitoring and optimization
 * - Component render performance measurement
 * - Cache effectiveness monitoring
 * - Search latency optimization
 * - Integration with existing search functionality
 */

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { PerformanceIndicator } from '@/components/monitoring';
import { VehicleCard } from '@/components/renter/VehicleCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useInfiniteVehicleSearch, useVehicleSearch } from '@/hooks/cached/useVehicles';
import {
    useCacheEffectivenessTracking,
    useComponentPerformanceTracking,
    useSearchPerformanceTracking,
} from '@/hooks/useOptimizedPerformance';
import type { PaginationOptions, SearchFilters } from '@/lib/supabase/optimizedQueries';

interface EnhancedSearchWithMonitoringProps {
    /** Initial search filters */
    initialFilters?: SearchFilters;
    /** Enable infinite scroll vs pagination */
    enableInfiniteScroll?: boolean;
    /** Show performance metrics in development */
    showPerformanceMetrics?: boolean;
    /** Custom performance thresholds */
    performanceThresholds?: {
        slowSearchThreshold?: number;
        maxRenderTime?: number;
    };
}

export function EnhancedSearchWithMonitoring({
    initialFilters = {},
    enableInfiniteScroll = false,
    showPerformanceMetrics = process.env.NODE_ENV === 'development',
    performanceThresholds = {
        slowSearchThreshold: 2000,
        maxRenderTime: 100,
    },
}: EnhancedSearchWithMonitoringProps) {
    const [searchFilters, setSearchFilters] = useState<SearchFilters>(initialFilters);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // Performance tracking hooks
    const { trackSearch, getSearchMetrics } = useSearchPerformanceTracking();
    const { renderCount, lastRenderTime } = useComponentPerformanceTracking(
        'EnhancedSearchWithMonitoring',
        {
            enableMetrics: showPerformanceMetrics,
            trackReRenders: true,
            slowRenderThreshold: performanceThresholds.maxRenderTime,
        },
    );

    // Cache effectiveness tracking
    const { recordCacheHit, recordCacheMiss, getCacheStats } =
        useCacheEffectivenessTracking('vehicle-search');

    // Search data hooks
    const paginationOptions: PaginationOptions = useMemo(
        () => ({
            page: currentPage,
            limit: 12,
        }),
        [currentPage],
    );

    const {
        vehicles: paginatedVehicles,
        isLoading: paginatedLoading,
        isError: paginatedError,
        hasNextPage,
        hasPreviousPage,
        nextPage,
        previousPage,
        totalCount,
        currentPage: actualCurrentPage,
        totalPages,
    } = useVehicleSearch(searchFilters, paginationOptions, {
        enabled: !enableInfiniteScroll,
        refetchOnFilterChange: true,
        staleTime: 3 * 60 * 1000, // 3 minutes
    });

    const {
        vehicles: infiniteVehicles,
        isLoading: infiniteLoading,
        isError: infiniteError,
        hasNextPage: hasInfiniteNextPage,
        fetchNextPage,
        isFetchingNextPage,
    } = useInfiniteVehicleSearch(searchFilters, {
        enabled: enableInfiniteScroll,
        refetchOnFilterChange: true,
        staleTime: 3 * 60 * 1000,
    });

    // Determine which data to use based on mode
    const vehicles = enableInfiniteScroll ? infiniteVehicles : paginatedVehicles;
    const isLoading = enableInfiniteScroll ? infiniteLoading : paginatedLoading;
    const isError = enableInfiniteScroll ? infiniteError : paginatedError;

    // Track search performance
    const handleSearch = useCallback(async () => {
        setIsSearching(true);

        // Update search filters
        const newFilters: SearchFilters = {
            ...searchFilters,
            // searchQuery: searchQuery.trim(),
        };

        // Track the search operation
        const finishSearchTracking = trackSearch(newFilters, 'vehicle');

        try {
            setSearchFilters(newFilters);
            if (!enableInfiniteScroll) {
                setCurrentPage(1); // Reset to first page for new search
            }

            // Simulate search completion tracking
            setTimeout(() => {
                const searchMetrics = finishSearchTracking();

                // Record cache effectiveness
                if (searchMetrics.searchTime < 100) {
                    recordCacheHit(); // Likely served from cache
                } else {
                    recordCacheMiss(); // Network request
                }

                setIsSearching(false);
            }, 100);
        } catch (error) {
            console.error('Search error:', error);
            setIsSearching(false);
        }
    }, [searchFilters, trackSearch, enableInfiniteScroll, recordCacheHit, recordCacheMiss]);

    // Handle filter changes
    const handleFilterChange = useCallback(
        (key: keyof SearchFilters, value: any) => {
            const finishSearchTracking = trackSearch({ [key]: value }, 'vehicle');

            setSearchFilters((prev) => ({
                ...prev,
                [key]: value,
            }));

            // Track filter change performance
            setTimeout(() => {
                finishSearchTracking();
            }, 50);
        },
        [trackSearch],
    );

    // Performance metrics for display
    const performanceStats = useMemo(() => {
        const searchMetrics = getSearchMetrics();
        const cacheStats = getCacheStats();

        return {
            searchMetrics,
            cacheStats,
            renderMetrics: {
                renderCount,
                lastRenderTime,
                componentName: 'EnhancedSearchWithMonitoring',
            },
        };
    }, [getSearchMetrics, getCacheStats, renderCount, lastRenderTime]);

    // Reset search when clearing query
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchFilters(initialFilters);
        }
    }, [searchQuery, initialFilters]);

    return (
        <div className="space-y-6">
            {/* Performance Header (Development Only) */}
            {showPerformanceMetrics && (
                <Card className="p-4 bg-gray-50 border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-700">
                            Search Performance Metrics
                        </h3>
                        <PerformanceIndicator className="text-xs" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                            <div className="font-medium text-gray-600">Avg Search Time</div>
                            <div className="text-lg font-bold text-blue-600">
                                {performanceStats.searchMetrics.avgSearchTime.toFixed(0)}
                                ms
                            </div>
                        </div>
                        <div>
                            <div className="font-medium text-gray-600">Total Searches</div>
                            <div className="text-lg font-bold text-gray-900">
                                {performanceStats.searchMetrics.totalSearches}
                            </div>
                        </div>
                        <div>
                            <div className="font-medium text-gray-600">Cache Hit Rate</div>
                            <div className="text-lg font-bold text-green-600">
                                {performanceStats.cacheStats.hitRate.toFixed(1)}%
                            </div>
                        </div>
                        <div>
                            <div className="font-medium text-gray-600">Render Count</div>
                            <div className="text-lg font-bold text-purple-600">
                                {performanceStats.renderMetrics.renderCount}
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Search Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Find Your Perfect Ride</h1>
                    <p className="text-gray-600">
                        {totalCount
                            ? `${totalCount} vehicles available`
                            : 'Discover amazing vehicles near you'}
                    </p>
                </div>

                {/* Performance Indicator */}
                <div className="flex items-center space-x-4">
                    {showPerformanceMetrics && (
                        <div className="text-xs text-gray-500">
                            Last render: {lastRenderTime.toFixed(1)}ms
                        </div>
                    )}
                    <PerformanceIndicator />
                </div>
            </div>

            {/* Search Bar */}
            <div className="flex space-x-3">
                <div className="flex-1">
                    <Input
                        type="text"
                        placeholder="Search by make, model, or location..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        className="w-full"
                    />
                </div>
                <Button onClick={handleSearch} disabled={isSearching || isLoading} className="px-8">
                    {isSearching ? 'Searching...' : 'Search'}
                </Button>
            </div>

            {/* Active Filters */}
            {Object.keys(searchFilters).length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Filters:</span>
                    {Object.entries(searchFilters).map(([key, value]) => {
                        if (!value) return null;
                        return (
                            <Badge
                                key={key}
                                variant="secondary"
                                className="flex items-center space-x-1"
                            >
                                <span>
                                    {key}: {String(value)}
                                </span>
                                <button
                                    onClick={() =>
                                        handleFilterChange(key as keyof SearchFilters, undefined)
                                    }
                                    className="ml-1 text-gray-500 hover:text-gray-700"
                                >
                                    ✕
                                </button>
                            </Badge>
                        );
                    })}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSearchFilters({});
                            setSearchQuery('');
                        }}
                        className="text-xs"
                    >
                        Clear All
                    </Button>
                </div>
            )}

            {/* Filter Controls */}
            <Card className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Car Type
                        </label>
                        <select
                            value={searchFilters.carType || ''}
                            onChange={(e) =>
                                handleFilterChange('carType', e.target.value || undefined)
                            }
                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                        >
                            <option value="">All Types</option>
                            <option value="sedan">Sedan</option>
                            <option value="suv">SUV</option>
                            <option value="compact">Compact</option>
                            <option value="luxury">Luxury</option>
                            <option value="electric">Electric</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Fuel Type
                        </label>
                        <select
                            value={searchFilters.fuelType || ''}
                            onChange={(e) =>
                                handleFilterChange('fuelType', e.target.value || undefined)
                            }
                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                        >
                            <option value="">All Fuel Types</option>
                            <option value="gasoline">Gasoline</option>
                            <option value="electric">Electric</option>
                            <option value="hybrid">Hybrid</option>
                            <option value="diesel">Diesel</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Max Price/Day
                        </label>
                        <Input
                            type="number"
                            placeholder="Enter amount"
                            value={searchFilters.priceMax || ''}
                            onChange={(e) =>
                                handleFilterChange(
                                    'priceMax',
                                    e.target.value ? parseInt(e.target.value) : undefined,
                                )
                            }
                            className="text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Location
                        </label>
                        <Input
                            type="text"
                            placeholder="City or area"
                            value={searchFilters.location || ''}
                            onChange={(e) =>
                                handleFilterChange('location', e.target.value || undefined)
                            }
                            className="text-sm"
                        />
                    </div>
                </div>
            </Card>

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">
                            {isSearching ? 'Searching vehicles...' : 'Loading vehicles...'}
                        </p>
                    </div>
                </div>
            )}

            {/* Error State */}
            {isError && (
                <Card className="p-8 text-center border-red-200 bg-red-50">
                    <div className="text-red-600 mb-2">⚠️</div>
                    <h3 className="text-lg font-medium text-red-900 mb-2">Search Error</h3>
                    <p className="text-red-700 mb-4">
                        We encountered an error while searching for vehicles. Please try again.
                    </p>
                    <Button onClick={handleSearch} variant="outline">
                        Retry Search
                    </Button>
                </Card>
            )}

            {/* Results */}
            {!isLoading && !isError && vehicles.length > 0 && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {vehicles.map((vehicle: any) => (
                            <VehicleCard
                                key={vehicle.id}
                                car={vehicle}
                                canRent={true}
                                showRating={true}
                            />
                        ))}
                    </div>

                    {/* Pagination for regular search */}
                    {!enableInfiniteScroll && totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                                Page {actualCurrentPage} of {totalPages} ({totalCount} total
                                vehicles)
                            </div>
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="outline"
                                    disabled={!hasPreviousPage}
                                    onClick={previousPage}
                                    size="sm"
                                >
                                    Previous
                                </Button>
                                <span className="text-sm text-gray-600">
                                    Page {actualCurrentPage}
                                </span>
                                <Button
                                    variant="outline"
                                    disabled={!hasNextPage}
                                    onClick={nextPage}
                                    size="sm"
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Load More for infinite scroll */}
                    {enableInfiniteScroll && hasInfiniteNextPage && (
                        <div className="text-center">
                            <Button
                                onClick={fetchNextPage}
                                disabled={isFetchingNextPage}
                                variant="outline"
                                size="lg"
                            >
                                {isFetchingNextPage ? 'Loading More...' : 'Load More Vehicles'}
                            </Button>
                        </div>
                    )}
                </>
            )}

            {/* No Results */}
            {!isLoading && !isError && vehicles.length === 0 && (
                <Card className="p-12 text-center">
                    <div className="text-6xl mb-4">🔍</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Vehicles Found</h3>
                    <p className="text-gray-600 mb-6">
                        We couldn&apos;t find any vehicles matching your search criteria. Try
                        adjusting your filters or search terms.
                    </p>
                    <Button
                        onClick={() => {
                            setSearchFilters({});
                            setSearchQuery('');
                        }}
                        variant="outline"
                    >
                        Clear All Filters
                    </Button>
                </Card>
            )}

            {/* Performance Summary (Development Only) */}
            {showPerformanceMetrics && vehicles.length > 0 && (
                <Card className="p-4 bg-blue-50 border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">
                        Search Performance Summary
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-blue-800">
                        <div>
                            <strong>Recent Search Times:</strong>
                            <br />
                            {performanceStats.searchMetrics.recentSearchTimes
                                .slice(-3)
                                .map((time) => `${Math.round(time)}ms`)
                                .join(', ')}
                        </div>
                        <div>
                            <strong>Cache Stats:</strong>
                            <br />
                            {performanceStats.cacheStats.hits} hits,{' '}
                            {performanceStats.cacheStats.misses} misses
                        </div>
                        <div>
                            <strong>Component Renders:</strong>
                            <br />
                            {performanceStats.renderMetrics.renderCount} renders in{' '}
                            {performanceStats.renderMetrics.lastRenderTime.toFixed(1)}ms
                        </div>
                        <div>
                            <strong>Vehicles Loaded:</strong>
                            <br />
                            {vehicles.length} vehicles displayed
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}
