export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
    // Allows to automatically instanciate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: '12.2.3 (519615d)';
    };
    public: {
        Tables: {
            user_profiles: {
                Row: {
                    id: string;
                    email: string;
                    full_name: string | null;
                    phone: string | null;
                    date_of_birth: string | null;
                    profile_image_url: string | null;
                    address: Json | null;
                    created_at: string;
                    updated_at: string;
                    is_active: boolean;
                };
                Insert: {
                    id: string;
                    email: string;
                    full_name?: string | null;
                    phone?: string | null;
                    date_of_birth?: string | null;
                    profile_image_url?: string | null;
                    address?: Json | null;
                    created_at?: string;
                    updated_at?: string;
                    is_active?: boolean;
                };
                Update: {
                    id?: string;
                    email?: string;
                    full_name?: string | null;
                    phone?: string | null;
                    date_of_birth?: string | null;
                    profile_image_url?: string | null;
                    address?: Json | null;
                    created_at?: string;
                    updated_at?: string;
                    is_active?: boolean;
                };
                Relationships: [
                    {
                        foreignKeyName: 'user_profiles_id_fkey';
                        columns: ['id'];
                        isOneToOne: true;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            user_roles: {
                Row: {
                    id: string;
                    user_id: string;
                    role: Database['public']['Enums']['user_role_type'];
                    assigned_at: string;
                    is_active: boolean;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    role: Database['public']['Enums']['user_role_type'];
                    assigned_at?: string;
                    is_active?: boolean;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    role?: Database['public']['Enums']['user_role_type'];
                    assigned_at?: string;
                    is_active?: boolean;
                };
                Relationships: [
                    {
                        foreignKeyName: 'user_roles_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'user_profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            user_verifications: {
                Row: {
                    id: string;
                    user_id: string;
                    verification_type: Database['public']['Enums']['verification_type'];
                    document_url: string | null;
                    verification_data: Json | null;
                    status: Database['public']['Enums']['verification_status'];
                    verified_at: string | null;
                    expires_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    verification_type: Database['public']['Enums']['verification_type'];
                    document_url?: string | null;
                    verification_data?: Json | null;
                    status?: Database['public']['Enums']['verification_status'];
                    verified_at?: string | null;
                    expires_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    verification_type?: Database['public']['Enums']['verification_type'];
                    document_url?: string | null;
                    verification_data?: Json | null;
                    status?: Database['public']['Enums']['verification_status'];
                    verified_at?: string | null;
                    expires_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'user_verifications_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'user_profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            cars: {
                Row: {
                    id: string;
                    host_id: string;
                    make: string;
                    model: string;
                    year: number;
                    vin: string | null;
                    license_plate: string | null;
                    color: string | null;
                    transmission: Database['public']['Enums']['transmission_type'];
                    fuel_type: Database['public']['Enums']['fuel_type'];
                    car_type: Database['public']['Enums']['car_type_enum'];
                    seats: number;
                    doors: number;
                    description: string | null;
                    features: string[] | null;
                    daily_rate: number;
                    weekly_rate: number | null;
                    monthly_rate: number | null;
                    location: Json;
                    delivery_available: boolean;
                    delivery_fee: number;
                    delivery_radius: number;
                    minimum_trip_duration: number;
                    status: Database['public']['Enums']['car_status'];
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    host_id: string;
                    make: string;
                    model: string;
                    year: number;
                    vin?: string | null;
                    license_plate?: string | null;
                    color?: string | null;
                    transmission: Database['public']['Enums']['transmission_type'];
                    fuel_type: Database['public']['Enums']['fuel_type'];
                    car_type?: Database['public']['Enums']['car_type_enum'];
                    seats: number;
                    doors: number;
                    description?: string | null;
                    features?: string[] | null;
                    daily_rate: number;
                    weekly_rate?: number | null;
                    monthly_rate?: number | null;
                    location: Json;
                    delivery_available?: boolean;
                    delivery_fee?: number;
                    delivery_radius?: number;
                    minimum_trip_duration?: number;
                    status?: Database['public']['Enums']['car_status'];
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    host_id?: string;
                    make?: string;
                    model?: string;
                    year?: number;
                    vin?: string | null;
                    license_plate?: string | null;
                    color?: string | null;
                    transmission?: Database['public']['Enums']['transmission_type'];
                    fuel_type?: Database['public']['Enums']['fuel_type'];
                    car_type?: Database['public']['Enums']['car_type_enum'];
                    seats?: number;
                    doors?: number;
                    description?: string | null;
                    features?: string[] | null;
                    daily_rate?: number;
                    weekly_rate?: number | null;
                    monthly_rate?: number | null;
                    location?: Json;
                    delivery_available?: boolean;
                    delivery_fee?: number;
                    delivery_radius?: number;
                    minimum_trip_duration?: number;
                    status?: Database['public']['Enums']['car_status'];
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'cars_host_id_fkey';
                        columns: ['host_id'];
                        isOneToOne: false;
                        referencedRelation: 'user_profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            car_images: {
                Row: {
                    id: string;
                    car_id: string;
                    image_url: string;
                    image_type: string | null;
                    is_primary: boolean;
                    display_order: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    car_id: string;
                    image_url: string;
                    image_type?: string | null;
                    is_primary?: boolean;
                    display_order?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    car_id?: string;
                    image_url?: string;
                    image_type?: string | null;
                    is_primary?: boolean;
                    display_order?: number;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'car_images_car_id_fkey';
                        columns: ['car_id'];
                        isOneToOne: false;
                        referencedRelation: 'cars';
                        referencedColumns: ['id'];
                    },
                ];
            };
            car_availability: {
                Row: {
                    id: string;
                    car_id: string;
                    start_date: string;
                    end_date: string;
                    is_available: boolean;
                    reason: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    car_id: string;
                    start_date: string;
                    end_date: string;
                    is_available?: boolean;
                    reason?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    car_id?: string;
                    start_date?: string;
                    end_date?: string;
                    is_available?: boolean;
                    reason?: string | null;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'car_availability_car_id_fkey';
                        columns: ['car_id'];
                        isOneToOne: false;
                        referencedRelation: 'cars';
                        referencedColumns: ['id'];
                    },
                ];
            };
            bookings: {
                Row: {
                    id: string;
                    car_id: string;
                    renter_id: string;
                    host_id: string;
                    start_date: string;
                    end_date: string;
                    pickup_location: Json | null;
                    dropoff_location: Json | null;
                    insurance_type: Database['public']['Enums']['insurance_type'];
                    daily_rate: number;
                    total_days: number;
                    subtotal: number;
                    insurance_fee: number;
                    service_fee: number;
                    delivery_fee: number;
                    total_amount: number;
                    security_deposit: number;
                    status: Database['public']['Enums']['booking_status'];
                    special_instructions: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    car_id: string;
                    renter_id: string;
                    host_id: string;
                    start_date: string;
                    end_date: string;
                    pickup_location?: Json | null;
                    dropoff_location?: Json | null;
                    insurance_type: Database['public']['Enums']['insurance_type'];
                    daily_rate: number;
                    total_days: number;
                    subtotal: number;
                    insurance_fee?: number;
                    service_fee?: number;
                    delivery_fee?: number;
                    total_amount: number;
                    security_deposit?: number;
                    status?: Database['public']['Enums']['booking_status'];
                    special_instructions?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    car_id?: string;
                    renter_id?: string;
                    host_id?: string;
                    start_date?: string;
                    end_date?: string;
                    pickup_location?: Json | null;
                    dropoff_location?: Json | null;
                    insurance_type?: Database['public']['Enums']['insurance_type'];
                    daily_rate?: number;
                    total_days?: number;
                    subtotal?: number;
                    insurance_fee?: number;
                    service_fee?: number;
                    delivery_fee?: number;
                    total_amount?: number;
                    security_deposit?: number;
                    status?: Database['public']['Enums']['booking_status'];
                    special_instructions?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'bookings_car_id_fkey';
                        columns: ['car_id'];
                        isOneToOne: false;
                        referencedRelation: 'cars';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'bookings_renter_id_fkey';
                        columns: ['renter_id'];
                        isOneToOne: false;
                        referencedRelation: 'user_profiles';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'bookings_host_id_fkey';
                        columns: ['host_id'];
                        isOneToOne: false;
                        referencedRelation: 'user_profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            payments: {
                Row: {
                    id: string;
                    booking_id: string;
                    user_id: string;
                    amount: number;
                    currency: string;
                    payment_type: Database['public']['Enums']['payment_type'];
                    payment_method_id: string | null;
                    stripe_payment_intent_id: string | null;
                    status: Database['public']['Enums']['payment_status'];
                    processed_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    booking_id: string;
                    user_id: string;
                    amount: number;
                    currency?: string;
                    payment_type: Database['public']['Enums']['payment_type'];
                    payment_method_id?: string | null;
                    stripe_payment_intent_id?: string | null;
                    status?: Database['public']['Enums']['payment_status'];
                    processed_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    booking_id?: string;
                    user_id?: string;
                    amount?: number;
                    currency?: string;
                    payment_type?: Database['public']['Enums']['payment_type'];
                    payment_method_id?: string | null;
                    stripe_payment_intent_id?: string | null;
                    status?: Database['public']['Enums']['payment_status'];
                    processed_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'payments_booking_id_fkey';
                        columns: ['booking_id'];
                        isOneToOne: false;
                        referencedRelation: 'bookings';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'payments_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'user_profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            messages: {
                Row: {
                    id: string;
                    booking_id: string;
                    sender_id: string;
                    receiver_id: string;
                    message: string;
                    is_read: boolean;
                    read_at: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    booking_id: string;
                    sender_id: string;
                    receiver_id: string;
                    message: string;
                    is_read?: boolean;
                    read_at?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    booking_id?: string;
                    sender_id?: string;
                    receiver_id?: string;
                    message?: string;
                    is_read?: boolean;
                    read_at?: string | null;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'messages_booking_id_fkey';
                        columns: ['booking_id'];
                        isOneToOne: false;
                        referencedRelation: 'bookings';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'messages_sender_id_fkey';
                        columns: ['sender_id'];
                        isOneToOne: false;
                        referencedRelation: 'user_profiles';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'messages_receiver_id_fkey';
                        columns: ['receiver_id'];
                        isOneToOne: false;
                        referencedRelation: 'user_profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            reviews: {
                Row: {
                    id: string;
                    booking_id: string;
                    reviewer_id: string;
                    reviewed_id: string;
                    car_id: string;
                    rating: number;
                    comment: string | null;
                    is_public: boolean;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    booking_id: string;
                    reviewer_id: string;
                    reviewed_id: string;
                    car_id: string;
                    rating: number;
                    comment?: string | null;
                    is_public?: boolean;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    booking_id?: string;
                    reviewer_id?: string;
                    reviewed_id?: string;
                    car_id?: string;
                    rating?: number;
                    comment?: string | null;
                    is_public?: boolean;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'reviews_booking_id_fkey';
                        columns: ['booking_id'];
                        isOneToOne: false;
                        referencedRelation: 'bookings';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'reviews_reviewer_id_fkey';
                        columns: ['reviewer_id'];
                        isOneToOne: false;
                        referencedRelation: 'user_profiles';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'reviews_reviewed_id_fkey';
                        columns: ['reviewed_id'];
                        isOneToOne: false;
                        referencedRelation: 'user_profiles';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'reviews_car_id_fkey';
                        columns: ['car_id'];
                        isOneToOne: false;
                        referencedRelation: 'cars';
                        referencedColumns: ['id'];
                    },
                ];
            };
            admin_actions: {
                Row: {
                    id: string;
                    admin_id: string;
                    action_type: Database['public']['Enums']['admin_action_type'];
                    target_id: string;
                    target_type: string;
                    reason: string | null;
                    details: Json | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    admin_id: string;
                    action_type: Database['public']['Enums']['admin_action_type'];
                    target_id: string;
                    target_type: string;
                    reason?: string | null;
                    details?: Json | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    admin_id?: string;
                    action_type?: Database['public']['Enums']['admin_action_type'];
                    target_id?: string;
                    target_type?: string;
                    reason?: string | null;
                    details?: Json | null;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'admin_actions_admin_id_fkey';
                        columns: ['admin_id'];
                        isOneToOne: false;
                        referencedRelation: 'user_profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            admin_stats: {
                Row: {
                    id: string;
                    total_users: number;
                    total_hosts: number;
                    total_renters: number;
                    total_cars: number;
                    active_cars: number;
                    total_bookings: number;
                    completed_bookings: number;
                    total_revenue: number;
                    monthly_revenue: number;
                    pending_verifications: number;
                    disputed_bookings: number;
                    calculated_at: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    total_users?: number;
                    total_hosts?: number;
                    total_renters?: number;
                    total_cars?: number;
                    active_cars?: number;
                    total_bookings?: number;
                    completed_bookings?: number;
                    total_revenue?: number;
                    monthly_revenue?: number;
                    pending_verifications?: number;
                    disputed_bookings?: number;
                    calculated_at?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    total_users?: number;
                    total_hosts?: number;
                    total_renters?: number;
                    total_cars?: number;
                    active_cars?: number;
                    total_bookings?: number;
                    completed_bookings?: number;
                    total_revenue?: number;
                    monthly_revenue?: number;
                    pending_verifications?: number;
                    disputed_bookings?: number;
                    calculated_at?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            host_stats: {
                Row: {
                    id: string;
                    host_id: string;
                    total_cars: number;
                    active_cars: number;
                    total_bookings: number;
                    completed_bookings: number;
                    total_earnings: number;
                    monthly_earnings: number;
                    average_rating: number;
                    total_reviews: number;
                    calculated_at: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    host_id: string;
                    total_cars?: number;
                    active_cars?: number;
                    total_bookings?: number;
                    completed_bookings?: number;
                    total_earnings?: number;
                    monthly_earnings?: number;
                    average_rating?: number;
                    total_reviews?: number;
                    calculated_at?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    host_id?: string;
                    total_cars?: number;
                    active_cars?: number;
                    total_bookings?: number;
                    completed_bookings?: number;
                    total_earnings?: number;
                    monthly_earnings?: number;
                    average_rating?: number;
                    total_reviews?: number;
                    calculated_at?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'host_stats_host_id_fkey';
                        columns: ['host_id'];
                        isOneToOne: true;
                        referencedRelation: 'user_profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            renter_stats: {
                Row: {
                    id: string;
                    renter_id: string;
                    total_bookings: number;
                    completed_bookings: number;
                    cancelled_bookings: number;
                    total_spent: number;
                    average_rating: number;
                    total_reviews: number;
                    calculated_at: string;
                    favorite_car_types: string[] | null;
                    preferred_locations: string[] | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    renter_id: string;
                    total_bookings?: number;
                    completed_bookings?: number;
                    cancelled_bookings?: number;
                    total_spent?: number;
                    average_rating?: number;
                    total_reviews?: number;
                    calculated_at?: string;
                    favorite_car_types?: string[] | null;
                    preferred_locations?: string[] | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    renter_id?: string;
                    total_bookings?: number;
                    completed_bookings?: number;
                    cancelled_bookings?: number;
                    total_spent?: number;
                    average_rating?: number;
                    total_reviews?: number;
                    calculated_at?: string;
                    favorite_car_types?: string[] | null;
                    preferred_locations?: string[] | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'renter_stats_renter_id_fkey';
                        columns: ['renter_id'];
                        isOneToOne: true;
                        referencedRelation: 'user_profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            host_preferences: {
                Row: {
                    id: string;
                    host_id: string;
                    auto_approval_enabled: boolean;
                    auto_approval_limit: number;
                    advance_booking_hours: number;
                    require_renter_verification: boolean;
                    minimum_renter_score: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    host_id: string;
                    auto_approval_enabled?: boolean;
                    auto_approval_limit?: number;
                    advance_booking_hours?: number;
                    require_renter_verification?: boolean;
                    minimum_renter_score?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    host_id?: string;
                    auto_approval_enabled?: boolean;
                    auto_approval_limit?: number;
                    advance_booking_hours?: number;
                    require_renter_verification?: boolean;
                    minimum_renter_score?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'host_preferences_host_id_fkey';
                        columns: ['host_id'];
                        isOneToOne: true;
                        referencedRelation: 'user_profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            renter_scores: {
                Row: {
                    id: string;
                    renter_id: string;
                    verification_score: number;
                    booking_history_score: number;
                    cancellation_rate: number;
                    dispute_count: number;
                    total_bookings: number;
                    completed_bookings: number;
                    overall_score: number;
                    last_updated: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    renter_id: string;
                    verification_score?: number;
                    booking_history_score?: number;
                    cancellation_rate?: number;
                    dispute_count?: number;
                    total_bookings?: number;
                    completed_bookings?: number;
                    overall_score?: number;
                    last_updated?: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    renter_id?: string;
                    verification_score?: number;
                    booking_history_score?: number;
                    cancellation_rate?: number;
                    dispute_count?: number;
                    total_bookings?: number;
                    completed_bookings?: number;
                    overall_score?: number;
                    last_updated?: string;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'renter_scores_renter_id_fkey';
                        columns: ['renter_id'];
                        isOneToOne: true;
                        referencedRelation: 'user_profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            indonesian_provinces: {
                Row: {
                    id: string;
                    code: string;
                    name: string;
                    island_group: string;
                    is_special_region: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    code: string;
                    name: string;
                    island_group: string;
                    is_special_region?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    code?: string;
                    name?: string;
                    island_group?: string;
                    is_special_region?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            indonesian_regencies: {
                Row: {
                    id: string;
                    province_id: string;
                    code: string;
                    name: string;
                    type: string;
                    is_capital: boolean;
                    is_major_city: boolean;
                    population: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    province_id: string;
                    code: string;
                    name: string;
                    type: string;
                    is_capital?: boolean;
                    is_major_city?: boolean;
                    population?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    province_id?: string;
                    code?: string;
                    name?: string;
                    type?: string;
                    is_capital?: boolean;
                    is_major_city?: boolean;
                    population?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'indonesian_regencies_province_id_fkey';
                        columns: ['province_id'];
                        isOneToOne: false;
                        referencedRelation: 'indonesian_provinces';
                        referencedColumns: ['id'];
                    },
                ];
            };
            indonesian_districts: {
                Row: {
                    id: string;
                    regency_id: string;
                    code: string;
                    name: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    regency_id: string;
                    code: string;
                    name: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    regency_id?: string;
                    code?: string;
                    name?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'indonesian_districts_regency_id_fkey';
                        columns: ['regency_id'];
                        isOneToOne: false;
                        referencedRelation: 'indonesian_regencies';
                        referencedColumns: ['id'];
                    },
                ];
            };
            indonesian_villages: {
                Row: {
                    id: string;
                    district_id: string;
                    code: string;
                    name: string;
                    type: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    district_id: string;
                    code: string;
                    name: string;
                    type?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    district_id?: string;
                    code?: string;
                    name?: string;
                    type?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'indonesian_villages_district_id_fkey';
                        columns: ['district_id'];
                        isOneToOne: false;
                        referencedRelation: 'indonesian_districts';
                        referencedColumns: ['id'];
                    },
                ];
            };
        };
        Views: {
            major_cities_dropdown: {
                Row: {
                    id: string;
                    province_id: string;
                    name: string;
                    type: string;
                    population: number;
                    province_name: string;
                    province_code: string;
                };
                Insert: {
                    id?: string;
                    province_id?: string;
                    name?: string;
                    type?: string;
                    population?: number;
                    province_name?: string;
                    province_code?: string;
                };
                Update: {
                    id?: string;
                    province_id?: string;
                    name?: string;
                    type?: string;
                    population?: number;
                    province_name?: string;
                    province_code?: string;
                };
            };
        };
        Functions: {
            get_provinces_dropdown: {
                Args: Record<string, never>;
                Returns: {
                    id: string;
                    name: string;
                    code: string;
                    island_group: string;
                    is_special_region: boolean;
                }[];
            };
            get_cities_by_province: {
                Args: {
                    province_identifier: string;
                };
                Returns: {
                    id: string;
                    name: string;
                    type: string;
                    code: string;
                    government_code: string;
                }[];
            };
            search_cities: {
                Args: {
                    search_term: string;
                };
                Returns: {
                    id: string;
                    name: string;
                    type: string;
                    province_name: string;
                    is_major_city: boolean;
                }[];
            };
            get_user_roles: {
                Args: {
                    user_uuid: string;
                };
                Returns: {
                    role: Database['public']['Enums']['user_role_type'];
                }[];
            };
            is_user_admin: {
                Args: {
                    user_uuid: string;
                };
                Returns: boolean;
            };
            is_user_host: {
                Args: {
                    user_uuid: string;
                };
                Returns: boolean;
            };
            get_pending_approval_cars: {
                Args: {
                    admin_user_id: string;
                };
                Returns: {
                    id: string;
                    host_id: string;
                    host_name: string;
                    host_email: string;
                    make: string;
                    model: string;
                    year: number;
                    license_plate: string;
                    color: string;
                    transmission: string;
                    fuel_type: string;
                    seats: number;
                    description: string;
                    daily_rate: number;
                    location: Json;
                    created_at: string;
                    updated_at: string;
                    image_count: number;
                    primary_image_url: string;
                }[];
            };
            approve_car: {
                Args: {
                    admin_user_id: string;
                    car_uuid: string;
                };
                Returns: {
                    success: boolean;
                    error?: string;
                };
            };
            reject_car: {
                Args: {
                    admin_user_id: string;
                    car_uuid: string;
                    rejection_reason: string;
                };
                Returns: {
                    success: boolean;
                    error?: string;
                };
            };
            submit_car_for_approval: {
                Args: {
                    host_user_id: string;
                    car_uuid: string;
                };
                Returns: {
                    success: boolean;
                    error?: string;
                };
            };
            check_storage_bucket_status: {
                Args: Record<string, never>;
                Returns: {
                    bucket_exists: boolean;
                    bucket_public: boolean;
                    status: string;
                    message: string;
                    next_steps: string[];
                };
            };
            check_vehicle_availability: {
                Args: {
                    p_car_id: string;
                    p_start_date: string;
                    p_end_date: string;
                };
                Returns: {
                    is_available: boolean;
                    conflict_type: string;
                    conflict_details: Json;
                }[];
            };
            create_booking_with_business_rules: {
                Args: {
                    p_booking_data: Json;
                };
                Returns: {
                    booking_id: string;
                    success: boolean;
                    status: Database['public']['Enums']['booking_status'];
                    approval_type: string;
                    message: string;
                    details: Json;
                }[];
            };
            create_booking_with_validation: {
                Args: {
                    p_booking_data: Json;
                };
                Returns: {
                    booking_id: string;
                    success: boolean;
                    error_message: string;
                }[];
            };
            search_available_vehicles: {
                Args: {
                    p_start_date?: string;
                    p_end_date?: string;
                    p_location?: string;
                    p_filters?: Json;
                };
                Returns: {
                    car_id: string;
                    make: string;
                    model: string;
                    year: number;
                    daily_rate: number;
                    location: Json;
                    features: string[];
                    transmission: Database['public']['Enums']['transmission_type'];
                    fuel_type: Database['public']['Enums']['fuel_type'];
                    seats: number;
                    host_name: string;
                    primary_image_url: string;
                    availability_status: string;
                }[];
            };
            set_recurring_availability: {
                Args: {
                    p_car_id: string;
                    p_pattern: Json;
                    p_start_date: string;
                    p_end_date: string;
                    p_is_available?: boolean;
                    p_created_by?: string;
                    p_reason?: string;
                };
                Returns: boolean;
            };
            get_vehicle_calendar: {
                Args: {
                    p_car_id: string;
                    p_year: number;
                    p_month: number;
                };
                Returns: {
                    date: string;
                    is_available: boolean;
                    status: string;
                    details: Json;
                }[];
            };
            check_booking_conflicts: {
                Args: {
                    p_car_id: string;
                    p_start_date: string;
                    p_end_date: string;
                    p_exclude_booking_id?: string;
                };
                Returns: {
                    has_conflict: boolean;
                    conflict_count: number;
                    conflicting_bookings: Json;
                }[];
            };
            evaluate_auto_approval_eligibility: {
                Args: {
                    p_car_id: string;
                    p_renter_id: string;
                    p_start_date: string;
                    p_total_amount: number;
                };
                Returns: {
                    is_eligible: boolean;
                    approval_score: number;
                    eligibility_details: Json;
                }[];
            };
            host_reject_booking: {
                Args: {
                    p_booking_id: string;
                    p_host_id: string;
                    p_rejection_reason: string;
                };
                Returns: {
                    success: boolean;
                    message: string;
                    booking_status: Database['public']['Enums']['booking_status'];
                }[];
            };
            update_car_status_by_host: {
                Args: {
                    host_user_id: string;
                    car_uuid: string;
                    new_status: string;
                };
                Returns: {
                    success: boolean;
                    message: string;
                    old_status: string;
                    new_status: string;
                    error?: string;
                    error_code?: string;
                };
            };
            get_indonesian_provinces: {
                Args: Record<string, never>;
                Returns: {
                    id: string;
                    code: string;
                    name: string;
                    government_code: string;
                }[];
            };
            get_indonesian_regencies: {
                Args: {
                    province_code_param: string;
                };
                Returns: {
                    id: string;
                    code: string;
                    name: string;
                    type: string;
                    province_code: string;
                }[];
            };
            get_indonesian_districts: {
                Args: {
                    regency_code_param: string;
                };
                Returns: {
                    id: string;
                    code: string;
                    name: string;
                    regency_code: string;
                }[];
            };
            get_indonesian_villages: {
                Args: {
                    district_code_param: string;
                };
                Returns: {
                    id: string;
                    code: string;
                    name: string;
                    district_code: string;
                }[];
            };
            search_cars_by_location: {
                Args: {
                    location_lat: number;
                    location_lng: number;
                    radius_km: number;
                    start_date: string;
                    end_date: string;
                };
                Returns: {
                    id: string;
                    make: string;
                    model: string;
                    year: number;
                    daily_rate: number;
                    location: Json;
                    distance_km: number;
                }[];
            };
            cancel_booking_by_renter: {
                Args: {
                    p_booking_id: string;
                    p_renter_id: string;
                    p_cancellation_reason: string;
                };
                Returns: {
                    success: boolean;
                    message: string;
                }[];
            };
            get_booking_cancellation_info: {
                Args: {
                    p_booking_id: string;
                };
                Returns: {
                    can_cancel: boolean;
                    fee_amount: number;
                    fee_percentage: number;
                    refund_amount: number;
                }[];
            };
            get_renter_bookings_with_cancellation: {
                Args: {
                    p_renter_id: string;
                };
                Returns: {
                    id: string;
                    car_id: string;
                    start_date: string;
                    end_date: string;
                    status: string;
                    total_amount: number;
                    can_cancel: boolean;
                }[];
            };
        };
        Enums: {
            user_role_type: 'ADMIN' | 'HOST' | 'RENTER';
            verification_type: 'ID_CARD' | 'DRIVERS_LICENSE' | 'PASSPORT' | 'FACE_SCAN';
            verification_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
            transmission_type: 'MANUAL' | 'AUTOMATIC' | 'CVT';
            fuel_type: 'GASOLINE' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';
            car_type_enum: 'sedan' | 'suv' | 'motorcycle' | 'ev';
            car_status: 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
            booking_status:
                | 'PENDING'
                | 'AUTO_APPROVED'
                | 'CONFIRMED'
                | 'IN_PROGRESS'
                | 'COMPLETED'
                | 'CANCELLED'
                | 'DISPUTED';
            insurance_type: 'BASIC' | 'STANDARD' | 'PREMIUM';
            payment_status:
                | 'PENDING'
                | 'PROCESSING'
                | 'COMPLETED'
                | 'FAILED'
                | 'REFUNDED'
                | 'PARTIALLY_REFUNDED';
            payment_type: 'BOOKING' | 'SECURITY_DEPOSIT' | 'EXTRA_CHARGES' | 'REFUND';
            admin_action_type:
                | 'USER_SUSPEND'
                | 'USER_ACTIVATE'
                | 'CAR_APPROVE'
                | 'CAR_SUSPEND'
                | 'DISPUTE_RESOLVE';
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
          DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
          Row: infer R;
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
            DefaultSchema['Views'])
      ? (DefaultSchema['Tables'] &
            DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R;
        }
          ? R
          : never
      : never;

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema['Tables']
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Insert: infer I;
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Insert: infer I;
        }
          ? I
          : never
      : never;

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema['Tables']
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Update: infer U;
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Update: infer U;
        }
          ? U
          : never
      : never;

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
        | keyof DefaultSchema['Enums']
        | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
        : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
      ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
      : never;

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema['CompositeTypes']
        | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
        : never = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
      ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
      : never;

export const Constants = {
    public: {
        Enums: {
            user_role_type: ['ADMIN', 'HOST', 'RENTER'] as const,
            verification_type: ['ID_CARD', 'DRIVERS_LICENSE', 'PASSPORT', 'FACE_SCAN'] as const,
            verification_status: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'] as const,
            transmission_type: ['MANUAL', 'AUTOMATIC', 'CVT'] as const,
            fuel_type: ['GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID'] as const,
            car_type_enum: ['sedan', 'suv', 'motorcycle'] as const,
            car_status: ['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'INACTIVE', 'SUSPENDED'] as const,
            booking_status: [
                'PENDING',
                'AUTO_APPROVED',
                'CONFIRMED',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED',
                'DISPUTED',
            ] as const,
            insurance_type: ['BASIC', 'STANDARD', 'PREMIUM'] as const,
            payment_status: [
                'PENDING',
                'PROCESSING',
                'COMPLETED',
                'FAILED',
                'REFUNDED',
                'PARTIALLY_REFUNDED',
            ] as const,
            payment_type: ['BOOKING', 'SECURITY_DEPOSIT', 'EXTRA_CHARGES', 'REFUND'] as const,
            admin_action_type: [
                'USER_SUSPEND',
                'USER_ACTIVATE',
                'CAR_APPROVE',
                'CAR_SUSPEND',
                'DISPUTE_RESOLVE',
            ] as const,
        },
    },
} as const;
