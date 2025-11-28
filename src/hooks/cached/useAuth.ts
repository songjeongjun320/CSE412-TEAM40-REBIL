/**
 * Cached Authentication State Hook
 *
 * Features:
 * - Persistent auth state caching
 * - Smart session management
 * - Role-based caching with intelligent invalidation
 * - Background session refresh
 * - Optimistic updates for auth state changes
 */

import { Session, User } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { getCurrentUserRoles, type UserRoles } from '@/lib/auth/userRoles';
import { cacheInvalidation, queryKeys } from '@/lib/cache/queryCache';
import { createClient } from '@/lib/supabase/supabaseClient';

interface AuthState {
    user: User | null;
    session: Session | null;
    roles: UserRoles | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

interface UseAuthOptions {
    enabled?: boolean;
    refetchInBackground?: boolean;
    staleTime?: number;
    /** Whether to automatically refresh the session */
    autoRefresh?: boolean;
}

interface UseAuthReturn extends AuthState {
    isError: boolean;
    error: Error | null;
    signOut: () => Promise<void>;
    refreshSession: () => Promise<void>;
    refreshRoles: () => Promise<void>;
    isRefreshing: boolean;
    isSigningOut: boolean;
}

/**
 * Hook for managing authentication state with caching
 */
export function useAuth(options: UseAuthOptions = {}): UseAuthReturn {
    const supabase = createClient();
    const queryClient = useQueryClient();

    // Auth state query with caching
    const {
        data: authState,
        isLoading,
        isError,
        error,
        refetch: refetchSession,
        isRefetching: isRefreshing,
    } = useQuery({
        queryKey: queryKeys.authUser(),
        enabled: options.enabled !== false,
        staleTime: options.staleTime || 15 * 60 * 1000, // 15 minutes
        refetchInterval: options.refetchInBackground ? 5 * 60 * 1000 : undefined, // 5 minutes
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        queryFn: async (): Promise<AuthState> => {
            try {
                // Get current session
                const {
                    data: { session },
                    error: sessionError,
                } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error('Session error:', sessionError);
                    // Don't throw for session errors, just return unauthenticated state
                    return {
                        user: null,
                        session: null,
                        roles: null,
                        isAuthenticated: false,
                        isLoading: false,
                    };
                }

                const user = session?.user || null;
                let roles: UserRoles | null = null;

                // Get user roles if authenticated
                if (user) {
                    try {
                        roles = await getCurrentUserRoles();
                    } catch (roleError) {
                        console.error('Error fetching user roles:', roleError);
                        // Set default roles if fetch fails
                        roles = {
                            isAdmin: false,
                            isHost: false,
                            isRenter: false,
                            roles: [],
                        };
                    }
                }

                return {
                    user,
                    session,
                    roles,
                    isAuthenticated: !!user,
                    isLoading: false,
                };
            } catch (error) {
                console.error('Auth query error:', error);
                throw error;
            }
        },
        retry: (failureCount, error: any) => {
            // Don't retry auth errors that are likely permanent
            if (error?.status === 401 || error?.status === 403) {
                return false;
            }
            return failureCount < 2;
        },
    });

    // Create a wrapper for refreshSession that returns Promise<void>
    const refreshSession = useCallback(async (): Promise<void> => {
        await refetchSession();
    }, [refetchSession]);

    // Sign out mutation
    const { mutateAsync: signOut, isPending: isSigningOut } = useMutation({
        mutationFn: async (): Promise<void> => {
            const { error } = await supabase.auth.signOut();
            if (error) {
                throw new Error(`Sign out error: ${error.message}`);
            }
        },
        onMutate: async () => {
            // Optimistically update auth state
        },
        onSuccess: () => {
            // Clear all auth-related caches
            cacheInvalidation.invalidateAuth(queryClient);
            cacheInvalidation.invalidateUserProfile(queryClient);

            // Redirect could be handled here or in the calling component
        },
        onError: (error) => {
            console.error('Sign out error:', error);
            // Refetch to get the actual current state
            refreshSession();
        },
    });

    // Refresh user roles mutation
    const { mutateAsync: refreshRolesMutation } = useMutation({
        mutationFn: async (): Promise<UserRoles> => {
            const roles = await getCurrentUserRoles();
            if (!roles) {
                throw new Error('Failed to get user roles');
            }
            return roles;
        },
        onSuccess: (newRoles) => {
            // Update the auth state with new roles
            const currentAuthState = queryClient.getQueryData<AuthState>(queryKeys.authUser());
            if (currentAuthState) {
                queryClient.setQueryData<AuthState>(queryKeys.authUser(), {
                    ...currentAuthState,
                    roles: newRoles,
                });
            }

            // Invalidate role-specific caches
            if (currentAuthState?.user) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.userRoles(currentAuthState.user.id),
                });
            }
        },
    });

    // Create a wrapper for refreshRoles that returns Promise<void>
    const refreshRoles = useCallback(async (): Promise<void> => {
        await refreshRolesMutation();
    }, [refreshRolesMutation]);

    // Set up auth state change listener
    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                // Refetch auth state when user signs in or token is refreshed
                refreshSession();
            } else if (event === 'SIGNED_OUT') {
                // Clear auth state when user signs out
                cacheInvalidation.invalidateAuth(queryClient);
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase.auth, refreshSession, queryClient]);

    // Set up automatic session refresh if enabled
    useEffect(() => {
        if (!options.autoRefresh || !authState?.session) return;

        const refreshInterval = setInterval(() => {
            // Refresh session 5 minutes before it expires
            const expiresAt = authState.session?.expires_at;
            if (expiresAt) {
                const expiresAtMs = expiresAt * 1000;
                const refreshAt = expiresAtMs - 5 * 60 * 1000; // 5 minutes before expiry
                const now = Date.now();

                if (now >= refreshAt) {
                    refreshSession();
                }
            }
        }, 60 * 1000); // Check every minute

        return () => clearInterval(refreshInterval);
    }, [options.autoRefresh, authState?.session, refreshSession]);

    // Default auth state while loading
    const defaultAuthState: AuthState = {
        user: null,
        session: null,
        roles: null,
        isAuthenticated: false,
        isLoading: true,
    };

    const currentState = authState || defaultAuthState;

    return {
        ...currentState,
        isLoading: isLoading || currentState.isLoading,
        isError,
        error: error as Error | null,
        signOut,
        refreshSession,
        refreshRoles,
        isRefreshing,
        isSigningOut,
    };
}

