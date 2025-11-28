# Frontend Integration Guide for Vehicle Availability System

This guide provides implementation instructions for integrating the vehicle availability system into your Next.js/Supabase frontend.

## 🚀 Overview

The availability system provides:

- ✅ Real-time availability checking for renters
- ✅ Airbnb-style calendar management for hosts
- ✅ Admin override capabilities
- ✅ Booking conflict prevention
- ✅ Revenue impact analytics

## 📋 Prerequisites

Ensure you have executed the following SQL files in order:

1. `10-vehicle-availability-system.sql`
2. `11-admin-availability-management.sql`

## 🔧 Implementation Steps

### Step 1: Enhanced Vehicle Search with Availability

Update your search functionality to use the new availability-aware search function.

#### A. Create Availability Service (`lib/availability.ts`)

```typescript
import { createClient } from '@/utils/supabase/client';

export interface AvailabilityCheck {
    is_available: boolean;
    conflict_type: string;
    conflict_details: any;
}

export interface VehicleSearchParams {
    startDate?: Date;
    endDate?: Date;
    location?: string;
    transmission?: string;
    fuelType?: string;
    seats?: number;
    maxPrice?: number;
}

export interface AvailableVehicle {
    car_id: string;
    make: string;
    model: string;
    year: number;
    daily_rate: number;
    location: any;
    features: string[];
    transmission: string;
    fuel_type: string;
    seats: number;
    host_name: string;
    primary_image_url: string;
    availability_status: 'available' | 'unavailable' | 'not_specified';
}

export class AvailabilityService {
    private supabase = createClient();

    async searchAvailableVehicles(
        params: VehicleSearchParams,
    ): Promise<AvailableVehicle[]> {
        const { data, error } = await this.supabase.rpc('search_available_vehicles', {
            p_start_date: params.startDate?.toISOString() || null,
            p_end_date: params.endDate?.toISOString() || null,
            p_location: params.location || null,
            p_filters: {
                transmission: params.transmission || null,
                fuel_type: params.fuelType || null,
                min_seats: params.seats || null,
                max_price: params.maxPrice || null,
            },
        });

        if (error) {
            console.error('Error searching vehicles:', error);
            throw error;
        }

        // Filter to only return available vehicles
        return (data || []).filter(
            (vehicle: AvailableVehicle) =>
                vehicle.availability_status === 'available' ||
                vehicle.availability_status === 'not_specified',
        );
    }

    async checkVehicleAvailability(
        carId: string,
        startDate: Date,
        endDate: Date,
    ): Promise<AvailabilityCheck> {
        const { data, error } = await this.supabase.rpc('check_vehicle_availability', {
            p_car_id: carId,
            p_start_date: startDate.toISOString(),
            p_end_date: endDate.toISOString(),
        });

        if (error) {
            console.error('Error checking availability:', error);
            throw error;
        }

        return data[0];
    }

    async createBookingWithValidation(bookingData: any): Promise<{
        booking_id: string;
        success: boolean;
        error_message?: string;
    }> {
        const { data, error } = await this.supabase.rpc(
            'create_booking_with_validation',
            {
                p_booking_data: bookingData,
            },
        );

        if (error) {
            console.error('Error creating booking:', error);
            throw error;
        }

        return data[0];
    }

    async getVehicleCalendar(carId: string, year: number, month: number) {
        const { data, error } = await this.supabase.rpc('get_vehicle_calendar', {
            p_car_id: carId,
            p_year: year,
            p_month: month,
        });

        if (error) {
            console.error('Error getting vehicle calendar:', error);
            throw error;
        }

        return data;
    }
}

export const availabilityService = new AvailabilityService();
```

#### B. Update Search Page (`app/search/page.tsx`)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { availabilityService, AvailableVehicle, VehicleSearchParams } from '@/lib/availability';

