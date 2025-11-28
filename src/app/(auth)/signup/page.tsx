'use client';

import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';

import { CompactAddressForm } from '@/components/address';
import type { IndonesianAddress } from '@/components/address';

import { signup } from '../auth/actions';

export default function SignupPage() {
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selectedRole, setSelectedRole] = useState('RENTER');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [address, setAddress] = useState<IndonesianAddress>({
        street_address: '',
        village: undefined,
        district: undefined,
        city: undefined,
        province: undefined,
        postal_code: '',
        additional_info: '',
    });
    const router = useRouter();

    // Validate password confirmation
    const validatePasswords = () => {
        if (password !== confirmPassword) {
            setPasswordError('Passwords do not match');
            return false;
        }
        if (password.length < 6) {
            setPasswordError('Password must be at least 6 characters long');
            return false;
        }
        setPasswordError('');
        return true;
    };

    // Keep password mismatch validation centralized
    useEffect(() => {
        if (password && confirmPassword && password !== confirmPassword) {
            setPasswordError('Passwords do not match');
        } else {
            // Do not enforce length here; only on submit via validatePasswords
            setPasswordError('');
        }
    }, [password, confirmPassword]);

    const handleAddressChange = useCallback((newAddress: IndonesianAddress) => {
        setAddress(newAddress);
    }, []);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validate passwords before submitting
        if (!validatePasswords()) {
            return;
        }

        const formData = new FormData(e.currentTarget);

        // Add selected role to formData
        formData.append('role', selectedRole);

        // Add address data to formData - only include if we have complete address info
        if (address.street_address && address.city?.code && address.province?.code) {
            formData.append('address', JSON.stringify(address));
        }

        const res = await signup(formData);
        if (res?.error) {
            setError(res.error);
            console.log('Signup failed:', res.error);
        } else {
            setSuccess('Signup successful! Redirecting...');
            console.log('Signup successful');
            setTimeout(() => router.push('/'), 1500);
        }
    }

    function handleGoogleSignup() {
        window.location.href = '/auth/google';
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200 p-4 sm:p-6 lg:p-12">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 sm:p-10">
                <h2 className="text-2xl sm:text-3xl font-bold text-black mb-6 text-center">
                    Sign Up
                </h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            name="name"
                            type="text"
                            placeholder="Full Name"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black placeholder-gray-600 bg-white"
                        />
                        <input
                            name="email"
                            type="email"
                            placeholder="Email"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black placeholder-gray-600 bg-white"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            name="password"
                            type="password"
                            placeholder="Password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black placeholder-gray-600 bg-white"
                        />
                        <input
                            name="confirmPassword"
                            type="password"
                            placeholder="Confirm Password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black placeholder-gray-600 bg-white"
                        />
                    </div>

                    {passwordError && (
                        <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg py-2 px-4">
                            {passwordError}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            name="phone"
                            type="tel"
                            placeholder="Phone Number"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black placeholder-gray-600 bg-white"
                        />
                        <input
                            name="dateOfBirth"
                            type="date"
                            placeholder="Date of Birth"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black placeholder-gray-600 bg-white"
                        />
                    </div>

                    <div className="flex items-center">
                        <label className="text-sm text-gray-600">
                            * Required fields for account verification
                        </label>
                    </div>

                    {/* Address Section */}
                    <div className="border-t pt-6">
                        <h3 className="text-lg font-semibold text-black mb-4">
                            Address Information
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Provide your address in Indonesia. This information is optional but
                            helps with location-based services.
                        </p>
                        <CompactAddressForm
                            initialAddress={address}
                            onChange={handleAddressChange}
                            onLocationStringChange={(locationString) => {
                                // Optional: Handle location string for display
                                console.log('Signup location string:', locationString);
                            }}
                            required={false}
                            disabled={false}
                            enableDetailedMode={true}
                        />
                    </div>

                    {/* Role selection section */}
                    <div className="space-y-3 border-t pt-6">
                        <label className="block text-sm font-medium text-gray-700">
                            What service would you like to use?
                        </label>
                        <div className="space-y-2">
                            <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="radio"
                                    name="roleSelection"
                                    value="RENTER"
                                    checked={selectedRole === 'RENTER'}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    className="mr-3 text-black focus:ring-black"
                                />
                                <div>
                                    <div className="font-medium text-black">🚗 Rent a Vehicle</div>
                                    <div className="text-sm text-gray-600">
                                        I want to borrow someone else&apos;s car
                                    </div>
                                </div>
                            </label>
                            <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="radio"
                                    name="roleSelection"
                                    value="HOST"
                                    checked={selectedRole === 'HOST'}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    className="mr-3 text-black focus:ring-black"
                                />
                                <div>
                                    <div className="font-medium text-black">💰 Host a Vehicle</div>
                                    <div className="text-sm text-gray-600">
                                        I want to rent out my car to others and earn money
                                    </div>
                                </div>
                            </label>
                        </div>
                        <p className="text-xs text-gray-500">
                            * You can change your role later in your profile
                        </p>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-900 transition-colors"
                    >
                        Sign Up
                    </button>
                </form>
                <div className="mt-6 flex flex-col items-center">
                    <button
                        onClick={handleGoogleSignup}
                        className="flex items-center justify-center w-full bg-[#4285F4] hover:bg-[#357ae8] text-white font-semibold py-2 rounded-lg shadow transition-colors mb-2"
                        type="button"
                    >
                        <svg
                            className="mr-2"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 48 48"
                            width="24"
                            height="24"
                        >
                            <path
                                fill="#FFC107"
                                d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,8,3.029V10.18c-3.482-3.184-7.98-5.18-13-5.18c-11.045,0-20,8.955-20,20c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44.011,21.671,43.864,20.833,43.611,20.083z"
                            />
                            <path
                                fill="#FF3D00"
                                d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,8,3.029V10.18c-3.482-3.184-7.98-5.18-13-5.18c-11.045,0-20,8.955-20,20c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44.011,21.671,43.864,20.833,43.611,20.083z"
                            />
                            <path
                                fill="#4CAF50"
                                d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.303-8H6.306C9.669,36.446,16.801,44,24,44z"
                            />
                            <path
                                fill="#1976D2"
                                d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,8,3.029V10.18c-3.482-3.184-7.98-5.18-13-5.18c-11.045,0-20,8.955-20,20c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44.011,21.671,43.864,20.833,43.611,20.083z"
                            />
                        </svg>
                        Sign up with Google
                    </button>
                </div>
                {error && (
                    <div className="text-red-500 text-center mt-4 font-medium bg-red-50 border border-red-200 rounded-lg py-2 px-4">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="text-green-600 text-center mt-4 font-medium bg-green-50 border border-green-200 rounded-lg py-2 px-4">
                        {success}
                    </div>
                )}
            </div>
        </div>
    );
}
