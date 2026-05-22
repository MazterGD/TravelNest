/**
 * API Services for TraveNest
 * Type-safe service layer for all API interactions
 */

import { api, ApiError } from "./client";
import type {
  User,
  Vehicle,
  Booking,
  Quotation,
  Review,
  TripPackage,
  PaginatedResponse,
  OwnerRegistrationInput,
} from "@/types";
import type {
  LoginInput,
  RegisterInput,
  QuotationRequestInput,
  VehicleInput,
  QuotationResponseInput,
} from "@/lib/validations";

// ============================================
// Type Definitions for API Responses
// ============================================
export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface TokenResponse {
  accessToken: string;
}

export interface MessageResponse {
  message: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface LandingStat {
  id: string;
  key?: string;
  label: string;
  value: string;
  sublabel?: string | null;
}

export interface LandingPopularRoute {
  id: string;
  fromCity: string;
  toCity: string;
  durationHours: number;
  bookingsCount: number;
  avgPrice: number;
  imageUrl: string;
  isPopular: boolean;
}

export interface LandingTestimonial {
  id: string;
  name: string;
  role: string;
  organization: string;
  quote: string;
  tripDetails: string;
  rating: number;
  imageUrl: string;
}

export interface LandingTrustedPartner {
  id: string;
  name: string;
  logoUrl?: string | null;
}

export interface LandingFeaturedVehicle {
  id: string;
  name: string;
  seats: number;
  location: string;
  amenities: string[];
  pricePerDay: number;
  imageUrl: string | null;
  ownerName: string;
  rating: number;
  reviewsCount: number;
}

export interface LandingDataResponse {
  stats: LandingStat[];
  popularRoutes: LandingPopularRoute[];
  testimonials: LandingTestimonial[];
  trustedPartners: LandingTrustedPartner[];
  featuredVehicles: LandingFeaturedVehicle[];
}

export interface LandingPublicOption {
  value: string;
  label: string;
}

export interface LandingAmenityOption {
  id: string;
  label: string;
}

export interface LandingRecentSearch {
  id: string;
  from: string;
  to: string;
  date: string;
  passengers: number;
}

export interface LandingQuotationPricing {
  driverCostPercentage: number;
  fuelCostPerKm: number;
  tollChargesBase: number;
  permitFeesBase: number;
  taxRate: number;
  defaultValidityDays: number;
  validityOptionsDays: number[];
}

export interface LandingPublicConfigResponse {
  contactInfo: {
    address?: string;
    email?: string;
    phone?: string;
    hours?: string;
  };
  socialMediaLinks: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };
  googleMapsEmbed: {
    embedUrl?: string;
    lat?: number;
    lng?: number;
    zoom?: number;
    address?: string;
  };
  aboutStats: Array<{
    label: string;
    value: string;
    icon?: string;
  }>;
  loginMarketingStats: {
    verifiedBuses?: string;
    happyCustomers?: string;
    averageRating?: string;
  };
  faqs: Array<{
    id: string;
    question: string;
    answer: string;
    category?: string | null;
  }>;
  options: {
    vehicleTypes: LandingPublicOption[];
    acTypes: LandingPublicOption[];
    conditions: LandingPublicOption[];
    amenities: LandingAmenityOption[];
    districts: string[];
    quotationVehicleTypes: LandingPublicOption[];
  };
  recentSearches: LandingRecentSearch[];
  quotationPricing: LandingQuotationPricing;
}

export interface RouteEstimateLocation {
  address?: string;
  city: string;
  district: string;
}

export interface RouteEstimateInput {
  pickupLocation: RouteEstimateLocation;
  dropoffLocation: RouteEstimateLocation;
  intermediateStops?: RouteEstimateLocation[];
  isRoundTrip?: boolean;
}

export interface RouteEstimateResponse {
  estimatedDistanceKm: number;
  estimatedDurationMinutes: number;
  displayDistance: string;
  displayDuration: string;
}

export interface ContactFormSubmissionInput {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export interface ContactFormSubmissionResponse {
  accepted: boolean;
  reference: string;
}

export interface LandingAboutStatsResponse {
  stats: Array<{
    label: string;
    value: string;
    icon?: string;
  }>;
}

export interface SendOtpResponse {
  sent: boolean;
  destination: string;
  expiresInSeconds: number;
}

export interface VerifyOtpResponse {
  verified: boolean;
  user?: User;
  accessToken?: string;
}

export const landingContentService = {
  getLandingData: () => api.get<LandingDataResponse>("/landing"),

  getPublicConfig: () =>
    api.get<LandingPublicConfigResponse>("/landing/config"),

  getAboutStats: () =>
    api.get<LandingAboutStatsResponse>("/landing/about-stats"),

  submitContactForm: (data: ContactFormSubmissionInput) =>
    api.post<ContactFormSubmissionResponse>("/landing/contact", data, {
      skipAuth: true,
    }),

  getRouteEstimate: (data: RouteEstimateInput) =>
    api.post<RouteEstimateResponse>("/landing/route-estimate", data, {
      skipAuth: true,
    }),
};

// ============================================
// Auth Services
// ============================================
export const authService = {
  /**
   * Login with email and password
   * @throws {ApiError} On invalid credentials or server error
   */
  login: (data: LoginInput) =>
    api.post<AuthResponse>("/auth/login", data, { skipAuth: true }),

  sendOtp: (data: {
    identifier: string;
    purpose: "LOGIN" | "REGISTRATION" | "PHONE_VERIFICATION";
  }) => api.post<SendOtpResponse>("/auth/otp/send", data, { skipAuth: true }),

  verifyOtp: (data: {
    identifier: string;
    code: string;
    purpose: "LOGIN" | "REGISTRATION" | "PHONE_VERIFICATION";
  }) =>
    api.post<VerifyOtpResponse>("/auth/otp/verify", data, { skipAuth: true }),

  /**
   * Register a new user
   * @throws {ApiError} On validation error or email already exists
   */
  register: (data: RegisterInput) =>
    api.post<AuthResponse>("/auth/register", data, { skipAuth: true }),

  /**
   * Logout current user
   */
  logout: () => api.post<MessageResponse>("/auth/logout"),

  /**
   * Get current authenticated user
   * @throws {ApiError} 401 if not authenticated
   */
  me: () => api.get<{ user: User }>("/auth/me"),

  /**
   * Refresh access token (uses HTTP-only cookie)
   */
  refreshToken: () =>
    api.post<TokenResponse>("/auth/refresh-token", undefined, {
      skipAuth: true,
    }),

  /**
   * Request password reset email
   */
  forgotPassword: (email: string) =>
    api.post<MessageResponse>(
      "/auth/forgot-password",
      { email },
      { skipAuth: true },
    ),

  /**
   * Reset password with token
   */
  resetPassword: (token: string, password: string) =>
    api.post<MessageResponse>(
      "/auth/reset-password",
      { token, password },
      { skipAuth: true },
    ),

  /**
   * Change password for authenticated user
   */
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put<MessageResponse>("/auth/change-password", {
      currentPassword,
      newPassword,
    }),
};

// ============================================
// User Services
// ============================================
export const userService = {
  /**
   * Get current user's profile
   */
  getProfile: () => api.get<User>("/users/profile"),

  /**
   * Update personal information
   */
  updatePersonalInfo: (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    nicNumber?: string;
  }) => api.patch<User>("/users/profile/personal", data),

  /**
   * Update address information
   */
  updateAddress: (data: {
    address?: string;
    city?: string;
    district?: string;
    postalCode?: string;
  }) => api.patch<User>("/users/profile/address", data),

  /**
   * Change password
   */
  changePassword: (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => api.post<{ message: string }>("/users/change-password", data),

  /**
   * Upload avatar image
   */
  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append("avatar", file);
    return api.upload<{ url: string }>("/users/avatar", formData);
  },

  /**
   * Get user by ID (admin only)
   */
  getById: (id: string) => api.get<User>(`/users/${id}`),

  /**
   * Delete user account
   */
  deleteAccount: () => api.delete<{ message: string }>("/users/account"),

  /**
   * Get customer dashboard statistics
   */
  getDashboardStats: () =>
    api.get<{
      totalBookings: number;
      completedBookings: number;
      pendingBookings: number;
      pendingQuotations: number;
      totalReviews: number;
      totalSpent: number;
    }>("/users/dashboard/stats"),
};

// ============================================
// Vehicle Services
// ============================================
export interface VehicleSearchParams extends PaginationParams {
  type?: string;
  location?: string;
  district?: string;
  acType?: string;
  minPrice?: number;
  maxPrice?: number;
  minSeats?: number;
  maxSeats?: number;
  amenities?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: "price" | "rating" | "capacity" | "newest";
  sortOrder?: "asc" | "desc";
}

const buildQueryString = <T extends object>(params: T): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
};

