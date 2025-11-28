'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input } from '@/components/ui';
import { createClient } from '@/lib/supabase/supabaseClient';

export default function LoginPage() {
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const router = useRouter();
    const { i18n } = useTranslation();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        setSuccess('');
        const formData = new FormData(e.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        const supabase = createClient();

        const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (signInError || !data?.user) {
            const message = signInError?.message || 'Invalid credentials';
            setError(message);
            console.log('Login failed:', message);
            return;
        }

        setSuccess('Login successful! Redirecting...');
        console.log('Login successful');

        // Preserve current language setting using i18next
        const currentLang =
            localStorage.getItem('i18nextLng') ||
            document.cookie
                .split(';')
                .find((cookie) => cookie.trim().startsWith('i18next='))
                ?.split('=')[1];

        // Only set language explicitly if one was already chosen by user
        if (currentLang) {
            localStorage.setItem('i18nextLng', currentLang);
            document.cookie = `i18next=${currentLang}; path=/; max-age=${365 * 24 * 60 * 60}; sameSite=lax`;
        }

        // Change language and update HTML lang attribute only if language was set
        if (currentLang) {
            i18n.changeLanguage(currentLang);
            document.documentElement.lang = currentLang;

            // Dispatch language change event for other components
            const languageEvent = new CustomEvent('languageChanged', {
                detail: { language: currentLang },
            });
            window.dispatchEvent(languageEvent);
        }

        // Add small delay to ensure language setting is applied before navigation
        setTimeout(() => {
            router.replace('/home');
        }, 100);
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200 p-4 sm:p-6 lg:p-12">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 sm:p-10">
                <h2 className="text-2xl sm:text-3xl font-bold text-black mb-6 text-center">
                    Sign In
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="Email"
                        required
                        error={error}
                        className="bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 rounded-md"
                    />
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="Password"
                        required
                        error={error}
                        className="bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 rounded-md"
                    />
                    <Button
                        type="submit"
                        variant="default"
                        size="lg"
                        className="w-full mt-2 cursor-pointer bg-black text-white hover:bg-gray-800 rounded-md"
                    >
                        Sign In
                    </Button>
                </form>
                <div className="mt-6 flex flex-col gap-3 items-center">
                    <button
                        className="w-full h-12 flex flex-row items-center justify-center gap-3 font-medium cursor-pointer bg-white text-black border-2 border-gray-300 hover:bg-gray-50 rounded-md transition-colors duration-200 px-4"
                        onClick={() => {
                            // Preserve current language when redirecting to Google OAuth
                            const currentLang =
                                localStorage.getItem('i18nextLng') ||
                                document.cookie
                                    .split(';')
                                    .find((cookie) => cookie.trim().startsWith('i18next='))
                                    ?.split('=')[1];

                            // Only add lang parameter if a specific language is set
                            const googleAuthUrl =
                                currentLang && currentLang !== 'en'
                                    ? `/auth/google?lang=${currentLang}`
                                    : '/auth/google';

                            window.location.href = googleAuthUrl;
                        }}
                    >
                        <svg
                            className="h-5 w-5 flex-shrink-0"
                            viewBox="0 0 48 48"
                            width="20"
                            height="20"
                        >
                            <g>
                                <path
                                    fill="#4285F4"
                                    d="M24 9.5c3.54 0 6.72 1.22 9.22 3.23l6.9-6.9C36.68 2.36 30.7 0 24 0 14.82 0 6.71 5.08 2.69 12.44l8.06 6.26C12.6 13.13 17.87 9.5 24 9.5z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.6C43.98 37.13 46.1 31.36 46.1 24.55z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M10.75 28.7c-1.13-3.36-1.13-6.98 0-10.34l-8.06-6.26C.7 15.29 0 19.51 0 24s.7 8.71 2.69 12.44l8.06-6.26z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M24 48c6.48 0 11.92-2.14 15.89-5.82l-7.19-5.6c-2.01 1.35-4.59 2.15-8.7 2.15-6.13 0-11.4-3.63-13.25-8.79l-8.06 6.26C6.71 42.92 14.82 48 24 48z"
                                />
                                <path fill="none" d="M0 0h48v48H0z" />
                            </g>
                        </svg>
                        <span>Continue with Google</span>
                    </button>
                    <Link
                        href="/signup"
                        className="block text-center text-sm text-gray-600 hover:text-black transition-colors mt-2 cursor-pointer"
                    >
                        Don&apos;t have an account? <span className="font-semibold">Sign Up</span>
                    </Link>
                </div>
                {error && <div className="text-red-500 text-center mt-4">{error}</div>}
                {success && <div className="text-green-600 text-center mt-4">{success}</div>}
            </div>
        </div>
    );
}
