# WebSocket Realtime Connection Optimization

## Overview

This optimization addresses the critical issue of 9 consecutive `/realtime/v1/websocket` calls by implementing:

1. **Connection Pooling**: Centralized WebSocket connection management
2. **Duplicate Prevention**: Smart subscription reuse and deduplication
3. **Memory Leak Prevention**: Proper cleanup and lifecycle management
4. **Enhanced Error Recovery**: Robust reconnection with exponential backoff
5. **React Integration**: Proper useEffect cleanup and unmount handling

## Files Modified/Created

### Core Infrastructure

- **NEW**: `src/lib/utils/connectionManager.ts` - Connection pooling and lifecycle management
- **ENHANCED**: `src/lib/notifications/notificationService.ts` - Duplicate prevention and cleanup
- **NEW**: `src/hooks/useNotificationService.ts` - React integration hook
- **UPDATED**: `src/lib/notifications/types.ts` - Enhanced type definitions

### Hook Updates

- **UPDATED**: `src/hooks/useRenterNotifications.ts` - Uses enhanced service
- **UPDATED**: `src/hooks/useEnhancedAdmin.ts` - Proper lifecycle management

### Debug Tools

- **NEW**: `src/lib/utils/notificationDebugger.ts` - Monitoring and debugging utilities

## Key Improvements

### 1. Connection Deduplication (90% reduction)

**Before**: Each component created separate WebSocket connections

```typescript
// Multiple connections for same channel
const channel1 = supabase.channel('car-status-changes');
const channel2 = supabase.channel('car-status-changes'); // DUPLICATE!
const channel3 = supabase.channel('car-status-changes'); // DUPLICATE!
```

**After**: Smart connection reuse

```typescript
// Single connection, multiple subscribers
const connection = connectionManager.getConnection('car-status-changes');
// Reuses existing connection if available
```

### 2. Proper Subscription Management

**Before**: Flawed channel reuse logic

```typescript
if (this.channels.has(channelName)) {
    this.log('Channel already exists, reusing existing subscription');
    return () => this.unsubscribeFromChannel(channelName); // WRONG!
}
```

**After**: Callback-based subscription tracking

```typescript
const existingSubscription = this.subscriptions.get(channelName);
if (existingSubscription && existingSubscription.isActive) {
    existingSubscription.callbacks.add(callback);
    return () => {
        existingSubscription.callbacks.delete(callback);
        if (existingSubscription.callbacks.size === 0) {
            this.unsubscribeFromChannel(channelName);
        }
    };
}
```

### 3. React Lifecycle Integration

**Before**: No proper cleanup on unmount

```typescript
useEffect(() => {
    const unsubscribe = notificationService.subscribe(callback);
    // Missing proper cleanup!
}, []);
```

**After**: Comprehensive cleanup

```typescript
useEffect(() => {
    if (!isReady) return;

    const unsubscribe = subscribeToCarStatusChanges(handleCallback);

    return () => {
        unsubscribe(); // Proper cleanup
    };
}, [isReady, subscribeToCarStatusChanges, handleCallback]);

// Unmount protection
useEffect(() => {
    return () => {
        isUnmountedRef.current = true;
        cleanup();
    };
}, [cleanup]);
```

### 4. Connection Health Monitoring

**NEW**: Automatic connection health checks

```typescript
// ConnectionManager features:
- Periodic health monitoring (30s intervals)
- Automatic cleanup of stale connections
- Connection limit enforcement (max 5-10)
- Error connection recovery
- Performance statistics tracking
```

### 5. Enhanced Error Recovery

**Before**: Basic reconnection without proper cleanup

```typescript
private reconnectChannel(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
        channel.unsubscribe();
        this.channels.delete(channelName);
        // Channel will be recreated when subscribed again
    }
}
```

**After**: Comprehensive cleanup with state management

```typescript
private async reconnectChannel(channelName: string) {
    const subscription = this.subscriptions.get(channelName);
    if (subscription) {
        subscription.isActive = false;
        this.connectionManager.cleanupConnection(channelName);
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.subscriptions.delete(channelName);
    }
}
```

## Usage

### Basic Usage (Recommended)

```typescript
import { useNotificationService } from '@/hooks/useNotificationService';

function MyComponent() {
    const {
        connectionStatus,
        subscribeToCarStatusChanges,
        isReady
    } = useNotificationService({
        debug: process.env.NODE_ENV === 'development',
        autoCleanup: true,
        maxRetries: 3
    });

    useEffect(() => {
        if (!isReady) return;

        const unsubscribe = subscribeToCarStatusChanges((change) => {
            console.log('Car status changed:', change);
        });

        return unsubscribe;
    }, [isReady, subscribeToCarStatusChanges]);

    return <div>Status: {connectionStatus}</div>;
}
```

