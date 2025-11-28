# Rebil Performance Monitoring System - Implementation Guide

## Overview

The Rebil Performance Monitoring System is a comprehensive, lightweight monitoring solution designed to track, analyze, and optimize the performance of the car rental platform. This system provides real-time insights into API response times, cache effectiveness, component render performance, memory usage, and user experience metrics.

## 🚀 Key Features

### 1. **Real-time Performance Metrics**

- API response time monitoring (target: <200ms)
- Database query performance tracking
- WebSocket latency measurement
- Memory usage and leak detection
- Component render performance analysis

### 2. **Intelligent Caching Monitoring**

- Cache hit/miss rate tracking
- Memory usage optimization
- Cache effectiveness analysis
- Automatic cache warming strategies

### 3. **Performance Alerts & Notifications**

- Configurable alert thresholds
- Real-time toast notifications
- Performance budget tracking
- Optimization recommendations

### 4. **Comprehensive Dashboard**

- Performance metrics visualization
- Historical performance data
- Optimization opportunities identification
- Alert management interface

## 📊 Architecture

```
Performance Monitoring System
├── Core Monitor (performanceMonitor.ts)
│   ├── API Call Tracking
│   ├── Cache Performance Monitoring
│   ├── Component Render Tracking
│   ├── Memory Usage Analysis
│   └── Alert Generation
├── UI Components
│   ├── PerformanceDashboard
│   ├── PerformanceWidget
│   ├── PerformanceAlerts
│   └── PerformanceProvider
├── Hooks & Integration
│   ├── usePerformanceMonitoring
│   ├── useOptimizedPerformance
│   └── Cache Integration
└── Optimized Components
    ├── VehicleCardOptimized
    ├── EnhancedSearchWithMonitoring
    └── Performance-aware Hooks
```

## 🛠️ Installation & Setup

### 1. **Enable Performance Monitoring**

Add to your main layout file (`src/app/layout.tsx`):

```tsx
import {
    CriticalAlertBanner,
    DEFAULT_MONITORING_CONFIG,
    PERFORMANCE_BUDGETS,
    PerformanceProvider,
} from '@/components/monitoring';

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <PerformanceProvider
                    enableInDevelopment={true}
                    enableInProduction={
                        process.env.ENABLE_PERFORMANCE_MONITORING === 'true'
                    }
                    config={{
                        ...DEFAULT_MONITORING_CONFIG,
                        enableAPITracking: true,
                        enableRenderTracking: true,
                        enableWebSocketTracking: true,
                        enableMemoryTracking: true,
                        alertThresholds: PERFORMANCE_BUDGETS.production,
                    }}
                >
                    <CriticalAlertBanner />
                    {children}
                </PerformanceProvider>
            </body>
        </html>
    );
}
```

### 2. **Add Performance Widget**

Add to your protected layout or main pages:

```tsx
import { PerformanceWidget } from '@/components/monitoring';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    return (
        <div>
            {children}
            <PerformanceWidget
                position="bottom-right"
                showDetails={true}
                onOpenDashboard={() => {
                    // Navigate to performance dashboard
                    window.open('/admin/performance', '_blank');
                }}
            />
        </div>
    );
}
```

### 3. **Environment Configuration**

Add to your `.env.local`:

```env
# Performance Monitoring
ENABLE_PERFORMANCE_MONITORING=true
PERFORMANCE_MONITORING_ENDPOINT=https://your-monitoring-endpoint.com
PERFORMANCE_ALERT_WEBHOOK=https://your-slack-webhook-url.com

# Performance Thresholds
MAX_API_RESPONSE_TIME=200
MIN_CACHE_HIT_RATE=85
MAX_MEMORY_USAGE=104857600  # 100MB in bytes
MAX_RENDER_TIME=50
```

## 🔧 Component Integration

### 1. **Optimized Components**

Replace existing components with performance-monitored versions:

```tsx
// Before
import VehicleCard from '@/components/renter/VehicleCard';
// After
import VehicleCardOptimized from '@/components/renter/VehicleCardOptimized';

<VehicleCardOptimized
    car={vehicle}
    canRent={true}
    enablePerformanceTracking={true}
    performanceThresholds={{
        slowRenderThreshold: 50,
        imageLoadThreshold: 2000,
    }}
/>;
```

### 2. **Enhanced Search Integration**

```tsx
import { EnhancedSearchWithMonitoring } from '@/components/search/EnhancedSearchWithMonitoring';

<EnhancedSearchWithMonitoring
    initialFilters={{}}
    enableInfiniteScroll={false}
    showPerformanceMetrics={process.env.NODE_ENV === 'development'}
    performanceThresholds={{
        slowSearchThreshold: 2000,
        maxRenderTime: 100,
    }}
/>;
```

### 3. **Custom Hook Integration**

Use optimized hooks for API calls:

