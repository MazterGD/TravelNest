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

  // Trip
  tripService,
  type CreateTripInput,
  type UpdateTripInput,
  type TripDTO,
  type TripLocation,

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
  type NotificationCategory,
  type NotificationListResponse,
  type NotificationQueryParams,

  // Messages / Chat
  messageService,
  type ChatMessage,
  type ConversationSummary,
  type ConversationListResponse,
  type ConversationCounterpartRole,
  type MessagesListResponse,

  // Search
  searchService,
  type SearchParams,

  // Admin
  adminService,
  type AdminActivityEvent,
  type AdminAnalyticsDateQuery,
  type AdminBookingRecord,
  type AdminBookingTrendPoint,
  type AdminBookingsAnalytics,
  type AdminBookingsQuery,
  type AdminBookingsResponse,
  type AdminCreateInput,
  type AdminDashboardOverview,
  type AdminFinancialAnalytics,
  type AdminGeographicAnalytics,
  type AdminManagedUser,
  type AdminOperationalAnalytics,
  type AdminPendingAction,
  type AdminRevenueChartPoint,
  type AdminUserActivityResponse,
  type AdminUserGrowthChartPoint,
  type AdminUsersAnalytics,
  type AdminUsersQuery,
  type AdminUsersResponse,
  type AdminOwnerVerificationDetails,
  type AdminOwnerVerificationItem,
  type AdminOwnerVerificationQuery,
  type AdminOwnerVerificationResponse,
  type AdminOwnerVerificationStatus,
  type AdminReviewModerationDetails,
  type AdminReviewModerationItem,
  type AdminReviewModerationQuery,
  type AdminReviewModerationResponse,
  type AdminReviewModerationStatus,
  type AdminReviewModerationUpdateResponse,
  type AdminReviewReportResolutionResponse,
  type AdminReviewReportResolutionStatus,
  type AdminDisputeDetails,
  type AdminDisputeListItem,
  type AdminDisputeMessage,
  type AdminDisputePriority,
  type AdminDisputeQuery,
  type AdminDisputeQueueResponse,
  type AdminDisputeStatus,
  type AdminDisputeType,
  type AdminSettlementDetails,
  type AdminSettlementItem,
  type AdminSettlementQuery,
  type AdminSettlementResponse,
  type AdminSettlementStatus,
  type AdminCommissionRule,
  type AdminCommissionRuleInput,
  type AdminCommissionTier,
  type AdminCommissionType,
  type AdminPlatformSettings,
  type AdminPlatformSettingsUpdateInput,
  type AdminContentPage,
  type AdminContentPageQuery,
  type AdminContentPageResponse,
  type AdminContentPageUpdateInput,
  type AdminFaq,
  type AdminFaqInput,
  type AdminFaqQuery,
  type AdminFaqResponse,
  type AdminTestimonial,
  type AdminTestimonialQuery,
  type AdminTestimonialResponse,
  type AdminTestimonialUpdateInput,
  type AdminAmenity,
  type AdminAmenityInput,
  type AdminAmenityQuery,
  type AdminAmenityResponse,
  type AdminPlatformNotification,
  type AdminPlatformNotificationStatus,
  type AdminPlatformNotificationChannel,
  type AdminNotificationTargetRole,
  type AdminPlatformNotificationQuery,
  type AdminPlatformNotificationResponse,
  type AdminPlatformNotificationCreateInput,
  type AdminPlatformNotificationResendInput,
  type AdminPlatformNotificationDelivery,
  type AdminPlatformNotificationCreateResponse,
  type AdminPlatformNotificationAnalyticsResponse,
  type AdminAuditLogStatus,
  type AdminAuditLogQuery,
  type AdminAuditLog,
  type AdminAuditLogListResponse,
  type AdminReportType,
  type AdminReportFormat,
  type AdminReportFrequency,
  type AdminScheduledReportRun,
  type AdminScheduledReport,
  type AdminScheduledReportListQuery,
  type AdminScheduledReportListResponse,
  type AdminScheduledReportInput,
  type AdminExportReportInput,
  type AdminProfileDetails,
  type AdminProfileActivityResponse,
  type AdminPermissionGrant,
  type AdminProfilePermissionsResponse,
  type AdminVehicleDocument,
  type AdminVehicleVerificationDetails,
  type AdminVehicleVerificationItem,
  type AdminVehicleVerificationQuery,
  type AdminVehicleVerificationResponse,
  type AdminVerificationDocumentStatus,
  type AdminVerificationHistoryLog,
  type AdminVerificationHistoryResponse,
  type AdminVehiclesQuery,
  type AdminVehicleRecord,
  type AdminVehiclesResponse,
  type AdminOwnerDocument,

  // Owner Registration
  ownerRegistrationService,

  // Storage
  storageService,

  // Owner Service - Profile Updates
  ownerService,

  // Landing
  landingContentService,
  type LandingDataResponse,
  type LandingFeaturedVehicle,
  type LandingPopularRoute,
  type LandingTestimonial,
  type LandingStat,
  type LandingPublicConfigResponse,
  type RouteEstimateInput,
  type RouteEstimateResponse,

  // Pagination
  type PaginationParams,
} from "./services";
