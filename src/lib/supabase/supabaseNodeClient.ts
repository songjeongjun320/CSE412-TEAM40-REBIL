import { createClient } from '@supabase/supabase-js';

import { Database } from '../../types/base/database.types';

/**
 * Create a Supabase client for Node.js scripts and server-side operations
 * This client is designed for use in scripts and server environments
 * where cookies and browser-specific features are not available.
 */
export function createNodeClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables. Check .env.local file.');
    }

    return createClient<Database>(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false,
            detectSessionInUrl: false,
            autoRefreshToken: false,
        },
    });
}
