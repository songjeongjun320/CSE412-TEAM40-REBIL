'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { getCurrentUserRoles, getPrimaryRole } from '@/lib/auth/userRoles';

export default function HomePage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    const redirectBasedOnRole = useCallback(async () => {
        try {
            const userRoles = await getCurrentUserRoles();

            if (!userRoles) {
                // Redirect to login page if role information cannot be retrieved
                router.push('/login');
                return;
            }

            // Check if user has no roles set (new OAuth user)
            if (userRoles.roles.length === 0) {
                router.push('/role-selection');
                return;
            }

            // Redirect to appropriate dashboard based on user's primary role
            const primaryRole = getPrimaryRole(userRoles);

            switch (primaryRole) {
                case 'ADMIN':
                    router.push('/home/admin');
                    break;
                case 'HOST':
                    router.push('/home/host');
                    break;
                case 'RENTER':
                    router.push('/home/renter');
                    break;
                default:
                    // For unexpected cases, go to role selection page
                    router.push('/role-selection');
                    break;
            }
        } catch (error) {
            console.error('Error determining user role:', error);
            setError('An error occurred while checking user role.');
            // Move to role selection page on error
            setTimeout(() => {
                router.push('/role-selection');
            }, 2000);
        }
    }, [router]);

    useEffect(() => {
        redirectBasedOnRole();
    }, [redirectBasedOnRole]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <div className="text-red-600 mb-4">⚠️</div>
                    <p className="text-red-600 mb-4">{error}</p>
                    <p className="text-gray-600">Moving to default page shortly...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                <p className="text-gray-600">Checking user information...</p>
            </div>
        </div>
    );
}
