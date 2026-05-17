/**
 * TravelNest Type Definitions
 * Centralized type definitions for the entire application
 * Aligned with Prisma database schema
 */

// ============================================
// User Types (match Prisma UserRole & UserStatus)
// ============================================
export enum UserRole {
  CUSTOMER = "CUSTOMER",
  VEHICLE_OWNER = "VEHICLE_OWNER",
  ADMIN = "ADMIN",
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SUSPENDED = "SUSPENDED",
  PENDING_VERIFICATION = "PENDING_VERIFICATION",
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatar: string | null;
  nicNumber?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  postalCode?: string | null;
  baseLocation?: string | null;
  // Business fields (for vehicle owners)
  businessName?: string | null;
  businessType?: string | null;
  businessRegNumber?: string | null;
  tinNumber?: string | null;
  registrationNumber?: string | null;
  taxId?: string | null;
  role: UserRole;
  status: UserStatus;
  isVerified: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * Helper to get full name from user
 */
export const getUserFullName = (user: User): string =>
  `${user.firstName} ${user.lastName}`;

/**
 * Helper to check user roles
 */
export const isCustomer = (user: User): boolean =>
  user.role === UserRole.CUSTOMER;
export const isVehicleOwner = (user: User): boolean =>
  user.role === UserRole.VEHICLE_OWNER;
export const isAdmin = (user: User): boolean => user.role === UserRole.ADMIN;

// Vehicle Types
export enum VehicleType {
  ORDINARY = "ORDINARY",
  SEMI_LUXURY = "SEMI_LUXURY",
  LUXURY_AC = "LUXURY_AC",
}

export enum ACType {
  AC = "ac",
  NON_AC = "non_ac",
}

export enum VehicleStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  PENDING_VERIFICATION = "pending_verification",
  UNDER_MAINTENANCE = "under_maintenance",
}

export interface Vehicle {
  id: string;
  ownerId: string;
  name: string;
  licensePlate: string;
  type: VehicleType | string;
  brand: string;
  model: string;
  year: number;
  seats: number;
  doors?: number;
  acType: string; // full-ac, ac, non-ac
  color?: string;
  description?: string;
  fuelType?: string;
  transmission?: string;
  mileage?: number;
  condition?: string; // excellent, good, fair
  pricePerDay: number;
  pricePerHour?: number;
  pricePerKm?: number;
  driverAllowance?: number;
  amenities?: string[];
  features?: any; // JSON field
  images: string[];
  location: string;
  latitude?: number;
  longitude?: number;
  averageRating?: number;
  totalBookings?: number;
  isAvailable: boolean;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  // Extended fields from joins
  owner?: Partial<User>;
  photos?: any[];
  documents?: any[];
  reviews?: any[];
}

// Trip Package Types
export interface TripPackage {
  id: string;
  ownerId: string;
  vehicleId: string;
  title: string;
  description?: string | null;
  startLocation: string;
  endLocation: string;
  durationDays: number;
  price: number;
  minPassengers: number;
  maxPassengers: number;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  vehicle?: Partial<Vehicle>;
  owner?: Partial<User>;
}

// Booking Types
export enum BookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  DISPUTED = "disputed",
}

export enum PaymentStatus {
  PENDING = "pending",
  PARTIAL = "partial",
  PAID = "paid",
  REFUNDED = "refunded",
  FAILED = "failed",
}

export interface Booking {
  id: string;
  customerId: string;
  ownerId: string;
  vehicleId: string;
  quotationId: string;
  bookingReference: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  pickupLocation: Location;
  destination: Location;
  stops: Location[];
  startDate: Date;
  endDate: Date;
  startTime: string;
  passengerCount: number;
  specialRequirements?: string;
  totalAmount: number;
  paidAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Quotation Types
export enum QuotationStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  VIEWED = "VIEWED",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

export interface Quotation {
  id: string;
  quotationId: string;
  customerId: string;
  vehicleId?: string | null;
  vehicleType: string;
  startDate: Date;
  endDate: Date;
  startTime?: string;
  pickupLocation: string;
  dropoffLocation: string;
  passengerCount: number;
  estimatedDistance?: string;
  estimatedDuration?: string;
  specialRequests?: string;
  status: QuotationStatus;
  // Pricing fields (nullable for PENDING status)
  vehicleRentalCost?: number;
  driverCost?: number;
  fuelCost?: number;
  tollCharges?: number;
  permitFees?: number;
  customItems?: Array<{ description: string; amount: number }>;
  subtotal?: number;
  tax?: number;
  totalAmount?: number;
  additionalNotes?: string;
  validityDays?: number;
  validUntil?: Date;
  rejectionReason?: string;
  // Timestamps
  sentAt?: Date;
  viewedAt?: Date;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  customer?: Partial<User>;
  vehicle?: Partial<Vehicle>;
}

// Location Type
export interface Location {
  address: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  district?: string;
}

// Review Types
export interface Review {
  id: string;
  bookingId: string;
  customerId: string;
  ownerId: string;
  vehicleId: string;
  overallRating: number;
  vehicleConditionRating: number;
  driverBehaviorRating: number;
  punctualityRating: number;
  cleanlinessRating: number;
  valueForMoneyRating: number;
  title?: string;
  comment?: string;
  images?: string[];
  recommended: boolean;
  ownerResponse?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Common Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  quotations?: T[];
  vehicles?: T[];
  bookings?: T[];
  users?: T[];
  data?: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Language Type
export type Locale = "en" | "si" | "ta";

// ============================================
// Owner Registration Types
// ============================================
export interface OwnerRegistrationVehicleDocument {
  type: "DRIVING_LICENSE" | "INSURANCE" | "REGISTRATION_CERTIFICATE";
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
}

export interface OwnerRegistrationVehiclePhoto {
  fileName: string;
  fileSize: number;
  mimeType: string;
  isPrimary?: boolean;
  url: string;
}

export interface OwnerRegistrationVehicle {
  registrationNumber: string; // Maps to licensePlate in DB
  vehicleType: "ORDINARY" | "SEMI_LUXURY" | "LUXURY_AC";
  make: string; // Maps to brand in DB
  model: string;
  year: number;
  seatingCapacity: number; // Maps to seats in DB
  acType: "FULL_AC" | "AC" | "NON_AC";
  photos?: OwnerRegistrationVehiclePhoto[];
  documents: OwnerRegistrationVehicleDocument[];
}

export interface OwnerRegistrationDocument {
  type: "NIC" | "PROFILE_PHOTO";
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
}

export interface OwnerRegistrationAddress {
  address: string;
  city: string;
  district: string;
  postalCode?: string;
  baseLocation: string;
}

export interface OwnerRegistrationInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nicNumber: string;
  password: string;
  confirmPassword: string;
  address: OwnerRegistrationAddress;
  ownerDocuments: OwnerRegistrationDocument[];
  vehicles: OwnerRegistrationVehicle[];
}
