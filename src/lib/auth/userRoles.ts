'use client';

import { createClient } from '@/lib/supabase/supabaseClient';
import { Database } from '@/types/base/database.types';

type UserRole = Database['public']['Enums']['user_role_type'];

// Simple session-level cache for user roles
let userRolesCache: { [userId: string]: { roles: UserRoles; timestamp: number } } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// User-specific concurrent request handling to prevent cross-user conflicts
let userRoleRequests: { [userId: string]: Promise<UserRoles | null> } = {};

export interface UserRoles {
    isAdmin: boolean;
    isHost: boolean;
    isRenter: boolean;
    roles: UserRole[];
}

/**
 * Get current user's roles with caching and user-specific concurrent request handling
 */
export async function getCurrentUserRoles(): Promise<UserRoles | null> {
    try {
        const supabase = createClient();

        // Get current user information first
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error('Failed to get current user:', userError);
            return null;
        }

        const userId = user.id;

        // Check if there's already a request in progress for this specific user
        if (userId in userRoleRequests) {
            return userRoleRequests[userId];
        }

        // Check cache first
        const cached = userRolesCache[userId];
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.roles;
        }

        // Create a new request promise for this specific user
        userRoleRequests[userId] = (async (): Promise<UserRoles | null> => {
            try {
                const roles = await getUserRoles(userId);

                // Cache the result
                if (roles) {
                    userRolesCache[userId] = {
                        roles,
                        timestamp: Date.now(),
                    };
                }

                return roles;
            } catch (error) {
                console.error('Error getting user roles:', error);
                return null;
            } finally {
                // Clear the current request for this user after completion
                delete userRoleRequests[userId];
            }
        })();

        return userRoleRequests[userId];
    } catch (error) {
        console.error('Error getting current user roles:', error);
        return null;
    }
}

/**
 * Get roles for a specific user
 */
export async function getUserRoles(userId: string): Promise<UserRoles | null> {
    try {
        const supabase = createClient();

        // Query user roles
        const { data: userRoles, error: rolesError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .eq('is_active', true);

        if (rolesError) {
            console.error('Failed to get user roles:', rolesError);
            return null;
        }

        const roles = userRoles?.map((r) => r.role) || [];

        // Only log in development
        if (process.env.NODE_ENV === 'development') {
            console.log('User ID:', userId);
            console.log('Raw roles from DB:', userRoles);
            console.log('Processed roles:', roles);
        }

        const result = {
            isAdmin: roles.includes('ADMIN'),
            isHost: roles.includes('HOST'),
            isRenter: roles.includes('RENTER'),
            roles: roles as UserRole[],
        };

        if (process.env.NODE_ENV === 'development') {
            console.log('UserRoles result:', result);
        }

        return result;
    } catch (error) {
        console.error('Error getting user roles:', error);
        return null;
    }
}

/**
 * Check if user has a specific role
 */
export async function hasRole(userId: string, role: UserRole): Promise<boolean> {
    const userRoles = await getUserRoles(userId);
    return userRoles?.roles.includes(role) || false;
}

/**
 * Check if user is an admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
    return await hasRole(userId, 'ADMIN');
}

/**
 * Check if user is a host
 */
export async function isHost(userId: string): Promise<boolean> {
    return await hasRole(userId, 'HOST');
}

/**
 * Check if user is a renter
 */
export async function isRenter(userId: string): Promise<boolean> {
    return await hasRole(userId, 'RENTER');
}

/**
 * Return user's primary role (priority: ADMIN > HOST > RENTER)
 */
export function getPrimaryRole(userRoles: UserRoles): UserRole {
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
        console.log('getPrimaryRole input:', userRoles);
        console.log('isAdmin:', userRoles.isAdmin);
        console.log('isHost:', userRoles.isHost);
        console.log('isRenter:', userRoles.isRenter);
    }

    // Priority: ADMIN > HOST > RENTER
    if (userRoles.isAdmin) {
        if (process.env.NODE_ENV === 'development') {
            console.log('Returning ADMIN');
        }
        return 'ADMIN';
    }
    if (userRoles.isHost) {
        if (process.env.NODE_ENV === 'development') {
            console.log('Returning HOST');
        }
        return 'HOST';
    }
    if (process.env.NODE_ENV === 'development') {
        console.log('Returning RENTER (default)');
    }
    return 'RENTER'; // Default is RENTER
}

/**
 * Function to check if user can rent (only RENTER role can rent)
 */
export function canUserRent(userRoles: UserRoles): boolean {
    // Only users with RENTER role can rent (exclusive role system)
    return userRoles.isRenter && !userRoles.isHost;
}

/**
 * Clear the user roles cache for a specific user or all users
 */
export function clearUserRolesCache(userId?: string): void {
    if (userId) {
        delete userRolesCache[userId];
        // Also clear any pending request for this specific user
        delete userRoleRequests[userId];
    } else {
        userRolesCache = {};
        userRoleRequests = {};
    }
}

/**
 * Function to assign role to user (for server side)
 */
export async function assignUserRole(userId: string, role: UserRole): Promise<boolean> {
    try {
        const supabase = createClient();

        // Check if user already has this role
        const { data: existingRole } = await supabase
            .from('user_roles')
            .select('*')
            .eq('user_id', userId)
            .eq('role', role)
            .eq('is_active', true)
            .single();

        if (existingRole) {
            // If role already exists, treat as success
            return true;
        }

        // Add new role
        const { error } = await supabase.from('user_roles').insert({
            user_id: userId,
            role: role,
            is_active: true,
        });

        if (error) {
            console.error(`Error assigning ${role} role to user ${userId}:`, error);
            return false;
        }

        // Clear cache for this user since roles changed
        clearUserRolesCache(userId);
        return true;
    } catch (error) {
        console.error(`Error assigning role ${role}:`, error);
        return false;
    }
}

/**
 * Switch user role (exclusive - deactivate current roles and set new one)
 */
export async function switchUserRole(userId: string, newRole: UserRole): Promise<boolean> {
    try {
        const supabase = createClient();

        // First, deactivate all current roles
        const { error: deactivateError } = await supabase
            .from('user_roles')
            .update({ is_active: false })
            .eq('user_id', userId)
            .eq('is_active', true);

        if (deactivateError) {
            console.error(`Error deactivating roles for user ${userId}:`, deactivateError);
            return false;
        }

        // Then, add the new role
        const { error: insertError } = await supabase.from('user_roles').insert({
            user_id: userId,
            role: newRole,
            is_active: true,
        });

        if (insertError) {
            console.error(`Error assigning new role ${newRole} to user ${userId}:`, insertError);
            return false;
        }

        // Clear cache for this user since roles changed
        clearUserRolesCache(userId);
        return true;
    } catch (error) {
        console.error(`Error switching role to ${newRole}:`, error);
        return false;
    }
}
