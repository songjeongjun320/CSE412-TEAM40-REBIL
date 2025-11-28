'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { ErrorCard } from '@/components/ui/error-card';

export default function SignupError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();

    useEffect(() => {
        // Log error to your error reporting service (in English)
        console.error('Signup Error:', error);
    }, [error]);

    /**
     * This error page is shown when the Google OAuth signup flow fails.
     * Signup is handled entirely via Google OAuth: users click the Google button, are redirected for authentication, and Supabase automatically creates their user/profile.
     * Errors here may be due to OAuth issues, Supabase session exchange failures, or profile creation problems.
     */
    return (
        <ErrorCard
            title="Google Signup Error"
            message={
                <>
                    <p>There was a problem signing up with Google.</p>
                    <p>
                        Signup is handled via Google OAuth. When you click the Google button, you
                        are redirected to Google for authentication. After successful login,
                        Supabase automatically creates your account and profile.
                    </p>
                    <p>If this error persists, please try again or use a different login method.</p>
                    <p>
                        <strong>Error details:</strong> {error.message}
                    </p>
                </>
            }
            retryButton={{
                onClick: () => reset(),
                text: 'Try Google Signup Again',
            }}
            redirectButton={{
                onClick: () => router.push('/login'),
                text: 'Back to Login',
            }}
        />
    );
}