export const vehicleService = {
  /**
   * Get all vehicles with filtering and pagination
   */
  getAll: (params?: VehicleSearchParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<PaginatedResponse<Vehicle>>(`/vehicles${query}`);
  },

  /**
   * Get vehicle by ID
   */
  getById: (id: string) => api.get<Vehicle>(`/vehicles/${id}`),

  /**
   * Create a new vehicle (owner only)
   */
  create: (data: VehicleInput) => api.post<Vehicle>("/vehicles", data),

  /**
   * Update a vehicle (owner only)
   */
  update: (id: string, data: Partial<VehicleInput>) =>
    api.patch<Vehicle>(`/vehicles/${id}`, data),

  /**
   * Delete a vehicle (owner only)
   */
  delete: (id: string) => api.delete<MessageResponse>(`/vehicles/${id}`),

  /**
   * Get vehicles by owner ID
   */
  getByOwner: (ownerId: string) =>
    api.get<Vehicle[]>(`/vehicles/owner/${ownerId}`),

  /**
   * Get current user's vehicles
   */
  getMyVehicles: () => api.get<{ vehicles: Vehicle[] }>("/vehicles/my"),

  /**
   * Set vehicle availability
   */
  setAvailability: (id: string, available: boolean) =>
    api.patch<Vehicle>(`/vehicles/${id}/availability`, { available }),

  /**
   * Toggle vehicle active status (isActive)
   */
  toggleStatus: (id: string, isActive: boolean) =>
    api.patch<{ vehicle: Vehicle }>(`/vehicles/${id}/status`, { isActive }),

  /**
   * Get vehicle availability for date range
   */
  getAvailability: (id: string, month?: string) => {
    const query = month ? `?month=${month}` : "";
    return api.get<{
      month: string;
      blocked: Array<{
        id: string;
        startDate: string;
        endDate: string;
        reason?: string | null;
      }>;
      booked: Array<{
        id: string;
        startDate: string;
        endDate: string;
        status: string;
      }>;
    }>(`/vehicles/${id}/availability${query}`);
  },

  getSimilarVehicles: (id: string, limit = 4) =>
    api.get<{ vehicles: Vehicle[] }>(`/vehicles/${id}/similar?limit=${limit}`),

  /**
   * Upload vehicle photos
   */
  uploadPhotos: async (
    id: string,
    photos: Array<{
      file: File;
      isPrimary?: boolean;
    }>,
  ) => {
    const uploads = await Promise.all(
      photos.map((photo) =>
        storageService.uploadRegistrationFile(photo.file, "vehicle-photos"),
      ),
    );

    const payload = {
      photos: uploads.map((upload, index) => ({
        url: upload.url,
        fileName: photos[index].file.name,
        fileSize: photos[index].file.size,
        mimeType: photos[index].file.type,
        isPrimary: photos[index].isPrimary ?? index === 0,
      })),
    };

    return api.post<{ photos: any[] }>(
      `/vehicles/${id}/photos/metadata`,
      payload,
    );
  },

  /**
   * Upload vehicle documents
   */
  uploadDocuments: async (
    id: string,
    documents: Array<{
      file: File;
      type: string;
    }>,
  ) => {
    const uploads = await Promise.all(
      documents.map((doc) =>
        storageService.uploadRegistrationFile(
          doc.file,
          "vehicle-documents",
          doc.type,
        ),
      ),
    );

    const payload = {
      documents: uploads.map((upload, index) => ({
        type: documents[index].type,
        url: upload.url,
        fileName: documents[index].file.name,
        fileSize: documents[index].file.size,
        mimeType: documents[index].file.type,
      })),
    };

    return api.post<{ documents: any[] }>(
      `/vehicles/${id}/documents/metadata`,
      payload,
    );
  },

  /**
   * Upload vehicle images (deprecated - use uploadPhotos)
   */
  uploadImages: async (id: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));
    return api.upload<{ urls: string[] }>(`/vehicles/${id}/images`, formData);
  },
};

// ============================================
// Trip Package Services
// ============================================
export interface TripPackageSearchParams extends PaginationParams {
  startLocation?: string;
  endLocation?: string;
  minPassengers?: number;
  maxPassengers?: number;
  durationDays?: number;
  minPrice?: number;
  maxPrice?: number;
  vehicleType?: string;
  ownerId?: string;
  search?: string;
  isActive?: boolean;
  sortBy?: "price" | "duration" | "newest";
  sortOrder?: "asc" | "desc";
}

export interface TripPackageInput {
  vehicleId: string;
  title: string;
  description?: string;
  startLocation: string;
  endLocation: string;
  durationDays: number;
  price: number;
  minPassengers: number;
  maxPassengers: number;
  isActive?: boolean;
}

export interface TripPackageUpdateInput extends Partial<TripPackageInput> {}

