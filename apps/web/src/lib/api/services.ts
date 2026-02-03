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
  PaginatedResponse,
  OwnerRegistrationInput,
} from "@/types";
import type {
  LoginInput,
  RegisterInput,
  QuotationRequestInput,
  VehicleInput,
  QuotationResponseInput,
  ReviewInput,
  ProfileUpdateInput,
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
  minPrice?: number;
  maxPrice?: number;
  seats?: number;
  startDate?: string;
  endDate?: string;
  sortBy?: "price" | "rating" | "newest";
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
   * Get vehicle availability for date range
   */
  getAvailability: (id: string, startDate: string, endDate: string) =>
    api.get<{ available: boolean; unavailableDates: string[] }>(
      `/vehicles/${id}/availability?startDate=${startDate}&endDate=${endDate}`,
    ),

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
    // For now, return mock URLs - will be replaced with actual upload logic
    const photoData = photos.map((photo, index) => ({
      url: `/uploads/vehicles/${id}/${Date.now()}_${photo.file.name}`,
      fileName: photo.file.name,
      fileSize: photo.file.size,
      mimeType: photo.file.type,
      isPrimary: index === 0 || photo.isPrimary || false,
    }));

    return api.post<{ photos: any[] }>(`/vehicles/${id}/photos`, {
      photos: photoData,
    });
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
    // For now, return mock URLs - will be replaced with actual upload logic
    const docData = documents.map((doc) => ({
      url: `/uploads/vehicles/${id}/documents/${Date.now()}_${doc.file.name}`,
      fileName: doc.file.name,
      fileSize: doc.file.size,
      mimeType: doc.file.type,
      type: doc.type,
    }));

    return api.post<{ documents: any[] }>(`/vehicles/${id}/documents`, {
      documents: docData,
    });
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
// Quotation Services
// ============================================
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
  getOwnerRequests: (params?: PaginationParams & { status?: string }) => {
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
    api.patch<{
      success: boolean;
      message: string;
      data: { quotation: Quotation };
    }>(`/quotations/${id}/send`, data),

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

// ============================================
// Review Services
// ============================================
export const reviewService = {
  /**
   * Create a review for a completed booking
   */
  create: (data: ReviewInput) => api.post<Review>("/reviews", data),

  /**
   * Get reviews for a vehicle
   */
  getByVehicle: (vehicleId: string, params?: PaginationParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<{
      reviews: Review[];
      stats: {
        averageRating: number;
        totalReviews: number;
        ratingDistribution: Record<number, number>;
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
   * Get reviews for an owner
   */
  getByOwner: (ownerId: string, params?: PaginationParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<Review[]>(`/reviews/owner/${ownerId}${query}`);
  },

  /**
   * Get reviews by current user
   */
  getMyReviews: (params?: PaginationParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<{
      reviews: Array<{
        id: string;
        rating: number;
        comment: string | null;
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
   * Update a review
   */
  update: (id: string, data: Partial<ReviewInput>) =>
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
  clientSecret: string;
  amount: number;
  currency: string;
}

export const paymentService = {
  /**
   * Create a payment intent for a booking
   */
  createPaymentIntent: (bookingId: string) =>
    api.post<PaymentIntent>(`/payments/create-intent`, { bookingId }),

  /**
   * Confirm payment completion
   */
  confirmPayment: (paymentIntentId: string) =>
    api.post<MessageResponse>(`/payments/confirm`, { paymentIntentId }),

  /**
   * Get payment history for current user
   */
  getMyPayments: (params?: PaginationParams) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<
      Array<{
        id: string;
        amount: number;
        status: string;
        createdAt: string;
      }>
    >(`/payments/my${query}`);
  },

  /**
   * Request a refund
   */
  requestRefund: (paymentId: string, reason: string) =>
    api.post<MessageResponse>(`/payments/${paymentId}/refund`, { reason }),
};

// ============================================
// Notification Services
// ============================================
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}

export const notificationService = {
  /**
   * Get notifications for current user
   */
  getAll: (params?: PaginationParams & { unreadOnly?: boolean }) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<Notification[]>(`/notifications${query}`);
  },

  /**
   * Mark notification as read
   */
  markAsRead: (id: string) =>
    api.patch<Notification>(`/notifications/${id}/read`),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: () =>
    api.post<MessageResponse>("/notifications/mark-all-read"),

  /**
   * Get unread count
   */
  getUnreadCount: () =>
    api.get<{ count: number }>("/notifications/unread-count"),

  /**
   * Delete a notification
   */
  delete: (id: string) => api.delete<MessageResponse>(`/notifications/${id}`),
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
export const adminService = {
  // User management
  /**
   * Get all users with filtering
   */
  getUsers: (
    params?: PaginationParams & { role?: string; status?: string },
  ) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<PaginatedResponse<User>>(`/admin/users${query}`);
  },

  /**
   * Get user by ID
   */
  getUserById: (id: string) => api.get<User>(`/admin/users/${id}`),

  /**
   * Update user status
   */
  updateUserStatus: (id: string, status: string) =>
    api.patch<User>(`/admin/users/${id}/status`, { status }),

  // Owner verification
  /**
   * Get pending owner verifications
   */
  getPendingVerifications: () =>
    api.get<User[]>("/admin/verifications/pending"),

  /**
   * Approve owner verification
   */
  verifyOwner: (id: string) =>
    api.post<MessageResponse>(`/admin/verifications/${id}/approve`),

  /**
   * Reject owner verification
   */
  rejectVerification: (id: string, reason: string) =>
    api.post<MessageResponse>(`/admin/verifications/${id}/reject`, { reason }),

  // Analytics
  /**
   * Get dashboard statistics
   */
  getDashboardStats: () =>
    api.get<{
      totalUsers: number;
      totalBookings: number;
      totalRevenue: number;
      pendingVerifications: number;
      activeVehicles: number;
      monthlyGrowth: number;
    }>("/admin/stats"),

  /**
   * Get revenue report
   */
  getRevenueReport: (period: "week" | "month" | "year") =>
    api.get<Array<{ date: string; amount: number }>>(
      `/admin/reports/revenue?period=${period}`,
    ),

  // Disputes
  /**
   * Get all disputes
   */
  getDisputes: (params?: PaginationParams & { status?: string }) => {
    const query = params ? `?${buildQueryString(params)}` : "";
    return api.get<
      Array<{ id: string; bookingId: string; reason: string; status: string }>
    >(`/admin/disputes${query}`);
  },

  /**
   * Resolve a dispute
   */
  resolveDispute: (id: string, resolution: string, refundAmount?: number) =>
    api.post<MessageResponse>(`/admin/disputes/${id}/resolve`, {
      resolution,
      refundAmount,
    }),
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
};

// Re-export ApiError for convenience
export { ApiError } from "./client";
