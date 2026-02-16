// Re-export HTTP types
export * from "./http.js";

// User types
export type UserRole = "customer" | "owner" | "admin";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile extends Omit<User, "createdAt" | "updatedAt"> {
  fullName: string;
}

// Vehicle types
export type VehicleType = "car" | "van" | "suv" | "bus" | "motorcycle";
export type FuelType = "petrol" | "diesel" | "electric" | "hybrid";
export type TransmissionType = "automatic" | "manual";

export interface Vehicle {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  type: VehicleType;
  brand: string;
  model: string;
  year: number;
  licensePlate: string;
  color?: string;
  seats: number;
  doors?: number;
  fuelType: FuelType;
  transmission: TransmissionType;
  mileage?: number;
  features: string[];
  images: string[];
  pricePerDay: number;
  pricePerHour?: number;
  location: string;
  latitude?: number;
  longitude?: number;
  isAvailable: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleWithOwner extends Vehicle {
  owner: Pick<User, "id" | "firstName" | "lastName" | "phone" | "avatar">;
}

// Booking types
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "ongoing"
  | "completed"
  | "cancelled";

export interface Booking {
  id: string;
  customerId: string;
  vehicleId: string;
  startDate: Date;
  endDate: Date;
  pickupLocation: string;
  dropoffLocation?: string;
  totalAmount: number;
  status: BookingStatus;
  notes?: string;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingWithDetails extends Booking {
  customer: Pick<User, "id" | "firstName" | "lastName" | "email" | "phone">;
  vehicle: Pick<Vehicle, "id" | "name" | "type" | "brand" | "model" | "images">;
}

// Quotation types
export type QuotationStatus =
  | "pending"
  | "responded"
  | "accepted"
  | "rejected"
  | "expired";

export interface Quotation {
  id: string;
  customerId: string;
  vehicleId?: string;
  vehicleType?: VehicleType;
  startDate: Date;
  endDate: Date;
  pickupLocation: string;
  dropoffLocation?: string;
  passengerCount?: number;
  specialRequests?: string;
  status: QuotationStatus;
  quotedPrice?: number;
  ownerMessage?: string;
  validUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Review types
export interface Review {
  id: string;
  customerId: string;
  vehicleId: string;
  bookingId: string;
  rating: number; // 1-5
  comment?: string;
  ownerResponse?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewWithAuthor extends Review {
  customer: Pick<User, "id" | "firstName" | "lastName" | "avatar">;
}

// Payment types
export type PaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "refunded";

export interface Payment {
  id: string;
  userId: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method?: string;
  payherePaymentId?: string; // PayHere order ID
  payhereCustomerId?: string; // PayHere customer reference
  bankReceiptUrl?: string;
  bankReceiptName?: string;
  bankReceiptSize?: number;
  bankReceiptMime?: string;
  bankReceiptAt?: Date;
  refundAmount?: number;
  refundReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Notification types
export type NotificationType =
  | "booking_created"
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_completed"
  | "payment_received"
  | "payment_failed"
  | "quotation_received"
  | "quotation_responded"
  | "review_received"
  | "system";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Search & Filter types
export interface VehicleSearchParams {
  type?: VehicleType;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  seats?: number;
  startDate?: string;
  endDate?: string;
  brand?: string;
  fuelType?: FuelType;
  transmission?: TransmissionType;
  page?: number;
  limit?: number;
  sortBy?: "price" | "rating" | "newest";
  sortOrder?: "asc" | "desc";
}

export interface BookingSearchParams {
  status?: BookingStatus;
  vehicleId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// Driver Information types
export interface DriverInfo {
  name: string;
  phone: string;
  license: string;
}

export interface BookingDriverInfo {
  bookingId: string;
  driverAssigned: boolean;
  driver?: DriverInfo;
  message?: string;
}

// Trip Itinerary types
export interface PickupDropoffPoint {
  location: string;
  time: string;
}

export interface TripItineraryDay {
  id?: string;
  dayNumber: number;
  date: Date | string;
  startLocation: string;
  endLocation: string;
  overnightStop?: string;
  description?: string;
  estimatedKm?: number;
  pickupPoints?: PickupDropoffPoint[];
  dropoffPoints?: PickupDropoffPoint[];
}

export interface TripItinerary {
  bookingId: string;
  tripDays: number;
  startDate: Date | string;
  endDate: Date | string;
  hasItinerary: boolean;
  itinerary: TripItineraryDay[];
}

// Pricing types (Sri Lankan Bus Rental Standards)
export interface PriceRange {
  min: number;
  max: number;
  suggested: number;
  perKm?: number;
  perDay?: number;
}

export interface PricingSuggestions {
  quotationId: string;
  vehicleId: string;
  vehicleType: string;
  tripDetails: {
    estimatedDistanceKm: number;
    tripDays: number;
    startDate: Date | string;
    endDate: Date | string;
  };
  minimumBooking: {
    kilometers: number;
    hours: number;
    meetsMinimum: boolean;
  };
  suggestions: {
    vehicleRentalCost: PriceRange;
    driverCost: PriceRange;
    fuelCost: PriceRange;
  };
  estimatedTotal: number;
}

export interface PricingValidation {
  warnings: string[];
  suggestions: {
    fuelCost?: PriceRange;
    driverCost?: PriceRange;
    vehicleRentalCost?: PriceRange;
  };
}
