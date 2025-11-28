'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { ErrorCard } from '@/components/ui/error-card';

export default function AuthCodeErrorPage() {
    const router = useRouter();

    useEffect(() => {
        // Log error for debugging
        console.error('OAuth authentication failed - user reached auth-code-error page');
    }, []);

    return (
        <ErrorCard
            title="Authentication Error"
            message={
                <>
                    <p>There was a problem with the Google authentication process.</p>
                    <p>This could be due to:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                        <li>Network connectivity issues</li>
                        <li>Temporary service unavailability</li>
                        <li>Session timeout</li>
                        <li>Browser security settings</li>
                    </ul>
                    <p className="mt-4">
                        Please try signing in again. If the problem persists, try:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                        <li>Refreshing the page</li>
                        <li>Clearing your browser cache</li>
                        <li>Using a different browser</li>
                        <li>Checking your internet connection</li>
                    </ul>
                </>
            }
            retryButton={{
                onClick: () => router.push('/login'),
                text: 'Try Again',
            }}
            redirectButton={{
                onClick: () => router.push('/'),
                text: 'Go Home',
            }}
        />
    );
}