export default function SearchPage() {
  const [vehicles, setVehicles] = useState<AvailableVehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<VehicleSearchParams>({
    startDate: undefined,
    endDate: undefined,
    location: '',
    transmission: '',
    fuelType: '',
    seats: undefined,
    maxPrice: undefined
  });

  const searchVehicles = async () => {
    setLoading(true);
    try {
      const results = await availabilityService.searchAvailableVehicles(filters);
      setVehicles(results);
    } catch (error) {
      console.error('Search failed:', error);
      // Handle error (show toast, etc.)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchVehicles();
  }, [filters]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Search Filters */}
      <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Search Available Vehicles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Picker */}
          <div>
            <label className="block text-sm font-medium mb-2">Start Date</label>
            <input
              type="date"
              value={filters.startDate?.toISOString().split('T')[0] || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                startDate: e.target.value ? new Date(e.target.value) : undefined
              }))}
              className="w-full p-2 border rounded-md"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">End Date</label>
            <input
              type="date"
              value={filters.endDate?.toISOString().split('T')[0] || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                endDate: e.target.value ? new Date(e.target.value) : undefined
              }))}
              className="w-full p-2 border rounded-md"
              min={filters.startDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium mb-2">Location</label>
            <input
              type="text"
              value={filters.location || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Enter city or area"
              className="w-full p-2 border rounded-md"
            />
          </div>

          {/* Max Price */}
          <div>
            <label className="block text-sm font-medium mb-2">Max Daily Rate</label>
            <input
              type="number"
              value={filters.maxPrice || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                maxPrice: e.target.value ? Number(e.target.value) : undefined
              }))}
              placeholder="$100"
              className="w-full p-2 border rounded-md"
            />
          </div>
        </div>

        <button
          onClick={searchVehicles}
          disabled={loading}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search Available Vehicles'}
        </button>

        {/* Availability Notice */}
        {(filters.startDate && filters.endDate) && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700">
              ✅ Showing vehicles available from {filters.startDate.toLocaleDateString()}
              to {filters.endDate.toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map((vehicle) => (
          <VehicleCard key={vehicle.car_id} vehicle={vehicle} />
        ))}
      </div>

      {vehicles.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500">No available vehicles found for your search criteria.</p>
        </div>
      )}
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: AvailableVehicle }) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {vehicle.primary_image_url && (
        <img
          src={vehicle.primary_image_url}
          alt={`${vehicle.make} ${vehicle.model}`}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-4">
        <h3 className="text-lg font-semibold">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </h3>
        <p className="text-gray-600 text-sm">Host: {vehicle.host_name}</p>
        <p className="text-gray-600 text-sm">
          {vehicle.seats} seats • {vehicle.transmission} • {vehicle.fuel_type}
        </p>

        <div className="mt-4 flex justify-between items-center">
          <span className="text-2xl font-bold text-green-600">
            ${vehicle.daily_rate}/day
          </span>
          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
            ✅ Available
          </span>
        </div>

        <button
          onClick={() => window.location.href = `/vehicles/${vehicle.car_id}`}
          className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          View Details & Book
        </button>
      </div>
    </div>
  );
}
```

### Step 2: Enhanced Booking Creation

Update your booking creation logic to use availability validation.

#### Update Vehicle Detail Page (`app/vehicles/[id]/page.tsx`)

```typescript
// Add this to your existing BookingForm component

