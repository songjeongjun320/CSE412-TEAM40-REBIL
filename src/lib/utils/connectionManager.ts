import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

/**
 * Connection state for tracking channel lifecycle
 */
export interface ConnectionState {
    channel: RealtimeChannel | null;
    status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error' | 'cleanup';
    subscribers: number;
    lastConnected: number | null;
    retryCount: number;
    cleanup?: () => void;
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
    maxConnections: number;
    connectionTimeout: number;
    cleanupInterval: number;
    maxRetries: number;
    enableHealthCheck: boolean;
    debugMode: boolean;
}

/**
 * Centralized WebSocket connection manager for Supabase realtime
 * Prevents duplicate connections and manages connection pooling
 */
export class ConnectionManager {
    private connections = new Map<string, ConnectionState>();
    private cleanupTimer: NodeJS.Timeout | null = null;
    private healthCheckTimer: NodeJS.Timeout | null = null;
    private config: ConnectionPoolConfig;

    constructor(
        private supabase: SupabaseClient,
        config: Partial<ConnectionPoolConfig> = {},
    ) {
        this.config = {
            maxConnections: 10,
            connectionTimeout: 30000,
            cleanupInterval: 60000,
            maxRetries: 3,
            enableHealthCheck: true,
            debugMode: false,
            ...config,
        };

        this.startCleanupTimer();
        if (this.config.enableHealthCheck) {
            this.startHealthCheck();
        }
    }

    /**
     * Get or create a connection for the given channel name
     */
    getConnection(channelName: string): RealtimeChannel | null {
        this.log(`Getting connection for channel: ${channelName}`);

        const existing = this.connections.get(channelName);

        if (
            existing &&
            existing.channel &&
            existing.status !== 'error' &&
            existing.status !== 'cleanup'
        ) {
            this.log(`Reusing existing connection for ${channelName}, status: ${existing.status}`);
            existing.subscribers++;
            return existing.channel;
        }

        // Check connection limits
        const activeConnections = Array.from(this.connections.values()).filter(
            (state) => state.status === 'connected' || state.status === 'connecting',
        ).length;

        if (activeConnections >= this.config.maxConnections) {
            this.log(
                `Connection limit reached (${activeConnections}/${this.config.maxConnections})`,
            );
            this.cleanupOldestConnection();
        }

        return this.createConnection(channelName);
    }

    /**
     * Create a new connection
     */
    private createConnection(channelName: string): RealtimeChannel | null {
        try {
            this.log(`Creating new connection for channel: ${channelName}`);

            // Clean up any existing connection
            this.cleanupConnection(channelName);

            const channel = this.supabase.channel(channelName);

            const connectionState: ConnectionState = {
                channel,
                status: 'idle',
                subscribers: 1,
                lastConnected: null,
                retryCount: 0,
            };

            this.connections.set(channelName, connectionState);

            // Set up connection monitoring
            this.setupConnectionMonitoring(channelName, connectionState);

            return channel;
        } catch (error) {
            this.log(`Error creating connection for ${channelName}:`, error);
            return null;
        }
    }

    /**
     * Set up connection monitoring for a channel
     */
    private setupConnectionMonitoring(channelName: string, connectionState: ConnectionState) {
        if (!connectionState.channel) return;

        // Add a wrapper to the original subscribe method
        const originalSubscribe = connectionState.channel.subscribe.bind(connectionState.channel);

        connectionState.channel.subscribe = (callback?: (status: any) => void) => {
            connectionState.status = 'connecting';

            return originalSubscribe((status: any) => {
                this.handleConnectionStatus(channelName, String(status));
                callback?.(status);
            });
        };
    }

    /**
     * Handle connection status changes
     */
    private handleConnectionStatus(channelName: string, status: string) {
        const connectionState = this.connections.get(channelName);
        if (!connectionState) return;

        this.log(`Channel ${channelName} status: ${status}`);

        switch (status) {
            case 'SUBSCRIBED':
                connectionState.status = 'connected';
                connectionState.lastConnected = Date.now();
                connectionState.retryCount = 0;
                break;
            case 'CHANNEL_ERROR':
            case 'TIMED_OUT':
                connectionState.status = 'error';
                this.handleConnectionError(channelName);
                break;
            case 'CLOSED':
                connectionState.status = 'disconnected';
                break;
        }
    }

    /**
     * Handle connection errors with retry logic
     */
    private handleConnectionError(channelName: string) {
        const connectionState = this.connections.get(channelName);
        if (!connectionState) return;

        if (connectionState.retryCount >= this.config.maxRetries) {
            this.log(`Max retries reached for ${channelName}, marking for cleanup`);
            connectionState.status = 'cleanup';
            return;
        }

        connectionState.retryCount++;
        this.log(
            `Connection error for ${channelName}, retry ${connectionState.retryCount}/${this.config.maxRetries}`,
        );
    }

