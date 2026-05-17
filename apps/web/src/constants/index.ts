/**
 * TravelNest Application Constants
 */

// Application Information
export const APP_NAME = "TravelNest";
export const APP_DESCRIPTION =
  "Sri Lanka's premier bus rental marketplace connecting bus owners with customers";
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Supported Languages
export const SUPPORTED_LOCALES = ["en", "si", "ta"] as const;
export const DEFAULT_LOCALE = "en";

// Language Labels
export const LOCALE_LABELS = {
  en: "English",
  si: "සිංහල",
  ta: "தமிழ்",
};

// Vehicle Amenities
export const VEHICLE_AMENITIES = [
  { id: "wifi", label: "WiFi", icon: "wifi" },
  { id: "usb_charging", label: "USB Charging", icon: "usb" },
  { id: "ac", label: "Air Conditioning", icon: "snowflake" },
  { id: "reclining_seats", label: "Reclining Seats", icon: "chair" },
  { id: "entertainment", label: "Entertainment System", icon: "tv" },
  { id: "gps", label: "GPS Tracking", icon: "map-pin" },
  { id: "first_aid", label: "First Aid Kit", icon: "heart-pulse" },
  { id: "reading_lights", label: "Reading Lights", icon: "lightbulb" },
  { id: "luggage_space", label: "Luggage Space", icon: "briefcase" },
  { id: "water", label: "Drinking Water", icon: "droplet" },
];

// Booking Status Colors
export const BOOKING_STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  disputed: "bg-orange-100 text-orange-800",
};

// Payment Status Colors
export const PAYMENT_STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-800",
  partial: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  refunded: "bg-purple-100 text-purple-800",
  failed: "bg-red-100 text-red-800",
};

// Sri Lankan Districts
export const SRI_LANKAN_DISTRICTS = [
  "Ampara",
  "Anuradhapura",
  "Badulla",
  "Batticaloa",
  "Colombo",
  "Galle",
  "Gampaha",
  "Hambantota",
  "Jaffna",
  "Kalutara",
  "Kandy",
  "Kegalle",
  "Kilinochchi",
  "Kurunegala",
  "Mannar",
  "Matale",
  "Matara",
  "Monaragala",
  "Mullaitivu",
  "Nuwara Eliya",
  "Polonnaruwa",
  "Puttalam",
  "Ratnapura",
  "Trincomalee",
  "Vavuniya",
];

// Pagination
export const DEFAULT_PAGE_SIZE = 12;
export const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

// Date Formats
export const DATE_FORMAT = "yyyy-MM-dd";
export const DATE_TIME_FORMAT = "yyyy-MM-dd HH:mm:ss";
export const DISPLAY_DATE_FORMAT = "MMM dd, yyyy";

// API Endpoints
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

// Currency
export const CURRENCY = "LKR";
export const CURRENCY_SYMBOL = "Rs.";

// Validation
export const PASSWORD_MIN_LENGTH = 8;
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
export const MAX_IMAGES_PER_VEHICLE = 10;

// Session
export const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

// Districts (alias for convenience)
export const DISTRICTS = SRI_LANKAN_DISTRICTS;

// Vehicle Types for forms
export const VEHICLE_TYPES = [
  { value: "mini_bus", label: "Mini Bus (10-15 seats)" },
  { value: "standard_bus", label: "Standard Bus (30-40 seats)" },
  { value: "luxury_bus", label: "Luxury Bus (40-50 seats)" },
  { value: "semi_luxury_bus", label: "Semi-Luxury Bus (35-45 seats)" },
] as const;

export const MARKETING_STATS = {
  verifiedBuses: "500+",
  happyCustomers: "5000+",
  averageRating: "4.8★",
} as const;

export const DEFAULT_SOCIAL_LINKS = {
  facebook: "https://facebook.com/travelnest",
  instagram: "https://instagram.com/travelnest",
  twitter: "https://x.com/travelnest",
  linkedin: "https://linkedin.com/company/travelnest",
} as const;

export const DEFAULT_MAP_CONFIG = {
  embedUrl:
    "https://www.google.com/maps?q=No.+45,+Galle+Road,+Colombo+03&output=embed",
  lat: 6.9271,
  lng: 79.8612,
  zoom: 15,
} as const;

export const OTP_LENGTH = 6;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
