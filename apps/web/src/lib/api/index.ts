// API Client
export { api, ApiError } from "./client";

// API Services
export {
  // Auth
  authService,
  type AuthResponse,
  type TokenResponse,
  type MessageResponse,

  // User
  userService,

  // Vehicle
  vehicleService,
  type VehicleSearchParams,

  // Trip Packages
  tripPackageService,
  type TripPackageSearchParams,
  type TripPackageInput,
  type TripPackageUpdateInput,

  // Quotation
  quotationService,

  // Booking
  bookingService,
  type BookingSearchParams,

  // Review
  reviewService,

  // Payment
  paymentService,
  type PaymentIntent,

  // Notification
  notificationService,
  type Notification,

  // Search
  searchService,
  type SearchParams,

  // Admin
  adminService,

  // Owner Registration
  ownerRegistrationService,

  // Owner Service - Profile Updates
  ownerService,

  // Pagination
  type PaginationParams,
} from "./services";
