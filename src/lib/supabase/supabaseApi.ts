import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

import { Database } from '@/types/base/database.types';

/**
 * Simple Supabase client for API routes
 * Uses the anon key and doesn't rely on cookies
 */
export function createApiClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }

    return createClient<Database>(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

/**
 * Supabase client for API routes with request-specific auth
 * Uses createServerClient to properly handle auth cookies from middleware
 */
export function createApiClientWithAuth(request?: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }

    // If no request provided, fall back to basic client
    if (!request) {
        return createClient<Database>(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });
    }

    // Use createServerClient to properly handle cookies from middleware
    return createServerClient<Database>(supabaseUrl, supabaseKey, {
        cookies: {
            getAll() {
                // Extract cookies from request headers
                const cookieHeader = request.headers.get('cookie');
                if (!cookieHeader) return [];

                return cookieHeader.split(';').map((cookie) => {
                    const [name, ...valueParts] = cookie.trim().split('=');
                    return { name, value: valueParts.join('=') };
                });
            },
            setAll() {
                // No-op for API routes - cookies are managed by middleware
            },
        },
    });
}
