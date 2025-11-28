'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/supabaseServer';

export async function login(formData: FormData): Promise<{
    error?: string;
    success: boolean;
    redirectTo?: string;
    data?: unknown;
}> {
    const supabase = await createClient();
    const cookieStore = await cookies(); // Handle as async

    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
    };

    try {
        const { error, data: authData } = await supabase.auth.signInWithPassword(data);

        if (error || !authData.user) {
            return {
                error: error?.message || 'Invalid credentials',
                success: false,
            };
        }

        cookieStore.set('user_id', authData.user.id);

        revalidatePath('/', 'layout');
        return {
            success: true,
            redirectTo: '/home',
        };
    } catch (error) {
        console.error('Error logging in:', error);
        return {
            error: 'An unexpected error occurred. Please try again.',
            success: false,
            data: error,
        };
    }
}

export async function signup(formData: FormData): Promise<{
    error?: string;
    success?: boolean;
    message?: string;
    data?: unknown;
}> {
    const supabase = await createClient();

    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
    };

    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;
    const dateOfBirth = formData.get('dateOfBirth') as string;
    const addressJson = formData.get('address') as string;
    const role = (formData.get('role') as string) || 'RENTER'; // Default is RENTER

    // Parse address data
    let address = null;
    try {
        if (addressJson) {
            address = JSON.parse(addressJson);
        }
    } catch (error) {
        console.error('Error parsing address data:', error);
        return {
            error: 'Invalid address data format',
            success: false,
        };
    }

    try {
        // Sign out if existing session exists
        await supabase.auth.signOut();

        const { data: authData, error } = await supabase.auth.signUp({
            ...data,
            options: {
                data: {
                    full_name: name,
                    selected_role: role, // Store selected role in metadata
                },
                emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/home`,
            },
        });

        if (error) {
            return {
                error: error.message,
                success: false,
            };
        }

        if (!authData.session) {
            return {
                message: 'Check your email to confirm your account',
                success: true,
            };
        }

        // If user is logged in immediately (when email confirmation is not required)
        if (authData.user && authData.session) {
            try {
                // Check if profile already exists
                const { data: existingProfile } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('id', authData.user.id)
                    .single();

                // Create profile if it doesn't exist (may already be created by trigger)
                if (!existingProfile) {
                    await supabase.from('user_profiles').insert({
                        id: authData.user.id,
                        email: authData.user.email || '',
                        full_name: name,
                        phone: phone || null,
                        date_of_birth: dateOfBirth || null,
                        address: address,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        is_active: true,
                    });
                } else {
                    // Update existing profile with additional information
                    await supabase
                        .from('user_profiles')
                        .update({
                            phone: phone || null,
                            date_of_birth: dateOfBirth || null,
                            address: address,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', authData.user.id);
                }

                // Assign additional role if selected role is not RENTER
                if (role === 'HOST') {
                    // Add HOST role (RENTER is already there by default)
                    await supabase.from('user_roles').insert({
                        user_id: authData.user.id,
                        role: 'HOST',
                    });
                }
                // For RENTER, it's already handled by the default trigger
            } catch (profileError) {
                console.error('Error handling profile/role creation:', profileError);
                // Treat signup as successful even if profile/role creation fails
            }
        }

        revalidatePath('/', 'layout');

        // redirect should be handled outside try-catch
        // or processed separately
    } catch (error) {
        // Handle only non-redirect errors
        if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
            throw error; // Re-throw redirect errors
        }

        return {
            error: 'An unexpected error occurred',
            success: false,
            data: error,
        };
    }

    // Redirect on success (this code won't execute but for type safety)
    redirect('/home');
    return { success: true }; // unreachable but satisfies TypeScript
}

export async function signOut(): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    try {
        const { error } = await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        const cookieStore = await cookies(); // Handle as async
        cookieStore.set('user_id', '', {
            expires: new Date(0),
            path: '/',
        });

        revalidatePath('/', 'layout');
        return { success: true }; // Remove Response.json
    } catch (error) {
        console.error('Error signing out:', error);
        return { success: false, error: 'Failed to sign out' }; // Remove Response.json
    }
}
