import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/supabaseServer';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const supabase = await createClient();

    // Get language parameter from request - don't force 'en' as default
    const lang = requestUrl.searchParams.get('lang');

    // Force localhost for development - ignore Supabase settings temporarily
    const isDevelopment = process.env.NODE_ENV === 'development';
    const baseUrl = isDevelopment ? 'http://localhost:3000' : requestUrl.origin;

    // Only add lang parameter to callback URL if it was explicitly provided
    const callbackUrl = lang ? `${baseUrl}/auth/callback?lang=${lang}` : `${baseUrl}/auth/callback`;

    console.log('Google OAuth - Environment:', process.env.NODE_ENV);
    console.log('Google OAuth - Request Origin:', requestUrl.origin);
    console.log('Google OAuth - Base URL:', baseUrl);
    console.log('Google OAuth - Callback URL:', callbackUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: callbackUrl,
        },
    });

    if (error) {
        console.error('Google OAuth Error:', error);
        return redirect('/login?error=Could not authenticate with Google');
    }

    console.log('Google OAuth - Redirect URL:', data.url);
    return redirect(data.url);
}
