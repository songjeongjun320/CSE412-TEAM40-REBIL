'use client';

import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createClient } from '@/lib/supabase/supabaseClient';

export default function RoleSelectionPage() {
    const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'HOST' | 'RENTER'>('RENTER');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [user, setUser] = useState<{
        id: string;
        email: string | undefined;
    } | null>(null);
    const router = useRouter();
    const { i18n } = useTranslation();

    const checkUser = useCallback(async () => {
        try {
            const supabase = createClient();
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                router.push('/login');
                return;
            }

            setUser({
                id: user.id,
                email: user.email,
            });

            // Check if user already has roles set
            const { data: existingRoles } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .eq('is_active', true);

            if (existingRoles && existingRoles.length > 0) {
                // Redirect to home if user already has roles
                router.push('/home');
            }
        } catch (error) {
            console.error('Error checking user:', error);
            setError('Failed to check user information.');
        }
    }, [router]);

    useEffect(() => {
        checkUser();
    }, [checkUser]);

    const handleRoleSelection = async () => {
        if (!user) return;

        setLoading(true);
        setError('');

        try {
            const supabase = createClient();

            console.log('Selected role:', selectedRole); // For debugging

            // Assign selected role (exclusive - only one role per user)
            const { error: roleInsertError } = await supabase.from('user_roles').insert({
                user_id: user.id,
                role: selectedRole,
            });

            if (roleInsertError) {
                console.error('Role insert error:', roleInsertError);
                throw roleInsertError;
            }

            // Verify that roles were saved properly
            const { data: insertedRoles } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .eq('is_active', true);

            console.log('Inserted roles:', insertedRoles); // For debugging

            // Update user metadata
            await supabase.auth.updateUser({
                data: {
                    role_selected: true,
                    selected_role: selectedRole,
                },
            });

            // Preserve language setting before redirect
            const currentLang =
                localStorage.getItem('i18nextLng') ||
                document.cookie
                    .split(';')
                    .find((cookie) => cookie.trim().startsWith('i18next='))
                    ?.split('=')[1] ||
                'en';

            // Ensure language is set in both localStorage and cookie for persistence
            localStorage.setItem('i18nextLng', currentLang);
            document.cookie = `i18next=${currentLang}; path=/; max-age=${365 * 24 * 60 * 60}; sameSite=lax`;

            // Change language and update HTML lang attribute
            i18n.changeLanguage(currentLang);
            document.documentElement.lang = currentLang;

            // Dispatch language change event
            const languageEvent = new CustomEvent('languageChanged', {
                detail: { language: currentLang },
            });
            window.dispatchEvent(languageEvent);

            // Add small delay to ensure language setting is applied before navigation
            setTimeout(() => {
                router.push('/home');
            }, 100);
        } catch (error) {
            console.error('Error setting role:', error);
            setError('Failed to set role. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200 p-4 sm:p-6 lg:p-12">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 sm:p-10">
                <div className="text-center mb-8">
                    <h2 className="text-2xl sm:text-3xl font-bold text-black mb-2">Welcome! 🎉</h2>
                    <p className="text-gray-600">What service would you like to use on REBIL?</p>
                </div>

                <div className="space-y-4">
                    {/* Role selection section */}
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <label className="flex items-center p-4 border-2 border-gray-400 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors hover:border-gray-500">
                                <input
                                    type="radio"
                                    name="roleSelection"
                                    value="RENTER"
                                    checked={selectedRole === 'RENTER'}
                                    onChange={(e) =>
                                        setSelectedRole(
                                            e.target.value as 'ADMIN' | 'HOST' | 'RENTER',
                                        )
                                    }
                                    className="mr-3 text-black focus:ring-black"
                                />
                                <div>
                                    <div className="font-medium text-black text-lg">
                                        🚗 Rent a Vehicle
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        I want to borrow someone else&apos;s car
                                    </div>
                                </div>
                            </label>

                            <label className="flex items-center p-4 border-2 border-gray-400 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors hover:border-gray-500">
                                <input
                                    type="radio"
                                    name="roleSelection"
                                    value="HOST"
                                    checked={selectedRole === 'HOST'}
                                    onChange={(e) =>
                                        setSelectedRole(
                                            e.target.value as 'ADMIN' | 'HOST' | 'RENTER',
                                        )
                                    }
                                    className="mr-3 text-black focus:ring-black"
                                />
                                <div>
                                    <div className="font-medium text-black text-lg">
                                        💰 Host a Vehicle
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        I want to rent out my car to others and earn money
                                    </div>
                                </div>
                            </label>
                        </div>

                        <p className="text-xs text-gray-500 text-center">
                            * You can change your role later in your profile
                        </p>
                    </div>

                    <button
                        onClick={handleRoleSelection}
                        disabled={loading}
                        className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Setting up...' : 'Get Started'}
                    </button>

                    {error && (
                        <div className="text-red-500 text-center mt-4 font-medium bg-red-50 border border-red-200 rounded-lg py-2 px-4">
                            {error}
                        </div>
                    )}
                </div>

                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-500">Account: {user?.email}</p>
                </div>
            </div>
        </div>
    );
}