const handleBooking = async () => {
    if (!user || !vehicle || !startDate || !endDate) return;

    setLoading(true);
    try {
        // Check availability first (optional - the function will do this too)
        const availabilityCheck = await availabilityService.checkVehicleAvailability(
            vehicle.id,
            startDate,
            endDate,
        );

        if (!availabilityCheck.is_available) {
            alert(`Vehicle not available: ${availabilityCheck.conflict_type}`);
            return;
        }

        // Create booking with validation
        const result = await availabilityService.createBookingWithValidation({
            car_id: vehicle.id,
            renter_id: user.id,
            host_id: vehicle.host_id,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            pickup_location: pickupLocation,
            dropoff_location: dropoffLocation,
            insurance_type: selectedInsurance,
            daily_rate: vehicle.daily_rate,
            total_days: totalDays,
            subtotal: totalCost,
            insurance_fee: insuranceFee,
            service_fee: serviceFee,
            delivery_fee: deliveryFee,
            total_amount: grandTotal,
            security_deposit: securityDeposit,
            special_instructions: specialInstructions,
        });

        if (!result.success) {
            alert(`Booking failed: ${result.error_message}`);
            return;
        }

        // Success - redirect to booking page
        router.push(`/bookings/${result.booking_id}`);
    } catch (error) {
        console.error('Booking error:', error);
        alert('An error occurred while creating your booking. Please try again.');
    } finally {
        setLoading(false);
    }
};
```

### Step 3: Host Calendar Management

Create a calendar interface for hosts to manage their vehicle availability.

#### Create Host Calendar Component (`components/HostCalendar.tsx`)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { availabilityService } from '@/lib/availability';

interface CalendarDay {
  date: Date;
  is_available: boolean;
  status: string;
  details: any;
}

interface HostCalendarProps {
  carId: string;
  onAvailabilityChange?: () => void;
}

export default function HostCalendar({ carId, onAvailabilityChange }: HostCalendarProps) {
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const loadCalendar = async () => {
    setLoading(true);
    try {
      const data = await availabilityService.getVehicleCalendar(
        carId,
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1
      );

      const calendarDays = data.map((day: any) => ({
        date: new Date(day.date),
        is_available: day.is_available,
        status: day.status,
        details: day.details
      }));

      setCalendar(calendarDays);
    } catch (error) {
      console.error('Error loading calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendar();
  }, [carId, currentMonth]);

  const blockDates = async (startDate: Date, endDate: Date, reason: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('car_availability')
        .insert({
          car_id: carId,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          is_available: false,
          reason: reason,
          availability_type: 'manual'
        });

      if (error) throw error;

      // Reload calendar
      await loadCalendar();
      onAvailabilityChange?.();

    } catch (error) {
      console.error('Error blocking dates:', error);
      alert('Failed to block dates');
    }
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            ←
          </button>
          <button
            onClick={nextMonth}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            →
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading calendar...</div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center font-medium text-gray-600">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendar.map((day, index) => (
            <CalendarDay
              key={index}
              day={day}
              onBlock={(reason) => blockDates(day.date, day.date, reason)}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-200 rounded"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-200 rounded"></div>
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-200 rounded"></div>
          <span>Blocked</span>
        </div>
      </div>
    </div>
  );
}

function CalendarDay({ day, onBlock }: {
  day: CalendarDay;
  onBlock: (reason: string) => void;
}) {
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  const getColorClass = () => {
    switch (day.status) {
      case 'available': return 'bg-green-200 hover:bg-green-300';
      case 'booked': return 'bg-blue-200';
      case 'blocked': return 'bg-red-200';
      default: return 'bg-gray-100';
    }
  };

  const handleClick = () => {
    if (day.status === 'available') {
      setShowBlockDialog(true);
    }
  };

  const handleBlock = () => {
    if (blockReason.trim()) {
      onBlock(blockReason);
      setShowBlockDialog(false);
      setBlockReason('');
    }
  };

  return (
    <>
      <div
        className={`p-2 text-center cursor-pointer ${getColorClass()}`}
        onClick={handleClick}
      >
        <div className="text-sm">{day.date.getDate()}</div>
        {day.status === 'booked' && (
          <div className="text-xs text-blue-800">
            {day.details?.renter || 'Booked'}
          </div>
        )}
        {day.status === 'blocked' && (
          <div className="text-xs text-red-800">
            {day.details?.reason || 'Blocked'}
          </div>
        )}
      </div>

      {/* Block Dialog */}
      {showBlockDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Block {day.date.toLocaleDateString()}
            </h3>
            <textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Reason for blocking (e.g., maintenance, personal use)"
              className="w-full p-2 border rounded-md mb-4"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowBlockDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleBlock}
                disabled={!blockReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Block Date
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

### Step 4: Admin Dashboard Integration

For admin users, create dashboard components to manage system-wide availability.

#### Create Admin Availability Dashboard (`app/admin/availability/page.tsx`)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

interface AvailabilityMetric {
  metric_name: string;
  metric_value: number;
  metric_details: any;
}

export default function AdminAvailabilityPage() {
  const [metrics, setMetrics] = useState<AvailabilityMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_availability_analytics');

      if (error) throw error;
      setMetrics(data || []);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Availability Management Dashboard</h1>

      {loading ? (
        <div className="text-center py-8">Loading metrics...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric) => (
            <MetricCard key={metric.metric_name} metric={metric} />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({ metric }: { metric: AvailabilityMetric }) {
  const formatValue = (value: number, name: string) => {
    if (name.includes('rate') || name.includes('percentage')) {
      return `${value.toFixed(1)}%`;
    }
    if (name.includes('revenue') || name.includes('amount')) {
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-2 capitalize">
        {metric.metric_name.replace(/_/g, ' ')}
      </h3>
      <div className="text-3xl font-bold text-blue-600 mb-2">
        {formatValue(metric.metric_value, metric.metric_name)}
      </div>
      {metric.metric_details && Object.keys(metric.metric_details).length > 0 && (
        <div className="text-sm text-gray-600">
          {Object.entries(metric.metric_details).map(([key, value]) => (
            <div key={key}>
              {key}: {typeof value === 'number' ? value.toLocaleString() : String(value)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## 🎯 Testing Your Implementation

1. **Database Functions**: Execute both SQL files in your Supabase dashboard
2. **Search Functionality**: Test vehicle search with and without date ranges
3. **Booking Creation**: Attempt to create overlapping bookings (should fail)
4. **Host Calendar**: Test blocking and unblocking dates
5. **Admin Functions**: Test admin override capabilities

## 📊 Performance Considerations

- The new indexes will significantly improve query performance
- Consider implementing Redis caching for frequently accessed availability data
- Use database connection pooling for high-traffic scenarios

## 🔒 Security Notes

- All functions use `SECURITY DEFINER` for proper permission handling
- RLS policies ensure users can only access appropriate data
- Admin functions verify user roles before execution

## 🚀 Next Steps

1. Implement recurring availability patterns for hosts
2. Add email notifications for booking conflicts
3. Create waitlist functionality for unavailable periods
4. Implement dynamic pricing based on availability

This implementation provides a robust, Airbnb-style availability system that prevents double bookings and provides excellent user experience for all user types.
