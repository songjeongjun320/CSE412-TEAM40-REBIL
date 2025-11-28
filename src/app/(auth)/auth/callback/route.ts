import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/supabaseServer';

// Helper function to preserve language setting
function preserveLanguageSetting(req: NextRequest, response: NextResponse) {
    // Try to get language from URL parameter, referer, or cookie
    let lang = req.nextUrl.searchParams.get('lang') || req.nextUrl.searchParams.get('language');

    if (!lang) {
        // Check the referer URL for language information
        const referer = req.headers.get('referer');
        if (referer) {
            try {
                const refererUrl = new URL(referer);
                const refererPath = refererUrl.pathname;
                // Look for language indicator in referer path or search params
                lang =
                    refererUrl.searchParams.get('lang') || refererUrl.searchParams.get('language');
                if (!lang && refererPath.includes('/ko')) lang = 'ko';
                else if (!lang && refererPath.includes('/id')) lang = 'id';
            } catch {
                // Ignore parsing errors
            }
        }
    }

    if (!lang) {
        // Check existing cookie
        const cookies = req.headers.get('cookie');
        if (cookies) {
            const langCookie = cookies
                .split(';')
                .find((cookie) => cookie.trim().startsWith('i18next='));
            if (langCookie) {
                lang = langCookie.split('=')[1];
            }
        }
    }

    if (!lang) {
        // Fallback to Accept-Language header (only for non-English languages)
        const acceptLanguage = req.headers.get('Accept-Language');
        if (acceptLanguage) {
            if (acceptLanguage.includes('ko')) {
                lang = 'ko';
            } else if (acceptLanguage.includes('id')) {
                lang = 'id';
            }
            // Don't force 'en' as default - let the frontend handle it
        }
    }

    // Validate and set the language only if one was detected
    if (lang && ['ko', 'id', 'en'].includes(lang)) {
        response.cookies.set('i18next', lang, {
            path: '/',
            maxAge: 365 * 24 * 60 * 60, // 1 year
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        });
    }
}

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const code = req.nextUrl.searchParams.get('code');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!code) {
        console.error('OAuth callback: No authorization code provided');
        return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
    }

    try {
        // Exchange code for session with timeout
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            console.error('OAuth callback: Session exchange failed:', error);
            return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
        }

        if (!data?.session?.user?.id) {
            console.error('OAuth callback: No user session after exchange');
            return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
        }

        const userId = data.session.user.id;
        console.log('OAuth callback: Successfully exchanged code for session, user ID:', userId);

        // Check if profile exists with retry logic
        let existingProfile = null;
        let profileError = null;

        try {
            const { data: profileData, error: profileCheckError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (profileCheckError && profileCheckError.code !== 'PGRST116') {
                // PGRST116 is "not found" error, which is expected for new users
                console.error(
                    'OAuth callback: Error checking existing profile:',
                    profileCheckError,
                );
                profileError = profileCheckError;
            } else {
                existingProfile = profileData;
            }
        } catch (checkError) {
            console.error('OAuth callback: Exception checking profile:', checkError);
            profileError = checkError;
        }

        if (!existingProfile && !profileError) {
            // Create new profile for first-time OAuth user
            try {
                console.log('OAuth callback: Creating new profile for user:', userId);

                const { error: insertError } = await supabase.from('user_profiles').insert({
                    id: userId,
                    email: data.session.user.email || '',
                    full_name:
                        data.session.user.user_metadata?.full_name ||
                        data.session.user.user_metadata?.name ||
                        null,
                    profile_image_url: data.session.user.user_metadata?.avatar_url || null,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });

                if (insertError) {
                    console.error('OAuth callback: Error creating profile:', insertError);
                    // Continue anyway - profile might be created by database trigger
                } else {
                    console.log('OAuth callback: Profile created successfully');
                }

                // Redirect to role selection page for first OAuth login
                const response = NextResponse.redirect(`${baseUrl}/role-selection`);
                response.cookies.set('user_id', userId, {
                    path: '/',
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                });

                // Preserve language setting if it exists
                preserveLanguageSetting(req, response);
                return response;
            } catch (profileCreationError) {
                console.error('OAuth callback: Exception creating profile:', profileCreationError);
                // Fallback: redirect to role selection anyway
                const response = NextResponse.redirect(`${baseUrl}/role-selection`);
                response.cookies.set('user_id', userId, {
                    path: '/',
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                });

                // Preserve language setting if it exists
                preserveLanguageSetting(req, response);
                return response;
            }
        }

        // Redirect existing users to home
        console.log('OAuth callback: Redirecting existing user to home');
        const response = NextResponse.redirect(`${baseUrl}/home`);
        response.cookies.set('user_id', userId, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        });

        // Preserve language setting if it exists
        preserveLanguageSetting(req, response);
        return response;
    } catch (error) {
        console.error('OAuth callback: Unexpected error:', error);
        return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
    }
}