```tsx
import {
  useOptimizedQuery,
  useOptimizedMutation,
  useSupabasePerformanceTracking
} from '@/hooks/useOptimizedPerformance';

function MyComponent() {
  const { trackSelect } = useSupabasePerformanceTracking();

  const { data, isLoading } = useOptimizedQuery(
    ['vehicles', filters],
    () => trackSelect('cars', supabase.from('cars').select('*'), { filters }),
    {},
    {
      trackingName: 'fetch-vehicles',
      enableMetrics: true,
      slowQueryThreshold: 1000,
    }
  );

  return (
    // Your component JSX
  );
}
```

## 📈 Performance Dashboard

### Accessing the Dashboard

Create a performance dashboard route (`src/app/(protected)/admin/performance/page.tsx`):

```tsx
import { PERFORMANCE_BUDGETS, PerformanceDashboard } from '@/components/monitoring';

export default function PerformancePage() {
    return (
        <div className="container mx-auto py-8">
            <PerformanceDashboard
                detailed={true}
                realTime={true}
                budgets={PERFORMANCE_BUDGETS.production}
            />
        </div>
    );
}
```

### Dashboard Features

1. **Performance Budget Status** - Real-time status of performance targets
2. **Key Metrics Cards** - API performance, cache effectiveness, memory usage, render performance
3. **Performance Alerts** - Active alerts with dismissal and filtering
4. **Detailed Metrics Tabs**:
    - Overview: Performance summary and trends
    - API Details: Endpoint-specific metrics and slow queries
    - Cache Details: Internal cache and React Query statistics
    - Optimizations: Actionable improvement recommendations

## 🔔 Alert Configuration

### Alert Thresholds

```typescript
const CUSTOM_ALERT_THRESHOLDS = {
    slowQueryThreshold: 500, // 500ms for API calls
    lowCacheHitRate: 75, // 75% minimum cache hit rate
    highErrorRate: 2, // 2% maximum error rate
    memoryUsageThreshold: 150, // 150MB memory limit
    renderTimeThreshold: 100, // 100ms render time limit
};
```

### Alert Integration

```tsx
import { PerformanceAlertBadge, PerformanceAlerts } from '@/components/monitoring';

function AdminHeader() {
    return (
        <header className="flex items-center justify-between">
            <h1>Admin Dashboard</h1>
            <PerformanceAlertBadge onClick={() => setShowAlerts(true)} />
        </header>
    );
}

function AdminSidebar() {
    return (
        <aside>
            <PerformanceAlerts
                mode="inline"
                enableToasts={true}
                maxAlerts={5}
                autoDismissTime={300000}
            />
        </aside>
    );
}
```

## 🚦 Performance Budgets

### Budget Definitions

```typescript
// Development budgets (more lenient)
const DEVELOPMENT_BUDGETS = {
    maxAPIResponseTime: 500,
    maxRenderTime: 100,
    maxMemoryUsage: 200 * 1024 * 1024, // 200MB
    minCacheHitRate: 70,
};

// Production budgets (strict)
const PRODUCTION_BUDGETS = {
    maxAPIResponseTime: 200,
    maxRenderTime: 50,
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    minCacheHitRate: 85,
};
```

### Budget Monitoring

```tsx
import { usePerformanceBudget } from '@/hooks/usePerformanceMonitoring';

function MyComponent() {
    const budgetStatus = usePerformanceBudget(PRODUCTION_BUDGETS);

    return (
        <div>
            {budgetStatus.apiResponseTime === 'fail' && (
                <Alert variant="destructive">
                    API response times exceed budget limits
                </Alert>
            )}
        </div>
    );
}
```

## 🔍 Optimization Strategies

### 1. **API Performance Optimization**

- **Implement caching** for frequently accessed endpoints
- **Use pagination** to reduce payload sizes
- **Optimize database queries** with proper indexing
- **Implement request deduplication** to avoid redundant calls

### 2. **Component Render Optimization**

- **Use React.memo** for expensive components
- **Implement virtualization** for large lists
- **Optimize image loading** with lazy loading and appropriate sizes
- **Minimize re-renders** with proper dependency arrays

### 3. **Cache Effectiveness Improvement**

- **Configure appropriate TTL values** based on data freshness requirements
- **Implement cache warming** for critical user paths
- **Use hierarchical cache keys** for efficient invalidation
- **Monitor cache hit rates** and adjust strategies accordingly

### 4. **Memory Management**

- **Clean up event listeners** and subscriptions
- **Implement proper component unmounting** cleanup
- **Use WeakMap/WeakSet** for temporary references
- **Monitor for memory leaks** in development

## 📊 Metrics & KPIs

### Key Performance Indicators

1. **API Response Time**: Target <200ms, Critical >1000ms
2. **Cache Hit Rate**: Target >85%, Critical <60%
3. **Memory Usage**: Target <100MB, Critical >200MB
4. **Render Performance**: Target <50ms, Critical >100ms
5. **Error Rate**: Target <1%, Critical >5%

### Success Metrics

