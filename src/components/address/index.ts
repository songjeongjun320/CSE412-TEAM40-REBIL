// Indonesian Address Components
export { default as CompactAddressForm } from './CompactAddressForm';
export { default as AddressDisplay, AddressCard, AddressLine } from './AddressDisplay';

// Types
export interface IndonesianAddress {
    street_address: string;
    // Store actual names and codes from Supabase Indonesian address data
    province?: {
        code: string;
        name: string;
    };
    city?: {
        code: string;
        name: string;
    };
    district?: {
        code: string;
        name: string;
    };
    village?: {
        code: string;
        name: string;
    };
    // Legacy UUID fields for backward compatibility
    village_id?: string;
    district_id?: string;
    city_id?: string;
    province_id?: string;
    postal_code?: string;
    additional_info?: string;
    latitude?: number | null;
    longitude?: number | null;
}

export interface Province {
    id: string;
    name: string;
    code: string;
    island_group: string;
    is_special_region: boolean;
}

export interface City {
    id: string;
    name: string;
    type: string;
    is_capital: boolean;
    is_major_city: boolean;
    population?: number;
}

export interface District {
    id: string;
    name: string;
    government_code: string;
}

export interface Village {
    id: string;
    name: string;
    government_code: string;
}