    /**
     * Release a connection (decrement subscriber count)
     */
    releaseConnection(channelName: string): boolean {
        const connectionState = this.connections.get(channelName);
        if (!connectionState) return false;

        connectionState.subscribers = Math.max(0, connectionState.subscribers - 1);
        this.log(
            `Released connection for ${channelName}, subscribers: ${connectionState.subscribers}`,
        );

        if (connectionState.subscribers === 0) {
            this.log(`No more subscribers for ${channelName}, scheduling cleanup`);
            // Don't cleanup immediately, allow for reuse
            setTimeout(() => this.cleanupIfUnused(channelName), 5000);
        }

        return true;
    }

    /**
     * Cleanup connection if no longer used
     */
    private cleanupIfUnused(channelName: string) {
        const connectionState = this.connections.get(channelName);
        if (connectionState && connectionState.subscribers === 0) {
            this.cleanupConnection(channelName);
        }
    }

    /**
     * Force cleanup a specific connection
     */
    cleanupConnection(channelName: string): boolean {
        const connectionState = this.connections.get(channelName);
        if (!connectionState) return false;

        this.log(`Cleaning up connection: ${channelName}`);

        if (connectionState.channel) {
            try {
                connectionState.status = 'cleanup';
                connectionState.channel.unsubscribe();
            } catch (error) {
                this.log(`Error unsubscribing from ${channelName}:`, error);
            }
        }

        if (connectionState.cleanup) {
            connectionState.cleanup();
        }

        this.connections.delete(channelName);
        return true;
    }

    /**
     * Get connection statistics
     */
    getStats(): {
        totalConnections: number;
        activeConnections: number;
        errorConnections: number;
        connectionDetails: Array<{
            channelName: string;
            status: string;
            subscribers: number;
            lastConnected: number | null;
            retryCount: number;
        }>;
    } {
        const connectionDetails: Array<{
            channelName: string;
            status: string;
            subscribers: number;
            lastConnected: number | null;
            retryCount: number;
        }> = [];

        let activeConnections = 0;
        let errorConnections = 0;

        for (const [channelName, state] of this.connections.entries()) {
            connectionDetails.push({
                channelName,
                status: state.status,
                subscribers: state.subscribers,
                lastConnected: state.lastConnected,
                retryCount: state.retryCount,
            });

            if (state.status === 'connected' || state.status === 'connecting') {
                activeConnections++;
            }
            if (state.status === 'error') {
                errorConnections++;
            }
        }

        return {
            totalConnections: this.connections.size,
            activeConnections,
            errorConnections,
            connectionDetails,
        };
    }

    /**
     * Cleanup oldest connection when limit reached
     */
    private cleanupOldestConnection() {
        let oldestChannel = '';
        let oldestTime = Date.now();

        for (const [channelName, state] of this.connections.entries()) {
            if (
                state.subscribers === 0 &&
                (!state.lastConnected || state.lastConnected < oldestTime)
            ) {
                oldestChannel = channelName;
                oldestTime = state.lastConnected || 0;
            }
        }

        if (oldestChannel) {
            this.log(`Cleaning up oldest unused connection: ${oldestChannel}`);
            this.cleanupConnection(oldestChannel);
        }
    }

    /**
     * Start periodic cleanup timer
     */
    private startCleanupTimer() {
        if (this.cleanupTimer) return;

        this.cleanupTimer = setInterval(() => {
            const now = Date.now();
            const channelsToCleanup: string[] = [];

            for (const [channelName, state] of this.connections.entries()) {
                // Cleanup unused connections older than 5 minutes
                if (
                    state.subscribers === 0 &&
                    state.lastConnected &&
                    now - state.lastConnected > 300000
                ) {
                    channelsToCleanup.push(channelName);
                }

                // Cleanup error connections that have exceeded retry limit
                if (state.status === 'error' && state.retryCount >= this.config.maxRetries) {
                    channelsToCleanup.push(channelName);
                }

                // Cleanup connections in cleanup status
                if (state.status === 'cleanup') {
                    channelsToCleanup.push(channelName);
                }
            }

            channelsToCleanup.forEach((channelName) => this.cleanupConnection(channelName));
        }, this.config.cleanupInterval);
    }

    /**
     * Start health check timer
     */
    private startHealthCheck() {
        if (this.healthCheckTimer) return;

        this.healthCheckTimer = setInterval(() => {
            const stats = this.getStats();
            this.log('Connection health check:', stats);

            // Cleanup error connections
            for (const [channelName, state] of this.connections.entries()) {
                if (state.status === 'error' && state.retryCount >= this.config.maxRetries) {
                    this.cleanupConnection(channelName);
                }
            }
        }, 30000); // Every 30 seconds
    }

    /**
     * Cleanup all connections and stop timers
     */
    destroy() {
        this.log('Destroying connection manager');

        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }

        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }

        // Cleanup all connections
        const channelNames = Array.from(this.connections.keys());
        channelNames.forEach((channelName) => this.cleanupConnection(channelName));
    }

    /**
     * Debug logging
     */
    private log(message: string, ...args: unknown[]) {
        if (this.config.debugMode) {
            console.log(`[ConnectionManager] ${message}`, ...args);
        }
    }
}