export const tripPackageService = {
  getAll: (params?: TripPackageSearchParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<{
      packages: TripPackage[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/packages${query}`);
  },

  getById: (id: string) =>
    api.get<{ tripPackage: TripPackage }>(`/packages/${id}`),

  getMyPackages: () =>
    api.get<{ packages: TripPackage[] }>("/packages/owner/my"),

  create: (data: TripPackageInput) =>
    api.post<{ tripPackage: TripPackage }>("/packages", data),

  update: (id: string, data: TripPackageUpdateInput) =>
    api.patch<{ tripPackage: TripPackage }>(`/packages/${id}`, data),

  delete: (id: string) => api.delete<MessageResponse>(`/packages/${id}`),

  book: (
    id: string,
    data: { startDate: string; passengerCount: number; notes?: string },
  ) => api.post<{ booking: Booking }>(`/packages/${id}/book`, data),
};

// ============================================
// Quotation Services
// ============================================
export interface OwnerQuotationRequestParams extends PaginationParams {
  status?: string;
  startDate?: string;
  endDate?: string;
  vehicleType?: string;
  passengerMin?: number;
  passengerMax?: number;
  sortBy?:
    | "newest"
    | "oldest"
    | "tripDate"
    | "passengersHigh"
    | "passengersLow";
}

export const quotationService = {
  // Customer endpoints
  /**
   * Request a quotation for a trip
   */
  requestQuotation: (data: QuotationRequestInput) =>
    api.post<{
      success: boolean;
      message: string;
      data: { quotation: Quotation };
    }>("/quotations", data),

  /**
   * Get all quotation requests by current user
   */
  getMyRequests: (params?: PaginationParams & { status?: string }) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<{
      success: boolean;
      data: PaginatedResponse<Quotation>;
    }>(`/quotations/my-requests${query}`);
  },

  /**
   * Get quotation by ID
   */
  getById: (id: string) =>
    api.get<{ quotation: Quotation }>(`/quotations/${id}`),

  /**
   * Respond to a quotation (accept/reject)
   */
  respondToQuotation: (
    id: string,
    data: { status: "ACCEPTED" | "REJECTED"; rejectionReason?: string },
  ) =>
    api.patch<{
      success: boolean;
      message: string;
      data: { quotation: Quotation };
    }>(`/quotations/${id}/respond`, data),

  // Owner endpoints
  /**
   * Get pending quotation requests for owner
   */
  getOwnerRequests: (params?: OwnerQuotationRequestParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<{
      quotations: Quotation[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/quotations/owner/requests${query}`);
  },

  /**
   * Get sent quotations by owner
   */
  getOwnerSentQuotations: (params?: PaginationParams & { status?: string }) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<{
      quotations: Quotation[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/quotations/owner/sent${query}`);
  },

  /**
   * Send quotation (owner responds to request)
   */
  sendQuotation: (id: string, data: QuotationResponseInput) =>
    api.patch<{ quotation: Quotation }>(`/quotations/${id}/send`, data),

  // Admin endpoints
  /**
   * Get all quotations (admin only)
   */
  getAllQuotations: (params?: PaginationParams & { status?: string }) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<{
      success: boolean;
      data: PaginatedResponse<Quotation>;
    }>(`/quotations/admin/all${query}`);
  },

  /**
   * Withdraw a submitted quote
   */
  withdrawQuote: (id: string) =>
    api.post<MessageResponse>(`/quotations/${id}/withdraw`),
};

// ============================================
// Booking Services
// ============================================
export interface BookingSearchParams extends PaginationParams {
  status?: string;
  startDate?: string;
  endDate?: string;
  vehicleId?: string;
  vehicleType?: string;
  sort?: string;
}

export const bookingService = {
  /**
   * Get all bookings with filtering (admin)
   */
  getAll: (params?: BookingSearchParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<PaginatedResponse<Booking>>(`/bookings${query}`);
  },

  /**
   * Get booking by ID
   */
  getById: (id: string) => api.get<{ booking: Booking }>(`/bookings/${id}`),

  /**
   * Create booking from accepted quotation
   */
  createFromQuotation: (quotationId: string) =>
    api.post<Booking>("/bookings/from-quotation", { quotationId }),

  /**
   * Get current user's bookings as customer
   */
  getMyBookings: (params?: BookingSearchParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<Booking[]>(`/bookings/my-bookings${query}`);
  },

  /**
   * Cancel a booking
   */
  cancel: (id: string, reason: string) =>
    api.patch<Booking>(`/bookings/${id}/cancel`, { reason }),

  /**
   * Mark booking as complete
   */
  complete: (id: string) => api.post<Booking>(`/bookings/${id}/complete`),

  // Owner endpoints
  /**
   * Get bookings for owner's vehicles
   */
  getOwnerBookings: (params?: BookingSearchParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<Booking[]>(`/bookings/owner/vehicle-bookings${query}`);
  },

  /**
   * Confirm a booking
   */
  confirmBooking: (id: string) => api.patch<Booking>(`/bookings/${id}/confirm`),

  /**
   * Start a trip
   */
  startTrip: (id: string) => api.post<Booking>(`/bookings/${id}/start`),

  /**
   * End a trip
   */
  endTrip: (id: string) => api.post<Booking>(`/bookings/${id}/end`),
};

// ── Shared review dimension shape ─────────────────────────────────────────────
export interface ReviewDimensions {
  vehicleCondition?: number | null;
  driverBehavior?: number | null;
  punctuality?: number | null;
  cleanliness?: number | null;
  valueForMoney?: number | null;
}

export interface ReviewDimensionInput {
  ratingVehicleCondition?: number | null;
  ratingDriverBehavior?: number | null;
  ratingPunctuality?: number | null;
  ratingCleanliness?: number | null;
  ratingValueForMoney?: number | null;
}

export interface ReviewCreateInput {
  bookingId: string;
  vehicleId: string;
  rating: number;
  title?: string;
  comment?: string;
  isRecommended?: boolean;
  dimensions?: ReviewDimensionInput;
}

// ============================================
// Review Services
// ============================================
export const reviewService = {
  /**
   * Create a review for a completed booking (supports 6-dimension sub-ratings)
   */
  create: (data: ReviewCreateInput) => api.post<Review>("/reviews", data),

  /**
   * Get reviews for a vehicle (includes per-dimension averages)
   */
  getByVehicle: (vehicleId: string, params?: PaginationParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<{
      reviews: Array<{
        id: string;
        rating: number;
        dimensions: ReviewDimensions | null;
        title: string | null;
        comment: string | null;
        isRecommended: boolean | null;
        customerName: string;
        customerAvatar: string | null;
        ownerResponse: string | null;
        createdAt: string;
      }>;
      stats: {
        averageRating: number;
        totalReviews: number;
        ratingDistribution: Record<number, number>;
        dimensionAverages: ReviewDimensions;
      };
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/reviews/vehicle/${vehicleId}${query}`);
  },

  /**
   * Get reviews by current customer (includes 6-dimension fields)
   */
  getMyReviews: (params?: PaginationParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<{
      reviews: Array<{
        id: string;
        rating: number;
        dimensions: ReviewDimensions | null;
        title: string | null;
        comment: string | null;
        isRecommended: boolean | null;
        createdAt: string;
        vehicleName: string;
        ownerName: string;
        ownerResponse: string | null;
        ownerResponseDate: string | null;
        tripDate: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/reviews/my-reviews${query}`);
  },

  /**
   * Get bookings pending review
   */
  getPendingReviews: (params?: PaginationParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<{
      pendingReviews: Array<{
        bookingId: string;
        vehicleId: string;
        vehicleName: string;
        ownerName: string;
        tripDate: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/reviews/pending${query}`);
  },

  /**
   * Get reviews received by the authenticated owner
   */
  getByOwner: (
    _ownerId: string,
    params?: PaginationParams & { hasResponse?: boolean },
  ) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<{
      reviews: Array<{
        id: string;
        rating: number;
        dimensions: ReviewDimensions | null;
        title: string | null;
        comment: string | null;
        isRecommended: boolean | null;
        ownerResponse: string | null;
        createdAt: string;
        tripDate: string;
        customerName: string;
        customerAvatar: string | null;
        vehicleId: string;
        vehicleName: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/reviews/owner/list${query}`);
  },

  /**
   * Update a review (supports 6-dimension sub-ratings)
   */
  update: (id: string, data: Partial<ReviewCreateInput>) =>
    api.put<Review>(`/reviews/${id}`, data),

  /**
   * Delete a review
   */
  delete: (id: string) => api.delete<MessageResponse>(`/reviews/${id}`),

  /**
   * Owner responds to a review
   */
  respond: (id: string, response: string) =>
    api.post<Review>(`/reviews/${id}/response`, { response }),
};

// ============================================
// Payment Services
// ============================================
export interface PaymentIntent {
  payment: {
    id: string;
    bookingId?: string;
    status: string;
    amount: number;
    currency: string;
    method: string | null;
    receipt?: {
      url?: string | null;
      name?: string | null;
      size?: number | null;
      mime?: string | null;
      uploadedAt?: string | Date | null;
    } | null;
  };
  payhere?: {
    actionUrl: string;
    payload: Record<string, string>;
  };
}

export const paymentService = {
  /**
   * Create a payment intent for a booking
   */
  createPaymentIntent: (
    bookingId: string,
    method: "CARD" | "BANK_TRANSFER" | "CASH",
    amount?: number,
  ) =>
    api.post<PaymentIntent>(`/payments/create-intent`, {
      bookingId,
      method,
      amount,
    }),

  /**
   * Confirm payment completion
   */
  confirmPayment: (paymentId: string) =>
    api.post<{ payment: { id: string; status: string } }>(`/payments/confirm`, {
      paymentId,
    }),

  /**
   * Get payment by ID
   */
  getPaymentById: (paymentId: string) =>
    api.get<{
      payment: {
        id: string;
        bookingId: string;
        status: string;
        amount: number;
        currency: string;
        method: string | null;
        receipt?: {
          url?: string | null;
          name?: string | null;
          size?: number | null;
          mime?: string | null;
          uploadedAt?: string | Date | null;
        } | null;
      };
    }>(`/payments/${paymentId}`),

  /**
   * Get payment history for current user
   */
  getMyPayments: (params?: PaginationParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<{
      payments: Array<{
        id: string;
        amount: number;
        status: string;
        currency: string;
        method: string | null;
        createdAt: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/payments/my-payments${query}`);
  },

  /**
   * Request a refund
   */
  requestRefund: (paymentId: string, reason: string, amount?: number) =>
    api.post<MessageResponse>(`/payments/${paymentId}/refund`, {
      reason,
      amount,
    }),

  /**
   * Fetch bank transfer details
   */
  getBankDetails: () =>
    api.get<{
      bankDetails: {
        bankName: string;
        accountName: string;
        accountNumber: string;
        branch: string;
        referenceHint: string;
      };
    }>("/payments/bank-details"),

  /**
   * Upload bank transfer receipt
   */
  uploadReceipt: (paymentId: string, file: File) => {
    const formData = new FormData();
    formData.append("receipt", file);
    return api.upload<{ payment: { id: string; status: string } }>(
      `/payments/${paymentId}/receipt`,
      formData,
    );
  },
};

// ============================================
// Notification Services
// ============================================
export type NotificationCategory =
  | "Bookings"
  | "Payments"
  | "Quotations"
  | "Reviews"
  | "System";

export interface Notification {
  id: string;
  type: string;
  category: NotificationCategory;
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface NotificationQueryParams extends PaginationParams {
  unreadOnly?: boolean;
  category?: NotificationCategory;
}

export const notificationService = {
  /**
   * Get notifications for current user
   */
  getAll: (params?: NotificationQueryParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<NotificationListResponse>(`/notifications${query}`);
  },

  /**
   * Mark notification as read
   */
  markAsRead: (id: string) =>
    api.patch<Notification>(`/notifications/${id}/read`),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: () => api.patch<{ count: number }>("/notifications/read-all"),

  /**
   * Get unread count
   */
  getUnreadCount: () =>
    api.get<{ unreadCount: number }>("/notifications/unread-count"),

  /**
   * Delete a notification
   */
  delete: (id: string) => api.delete<MessageResponse>(`/notifications/${id}`),

  /**
   * Delete all notifications (bulk clear)
   */
  deleteAll: () => api.delete<{ count: number }>("/notifications"),
};

// ============================================
// Message / Chat Services
// ============================================
export type ConversationCounterpartRole = "CUSTOMER" | "VEHICLE_OWNER";

export interface ConversationSummary {
  id: string;
  bookingId: string;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
  } | null;
  counterpart: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    role: ConversationCounterpartRole;
  };
  booking: {
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    pickupLocation: string;
    dropoffLocation: string | null;
    vehicle: {
      id: string;
      name: string;
      type: string;
    };
  };
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
  // Client-only: set on optimistic messages awaiting server confirmation.
  // The API never returns this field.
  pending?: boolean;
}

export interface ConversationListResponse {
  conversations: ConversationSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MessagesListResponse {
  messages: ChatMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const messageService = {
  listConversations: (params?: PaginationParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<ConversationListResponse>(`/messages/conversations${query}`);
  },

  getConversation: (id: string) =>
    api.get<{ conversation: ConversationSummary }>(
      `/messages/conversations/${id}`,
    ),

  openConversation: (bookingId: string) =>
    api.post<{ conversation: ConversationSummary }>("/messages/conversations", {
      bookingId,
    }),

  listMessages: (conversationId: string, params?: PaginationParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<MessagesListResponse>(
      `/messages/conversations/${conversationId}/messages${query}`,
    );
  },

  sendMessage: (conversationId: string, content: string) =>
    api.post<{ message: ChatMessage }>(
      `/messages/conversations/${conversationId}/messages`,
      { content },
    ),

  markRead: (conversationId: string) =>
    api.patch<{ count: number }>(
      `/messages/conversations/${conversationId}/read`,
    ),

  getUnreadCount: () =>
    api.get<{ unreadCount: number }>("/messages/unread-count"),
};

// ============================================
// Search Services
// ============================================
export interface SearchParams {
  pickup: string;
  dropoff: string;
  date: string;
  passengers: number;
  vehicleType?: string;
}

export const searchService = {
  /**
   * Search for available vehicles
   */
  searchVehicles: (params: SearchParams) => {
    const query = buildQueryString(params);
    return api.get<Vehicle[]>(`/search/vehicles?${query}`);
  },

  /**
   * Get popular routes
   */
  getPopularRoutes: () =>
    api.get<Array<{ from: string; to: string; count: number }>>(
      "/search/popular-routes",
    ),

  /**
   * Get search suggestions
   */
  getSuggestions: (query: string) =>
    api.get<string[]>(`/search/suggestions?q=${encodeURIComponent(query)}`),
};

// ============================================
// Admin Services
// ============================================
const ADMIN_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

const getStoredAuthToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = localStorage.getItem("travenest-auth");
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
};

const downloadAdminCsv = async (
  endpoint: string,
  filename: string,
  init?: {
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    body?: string;
  },
) => {
  const token = getStoredAuthToken();
  const response = await fetch(`${ADMIN_API_BASE_URL}${endpoint}`, {
    method: init?.method ?? "GET",
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(init?.body ? { body: init.body } : {}),
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      "Failed to export CSV",
      "CSV_EXPORT_FAILED",
    );
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
};

export interface AdminDashboardOverview {
  users: {
    total: number;
    active: number;
    owners: number;
    verifiedOwners: number;
    ownerVerificationRate: number;
  };
  vehicles: {
    total: number;
    active: number;
  };
  bookings: {
    total: number;
    pending: number;
    completed: number;
    completionRate: number;
  };
  finance: {
    totalRevenue: number;
    successfulPaymentCount: number;
    failedPaymentCount: number;
  };
}

export interface AdminRevenueChartPoint {
  month: string;
  key: string;
  revenue: number;
  bookings: number;
}

export interface AdminUserGrowthChartPoint {
  month: string;
  key: string;
  total: number;
  customers: number;
  owners: number;
  admins: number;
}

export interface AdminBookingTrendPoint {
  month: string;
  key: string;
  total: number;
  pending: number;
  confirmed: number;
  ongoing: number;
  completed: number;
  cancelled: number;
}

export interface AdminActivityEvent {
  id: string;
  type: "booking" | "user" | "audit";
  title: string;
  description: string;
  timestamp: string;
  status?: string;
}

export interface AdminPendingAction {
  id: string;
  title: string;
  count: number;
  href: string;
  severity: "low" | "medium" | "high";
}

export interface AdminUsersQuery extends PaginationParams {
  search?: string;
  role?: "CUSTOMER" | "VEHICLE_OWNER" | "ADMIN";
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
  adminRole?: "SUPER_ADMIN" | "MODERATOR" | "FINANCE_ADMIN" | "SUPPORT_ADMIN";
}

export interface AdminManagedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: "CUSTOMER" | "VEHICLE_OWNER" | "ADMIN";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
  adminRole:
    | "SUPER_ADMIN"
    | "MODERATOR"
    | "FINANCE_ADMIN"
    | "SUPPORT_ADMIN"
    | null;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    bookings: number;
    reviews: number;
  };
}

export interface AdminUsersResponse {
  users: AdminManagedUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminUserActivityResponse {
  logs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    status: string;
    createdAt: string;
    changes?: Record<string, unknown>;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminCreateInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  adminRole: "SUPER_ADMIN" | "MODERATOR" | "FINANCE_ADMIN" | "SUPPORT_ADMIN";
  permissions?: string[];
}

export interface AdminBookingRecord {
  id: string;
  customerId: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  pickupLocation: string;
  dropoffLocation: string | null;
  totalPassengers: number | null;
  totalAmount: number;
  status: "PENDING" | "CONFIRMED" | "ONGOING" | "COMPLETED" | "CANCELLED";
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  vehicle: {
    id: string;
    name: string;
    licensePlate: string;
    type: string;
    owner: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  payment: {
    id: string;
    amount: number;
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED";
    method: string | null;
    refundAmount: number | null;
    createdAt: string;
  } | null;
}

export interface AdminBookingsResponse {
  bookings: AdminBookingRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminBookingsQuery extends PaginationParams {
  search?: string;
  status?: "PENDING" | "CONFIRMED" | "ONGOING" | "COMPLETED" | "CANCELLED";
  paymentStatus?:
    | "PENDING"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"
    | "REFUNDED";
  startDateFrom?: string;
  startDateTo?: string;
}

export interface AdminAnalyticsDateQuery {
  startDate?: string;
  endDate?: string;
}

export interface AdminUsersAnalytics {
  dateRange: { startDate: string; endDate: string };
  totalUsers: number;
  newUsersInRange: number;
  roleDistribution: Array<{ role: string; count: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
  growthSeries: Array<{ date: string; value: number }>;
}

export interface AdminBookingsAnalytics {
  dateRange: { startDate: string; endDate: string };
  totalBookingsInRange: number;
  completionRate: number;
  cancellationRate: number;
  averageBookingValue: number;
  grossBookingValue: number;
  statusDistribution: Array<{ status: string; count: number }>;
  bookingTrend: Array<{ date: string; value: number }>;
  completedTrend: Array<{ date: string; value: number }>;
}

export interface AdminFinancialAnalytics {
  dateRange: { startDate: string; endDate: string };
  grossRevenue: number;
  completedRevenue: number;
  netRevenue: number;
  refundedAmount: number;
  estimatedCommission: number;
  paymentStatusDistribution: Array<{
    status: string;
    count: number;
    totalAmount: number;
    totalRefund: number;
  }>;
  completedTrend: Array<{ date: string; value: number }>;
  refundedTrend: Array<{ date: string; value: number }>;
}

export interface AdminOperationalAnalytics {
  dateRange: { startDate: string; endDate: string };
  pendingOwnerVerifications: number;
  pendingOwnerDocuments: number;
  pendingVehicleDocuments: number;
  pendingVerificationItems: number;
  auditEventsInRange: number;
  averagePaymentResolutionHours: number;
}

export interface AdminGeographicAnalytics {
  dateRange: { startDate: string; endDate: string };
  bookingsByPickupCity: Array<{
    city: string;
    bookingCount: number;
    totalAmount: number;
  }>;
  usersByDistrict: Array<{
    district: string;
    count: number;
  }>;
  topRoutes: Array<{
    route: string;
    count: number;
  }>;
}

export type AdminVerificationDocumentStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED";
export type AdminOwnerVerificationStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "PENDING_VERIFICATION";
export type AdminReviewModerationStatus = "ACTIVE" | "HIDDEN" | "DELETED";
export type AdminReviewReportResolutionStatus = "RESOLVED" | "DISMISSED";

export interface AdminVerificationDocumentSummary {
  pending: number;
  verified: number;
  rejected: number;
  latestDocumentAt: string | null;
}

export interface AdminOwnerVerificationQuery extends PaginationParams {
  search?: string;
  status?: AdminOwnerVerificationStatus;
  documentStatus?: AdminVerificationDocumentStatus;
}

export interface AdminVehicleVerificationQuery extends PaginationParams {
  search?: string;
  documentStatus?: AdminVerificationDocumentStatus;
}

export interface AdminReviewModerationQuery extends PaginationParams {
  search?: string;
  status?: AdminReviewModerationStatus;
  flaggedOnly?: boolean;
}

export interface AdminOwnerDocument {
  id: string;
  type: string;
  status: AdminVerificationDocumentStatus;
  createdAt: string;
  updatedAt: string;
  url: string;
  fileName: string;
  rejectionReason: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

export interface AdminVehicleDocument {
  id: string;
  type: string;
  status: AdminVerificationDocumentStatus;
  createdAt: string;
  updatedAt: string;
  url: string;
  fileName: string;
  rejectionReason: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

export interface AdminOwnerVerificationItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  nicNumber: string | null;
  status: AdminOwnerVerificationStatus;
  isVerified: boolean;
  createdAt: string;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  documents: AdminOwnerDocument[];
  documentSummary: AdminVerificationDocumentSummary;
  _count: {
    vehicles: number;
    documents: number;
  };
}

export interface AdminOwnerVerificationDetails {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  nicNumber: string | null;
  avatar: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  postalCode: string | null;
  baseLocation: string | null;
  status: AdminOwnerVerificationStatus;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  documents: AdminOwnerDocument[];
  vehicles: Array<{
    id: string;
    name: string;
    licensePlate: string;
    brand: string;
    model: string;
    isActive: boolean;
    createdAt: string;
    documents: Array<{
      id: string;
      status: AdminVerificationDocumentStatus;
      type: string;
    }>;
  }>;
  documentSummary: AdminVerificationDocumentSummary;
}

export interface AdminOwnerVerificationResponse {
  items: AdminOwnerVerificationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminVehicleVerificationItem {
  id: string;
  ownerId: string;
  name: string;
  brand: string;
  model: string;
  licensePlate: string;
  type: string;
  isActive: boolean;
  isAvailable: boolean;
  location: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
    isVerified: boolean;
  };
  documents: AdminVehicleDocument[];
  documentSummary: AdminVerificationDocumentSummary;
  verificationState: "PENDING" | "REJECTED" | "VERIFIED" | "MISSING_DOCUMENTS";
  _count: {
    bookings: number;
    documents: number;
  };
}

export interface AdminVehicleVerificationDetails {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  brand: string;
  model: string;
  year: number;
  licensePlate: string;
  type: string;
  seats: number;
  location: string;
  isActive: boolean;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    status: string;
    isVerified: boolean;
    verifiedAt: string | null;
  };
  documents: AdminVehicleDocument[];
  photos: Array<{
    id: string;
    url: string;
    sortOrder: number;
    isPrimary: boolean;
    createdAt: string;
  }>;
  _count: {
    bookings: number;
    reviews: number;
  };
  documentSummary: AdminVerificationDocumentSummary;
}

export interface AdminVehicleVerificationResponse {
  items: AdminVehicleVerificationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminVerificationHistoryLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  status: string;
  createdAt: string;
  changes: Record<string, unknown> | null;
  admin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    adminRole: string | null;
  };
}

export interface AdminVerificationHistoryResponse {
  logs: AdminVerificationHistoryLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminReviewModerationItem {
  id: string;
  rating: number;
  comment: string | null;
  ownerResponse: string | null;
  createdAt: string;
  updatedAt: string;
  moderationStatus: AdminReviewModerationStatus;
  isFlagged: boolean;
  flaggedByKeyword: boolean;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  vehicle: {
    id: string;
    name: string;
    licensePlate: string;
    owner: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  booking: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    pickupLocation?: string;
    dropoffLocation?: string | null;
    totalAmount?: number;
  };
}

export interface AdminReviewModerationResponse {
  reviews: AdminReviewModerationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminReviewModerationDetails extends AdminReviewModerationItem {
  moderationHistory: AdminVerificationHistoryLog[];
}

export interface AdminReviewModerationUpdateResponse {
  id: string;
  moderationStatus: AdminReviewModerationStatus;
  updated: boolean;
}

export interface AdminReviewReportResolutionResponse {
  reviewId: string;
  reportStatus: AdminReviewReportResolutionStatus;
  resolution: string;
}

export type AdminDisputeStatus =
  | "OPEN"
  | "INVESTIGATING"
  | "RESOLVED"
  | "CLOSED"
  | "ESCALATED";

export type AdminDisputePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type AdminDisputeType =
  | "BOOKING_QUALITY_ISSUE"
  | "CANCELLATION_DISPUTE"
  | "PAYMENT_ISSUE"
  | "VEHICLE_CONDITION"
  | "BEHAVIOR_COMPLAINT"
  | "SERVICE_NOT_PROVIDED"
  | "OTHER";

export interface AdminDisputeQuery extends PaginationParams {
  search?: string;
  status?: AdminDisputeStatus;
  priority?: AdminDisputePriority;
  type?: AdminDisputeType;
  assignedTo?: string;
}

export interface AdminDisputeListItem {
  id: string;
  disputeCode: string;
  bookingId: string;
  raisedBy: string;
  raisedAgainst: string;
  type: AdminDisputeType;
  priority: AdminDisputePriority;
  status: AdminDisputeStatus;
  subject: string;
  description: string;
  evidenceUrls: string[];
  assignedTo: string | null;
  proposedResolution: string | null;
  resolution: string | null;
  resolutionType: string | null;
  resolutionAmount: number | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  booking: {
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    pickupLocation: string;
    dropoffLocation: string | null;
    totalAmount: number;
    customer: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    vehicle: {
      id: string;
      name: string;
      licensePlate: string;
    };
  };
  raisedByUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  againstUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignedAdmin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    adminRole: string | null;
  } | null;
  _count: {
    messages: number;
  };
}

export interface AdminDisputeMessage {
  id: string;
  disputeId: string;
  senderId: string;
  message: string;
  isInternalNote: boolean;
  createdAt: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    adminRole: string | null;
  };
}

export interface AdminDisputeDetails extends AdminDisputeListItem {
  booking: AdminDisputeListItem["booking"] & {
    payment: {
      id: string;
      amount: number;
      status: string;
      refundAmount: number | null;
      refundReason: string | null;
    } | null;
  };
  raisedByUser: AdminDisputeListItem["raisedByUser"] & {
    phone: string | null;
    role: string;
  };
  againstUser: AdminDisputeListItem["againstUser"] & {
    phone: string | null;
    role: string;
  };
  messages: AdminDisputeMessage[];
}

export interface AdminDisputeQueueResponse {
  items: AdminDisputeListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type AdminSettlementStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface AdminSettlementQuery extends PaginationParams {
  search?: string;
  status?: AdminSettlementStatus;
  period?: string;
  ownerId?: string;
}

export interface AdminSettlementItem {
  id: string;
  settlementCode: string;
  ownerId: string;
  period: string;
  totalBookings: number;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  status: AdminSettlementStatus;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankCode: string | null;
  processedBy: string | null;
  processedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  processedByAdmin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    adminRole: string | null;
  } | null;
  _count: {
    bookings: number;
  };
}

export interface AdminSettlementDetails extends AdminSettlementItem {
  owner: AdminSettlementItem["owner"] & {
    status: string;
    isVerified: boolean;
  };
  bookings: Array<{
    id: string;
    settlementId: string;
    bookingId: string;
    amount: number;
    commission: number;
    net: number;
    booking: {
      id: string;
      status: string;
      startDate: string;
      endDate: string;
      pickupLocation: string;
      dropoffLocation: string | null;
      totalAmount: number;
      customer: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
      vehicle: {
        id: string;
        name: string;
        licensePlate: string;
      };
    };
  }>;
}

export interface AdminSettlementResponse {
  items: AdminSettlementItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type AdminCommissionType = "PERCENTAGE" | "FIXED" | "TIERED";

export interface AdminCommissionTier {
  min: number;
  max: number;
  rate: number;
}

export interface AdminCommissionRule {
  id: string;
  name: string;
  type: AdminCommissionType;
  percentage: number | null;
  fixedAmount: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  tiers: AdminCommissionTier[] | null;
  appliesFrom: string | null;
  appliesTo: string | null;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCommissionRuleInput {
  name: string;
  type: AdminCommissionType;
  percentage?: number;
  fixedAmount?: number;
  minAmount?: number;
  maxAmount?: number;
  tiers?: AdminCommissionTier[];
  appliesFrom?: string;
  appliesTo?: string;
  isActive?: boolean;
}

export interface AdminPlatformSettings {
  id: string;
  generalSettings: Record<string, unknown> | null;
  notificationSettings: Record<string, unknown> | null;
  paymentSettings: Record<string, unknown> | null;
  bookingSettings: Record<string, unknown> | null;
  securitySettings: Record<string, unknown> | null;
  mapSettings: Record<string, unknown> | null;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByAdmin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    adminRole: string | null;
  } | null;
}

export interface AdminPlatformSettingsUpdateInput {
  generalSettings?: Record<string, unknown>;
  notificationSettings?: Record<string, unknown>;
  paymentSettings?: Record<string, unknown>;
  bookingSettings?: Record<string, unknown>;
  securitySettings?: Record<string, unknown>;
  mapSettings?: Record<string, unknown>;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
}

export interface AdminContentPageQuery extends PaginationParams {
  search?: string;
  isPublished?: boolean;
}

export interface AdminContentPage {
  id: string;
  slug: string;
  title: string;
  content: unknown;
  excerpt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByAdmin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    adminRole: string | null;
  } | null;
}

export interface AdminContentPageResponse {
  items: AdminContentPage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminContentPageUpdateInput {
  title?: string;
  content?: unknown;
  excerpt?: string;
  seoTitle?: string;
  seoDescription?: string;
  isPublished?: boolean;
}

export interface AdminFaqQuery extends PaginationParams {
  search?: string;
  category?: string;
  isPublished?: boolean;
}

export interface AdminFaq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  isPublished: boolean;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByAdmin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    adminRole: string | null;
  } | null;
}

export interface AdminFaqResponse {
  items: AdminFaq[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminFaqInput {
  question: string;
  answer: string;
  category?: string;
  sortOrder?: number;
  isPublished?: boolean;
}

export interface AdminTestimonialQuery extends PaginationParams {
  includeInactive?: boolean;
  search?: string;
}

export interface AdminTestimonial {
  id: string;
  name: string;
  role: string;
  organization: string;
  imageUrl: string;
  rating: number;
  quote: string;
  tripDetails: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTestimonialResponse {
  items: AdminTestimonial[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminTestimonialUpdateInput {
  name?: string;
  role?: string;
  organization?: string;
  imageUrl?: string;
  rating?: number;
  quote?: string;
  tripDetails?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface AdminAmenityQuery extends PaginationParams {
  search?: string;
  includeInactive?: boolean;
}

export interface AdminAmenity {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByAdmin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    adminRole: string | null;
  } | null;
}

export interface AdminAmenityResponse {
  items: AdminAmenity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminAmenityInput {
  code: string;
  name: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export type AdminPlatformNotificationStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "SENT"
  | "FAILED"
  | "CANCELLED";

export type AdminPlatformNotificationChannel = "IN_APP" | "EMAIL" | "SMS";

export type AdminNotificationTargetRole =
  | "CUSTOMER"
  | "VEHICLE_OWNER"
  | "ADMIN";

export interface AdminPlatformNotificationQuery extends PaginationParams {
  search?: string;
  status?: AdminPlatformNotificationStatus;
  channel?: AdminPlatformNotificationChannel;
  targetRole?: AdminNotificationTargetRole;
}

export interface AdminPlatformNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  channel: AdminPlatformNotificationChannel;
  status: AdminPlatformNotificationStatus;
  targetRole: AdminNotificationTargetRole | null;
  targetUserIds: string[];
  metadata: Record<string, unknown> | null;
  scheduledFor: string | null;
  sentAt: string | null;
  createdBy: string;
  resentFromId: string | null;
  createdAt: string;
  updatedAt: string;
  createdByAdmin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    adminRole: string | null;
  };
  _count?: {
    resends: number;
  };
  resentFrom?: {
    id: string;
    title: string;
    createdAt: string;
  } | null;
}

export interface AdminPlatformNotificationResponse {
  items: AdminPlatformNotification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminPlatformNotificationCreateInput {
  title: string;
  message: string;
  type?: string;
  channel?: AdminPlatformNotificationChannel;
  targetRole?: AdminNotificationTargetRole;
  targetUserIds?: string[];
  scheduledFor?: string;
  metadata?: Record<string, unknown>;
}

export interface AdminPlatformNotificationResendInput {
  title?: string;
  message?: string;
  type?: string;
  channel?: AdminPlatformNotificationChannel;
  targetRole?: AdminNotificationTargetRole;
  targetUserIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface AdminPlatformNotificationDelivery {
  recipientCount: number;
  dispatchedCount: number;
  status: AdminPlatformNotificationStatus;
  scheduledFor?: string | null;
  sentAt: string | null;
}

export interface AdminPlatformNotificationCreateResponse {
  notification: AdminPlatformNotification;
  delivery: AdminPlatformNotificationDelivery;
}

export interface AdminPlatformNotificationAnalyticsResponse {
  notification: AdminPlatformNotification;
  metrics: {
    targetedRecipients: number;
    delivered: number;
    reads: number;
    openRate: number;
    deliveryRate: number;
    resendCount: number;
  };
}

export type AdminAuditLogStatus = "success" | "failure";

export interface AdminAuditLogQuery extends PaginationParams {
  adminId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  status?: AdminAuditLogStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  status: AdminAuditLogStatus;
  errorMessage: string | null;
  createdAt: string;
  admin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    adminRole: string | null;
  };
}

export interface AdminAuditLogListResponse {
  logs: AdminAuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export type AdminReportType =
  | "USERS"
  | "BOOKINGS"
  | "FINANCIAL"
  | "OPERATIONS"
  | "AUDIT"
  | "DISPUTES"
  | "VERIFICATIONS"
  | "SYSTEM";

export type AdminReportFormat = "CSV" | "PDF" | "EXCEL";
export type AdminReportFrequency = "ON_DEMAND" | "DAILY" | "WEEKLY" | "MONTHLY";

export interface AdminScheduledReportRun {
  id: string;
  reportId: string;
  status: "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  triggerSource: "SYSTEM" | "MANUAL" | "EXPORT";
  format: AdminReportFormat;
  fileName: string | null;
  rowCount: number | null;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface AdminScheduledReport {
  id: string;
  name: string;
  description: string | null;
  reportType: AdminReportType;
  format: AdminReportFormat;
  frequency: AdminReportFrequency;
  cronExpression: string | null;
  timezone: string;
  configuration: Record<string, unknown> | null;
  recipients: string[];
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    runs: number;
  };
  runs?: AdminScheduledReportRun[];
}

export interface AdminScheduledReportListQuery extends PaginationParams {
  search?: string;
  reportType?: AdminReportType;
  format?: AdminReportFormat;
  frequency?: AdminReportFrequency;
  isActive?: boolean;
}

export interface AdminScheduledReportListResponse {
  items: AdminScheduledReport[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminScheduledReportInput {
  name: string;
  description?: string;
  reportType: AdminReportType;
  format?: AdminReportFormat;
  frequency?: AdminReportFrequency;
  cronExpression?: string;
  timezone?: string;
  configuration?: Record<string, unknown>;
  recipients?: string[];
  isActive?: boolean;
  nextRunAt?: string;
}

export interface AdminExportReportInput {
  reportId?: string;
  reportType?: AdminReportType;
  format?: AdminReportFormat;
  name?: string;
  configuration?: Record<string, unknown>;
}

export interface AdminProfileDetails {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatar: string | null;
  role: string;
  adminRole: string | null;
  status: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  _count: {
    adminPermissions: number;
    auditLogs: number;
  };
}

export interface AdminProfileActivityResponse {
  items: AdminAuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminPermissionGrant {
  permission: string;
  grantedAt: string;
  grantedBy: string;
  expiresAt: string | null;
}

export interface AdminProfilePermissionsResponse {
  admin: {
    id: string;
    email: string;
    role: string | null;
  };
  explicitPermissions: AdminPermissionGrant[];
  effectivePermissions: string[];
}

const withAdminDateQuery = (params?: AdminAnalyticsDateQuery) =>
  params ? `?${buildQueryString(params)}` : "";

export const adminService = {
  getDashboardOverview: () =>
    api.get<AdminDashboardOverview>("/admin/dashboard"),

  getRevenueChart: (months = 6) =>
    api.get<AdminRevenueChartPoint[]>(
      `/admin/dashboard/charts/revenue?months=${months}`,
    ),

  getUserGrowthChart: (months = 6) =>
    api.get<AdminUserGrowthChartPoint[]>(
      `/admin/dashboard/charts/users?months=${months}`,
    ),

  getBookingTrendsChart: (months = 6) =>
    api.get<AdminBookingTrendPoint[]>(
      `/admin/dashboard/charts/bookings?months=${months}`,
    ),

  getActivityFeed: (limit = 15) =>
    api.get<AdminActivityEvent[]>(
      `/admin/dashboard/activity-feed?limit=${limit}`,
    ),

  getPendingActions: () =>
    api.get<AdminPendingAction[]>("/admin/dashboard/pending-actions"),

  getUsers: (params?: AdminUsersQuery) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminUsersResponse>(`/admin/users${query}`);
  },

  getUserById: (id: string) =>
    api.get<
      AdminManagedUser & {
        address: string | null;
        city: string | null;
        district: string | null;
        postalCode: string | null;
        baseLocation: string | null;
        avatar: string | null;
        _count: {
          bookings: number;
          reviews: number;
          notifications: number;
        };
      }
    >(`/admin/users/${id}`),

  getUserActivity: (userId: string, params?: PaginationParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminUserActivityResponse>(
      `/admin/users/${userId}/activity${query}`,
    );
  },

  updateUserStatus: (
    userId: string,
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION",
    reason?: string,
  ) =>
    api.patch<AdminManagedUser>(`/admin/users/${userId}/status`, {
      status,
      reason,
    }),

  resetUserPassword: (userId: string, newPassword: string) =>
    api.patch<{ success: boolean }>(`/admin/users/${userId}/password`, {
      newPassword,
    }),

  deleteUser: (userId: string) =>
    api.delete<{ id: string; deleted: boolean }>(`/admin/users/${userId}`),

  createAdmin: (data: AdminCreateInput) =>
    api.post<AdminManagedUser>("/admin/admins", data),

  exportUsersCsv: (params?: Omit<AdminUsersQuery, "page" | "limit">) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return downloadAdminCsv(
      `/admin/users/export${query}`,
      "admin-users-export.csv",
    );
  },

  getBookings: (params?: AdminBookingsQuery) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminBookingsResponse>(`/admin/bookings${query}`);
  },

  getBookingById: (bookingId: string) =>
    api.get<AdminBookingRecord & Record<string, unknown>>(
      `/admin/bookings/${bookingId}`,
    ),

  updateBookingStatus: (
    bookingId: string,
    status: "PENDING" | "CONFIRMED" | "ONGOING" | "COMPLETED" | "CANCELLED",
    reason?: string,
  ) => api.patch(`/admin/bookings/${bookingId}/status`, { status, reason }),

  cancelBookingWithRefund: (
    bookingId: string,
    refundReason: string,
    refundAmount?: number,
  ) =>
    api.post(`/admin/bookings/${bookingId}/cancel-with-refund`, {
      refundReason,
      refundAmount,
    }),

  exportBookingsCsv: (params?: Omit<AdminBookingsQuery, "page" | "limit">) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return downloadAdminCsv(
      `/admin/bookings/export${query}`,
      "admin-bookings-export.csv",
    );
  },

  getUsersAnalytics: (params?: AdminAnalyticsDateQuery) =>
    api.get<AdminUsersAnalytics>(
      `/admin/analytics/users${withAdminDateQuery(params)}`,
    ),

  getBookingsAnalytics: (params?: AdminAnalyticsDateQuery) =>
    api.get<AdminBookingsAnalytics>(
      `/admin/analytics/bookings${withAdminDateQuery(params)}`,
    ),

  getFinancialAnalytics: (params?: AdminAnalyticsDateQuery) =>
    api.get<AdminFinancialAnalytics>(
      `/admin/analytics/financial${withAdminDateQuery(params)}`,
    ),

  getOperationalAnalytics: (params?: AdminAnalyticsDateQuery) =>
    api.get<AdminOperationalAnalytics>(
      `/admin/analytics/operational${withAdminDateQuery(params)}`,
    ),

  getGeographicAnalytics: (params?: AdminAnalyticsDateQuery) =>
    api.get<AdminGeographicAnalytics>(
      `/admin/analytics/geographic${withAdminDateQuery(params)}`,
    ),

  exportAnalyticsCsv: (params?: AdminAnalyticsDateQuery) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return downloadAdminCsv(
      `/admin/analytics/export${query}`,
      "admin-analytics-export.csv",
    );
  },

  getOwnerVerifications: (params?: AdminOwnerVerificationQuery) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminOwnerVerificationResponse>(
      `/admin/verifications/owners${query}`,
    );
  },

  getOwnerVerificationById: (ownerId: string) =>
    api.get<AdminOwnerVerificationDetails>(
      `/admin/verifications/owners/${ownerId}`,
    ),

  approveOwnerVerification: (ownerId: string, note?: string) =>
    api.post(`/admin/verifications/owners/${ownerId}/approve`, { note }),

  rejectOwnerVerification: (ownerId: string, reason: string) =>
    api.post(`/admin/verifications/owners/${ownerId}/reject`, { reason }),

  requestOwnerResubmission: (ownerId: string, reason: string) =>
    api.post(`/admin/verifications/owners/${ownerId}/request-resubmission`, {
      reason,
    }),

  getVehicleVerifications: (params?: AdminVehicleVerificationQuery) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminVehicleVerificationResponse>(
      `/admin/verifications/vehicles${query}`,
    );
  },

  getVehicleVerificationById: (vehicleId: string) =>
    api.get<AdminVehicleVerificationDetails>(
      `/admin/verifications/vehicles/${vehicleId}`,
    ),

  approveVehicleVerification: (vehicleId: string, note?: string) =>
    api.post(`/admin/verifications/vehicles/${vehicleId}/approve`, { note }),

  rejectVehicleVerification: (vehicleId: string, reason: string) =>
    api.post(`/admin/verifications/vehicles/${vehicleId}/reject`, { reason }),

  getVerificationHistory: (entityId: string, params?: PaginationParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminVerificationHistoryResponse>(
      `/admin/verifications/history/${entityId}${query}`,
    );
  },

  getReviewModerationQueue: (params?: AdminReviewModerationQuery) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminReviewModerationResponse>(
      `/admin/reviews/moderation${query}`,
    );
  },

  getReviewModerationById: (reviewId: string) =>
    api.get<AdminReviewModerationDetails>(`/admin/reviews/${reviewId}`),

  updateReviewModerationStatus: (
    reviewId: string,
    status: AdminReviewModerationStatus,
    reason?: string,
  ) =>
    api.post<AdminReviewModerationUpdateResponse>(
      `/admin/reviews/${reviewId}/status`,
      {
        status,
        reason,
      },
    ),

  resolveReviewReport: (
    reviewId: string,
    status: AdminReviewReportResolutionStatus,
    resolution: string,
  ) =>
    api.post<AdminReviewReportResolutionResponse>(
      `/admin/reviews/${reviewId}/report/resolve`,
      {
        status,
        resolution,
      },
    ),

  getDisputes: (params?: AdminDisputeQuery) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminDisputeQueueResponse>(`/admin/disputes${query}`);
  },

  getDisputeById: (disputeId: string) =>
    api.get<AdminDisputeDetails>(`/admin/disputes/${disputeId}`),

  assignDispute: (disputeId: string, assignedTo: string, note?: string) =>
    api.post(`/admin/disputes/${disputeId}/assign`, {
      assignedTo,
      note,
    }),

  updateDisputePriority: (
    disputeId: string,
    priority: AdminDisputePriority,
    note?: string,
  ) =>
    api.post(`/admin/disputes/${disputeId}/priority`, {
      priority,
      note,
    }),

  updateDisputeStatus: (
    disputeId: string,
    status: AdminDisputeStatus,
    note?: string,
  ) =>
    api.post(`/admin/disputes/${disputeId}/status`, {
      status,
      note,
    }),

  addDisputeMessage: (
    disputeId: string,
    message: string,
    isInternalNote = true,
  ) =>
    api.post<AdminDisputeMessage>(`/admin/disputes/${disputeId}/message`, {
      message,
      isInternalNote,
    }),

  resolveDispute: (
    disputeId: string,
    resolution: string,
    resolutionType?: string,
    resolutionAmount?: number,
  ) =>
    api.post(`/admin/disputes/${disputeId}/resolve`, {
      resolution,
      resolutionType,
      resolutionAmount,
    }),

  getSettlements: (params?: AdminSettlementQuery) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminSettlementResponse>(`/admin/settlements${query}`);
  },

  getSettlementHistory: (params?: AdminSettlementQuery) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminSettlementResponse>(
      `/admin/settlements/history${query}`,
    );
  },

  getSettlementById: (settlementId: string) =>
    api.get<AdminSettlementDetails>(`/admin/settlements/${settlementId}`),

  processSettlement: (
    settlementId: string,
    status?: "COMPLETED" | "FAILED" | "CANCELLED",
    notes?: string,
  ) =>
    api.post<AdminSettlementDetails>(
      `/admin/settlements/${settlementId}/process`,
      {
        status,
        notes,
      },
    ),

  getCommissionRules: (includeInactive?: boolean) => {
    const query = includeInactive ? "?includeInactive=true" : "";
    return api.get<AdminCommissionRule[]>(`/admin/commissions${query}`);
  },

  createCommissionRule: (payload: AdminCommissionRuleInput) =>
    api.post<AdminCommissionRule>(`/admin/commissions`, payload),

  updateCommissionRule: (
    ruleId: string,
    payload: Partial<AdminCommissionRuleInput>,
  ) => api.patch<AdminCommissionRule>(`/admin/commissions/${ruleId}`, payload),

  deleteCommissionRule: (ruleId: string) =>
    api.delete<{ id: string; deleted: boolean }>(
      `/admin/commissions/${ruleId}`,
    ),

  getPlatformSettings: () =>
    api.get<AdminPlatformSettings>("/admin/settings/platform"),

  updatePlatformSettings: (payload: AdminPlatformSettingsUpdateInput) =>
    api.patch<AdminPlatformSettings>("/admin/settings/platform", payload),

  getContentPages: (params?: AdminContentPageQuery) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminContentPageResponse>(`/admin/content${query}`);
  },

  getContentPageBySlug: (slug: string) =>
    api.get<AdminContentPage>(`/admin/content/${slug}`),

  updateContentPage: (slug: string, payload: AdminContentPageUpdateInput) =>
    api.patch<AdminContentPage>(`/admin/content/${slug}`, payload),

  getFaqs: (params?: AdminFaqQuery) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminFaqResponse>(`/admin/faqs${query}`);
  },

  createFaq: (payload: AdminFaqInput) =>
    api.post<AdminFaq>("/admin/faqs", payload),

  updateFaq: (faqId: string, payload: Partial<AdminFaqInput>) =>
    api.patch<AdminFaq>(`/admin/faqs/${faqId}`, payload),

  deleteFaq: (faqId: string) =>
    api.delete<{ id: string; deleted: boolean }>(`/admin/faqs/${faqId}`),

  getTestimonials: (params?: AdminTestimonialQuery) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminTestimonialResponse>(`/admin/testimonials${query}`);
  },

  approveTestimonial: (testimonialId: string, note?: string) =>
    api.post<AdminTestimonial>(`/admin/testimonials/${testimonialId}/approve`, {
      note,
    }),

  updateTestimonial: (
    testimonialId: string,
    payload: AdminTestimonialUpdateInput,
  ) =>
    api.patch<AdminTestimonial>(
      `/admin/testimonials/${testimonialId}`,
      payload,
    ),

  deleteTestimonial: (testimonialId: string) =>
    api.delete<{ id: string; deleted: boolean }>(
      `/admin/testimonials/${testimonialId}`,
    ),

  getAmenities: (params?: AdminAmenityQuery) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminAmenityResponse>(`/admin/amenities${query}`);
  },

  createAmenity: (payload: AdminAmenityInput) =>
    api.post<AdminAmenity>(`/admin/amenities`, payload),

  updateAmenity: (amenityId: string, payload: Partial<AdminAmenityInput>) =>
    api.patch<AdminAmenity>(`/admin/amenities/${amenityId}`, payload),

  deleteAmenity: (amenityId: string) =>
    api.delete<{ id: string; deleted: boolean }>(
      `/admin/amenities/${amenityId}`,
    ),

  getPlatformNotifications: (params?: AdminPlatformNotificationQuery) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminPlatformNotificationResponse>(
      `/admin/notifications${query}`,
    );
  },

  createPlatformNotification: (payload: AdminPlatformNotificationCreateInput) =>
    api.post<AdminPlatformNotificationCreateResponse>(
      `/admin/notifications`,
      payload,
    ),

  getPlatformNotificationAnalytics: (notificationId: string) =>
    api.get<AdminPlatformNotificationAnalyticsResponse>(
      `/admin/notifications/${notificationId}/analytics`,
    ),

  resendPlatformNotification: (
    notificationId: string,
    payload: AdminPlatformNotificationResendInput,
  ) =>
    api.patch<AdminPlatformNotificationCreateResponse>(
      `/admin/notifications/${notificationId}/resend`,
      payload,
    ),

  getAuditLogs: (params?: AdminAuditLogQuery) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminAuditLogListResponse>(`/admin/audit-logs${query}`);
  },

  getAuditLogById: (logId: string) =>
    api.get<AdminAuditLog>(`/admin/audit-logs/${logId}`),

  exportAuditLogsCsv: (params?: Omit<AdminAuditLogQuery, "page" | "limit">) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return downloadAdminCsv(
      `/admin/audit-logs/export${query}`,
      "admin-audit-logs.csv",
    );
  },

  getScheduledReports: (params?: AdminScheduledReportListQuery) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminScheduledReportListResponse>(`/admin/reports${query}`);
  },

  createScheduledReport: (payload: AdminScheduledReportInput) =>
    api.post<AdminScheduledReport>(`/admin/reports`, payload),

  updateScheduledReport: (
    reportId: string,
    payload: Partial<AdminScheduledReportInput>,
  ) => api.patch<AdminScheduledReport>(`/admin/reports/${reportId}`, payload),

  archiveScheduledReport: (reportId: string) =>
    api.delete<{ id: string; deleted: boolean }>(`/admin/reports/${reportId}`),

  runScheduledReport: (reportId: string, format?: AdminReportFormat) =>
    api.post<{
      report: AdminScheduledReport;
      run: AdminScheduledReportRun;
      preview: {
        headers: string[];
        rows: unknown[][];
      };
    }>(`/admin/reports/${reportId}/run`, { format }),

  exportAdminReport: (payload: AdminExportReportInput) =>
    downloadAdminCsv(
      `/admin/reports/export`,
      payload.name || "admin-report.csv",
      {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
      },
    ),

  getAdminProfile: () => api.get<AdminProfileDetails>(`/admin/profile`),

  updateAdminProfile: (payload: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) => api.patch<AdminProfileDetails>(`/admin/profile/personal`, payload),

  changeAdminProfilePassword: (payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => api.patch<{ message: string }>(`/admin/profile/password`, payload),

  getAdminProfileActivity: (params?: {
    page?: number;
    limit?: number;
    action?: string;
    status?: AdminAuditLogStatus;
  }) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<AdminProfileActivityResponse>(
      `/admin/profile/activity${query}`,
    );
  },

  getAdminProfilePermissions: () =>
    api.get<AdminProfilePermissionsResponse>(`/admin/profile/permissions`),
};