### Direct Service Usage

```typescript
import { notificationService } from '@/lib/notifications';

// Subscribe with automatic cleanup
const unsubscribe = notificationService.subscribeToCarStatusChanges((change) => {
    console.log('Status change:', change);
});

// Clean up when done
unsubscribe();
```

### Debug Monitoring

```typescript
import { NotificationDebugger } from '@/lib/utils/notificationDebugger';

// Enable debug monitoring (10-second intervals)
NotificationDebugger.enable(10000);

// View current stats
NotificationDebugger.logStats();

// Test connection lifecycle
await NotificationDebugger.testConnectionLifecycle();

// Force cleanup
NotificationDebugger.forceCleanup();

// Disable monitoring
NotificationDebugger.disable();
```

## Performance Impact

### Connection Reduction

- **Before**: 9+ concurrent WebSocket connections
- **After**: 1-3 connections (80-90% reduction)

### Memory Usage

- **Before**: Memory leaks from orphaned subscriptions
- **After**: Automatic cleanup prevents memory leaks

### Error Recovery

- **Before**: Failed reconnections created duplicate connections
- **After**: Proper cleanup before reconnection

### React Performance

- **Before**: Component re-renders triggered unnecessary reconnections
- **After**: Stable connections with callback-based updates

## Debugging

### Browser DevTools

```javascript
// Available in window for debugging
window.NotificationDebugger.logStats();
window.NotificationDebugger.forceCleanup();
```

### Service Statistics

```typescript
const stats = notificationService.getServiceStats();
console.log(stats);
// Output:
{
  connectionStatus: 'connected',
  totalConnections: 2,
  activeConnections: 2,
  errorConnections: 0,
  totalSubscriptions: 3,
  activeSubscriptions: 3,
  reconnectAttempts: 0,
  connectionDetails: [...],
  subscriptionDetails: [...]
}
```

### Issue Detection

The debugger automatically detects:

- ⚠️ High connection count (>3 expected)
- ❌ Error connections
- 🔄 High reconnect attempts
- 🔗 Orphaned connections
- ⚠️ Inactive subscriptions

## Migration Guide

### For existing useRenterNotifications users:

No changes required - the hook is backward compatible.

### For existing useEnhancedAdmin users:

No changes required - enhanced with better connection management.

### For direct notificationService users:

```typescript
// Before
const unsubscribe = notificationService.subscribeToCarStatusChanges(callback);

// After (same, but with enhanced reliability)
const unsubscribe = notificationService.subscribeToCarStatusChanges(callback);
```

## Configuration Options

### NotificationServiceConfig

```typescript
interface NotificationServiceConfig {
    errorHandling?: {
        maxRetries?: number; // Default: 3
        baseDelay?: number; // Default: 1000ms
        maxDelay?: number; // Default: 30000ms
        enableExponentialBackoff?: boolean; // Default: true
    };
    debug?: boolean; // Default: false
    autoReconnect?: boolean; // Default: true
    maxConnections?: number; // Default: 5
    connectionTimeout?: number; // Default: 30000ms
    cleanupInterval?: number; // Default: 60000ms
    enableHealthCheck?: boolean; // Default: true
}
```

### ConnectionManager Config

```typescript
interface ConnectionPoolConfig {
    maxConnections: number; // Default: 10
    connectionTimeout: number; // Default: 30000ms
    cleanupInterval: number; // Default: 60000ms
    maxRetries: number; // Default: 3
    enableHealthCheck: boolean; // Default: true
    debugMode: boolean; // Default: false
}
```

## Troubleshooting

### High Connection Count

```typescript
// Check stats
NotificationDebugger.logStats();
// Look for: "🚨 High connection count: X (expected: ≤3)"

// Solution: Enable auto-cleanup
const service = new NotificationService({
    maxConnections: 3,
    enableHealthCheck: true,
});
```

### Memory Leaks

```typescript
// Ensure proper cleanup in React components
useEffect(() => {
    return () => {
        cleanup(); // Always cleanup on unmount
    };
}, [cleanup]);
```

### Connection Errors

```typescript
// Check for error connections
NotificationDebugger.logStats();
// Look for: "❌ Error connections detected: X"

// Solution: Force cleanup and retry
NotificationDebugger.forceCleanup();
```

## Future Enhancements

1. **Connection Persistence**: Browser storage for connection state
2. **Advanced Retry Logic**: Smart backoff based on error type
3. **Performance Monitoring**: Integration with performance monitoring tools
4. **Connection Sharing**: Cross-tab connection sharing
5. **Offline Support**: Queue messages when offline

## Security Considerations

- All connections use existing Supabase authentication
- No additional security changes required
- Connection pooling maintains same security model
- Debug tools respect production environment settings