- **25% reduction** in API calls through effective caching
- **40% improvement** in page load times
- **90% cache hit rate** for frequently accessed data
- **<50ms average render time** for VehicleCard components
- **Zero memory leaks** in production environment

## 🚀 Advanced Features

### 1. **Custom Performance Tracking**

```tsx
import { usePerformanceContext } from '@/components/monitoring/PerformanceProvider';

function CustomComponent() {
  const { trackAPICall, trackComponentRender } = usePerformanceContext();

  const handleCustomOperation = async () => {
    const finishTracking = trackAPICall('custom-operation', { param1: 'value' });

    try {
      // Your custom operation
      await someExpensiveOperation();
      finishTracking(); // Success
    } catch (error) {
      finishTracking(true); // Error
      throw error;
    }
  };

  return (
    // Your component JSX
  );
}
```

### 2. **WebSocket Performance Monitoring**

```tsx
import { useWebSocketPerformanceTracking } from '@/hooks/useOptimizedPerformance';

function RealtimeComponent() {
  const { trackConnection, trackMessage, getWebSocketMetrics } =
    useWebSocketPerformanceTracking('wss://your-websocket-url');

  useEffect(() => {
    const ws = new WebSocket('wss://your-websocket-url');
    const connectionStart = performance.now();

    ws.onopen = () => {
      trackConnection(connectionStart);
    };

    ws.onmessage = (event) => {
      trackMessage('receive', event.data);
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    // Your real-time component
  );
}
```

### 3. **Performance-aware HOC**

```tsx
import { withPerformanceTracking } from '@/components/monitoring/PerformanceProvider';

const MyExpensiveComponent = ({ data }) => {
    // Expensive rendering logic
    return <div>{data.map(/* complex rendering */)}</div>;
};

// Wrap with automatic performance tracking
export default withPerformanceTracking(MyExpensiveComponent, 'MyExpensiveComponent');
```

## 🔧 Troubleshooting

### Common Issues

1. **High Memory Usage**
    - Check for memory leaks in components
    - Verify proper cleanup of event listeners
    - Monitor cache size and implement proper eviction

2. **Slow API Responses**
    - Analyze slow query alerts
    - Check database query optimization
    - Verify network conditions and server performance

3. **Low Cache Hit Rates**
    - Review cache configuration and TTL values
    - Check cache warming strategies
    - Analyze cache key patterns for conflicts

4. **Performance Monitoring Overhead**
    - Disable in production if not needed
    - Adjust sampling rates for high-volume operations
    - Use performance budgets to focus on critical paths

### Performance Debugging

```tsx
// Enable detailed logging in development
if (process.env.NODE_ENV === 'development') {
    console.log('Performance metrics:', getPerformanceMetrics());
    console.log('Optimization report:', getOptimizationReport());
}

// Check component render performance
const { getRenderMetrics } = useVehicleCardPerformance(vehicleId);
console.log('VehicleCard metrics:', getRenderMetrics());

// Monitor cache effectiveness
const { getCacheStats } = useCacheEffectivenessTracking('operation-name');
console.log('Cache stats:', getCacheStats());
```

## 📚 Best Practices

### 1. **Development Guidelines**

- Always enable performance monitoring in development
- Set up performance budgets early in development
- Monitor performance during code reviews
- Use performance metrics to guide optimization decisions

### 2. **Production Deployment**

- Enable monitoring only when necessary (controlled via environment variables)
- Set appropriate alert thresholds for production workloads
- Monitor performance metrics regularly
- Set up automated alerts for critical performance degradation

### 3. **Monitoring Strategy**

- Focus on user-facing performance metrics
- Prioritize optimization based on impact and effort
- Regularly review and update performance budgets
- Document performance optimization decisions

## 🎯 Performance Targets

### Rebil Platform Targets

| Metric             | Target | Warning | Critical |
| ------------------ | ------ | ------- | -------- |
| API Response Time  | <200ms | >500ms  | >1000ms  |
| Cache Hit Rate     | >85%   | <75%    | <60%     |
| Memory Usage       | <100MB | >150MB  | >200MB   |
| VehicleCard Render | <50ms  | >75ms   | >100ms   |
| Search Response    | <2s    | >3s     | >5s      |
| Image Load Time    | <2s    | >3s     | >5s      |
| Error Rate         | <1%    | >2%     | >5%      |

## 📈 Measuring Success

### Key Success Indicators

1. **API Call Reduction**: Target 25% reduction through caching
2. **Page Load Performance**: Target 40% improvement in load times
3. **User Experience**: Target <3s for critical user interactions
4. **Resource Efficiency**: Target <100MB memory usage in production
5. **Reliability**: Target >99.9% uptime with <1% error rate

### Monitoring Dashboard

Track these metrics in your performance dashboard:

- Real-time performance indicators
- Historical performance trends
- Optimization opportunity identification
- Alert frequency and resolution times
- Cache effectiveness over time

This comprehensive monitoring system ensures the Rebil platform maintains excellent performance while providing actionable insights for continuous optimization.