// ============================================
// Owner Registration Service
// ============================================
export const ownerRegistrationService = {
  /**
   * Register a new bus owner with vehicles
   * @throws {ApiError} On validation error or email already exists
   */
  register: (data: OwnerRegistrationInput) =>
    api.post<AuthResponse>("/owner/register", data, { skipAuth: true }),

  /**
   * Get owner profile with vehicles and documents
   */
  getProfile: () =>
    api.get<{
      profile: User & {
        documents?: Array<{
          id: string;
          type: string;
          url: string;
          status: string;
        }>;
        vehicles?: Array<
          Vehicle & {
            documents?: Array<{
              id: string;
              type: string;
              url: string;
              status: string;
            }>;
            photos?: Array<{
              id: string;
              url: string;
              isPrimary: boolean;
            }>;
          }
        >;
      };
    }>("/owner/profile"),
};

// ============================================
// Storage Services
// ============================================
export const storageService = {
  uploadRegistrationFile: (
    file: File,
    category: "owner-documents" | "vehicle-documents" | "vehicle-photos",
    subfolder?: string,
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    if (subfolder) {
      formData.append("subfolder", subfolder);
    }
    return api.upload<{ url: string; path: string }>(
      "/uploads/registration",
      formData,
    );
  },
};

// ============================================
// Owner Service - Profile Updates
// ============================================
export const ownerService = {
  /**
   * Update owner personal information
   */
  updatePersonalInfo: (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    nicNumber?: string;
    businessName?: string;
    businessType?: string;
    businessRegNumber?: string;
    tinNumber?: string;
  }) => api.patch<User>("/owner/profile/personal", data),

  /**
   * Update owner address information
   */
  updateAddress: (data: {
    address?: string;
    city?: string;
    district?: string;
    postalCode?: string;
    baseLocation?: string;
  }) => api.patch<User>("/owner/profile/address", data),

  /**
   * Get owner dashboard stats
   */
  getDashboardStats: () =>
    api.get<{
      totalRevenue: number;
      activeBookings: number;
      pendingQuotes: number;
      averageRating: number;
      fleetStats: {
        active: number;
        inactive: number;
        pendingReview: number;
        utilization: number;
      };
    }>("/owner/dashboard/stats"),

  /**
   * Get monthly revenue chart data for the last 6 months
   */
  getRevenueChart: () =>
    api.get<Array<{ month: string; revenue: number }>>(
      "/owner/dashboard/revenue-chart",
    ),

  /**
   * Get 5 most recent reviews across all owner vehicles
   */
  getRecentReviews: () =>
    api.get<
      Array<{
        id: string;
        rating: number;
        comment: string;
        createdAt: string;
        vehicleName: string;
        customerName: string;
        ownerResponse: string | null;
      }>
    >("/owner/dashboard/recent-reviews"),

  /**
   * Get all documents uploaded by the authenticated owner
   */
  getDocuments: () =>
    api.get<
      Array<{
        id: string;
        type: string;
        url: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
        status: "PENDING" | "VERIFIED" | "REJECTED";
        rejectionReason: string | null;
        verifiedAt: string | null;
        createdAt: string;
        updatedAt: string;
      }>
    >("/owner/documents"),

  /**
   * Upload a new owner document (NIC or PROFILE_PHOTO)
   */
  addDocument: (data: {
    type: "NIC" | "PROFILE_PHOTO";
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }) =>
    api.post<{
      id: string;
      type: string;
      status: string;
      url: string;
      fileName: string;
      createdAt: string;
    }>("/owner/documents", data),

  /**
   * Delete an owner document by ID
   */
  deleteDocument: (docId: string) =>
    api.delete<null>(`/owner/documents/${docId}`),

  /**
   * Get all reviews across owner's vehicles with optional filters
   */
  getReviews: (params?: {
    page?: number;
    limit?: number;
    rating?: number;
    hasResponse?: boolean;
  }) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<{
      reviews: Array<{
        id: string;
        rating: number;
        dimensions: ReviewDimensions | null;
        title: string | null;
        comment: string | null;
        isRecommended: boolean | null;
        ownerResponse: string | null;
        createdAt: string;
        tripDate: string;
        customerName: string;
        customerAvatar: string | null;
        vehicleId: string;
        vehicleName: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/owner/reviews${query}`);
  },

  /**
   * Get aggregate review summary for owner's vehicles
   */
  getReviewSummary: () =>
    api.get<{
      averageRating: number;
      totalReviews: number;
      pendingResponses: number;
      responseRate: number;
      ratingDistribution: Record<number, number>;
      dimensionAverages: ReviewDimensions;
    }>("/owner/reviews/summary"),

  /**
   * Get analytics KPI overview
   */
  getAnalyticsOverview: () =>
    api.get<{
      totalRevenue: number;
      thisMonthRevenue: number;
      revenueGrowth: number;
      totalBookings: number;
      completedBookings: number;
      completionRate: number;
      totalVehicles: number;
      activeVehicles: number;
      fleetUtilization: number;
      averageRating: number;
    }>("/owner/analytics/overview"),

  /**
   * Get revenue trend and bookings count for the last 6 months
   */
  getAnalyticsRevenue: () =>
    api.get<Array<{ month: string; revenue: number; bookings: number }>>(
      "/owner/analytics/revenue",
    ),

  /**
   * Get per-vehicle performance metrics sorted by revenue
   */
  getAnalyticsVehicles: () =>
    api.get<
      Array<{
        id: string;
        name: string;
        isActive: boolean;
        totalBookings: number;
        completedBookings: number;
        revenue: number;
        averageRating: number;
        reviewCount: number;
      }>
    >("/owner/analytics/vehicles"),

  /**
   * Get earnings summary — lifetime/month/year earnings + pending balance
   */
  getEarningsSummary: () =>
    api.get<{
      lifetimeEarnings: number;
      thisMonthEarnings: number;
      thisYearEarnings: number;
      pendingBalance: number;
    }>("/owner/earnings/summary"),

  /**
   * Get paginated payment transaction history with optional filters
   */
  getEarningsTransactions: (params?: {
    page?: number;
    limit?: number;
    status?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED";
    from?: string;
    to?: string;
  }) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<{
      transactions: Array<{
        id: string;
        date: string;
        bookingId: string;
        bookingRef: string;
        route: string;
        amount: number;
        currency: string;
        method: string | null;
        status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED";
      }>;
      total: number;
      page: number;
      totalPages: number;
    }>(`/owner/earnings/transactions${query}`);
  },

  /**
   * Get settlement payout history
   */
  getEarningsSettlements: () =>
    api.get<
      Array<{
        id: string;
        settlementCode: string;
        period: string;
        totalBookings: number;
        grossAmount: number;
        commissionAmount: number;
        netAmount: number;
        status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
        processedAt: string | null;
        createdAt: string;
      }>
    >("/owner/earnings/settlements"),

  /**
   * Get the owner's saved bank account (account number masked to last 4 digits)
   */
  getBankAccount: () =>
    api.get<{
      id: string;
      accountHolderName: string;
      accountNumberMasked: string | null;
      bankName: string;
      bankCode: string | null;
      branchName: string | null;
      branchCode: string | null;
      isPrimary: boolean;
      updatedAt: string;
    } | null>("/owner/bank-account"),

  /**
   * Create or update the owner's bank account
   */
  upsertBankAccount: (data: {
    accountHolderName: string;
    accountNumber: string;
    bankName: string;
    bankCode?: string;
    branchName?: string;
    branchCode?: string;
  }) =>
    api.put<{
      id: string;
      accountHolderName: string;
      accountNumberMasked: string | null;
      bankName: string;
      bankCode: string | null;
      branchName: string | null;
      branchCode: string | null;
      isPrimary: boolean;
      updatedAt: string;
    }>("/owner/bank-account", data),
};

// Re-export ApiError for convenience
export { ApiError } from "./client";