/**
 * Hook for checking specific user roles with caching
 */
export function useUserRoles(userId?: string, options: UseAuthOptions = {}) {
    const {
        data: roles,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: queryKeys.userRoles(userId!),
        enabled: options.enabled !== false && !!userId,
        staleTime: options.staleTime || 10 * 60 * 1000, // 10 minutes
        refetchInterval: options.refetchInBackground ? 15 * 60 * 1000 : undefined, // 15 minutes
        queryFn: async (): Promise<UserRoles> => {
            if (!userId) {
                throw new Error('User ID is required');
            }

            const supabase = createClient();

            // Get user profile to check roles
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', userId)
                .single();

            if (profileError) {
                throw new Error(`Error fetching user roles: ${profileError.message}`);
            }

            const role = profile?.role || null;

            return {
                isAdmin: role === 'admin',
                isHost: role === 'host' || role === 'admin',
                isRenter: role === 'renter' || role === 'admin',
                roles: role ? [role] : [],
            };
        },
    });

    return {
        roles,
        isLoading,
        isError,
        error: error as Error | null,
        refetch,
    };
}

/**
 * Hook for checking if user has specific permissions
 */
export function usePermissions() {
    const { roles, isAuthenticated } = useAuth();

    const hasPermission = useCallback(
        (permission: string): boolean => {
            if (!isAuthenticated || !roles) return false;

            switch (permission) {
                case 'admin':
                    return roles.isAdmin;
                case 'host':
                    return roles.isHost;
                case 'renter':
                    return roles.isRenter;
                case 'manage-vehicles':
                    return roles.isHost || roles.isAdmin;
                case 'manage-bookings':
                    return roles.isHost || roles.isAdmin;
                case 'admin-dashboard':
                    return roles.isAdmin;
                default:
                    return false;
            }
        },
        [isAuthenticated, roles],
    );

    const hasAnyPermission = useCallback(
        (permissions: string[]): boolean => {
            return permissions.some((permission) => hasPermission(permission));
        },
        [hasPermission],
    );

    const hasAllPermissions = useCallback(
        (permissions: string[]): boolean => {
            return permissions.every((permission) => hasPermission(permission));
        },
        [hasPermission],
    );

    return {
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        roles,
        isAuthenticated,
    };
}

/**
 * Hook for session management utilities
 */
export function useSession() {
    const { session, isAuthenticated, refreshSession } = useAuth();

    const isSessionExpired = useCallback((): boolean => {
        if (!session?.expires_at) return true;
        return Date.now() >= session.expires_at * 1000;
    }, [session]);

    const getSessionTimeRemaining = useCallback((): number => {
        if (!session?.expires_at) return 0;
        const remaining = session.expires_at * 1000 - Date.now();
        return Math.max(0, remaining);
    }, [session]);

    const isSessionExpiringSoon = useCallback(
        (minutesThreshold: number = 5): boolean => {
            const remaining = getSessionTimeRemaining();
            return remaining <= minutesThreshold * 60 * 1000;
        },
        [getSessionTimeRemaining],
    );

    return {
        session,
        isAuthenticated,
        isSessionExpired,
        isSessionExpiringSoon,
        getSessionTimeRemaining,
        refreshSession,
    };
}

/**
 * Auth cache statistics and utilities
 */
export function useAuthCache() {
    const queryClient = useQueryClient();

    const clearAuthCache = useCallback(() => {
        cacheInvalidation.invalidateAuth(queryClient);
    }, [queryClient]);

    const preloadUserRoles = useCallback(
        async (userId: string) => {
            const queryKey = queryKeys.userRoles(userId);
            const cached = queryClient.getQueryData(queryKey);

            if (!cached) {
                try {
                    await queryClient.prefetchQuery({
                        queryKey,
                        queryFn: async () => {
                            const supabase = createClient();

                            const { data: profile, error } = await supabase
                                .from('user_profiles')
                                .select('role')
                                .eq('id', userId)
                                .single();

                            if (error) throw error;

                            const role = profile?.role || null;

                            return {
                                isAdmin: role === 'admin',
                                isHost: role === 'host' || role === 'admin',
                                isRenter: role === 'renter' || role === 'admin',
                                roles: role ? [role] : [],
                            };
                        },
                        staleTime: 10 * 60 * 1000, // 10 minutes
                    });
                } catch (error) {
                    console.error('Error preloading user roles:', error);
                }
            }
        },
        [queryClient],
    );

    return {
        clearAuthCache,
        preloadUserRoles,
    };
}
