import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encryptSettlementBankValue } from "./settlementBankEncryption.js";
import { seedContentPages } from "./backfillContent.js";

const prisma = new PrismaClient();
const prismaAny = prisma as any;

// Sri Lankan Districts for realistic data
const SRI_LANKAN_DISTRICTS = [
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Matale",
  "Nuwara Eliya",
  "Galle",
  "Matara",
  "Hambantota",
  "Jaffna",
  "Kilinochchi",
  "Mannar",
  "Vavuniya",
  "Trincomalee",
  "Batticaloa",
  "Ampara",
  "Kurunegala",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Badulla",
  "Monaragala",
  "Ratnapura",
  "Kegalle",
];

// Sri Lankan location coordinates
const LOCATIONS: Record<string, { latitude: number; longitude: number }> = {
  Colombo: { latitude: 6.9271, longitude: 79.8612 },
  Kandy: { latitude: 7.2906, longitude: 80.6337 },
  Galle: { latitude: 6.0535, longitude: 80.221 },
  Jaffna: { latitude: 9.6615, longitude: 80.0255 },
  Negombo: { latitude: 7.2008, longitude: 79.8737 },
  Anuradhapura: { latitude: 8.3114, longitude: 80.4037 },
  Matara: { latitude: 5.9549, longitude: 80.555 },
  Kurunegala: { latitude: 7.4863, longitude: 80.3647 },
  Batticaloa: { latitude: 7.7102, longitude: 81.6924 },
  Trincomalee: { latitude: 8.5874, longitude: 81.2152 },
  Yala: { latitude: 6.3719, longitude: 81.5117 },
};

// Bus makes and models popular in Sri Lanka
const BUS_MAKES = [
  {
    make: "Ashok Leyland",
    models: ["Viking", "Lynx", "Boss", "Sunshine", "2820"],
  },
  {
    make: "TATA",
    models: ["Starbus", "Marcopolo", "LP913", "LP1512", "Ultra"],
  },
  { make: "Isuzu", models: ["Journey", "NQR", "NPR", "FTR"] },
  { make: "Mitsubishi", models: ["Rosa", "Fuso", "Canter"] },
  { make: "Toyota", models: ["Coaster", "HiAce"] },
  { make: "Hino", models: ["Dutro", "Poncho", "RK8J"] },
  { make: "Nissan", models: ["Civilian", "UD"] },
  { make: "BYD", models: ["K9", "C6", "Electric Coach"] },
];

// Generate Sri Lankan vehicle registration numbers
const generateLicensePlate = (index: number): string => {
  const provinces = ["WP", "CP", "SP", "NP", "EP", "NW", "NC", "SG", "UV"];
  const province = provinces[Math.floor(Math.random() * provinces.length)];
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const letter1 = letters[Math.floor(Math.random() * letters.length)];
  const letter2 = letters[Math.floor(Math.random() * letters.length)];
  const number = String(1000 + index + Math.floor(Math.random() * 8999));
  return `${province}-${letter1}${letter2}-${number}`;
};

async function main() {
  console.log("Starting Sri Lankan TraveNest database seed...\n");

  // Clean up existing data
  console.log("Cleaning up existing data...");
  await prismaAny.platformConfig.deleteMany({});
  await prisma.trustedPartner.deleteMany({});
  await prisma.testimonial.deleteMany({});
  await prisma.popularRoute.deleteMany({});
  await prisma.platformStat.deleteMany({});
  await prismaAny.contactMessage.deleteMany({});
  await prisma.notification.deleteMany({});
  await prismaAny.otpToken.deleteMany({});
  await prismaAny.scheduledReportRun.deleteMany({});
  await prismaAny.scheduledReport.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.tripPackage.deleteMany({});
  await prisma.quotation.deleteMany({});
  // @ts-ignore - prisma client regeneration pending; trip table exists after migration
  await prismaAny.trip.deleteMany({});
  await prisma.vehiclePhoto.deleteMany({});
  await prisma.vehicleDocument.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.ownerDocument.deleteMany({});
  await prisma.ownerBankAccount.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.user.deleteMany({});
  console.log("Cleanup complete\n");

  // ===========================================
  // Create Admin User
  // ===========================================
  console.log("Creating admin user...");
  const adminPassword = await bcrypt.hash("admin@123", 12);
  const admin = await prisma.user.create({
    data: {
      email: "admin@travenest.lk",
      password: adminPassword,
      firstName: "Geeneth",
      lastName: "Punchihewa",
      phone: "+94112345678",
      role: "ADMIN",
      // SUPER_ADMIN bypasses every permission check (admin.middleware.ts),
      // so the primary admin can perform every admin action including refunds.
      adminRole: "SUPER_ADMIN",
      status: "ACTIVE",
      isVerified: true,
      address: "No. 45, Galle Road",
      city: "Colombo 03",
      district: "Colombo",
      postalCode: "00300",
    },
  });
  console.log(`Admin created: ${admin.email}\n`);

  // Auth token lifetimes — editable at runtime via PlatformConfig; the API
  // falls back to env-configured defaults when these are absent.
  await prisma.platformConfig.createMany({
    data: [
      {
        key: "auth.accessTokenTtl",
        value: "1h",
        description: "Access token validity (e.g. 15m, 1h, 2h)",
      },
      {
        key: "auth.refreshTokenTtl",
        value: "30d",
        description: "Refresh token / remember-me validity (e.g. 7d, 30d)",
      },
    ],
    skipDuplicates: true,
  });

  // Public, editable content pages (Terms, Privacy, Refund, FAQ) — per-locale,
  // sourced from the web translation files and published.
  await seedContentPages(prisma);

  // ===========================================
  // Create Bus Owners with Realistic Sri Lankan Data
  // ===========================================
  console.log("Creating bus owners...\n");

  const owners = [];
  const ownerPassword = await bcrypt.hash("owner@123", 12);

  // Owner 1: Sinhala name from Colombo
  const owner1 = await prisma.user.create({
    data: {
      email: "nuwan.perera@gmail.com",
      password: ownerPassword,
      firstName: "Nuwan",
      lastName: "Perera",
      phone: "+94771234567",
      nicNumber: "199012345678",
      role: "VEHICLE_OWNER",
      status: "ACTIVE",
      isVerified: true,
      address: "No. 123, Highlevel Road",
      city: "Maharagama",
      district: "Colombo",
      postalCode: "10280",
      baseLocation: "Colombo",
    },
  });
  owners.push(owner1);
  console.log(`Owner 1: ${owner1.firstName} ${owner1.lastName} - Colombo`);

  // Owner 2: Tamil name from Jaffna
  const owner2 = await prisma.user.create({
    data: {
      email: "siva.kumar@yahoo.com",
      password: ownerPassword,
      firstName: "Sivakumar",
      lastName: "Rajaratnam",
      phone: "+94772345678",
      nicNumber: "198523456789",
      role: "VEHICLE_OWNER",
      status: "ACTIVE",
      isVerified: true,
      address: "No. 45, Hospital Road",
      city: "Jaffna",
      district: "Jaffna",
      postalCode: "40000",
      baseLocation: "Jaffna",
    },
  });
  owners.push(owner2);
  console.log(`Owner 2: ${owner2.firstName} ${owner2.lastName} - Jaffna`);

  // Owner 3: Sinhala name from Kandy
  const owner3 = await prisma.user.create({
    data: {
      email: "chaminda.silva@hotmail.com",
      password: ownerPassword,
      firstName: "Chaminda",
      lastName: "Silva",
      phone: "+94773456789",
      nicNumber: "198834567890",
      role: "VEHICLE_OWNER",
      status: "ACTIVE",
      isVerified: true,
      address: "No. 78, Peradeniya Road",
      city: "Kandy",
      district: "Kandy",
      postalCode: "20000",
      baseLocation: "Kandy",
    },
  });
  owners.push(owner3);
  console.log(`Owner 3: ${owner3.firstName} ${owner3.lastName} - Kandy`);

  // Owner 4: Muslim name from Batticaloa
  const owner4 = await prisma.user.create({
    data: {
      email: "mohamed.farook@gmail.com",
      password: ownerPassword,
      firstName: "Mohamed",
      lastName: "Farook",
      phone: "+94774567890",
      nicNumber: "199245678901",
      role: "VEHICLE_OWNER",
      status: "ACTIVE",
      isVerified: true,
      address: "No. 34, Main Street",
      city: "Batticaloa",
      district: "Batticaloa",
      postalCode: "30000",
      baseLocation: "Batticaloa",
    },
  });
  owners.push(owner4);
  console.log(`Owner 4: ${owner4.firstName} ${owner4.lastName} - Batticaloa`);

  // Owner 5: Sinhala name from Galle
  const owner5 = await prisma.user.create({
    data: {
      email: "kasun.fernando@outlook.com",
      password: ownerPassword,
      firstName: "Kasun",
      lastName: "Fernando",
      phone: "+94775678901",
      nicNumber: "199156789012",
      role: "VEHICLE_OWNER",
      status: "PENDING_VERIFICATION",
      isVerified: false,
      address: "No. 56, Matara Road",
      city: "Galle",
      district: "Galle",
      postalCode: "80000",
      baseLocation: "Galle",
    },
  });
  owners.push(owner5);
  console.log(
    `Owner 5: ${owner5.firstName} ${owner5.lastName} - Galle (Pending Verification)`,
  );

  console.log(`\nTotal owners created: ${owners.length}\n`);

  // ===========================================
  // Create Customers
  // ===========================================
  console.log("Creating customers...\n");
  const customerPassword = await bcrypt.hash("customer@123", 12);

  const customer1 = await prisma.user.create({
    data: {
      email: "dilshan.jayawardena@gmail.com",
      password: customerPassword,
      firstName: "Dilshan",
      lastName: "Jayawardena",
      phone: "+94776789012",
      role: "CUSTOMER",
      status: "ACTIVE",
      isVerified: true,
      address: "No. 89, Lake Road",
      city: "Nugegoda",
      district: "Colombo",
    },
  });
  console.log(`Customer 1: ${customer1.firstName} ${customer1.lastName}`);

  const customer2 = await prisma.user.create({
    data: {
      email: "priya.nathan@yahoo.com",
      password: customerPassword,
      firstName: "Priya",
      lastName: "Nathan",
      phone: "+94777890123",
      role: "CUSTOMER",
      status: "ACTIVE",
      isVerified: true,
      city: "Wellawatte",
      district: "Colombo",
    },
  });
  console.log(`Customer 2: ${customer2.firstName} ${customer2.lastName}`);

  const customer3 = await prisma.user.create({
    data: {
      email: "amal.senanayake@outlook.com",
      password: customerPassword,
      firstName: "Amal",
      lastName: "Senanayake",
      phone: "+94778901234",
      role: "CUSTOMER",
      status: "ACTIVE",
      isVerified: true,
      city: "Kandy",
      district: "Kandy",
    },
  });
  console.log(`Customer 3: ${customer3.firstName} ${customer3.lastName}`);

  const customer4 = await prisma.user.create({
    data: {
      email: "tharaka.wijesinghe@hotmail.com",
      password: customerPassword,
      firstName: "Tharaka",
      lastName: "Wijesinghe",
      phone: "+94702345678",
      role: "CUSTOMER",
      status: "ACTIVE",
      isVerified: true,
      address: "No. 78, Main Street",
      city: "Negombo",
      district: "Gampaha",
    },
  });
  console.log(`Customer 4: ${customer4.firstName} ${customer4.lastName}`);

  const customer5 = await prisma.user.create({
    data: {
      email: "nadeeka.silva@outlook.com",
      password: customerPassword,
      firstName: "Nadeeka",
      lastName: "Silva",
      phone: "+94778905555",
      role: "CUSTOMER",
      status: "ACTIVE",
      isVerified: true,
      address: "No. 23, Station Road",
      city: "Matara",
      district: "Matara",
    },
  });
  console.log(`Customer 5: ${customer5.firstName} ${customer5.lastName}\n`);

  // ===========================================
  // Seed Landing Page & Public Configuration Data
  // ===========================================
  console.log("Seeding landing page and public configuration data...\n");

  await prisma.platformStat.createMany({
    data: [
      {
        key: "verified_buses",
        value: "500+",
        label: "Verified Buses",
        sublabel: "Across Sri Lanka",
        sortOrder: 1,
      },
      {
        key: "active_routes",
        value: "120+",
        label: "Active Routes",
        sublabel: "Island-wide Coverage",
        sortOrder: 2,
      },
      {
        key: "happy_customers",
        value: "10K+",
        label: "Happy Travelers",
        sublabel: "Trusted by Families & Companies",
        sortOrder: 3,
      },
      {
        key: "trips_completed",
        value: "25K+",
        label: "Trips Completed",
        sublabel: "Safe & Reliable Journeys",
        sortOrder: 4,
      },
    ],
  });

  await prisma.popularRoute.createMany({
    data: [
      {
        fromCity: "Colombo",
        toCity: "Kandy",
        durationHours: 3,
        avgPrice: 18000,
        bookingsCount: 1200,
        imageUrl:
          "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?q=80&w=2070",
        isPopular: true,
        sortOrder: 1,
      },
      {
        fromCity: "Colombo",
        toCity: "Galle",
        durationHours: 2.5,
        avgPrice: 15000,
        bookingsCount: 980,
        imageUrl:
          "https://images.unsplash.com/photo-1588417495960-eb4c560c4a7a?q=80&w=2070",
        sortOrder: 2,
      },
      {
        fromCity: "Kandy",
        toCity: "Ella",
        durationHours: 4,
        avgPrice: 22000,
        bookingsCount: 850,
        imageUrl:
          "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=2071",
        sortOrder: 3,
      },
      {
        fromCity: "Colombo",
        toCity: "Anuradhapura",
        durationHours: 4.5,
        avgPrice: 25000,
        bookingsCount: 720,
        imageUrl:
          "https://images.unsplash.com/photo-1588402237163-0a6d2f6a5ef7?q=80&w=2073",
        sortOrder: 4,
      },
      {
        fromCity: "Negombo",
        toCity: "Sigiriya",
        durationHours: 3.5,
        avgPrice: 20000,
        bookingsCount: 650,
        imageUrl:
          "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070",
        sortOrder: 5,
      },
    ],
  });

  await prisma.testimonial.createMany({
    data: [
      {
        name: "Rajesh Perera",
        role: "Operations Manager",
        organization: "Ceylon Academy",
        imageUrl:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
        rating: 5,
        quote:
          "TravelNest made organizing our annual school trip incredibly easy. The transparent pricing and verified owners gave us complete peace of mind.",
        tripDetails: "Colombo to Kandy - 3 day educational tour",
        sortOrder: 1,
      },
      {
        name: "Shenali Fernando",
        role: "HR Executive",
        organization: "Lanka Tech Solutions",
        imageUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
        rating: 5,
        quote:
          "Excellent service and professional drivers. We now use TravelNest for all our corporate transport requirements.",
        tripDetails: "Corporate transfer - Colombo to Galle",
        sortOrder: 2,
      },
      {
        name: "Mohamed Irfan",
        role: "Travel Coordinator",
        organization: "Pearl Tours",
        imageUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
        rating: 5,
        quote:
          "Reliable fleet, clear communication, and competitive pricing. Our clients consistently appreciate the service quality.",
        tripDetails: "Multi-city leisure tour",
        sortOrder: 3,
      },
    ],
  });

  await prisma.trustedPartner.createMany({
    data: [
      { name: "Ceylon Academy", sortOrder: 1 },
      { name: "Lanka Tech Solutions", sortOrder: 2 },
      { name: "Pearl Tours", sortOrder: 3 },
      { name: "Island Adventures", sortOrder: 4 },
      { name: "University Travel Club", sortOrder: 5 },
      { name: "Sri Lanka Events", sortOrder: 6 },
    ],
  });

  await prismaAny.platformConfig.createMany({
    data: [
      {
        key: "contact_info",
        description: "Public contact information for frontend contact page",
        value: {
          address: "No. 45, Galle Road, Colombo 03",
          email: "support@travelnest.lk",
          phone: "+94112345678",
          hours: "Mon - Fri, 8:30 AM - 6:00 PM",
        },
      },
      {
        key: "vehicle_types",
        description: "Vehicle types shown in search and registration forms",
        value: [
          { value: "ORDINARY", label: "Ordinary Bus" },
          { value: "SEMI_LUXURY", label: "Semi-Luxury" },
          { value: "LUXURY_AC", label: "Luxury AC" },
        ],
      },
      {
        key: "ac_types",
        description: "AC type options shown across forms",
        value: [
          { value: "FULL_AC", label: "Full AC" },
          { value: "AC", label: "AC" },
          { value: "NON_AC", label: "Non-AC" },
        ],
      },
      {
        key: "vehicle_conditions",
        description: "Vehicle condition options for owner registration",
        value: [
          { value: "excellent", label: "Excellent" },
          { value: "good", label: "Good" },
          { value: "fair", label: "Fair" },
        ],
      },
      {
        key: "vehicle_amenities",
        description:
          "Configurable amenity options for filters and registration",
        value: [
          { id: "wifi", label: "WiFi" },
          { id: "ac", label: "Air Conditioning" },
          { id: "music", label: "Music System" },
          { id: "usb", label: "USB Charging" },
          { id: "tv", label: "TV/Entertainment" },
          { id: "reclining", label: "Reclining Seats" },
          { id: "reading", label: "Reading Lights" },
          { id: "gps", label: "GPS Tracking" },
        ],
      },
      {
        key: "districts",
        description: "Supported Sri Lankan districts for location selectors",
        value: SRI_LANKAN_DISTRICTS,
      },
      {
        key: "quotation_vehicle_types",
        description: "Vehicle type options for quotation requests",
        value: [
          { value: "ORDINARY", label: "Ordinary Bus" },
          { value: "SEMI_LUXURY", label: "Semi-Luxury" },
          { value: "LUXURY_AC", label: "Luxury AC" },
        ],
      },
      {
        key: "quotation_pricing",
        description:
          "Configurable quotation pricing parameters used by owner quotation builder",
        value: {
          driverCostPercentage: 0.2,
          fuelCostPerKm: 50,
          tollChargesBase: 2000,
          permitFeesBase: 1500,
          taxRate: 0.1,
          defaultValidityDays: 7,
          validityOptionsDays: [3, 5, 7, 14, 30],
        },
      },
      {
        key: "recent_searches",
        description: "Seeded recent searches shown in quotation creation page",
        value: [
          {
            id: "1",
            from: "Colombo",
            to: "Kandy",
            date: "2026-02-15",
            passengers: 4,
          },
          {
            id: "2",
            from: "Galle",
            to: "Colombo Airport",
            date: "2026-02-20",
            passengers: 2,
          },
          {
            id: "3",
            from: "Kandy",
            to: "Nuwara Eliya",
            date: "2026-03-01",
            passengers: 6,
          },
        ],
      },
      {
        key: "social_media_links",
        description:
          "Public social media links used by footer and contact page",
        value: {
          facebook: "https://facebook.com/travelnest",
          instagram: "https://instagram.com/travelnest",
          twitter: "https://x.com/travelnest",
          linkedin: "https://linkedin.com/company/travelnest",
        },
      },
      {
        key: "google_maps_embed",
        description: "Public map configuration for contact page embed",
        value: {
          embedUrl:
            "https://www.google.com/maps?q=No.+45,+Galle+Road,+Colombo+03&output=embed",
          lat: 6.9271,
          lng: 79.8612,
          zoom: 15,
          address: "No. 45, Galle Road, Colombo 03, Sri Lanka",
        },
      },
      {
        key: "about_page_stats",
        description: "About page impact and achievement counters",
        value: [
          { label: "Verified Buses", value: "500+", icon: "bus" },
          { label: "Happy Customers", value: "10K+", icon: "users" },
          { label: "Districts Covered", value: "25", icon: "map" },
          { label: "Average Rating", value: "4.8★", icon: "star" },
        ],
      },
      {
        key: "login_marketing_stats",
        description: "Configurable marketing counters shown on login page",
        value: {
          verifiedBuses: "500+",
          happyCustomers: "5000+",
          averageRating: "4.8★",
        },
      },
    ],
  });

  console.log("Landing and public config seed data created\n");

  // ===========================================
  // Create Owner Documents (Different Statuses)
  // ===========================================
  console.log("Creating owner documents...\n");

  // Owner 1 - All verified
  await prisma.ownerDocument.createMany({
    data: [
      {
        ownerId: owner1.id,
        type: "NIC",
        url: "https://zjypaacrpocxqhdywuhz.supabase.co/storage/v1/object/public/travelnest/registration/owner-documents/1771230832143_5d13l5n2_Container__5_.png",
        fileName: "nic-front.pdf",
        fileSize: 524288,
        mimeType: "application/pdf",
        status: "VERIFIED",
        verifiedAt: new Date("2026-02-10T10:00:00.000Z"),
        verifiedBy: admin.id,
      },
      {
        ownerId: owner1.id,
        type: "DRIVING_LICENSE",
        url: "https://storage.example.com/docs/owner1-license.pdf",
        fileName: "driving-license.pdf",
        fileSize: 425984,
        mimeType: "application/pdf",
        status: "VERIFIED",
        verifiedAt: new Date("2026-02-10T10:00:00.000Z"),
        verifiedBy: admin.id,
      },
      {
        ownerId: owner1.id,
        type: "INSURANCE",
        url: "https://storage.example.com/docs/owner1-insurance.pdf",
        fileName: "insurance-certificate.pdf",
        fileSize: 687104,
        mimeType: "application/pdf",
        status: "VERIFIED",
        verifiedAt: new Date("2026-02-10T10:00:00.000Z"),
        verifiedBy: admin.id,
      },
    ],
  });

  // Owner 5 - Pending verification
  await prisma.ownerDocument.createMany({
    data: [
      {
        ownerId: owner5.id,
        type: "NIC",
        url: "https://storage.example.com/docs/owner5-nic.pdf",
        fileName: "nic-both-sides.pdf",
        fileSize: 512000,
        mimeType: "application/pdf",
        status: "PENDING",
      },
      {
        ownerId: owner5.id,
        type: "DRIVING_LICENSE",
        url: "https://storage.example.com/docs/owner5-license.pdf",
        fileName: "license.pdf",
        fileSize: 458752,
        mimeType: "application/pdf",
        status: "PENDING",
      },
    ],
  });

  // Owner 2 - One rejected document
  await prisma.ownerDocument.createMany({
    data: [
      {
        ownerId: owner2.id,
        type: "NIC",
        url: "https://storage.example.com/docs/owner2-nic.pdf",
        fileName: "nic.pdf",
        fileSize: 498432,
        mimeType: "application/pdf",
        status: "VERIFIED",
        verifiedAt: new Date("2026-02-05T14:00:00.000Z"),
        verifiedBy: admin.id,
      },
      {
        ownerId: owner2.id,
        type: "INSURANCE",
        url: "https://storage.example.com/docs/owner2-insurance.pdf",
        fileName: "insurance-expired.pdf",
        fileSize: 625000,
        mimeType: "application/pdf",
        status: "REJECTED",
        rejectionReason:
          "Insurance certificate has expired. Please upload a current valid certificate.",
      },
    ],
  });

  console.log("Created owner documents with various statuses\n");

  // ===========================================
  // Create Vehicles for Each Owner
  // ===========================================
  console.log("Creating vehicles...\n");

  let vehicleIndex = 0;

  // Owner 1 Vehicles (Nuwan Perera - Colombo) - 4 Luxury Coaches
  const owner1VehicleData = [
    {
      name: "Ashok Leyland Viking Luxury Coach",
      description:
        "Premium luxury coach with reclining seats, entertainment system, and refreshments. Perfect for corporate tours and long-distance travel.",
      type: "LUXURY_AC" as const,
      brand: "Ashok Leyland",
      model: "Viking",
      year: 2023,
      color: "White",
      seats: 45,
      acType: "FULL_AC" as const,
      fuelType: "DIESEL" as const,
      transmission: "MANUAL" as const,
      features: [
        "Full AC",
        "Reclining Seats",
        "Entertainment System",
        "WiFi",
        "Refreshments",
        "USB Charging",
        "GPS Tracking",
        "CCTV",
      ],
      pricePerDay: 35000,
      pricePerKm: 85,
      location: "Colombo",
      condition: "EXCELLENT" as const,
      isAvailable: true,
      isActive: true,
    },
    {
      name: "TATA Marcopolo Semi-Luxury",
      description:
        "Comfortable semi-luxury bus ideal for pilgrimages and family trips. Well-maintained with experienced drivers.",
      type: "LUXURY_AC" as const,
      brand: "TATA",
      model: "Marcopolo",
      year: 2022,
      color: "Silver",
      seats: 52,
      acType: "SEMI_AC" as const,
      fuelType: "DIESEL" as const,
      transmission: "MANUAL" as const,
      features: [
        "Semi AC",
        "Pushback Seats",
        "PA System",
        "Luggage Compartment",
        "First Aid Kit",
      ],
      pricePerDay: 28000,
      pricePerKm: 70,
      location: "Colombo",
      condition: "GOOD" as const,
      isAvailable: true,
      isActive: true,
    },
    {
      name: "Toyota Coaster Mini Bus",
      description:
        "Compact and efficient mini bus perfect for small groups and city tours. Easy to maneuver through narrow roads.",
      type: "SEMI_LUXURY" as const,
      brand: "Toyota",
      model: "Coaster",
      year: 2021,
      color: "Blue",
      seats: 28,
      acType: "FULL_AC" as const,
      fuelType: "DIESEL" as const,
      transmission: "AUTOMATIC" as const,
      features: [
        "Full AC",
        "Comfortable Seats",
        "TV/DVD",
        "Microphone",
        "USB Charging",
      ],
      pricePerDay: 22000,
      pricePerKm: 60,
      location: "Colombo",
      condition: "EXCELLENT" as const,
      isAvailable: true,
      isActive: true,
    },
    {
      name: "Isuzu Journey School Service",
      description:
        "Reliable school service bus with safety features. Currently available for weekend bookings.",
      type: "LUXURY_AC" as const,
      brand: "Isuzu",
      model: "Journey",
      year: 2020,
      color: "Yellow",
      seats: 40,
      acType: "NON_AC" as const,
      fuelType: "DIESEL" as const,
      transmission: "MANUAL" as const,
      features: [
        "Safety Belts",
        "First Aid",
        "Fire Extinguisher",
        "Emergency Exit",
        "CCTV",
      ],
      pricePerDay: 18000,
      pricePerKm: 50,
      location: "Colombo",
      condition: "GOOD" as const,
      isAvailable: false, // In use for school service on weekdays
      isActive: true,
    },
  ];

  for (const vehicleData of owner1VehicleData) {
    const coords = LOCATIONS[vehicleData.location];
    await prisma.vehicle.create({
      data: {
        ownerId: owner1.id,
        name: vehicleData.name,
        description: vehicleData.description,
        type: vehicleData.type,
        brand: vehicleData.brand,
        model: vehicleData.model,
        year: vehicleData.year,
        licensePlate: generateLicensePlate(vehicleIndex++),
        color: vehicleData.color,
        seats: vehicleData.seats,
        acType: vehicleData.acType,
        fuelType: vehicleData.fuelType,
        transmission: vehicleData.transmission,
        features: vehicleData.features,
        images: [],
        pricePerDay: vehicleData.pricePerDay,
        pricePerKm: vehicleData.pricePerKm,
        location: vehicleData.location,
        latitude: coords.latitude,
        longitude: coords.longitude,
        condition: vehicleData.condition,
        isAvailable: vehicleData.isAvailable,
        isActive: vehicleData.isActive,
      },
    });
  }
  console.log(
    `Created ${owner1VehicleData.length} vehicles for ${owner1.firstName} ${owner1.lastName}`,
  );

  // Owner 2 Vehicles (Sivakumar - Jaffna) - 3 Vehicles
  const owner2VehicleData = [
    {
      name: "Ashok Leyland Lynx AC Coach",
      description:
        "Modern AC coach for comfortable travel across Northern Province. Ideal for temple visits and cultural tours.",
      type: "LUXURY_AC" as const,
      brand: "Ashok Leyland",
      model: "Lynx",
      year: 2022,
      color: "White",
      seats: 48,
      acType: "FULL_AC" as const,
      fuelType: "DIESEL" as const,
      transmission: "MANUAL" as const,
      features: [
        "Full AC",
        "Reclining Seats",
        "Curtains",
        "PA System",
        "Cool Box",
      ],
      pricePerDay: 30000,
      pricePerKm: 75,
      location: "Jaffna",
      condition: "EXCELLENT" as const,
      isAvailable: true,
      isActive: true,
    },
    {
      name: "TATA Starbus Standard",
      description:
        "Economical option for budget-conscious travelers. Well-maintained and reliable for local trips.",
      type: "LUXURY_AC" as const,
      brand: "TATA",
      model: "Starbus",
      year: 2019,
      color: "Red",
      seats: 54,
      acType: "NON_AC" as const,
      fuelType: "DIESEL" as const,
      transmission: "MANUAL" as const,
      features: ["Fan", "Luggage Rack", "Emergency Exit", "First Aid"],
      pricePerDay: 15000,
      pricePerKm: 45,
      location: "Jaffna",
      condition: "GOOD" as const,
      isAvailable: true,
      isActive: true,
    },
    {
      name: "Mitsubishi Rosa Deluxe",
      description:
        "Premium mini bus with extra legroom. Perfect for VIP transport and small corporate groups.",
      type: "SEMI_LUXURY" as const,
      brand: "Mitsubishi",
      model: "Rosa",
      year: 2023,
      color: "Black",
      seats: 22,
      acType: "FULL_AC" as const,
      fuelType: "DIESEL" as const,
      transmission: "AUTOMATIC" as const,
      features: [
        "Full AC",
        "Leather Seats",
        "Tinted Windows",
        "Mini Fridge",
        "WiFi",
        "TV",
      ],
      pricePerDay: 25000,
      pricePerKm: 65,
      location: "Jaffna",
      condition: "EXCELLENT" as const,
      isAvailable: true,
      isActive: true,
    },
    {
      name: "TATA Starbus Under Maintenance",
      description:
        "Currently undergoing scheduled maintenance. Will be available soon.",
      type: "SEMI_LUXURY" as const,
      brand: "TATA",
      model: "Starbus",
      year: 2020,
      color: "White",
      seats: 40,
      acType: "SEMI_AC" as const,
      fuelType: "DIESEL" as const,
      transmission: "MANUAL" as const,
      features: [
        "Semi AC",
        "Comfortable Seats",
        "Music System",
        "Storage Space",
      ],
      pricePerDay: 18000,
      pricePerKm: 45,
      location: "Jaffna",
      condition: "GOOD" as const,
      isAvailable: false,
      isActive: false,
    },
  ];

  for (const vehicleData of owner2VehicleData) {
    const coords = LOCATIONS[vehicleData.location];
    await prisma.vehicle.create({
      data: {
        ownerId: owner2.id,
        name: vehicleData.name,
        description: vehicleData.description,
        type: vehicleData.type,
        brand: vehicleData.brand,
        model: vehicleData.model,
        year: vehicleData.year,
        licensePlate: generateLicensePlate(vehicleIndex++),
        color: vehicleData.color,
        seats: vehicleData.seats,
        acType: vehicleData.acType,
        fuelType: vehicleData.fuelType,
        transmission: vehicleData.transmission,
        features: vehicleData.features,
        images: [],
        pricePerDay: vehicleData.pricePerDay,
        pricePerKm: vehicleData.pricePerKm,
        location: vehicleData.location,
        latitude: coords.latitude,
        longitude: coords.longitude,
        condition: vehicleData.condition,
        isAvailable: vehicleData.isAvailable,
        isActive: vehicleData.isActive,
      },
    });
  }
  console.log(
    `Created ${owner2VehicleData.length} vehicles for ${owner2.firstName} ${owner2.lastName}`,
  );

  // Owner 3 Vehicles (Chaminda - Kandy) - 3 Vehicles
  const owner3VehicleData = [
    {
      name: "Hino RK8J Tourist Coach",
      description:
        "Japanese-built tourist coach with panoramic windows. Ideal for hill country tours and scenic routes.",
      type: "LUXURY_AC" as const,
      brand: "Hino",
      model: "RK8J",
      year: 2021,
      color: "Green",
      seats: 42,
      acType: "FULL_AC" as const,
      fuelType: "DIESEL" as const,
      transmission: "MANUAL" as const,
      features: [
        "Panoramic Windows",
        "Full AC",
        "Reclining Seats",
        "Tour Guide Mic",
        "Cool Box",
        "USB Charging",
      ],
      pricePerDay: 32000,
      pricePerKm: 80,
      location: "Kandy",
      condition: "EXCELLENT" as const,
      isAvailable: true,
      isActive: true,
    },
    {
      name: "Toyota HiAce Commuter",
      description:
        "Versatile commuter van perfect for small groups exploring Kandy and surrounding areas.",
      type: "ORDINARY" as const,
      brand: "Toyota",
      model: "HiAce",
      year: 2022,
      color: "Silver",
      seats: 14,
      acType: "FULL_AC" as const,
      fuelType: "DIESEL" as const,
      transmission: "AUTOMATIC" as const,
      features: [
        "Full AC",
        "Comfortable Seats",
        "Luggage Space",
        "USB Charging",
      ],
      pricePerDay: 18000,
      pricePerKm: 55,
      location: "Kandy",
      condition: "EXCELLENT" as const,
      isAvailable: true,
      isActive: true,
    },
    {
      name: "Nissan Civilian Pilgrim Bus",
      description:
        "Specially equipped for religious pilgrimages with ample space for offerings and luggage.",
      type: "LUXURY_AC" as const,
      brand: "Nissan",
      model: "Civilian",
      year: 2020,
      color: "White",
      seats: 30,
      acType: "SEMI_AC" as const,
      fuelType: "DIESEL" as const,
      transmission: "MANUAL" as const,
      features: [
        "Semi AC",
        "Extra Luggage Space",
        "PA System",
        "DVD Player",
        "Curtains",
      ],
      pricePerDay: 20000,
      pricePerKm: 55,
      location: "Kandy",
      condition: "GOOD" as const,
      isAvailable: true,
      isActive: true,
    },
    {
      name: "BYD eBus - Inactive",
      description:
        "Electric bus currently inactive. Being prepared for registration.",
      type: "LUXURY_AC" as const,
      brand: "BYD",
      model: "K9",
      year: 2024,
      color: "Green",
      seats: 35,
      acType: "FULL_AC" as const,
      fuelType: "ELECTRIC" as const,
      transmission: "AUTOMATIC" as const,
      features: [
        "Full AC",
        "Electric Drive",
        "Zero Emissions",
        "USB Charging",
        "WiFi",
      ],
      pricePerDay: 28000,
      pricePerKm: 0, // Electric, no per km charge
      location: "Kandy",
      condition: "EXCELLENT" as const,
      isAvailable: false,
      isActive: false,
    },
  ];

  for (const vehicleData of owner3VehicleData) {
    const coords = LOCATIONS[vehicleData.location];
    await prisma.vehicle.create({
      data: {
        ownerId: owner3.id,
        name: vehicleData.name,
        description: vehicleData.description,
        type: vehicleData.type,
        brand: vehicleData.brand,
        model: vehicleData.model,
        year: vehicleData.year,
        licensePlate: generateLicensePlate(vehicleIndex++),
        color: vehicleData.color,
        seats: vehicleData.seats,
        acType: vehicleData.acType,
        fuelType: vehicleData.fuelType,
        transmission: vehicleData.transmission,
        features: vehicleData.features,
        images: [],
        pricePerDay: vehicleData.pricePerDay,
        pricePerKm: vehicleData.pricePerKm,
        location: vehicleData.location,
        latitude: coords.latitude,
        longitude: coords.longitude,
        condition: vehicleData.condition,
        isAvailable: vehicleData.isAvailable,
        isActive: vehicleData.isActive,
      },
    });
  }
  console.log(
    `Created ${owner3VehicleData.length} vehicles for ${owner3.firstName} ${owner3.lastName}`,
  );

  // Owner 4 Vehicles (Mohamed Farook - Batticaloa) - 2 Vehicles
  const owner4VehicleData = [
    {
      name: "TATA LP913 Eastern Express",
      description:
        "Reliable bus for Eastern Province travel. Regular service to Colombo and back.",
      type: "LUXURY_AC" as const,
      brand: "TATA",
      model: "LP913",
      year: 2021,
      color: "Blue",
      seats: 50,
      acType: "SEMI_AC" as const,
      fuelType: "DIESEL" as const,
      transmission: "MANUAL" as const,
      features: [
        "Semi AC",
        "Reclining Seats",
        "Luggage Compartment",
        "Mobile Charging",
      ],
      pricePerDay: 25000,
      pricePerKm: 65,
      location: "Batticaloa",
      condition: "GOOD" as const,
      isAvailable: true,
      isActive: true,
    },
    {
      name: "Isuzu NPR Mini Coach",
      description:
        "Compact coach ideal for local tours and wedding transport in the Eastern region.",
      type: "SEMI_LUXURY" as const,
      brand: "Isuzu",
      model: "NPR",
      year: 2022,
      color: "White",
      seats: 26,
      acType: "FULL_AC" as const,
      fuelType: "DIESEL" as const,
      transmission: "MANUAL" as const,
      features: ["Full AC", "Decorated Interior", "Sound System", "LED Lights"],
      pricePerDay: 20000,
      pricePerKm: 55,
      location: "Batticaloa",
      condition: "EXCELLENT" as const,
      isAvailable: true,
      isActive: true,
    },
  ];

  for (const vehicleData of owner4VehicleData) {
    const coords = LOCATIONS[vehicleData.location];
    await prisma.vehicle.create({
      data: {
        ownerId: owner4.id,
        name: vehicleData.name,
        description: vehicleData.description,
        type: vehicleData.type,
        brand: vehicleData.brand,
        model: vehicleData.model,
        year: vehicleData.year,
        licensePlate: generateLicensePlate(vehicleIndex++),
        color: vehicleData.color,
        seats: vehicleData.seats,
        acType: vehicleData.acType,
        fuelType: vehicleData.fuelType,
        transmission: vehicleData.transmission,
        features: vehicleData.features,
        images: [],
        pricePerDay: vehicleData.pricePerDay,
        pricePerKm: vehicleData.pricePerKm,
        location: vehicleData.location,
        latitude: coords.latitude,
        longitude: coords.longitude,
        condition: vehicleData.condition,
        isAvailable: vehicleData.isAvailable,
        isActive: vehicleData.isActive,
      },
    });
  }
  console.log(
    `Created ${owner4VehicleData.length} vehicles for ${owner4.firstName} ${owner4.lastName}`,
  );

  // Owner 5 Vehicles (Kasun Fernando - Galle, Pending Verification) - 2 Vehicles (inactive)
  const owner5VehicleData = [
    {
      name: "Ashok Leyland Boss Super Luxury",
      description:
        "Brand new super luxury coach with premium amenities. Currently pending verification.",
      type: "LUXURY_AC" as const,
      brand: "Ashok Leyland",
      model: "Boss",
      year: 2024,
      color: "Pearl White",
      seats: 45,
      acType: "FULL_AC" as const,
      fuelType: "DIESEL" as const,
      transmission: "MANUAL" as const,
      features: [
        "Super AC",
        "Leather Reclining Seats",
        "Personal Screens",
        "WiFi",
        "Refreshments",
        "Toilet",
      ],
      pricePerDay: 45000,
      pricePerKm: 100,
      location: "Galle",
      condition: "EXCELLENT" as const,
      isAvailable: false,
      isActive: false, // Pending verification
    },
    {
      name: "BYD K9 Electric Coach",
      description:
        "Eco-friendly electric bus for sustainable tourism. Zero emissions, quiet operation.",
      type: "LUXURY_AC" as const,
      brand: "BYD",
      model: "K9",
      year: 2024,
      color: "Green",
      seats: 35,
      acType: "FULL_AC" as const,
      fuelType: "ELECTRIC" as const,
      transmission: "AUTOMATIC" as const,
      features: [
        "Full AC",
        "Zero Emissions",
        "Quiet Ride",
        "USB Charging",
        "WiFi",
        "Large Windows",
      ],
      pricePerDay: 40000,
      pricePerKm: 90,
      location: "Galle",
      condition: "EXCELLENT" as const,
      isAvailable: false,
      isActive: false, // Pending verification
    },
  ];

  for (const vehicleData of owner5VehicleData) {
    const coords = LOCATIONS[vehicleData.location];
    await prisma.vehicle.create({
      data: {
        ownerId: owner5.id,
        name: vehicleData.name,
        description: vehicleData.description,
        type: vehicleData.type,
        brand: vehicleData.brand,
        model: vehicleData.model,
        year: vehicleData.year,
        licensePlate: generateLicensePlate(vehicleIndex++),
        color: vehicleData.color,
        seats: vehicleData.seats,
        acType: vehicleData.acType,
        fuelType: vehicleData.fuelType,
        transmission: vehicleData.transmission,
        features: vehicleData.features,
        images: [],
        pricePerDay: vehicleData.pricePerDay,
        pricePerKm: vehicleData.pricePerKm,
        location: vehicleData.location,
        latitude: coords.latitude,
        longitude: coords.longitude,
        condition: vehicleData.condition,
        isAvailable: vehicleData.isAvailable,
        isActive: vehicleData.isActive,
      },
    });
  }
  console.log(
    `Created ${owner5VehicleData.length} vehicles for ${owner5.firstName} ${owner5.lastName} (Pending)`,
  );

  // ===========================================
  // Create trip packages for owners
  // ===========================================
  console.log("\nCreating trip packages...\n");

  const pickRandomDistrict = (exclude?: string) => {
    const candidates = SRI_LANKAN_DISTRICTS.filter((d) => d !== exclude);
    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  const createPackagesForOwner = async (ownerId: string) => {
    const vehicles = await prisma.vehicle.findMany({
      where: { ownerId },
      orderBy: { createdAt: "asc" },
    });

    for (const vehicle of vehicles) {
      const packageCount = 1 + Math.floor(Math.random() * 4);
      for (let i = 0; i < packageCount; i += 1) {
        const startLocation = vehicle.location;
        const endLocation = pickRandomDistrict(startLocation);
        const durationDays = 1 + Math.floor(Math.random() * 5);
        const minPassengers = Math.max(10, Math.floor(vehicle.seats * 0.5));
        const maxPassengers = vehicle.seats;
        const basePrice = vehicle.pricePerDay * durationDays;
        const price = Math.round(basePrice * (0.9 + Math.random() * 0.6));

        await prisma.tripPackage.create({
          data: {
            ownerId: vehicle.ownerId,
            vehicleId: vehicle.id,
            title: `${startLocation} to ${endLocation} ${durationDays}-Day Trip`,
            description:
              "Fixed itinerary package with experienced driver and standard amenities.",
            startLocation,
            endLocation,
            durationDays,
            price,
            minPassengers,
            maxPassengers,
            isActive: vehicle.isActive,
          },
        });
      }
    }
  };

  for (const owner of owners) {
    await createPackagesForOwner(owner.id);
  }
  console.log("Trip packages created\n");

  // ===========================================
  // Create sample quotations
  // ===========================================
  console.log("\nCreating sample quotations...\n");

  // Get vehicles for quotations
  const owner1Vehicles = await prisma.vehicle.findMany({
    where: { ownerId: owner1.id },
  });
  const owner2Vehicles = await prisma.vehicle.findMany({
    where: { ownerId: owner2.id },
  });
  const owner3Vehicles = await prisma.vehicle.findMany({
    where: { ownerId: owner3.id },
  });
  const owner4Vehicles = await prisma.vehicle.findMany({
    where: { ownerId: owner4.id },
  });

  // ===========================================
  // Vehicle Photos (P1 — edit vehicle photo tab)
  // ===========================================
  console.log("Creating vehicle photos and documents...\n");

  // Photo URLs rotated across vehicles so each one looks distinct in the fleet view.
  const vehiclePhotoSets = [
    {
      primary: "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800",
      secondary: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800",
      tertiary: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
    },
    {
      primary: "https://images.unsplash.com/photo-1570125872073-0a9a1d8f9d79?w=800",
      secondary: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
      tertiary: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800",
    },
    {
      primary: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800",
      secondary: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800",
      tertiary: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
    },
    {
      primary: "https://images.unsplash.com/photo-1586016413664-864c0dd76f53?w=800",
      secondary: "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800",
      tertiary: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800",
    },
  ];

  for (let i = 0; i < owner1Vehicles.length; i++) {
    const vehicle = owner1Vehicles[i]!;
    const set = vehiclePhotoSets[i % vehiclePhotoSets.length]!;
    await prisma.vehiclePhoto.createMany({
      data: [
        {
          vehicleId: vehicle.id,
          url: set.primary,
          fileName: "exterior-front.jpg",
          fileSize: 524288,
          mimeType: "image/jpeg",
          isPrimary: true,
          sortOrder: 0,
        },
        {
          vehicleId: vehicle.id,
          url: set.secondary,
          fileName: "interior-seats.jpg",
          fileSize: 487424,
          mimeType: "image/jpeg",
          isPrimary: false,
          sortOrder: 1,
        },
        {
          vehicleId: vehicle.id,
          url: set.tertiary,
          fileName: "exterior-side.jpg",
          fileSize: 512000,
          mimeType: "image/jpeg",
          isPrimary: false,
          sortOrder: 2,
        },
      ],
    });
  }

  // Vehicle photos for owner3's first vehicle
  if (owner3Vehicles[0]) {
    await prisma.vehiclePhoto.createMany({
      data: [
        {
          vehicleId: owner3Vehicles[0].id,
          url: "https://images.unsplash.com/photo-1588417495960-eb4c560c4a7a?w=800",
          fileName: "exterior.jpg",
          fileSize: 512000,
          mimeType: "image/jpeg",
          isPrimary: true,
          sortOrder: 0,
        },
        {
          vehicleId: owner3Vehicles[0].id,
          url: "https://images.unsplash.com/photo-1588402237163-0a6d2f6a5ef7?w=800",
          fileName: "panoramic-windows.jpg",
          fileSize: 498432,
          mimeType: "image/jpeg",
          isPrimary: false,
          sortOrder: 1,
        },
      ],
    });
  }

  // ===========================================
  // Vehicle Documents (P1 — edit vehicle docs)
  // ===========================================
  for (const vehicle of owner1Vehicles.slice(0, 2)) {
    await prisma.vehicleDocument.createMany({
      data: [
        {
          vehicleId: vehicle.id,
          type: "DRIVING_LICENSE",
          url: "https://storage.example.com/docs/vehicle-license.pdf",
          fileName: "driving-license.pdf",
          fileSize: 425984,
          mimeType: "application/pdf",
          status: "VERIFIED",
          verifiedAt: new Date("2026-02-10T10:00:00.000Z"),
          verifiedBy: admin.id,
          expiryDate: new Date("2028-06-30T00:00:00.000Z"),
        },
        {
          vehicleId: vehicle.id,
          type: "INSURANCE",
          url: "https://storage.example.com/docs/vehicle-insurance.pdf",
          fileName: "insurance-certificate.pdf",
          fileSize: 687104,
          mimeType: "application/pdf",
          status: "VERIFIED",
          verifiedAt: new Date("2026-02-10T10:00:00.000Z"),
          verifiedBy: admin.id,
          expiryDate: new Date("2027-01-31T00:00:00.000Z"),
        },
        {
          vehicleId: vehicle.id,
          type: "REGISTRATION_CERTIFICATE",
          url: "https://storage.example.com/docs/vehicle-registration.pdf",
          fileName: "registration-certificate.pdf",
          fileSize: 368640,
          mimeType: "application/pdf",
          status: "VERIFIED",
          verifiedAt: new Date("2026-02-10T10:00:00.000Z"),
          verifiedBy: admin.id,
        },
      ],
    });
  }

  // Owner 2: one vehicle with mixed document statuses (shows rejected state)
  if (owner2Vehicles[0]) {
    await prisma.vehicleDocument.createMany({
      data: [
        {
          vehicleId: owner2Vehicles[0].id,
          type: "DRIVING_LICENSE",
          url: "https://storage.example.com/docs/owner2-vehicle-license.pdf",
          fileName: "driving-license.pdf",
          fileSize: 425984,
          mimeType: "application/pdf",
          status: "VERIFIED",
          verifiedAt: new Date("2026-02-05T14:00:00.000Z"),
          verifiedBy: admin.id,
          expiryDate: new Date("2027-12-31T00:00:00.000Z"),
        },
        {
          vehicleId: owner2Vehicles[0].id,
          type: "INSURANCE",
          url: "https://storage.example.com/docs/owner2-vehicle-insurance-expired.pdf",
          fileName: "insurance-expired.pdf",
          fileSize: 512000,
          mimeType: "application/pdf",
          status: "REJECTED",
          rejectionReason:
            "Insurance certificate is expired. Please upload a current valid certificate.",
          expiryDate: new Date("2025-12-31T00:00:00.000Z"),
        },
        {
          vehicleId: owner2Vehicles[0].id,
          type: "REGISTRATION_CERTIFICATE",
          url: "https://storage.example.com/docs/owner2-vehicle-registration.pdf",
          fileName: "registration.pdf",
          fileSize: 368640,
          mimeType: "application/pdf",
          status: "PENDING",
        },
      ],
    });
  }

  console.log(
    `Created vehicle photos and documents for owners 1–2 and owner 3 first vehicle\n`,
  );

  // ===========================================
  // Vehicle Availability Blocked Periods (P3 — calendar page)
  // ===========================================
  console.log("Creating vehicle availability blocked periods...\n");

  if (owner1Vehicles[0]) {
    await prisma.vehicleAvailability.createMany({
      data: [
        {
          vehicleId: owner1Vehicles[0].id,
          startDate: new Date("2026-07-01T00:00:00.000Z"),
          endDate: new Date("2026-07-05T23:59:59.000Z"),
          isBlocked: true,
          reason: "Scheduled maintenance — annual service",
        },
        {
          vehicleId: owner1Vehicles[0].id,
          startDate: new Date("2026-07-20T00:00:00.000Z"),
          endDate: new Date("2026-07-22T23:59:59.000Z"),
          isBlocked: true,
          reason: "Owner personal reservation",
        },
      ],
    });
  }

  if (owner3Vehicles[0]) {
    await prisma.vehicleAvailability.createMany({
      data: [
        {
          vehicleId: owner3Vehicles[0].id,
          startDate: new Date("2026-07-10T00:00:00.000Z"),
          endDate: new Date("2026-07-12T23:59:59.000Z"),
          isBlocked: true,
          reason: "Driver annual leave",
        },
      ],
    });
  }

  console.log("Created vehicle availability blocked periods\n");

  let quotationCounter = 1;
  const generateQuotationId = () => {
    const id = `QUO-2026-${String(quotationCounter).padStart(3, "0")}`;
    quotationCounter++;
    return id;
  };

  // Quotation 1: PENDING - New request awaiting owner response
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer1.id,
      vehicleId: owner1Vehicles[0]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-06-25T08:00:00.000Z"),
      endDate: new Date("2026-06-26T20:00:00.000Z"),
      startTime: "08:00 AM",
      pickupLocation: "Colombo - Galle Face Green",
      dropoffLocation: "Kandy - Temple of the Tooth",
      passengerCount: 35,
      estimatedDistance: "120 km",
      estimatedDuration: "3.5 hours",
      specialRequests:
        "Air conditioning required. Need experienced driver familiar with hill country roads.",
      status: "PENDING",
    },
  });

  // Quotation 2: SENT - Owner has sent quotation
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer2.id,
      vehicleId: owner1Vehicles[0]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-06-20T06:00:00.000Z"),
      endDate: new Date("2026-06-22T18:00:00.000Z"),
      startTime: "06:00 AM",
      pickupLocation: "Negombo - Beach Resort Area",
      dropoffLocation: "Jaffna - Fort Area",
      passengerCount: 40,
      estimatedDistance: "380 km",
      estimatedDuration: "8 hours",
      specialRequests: "Long distance trip, need comfortable seating and AC.",
      status: "SENT",
      vehicleRentalCost: 35000,
      driverCost: 8000,
      fuelCost: 15000,
      tollCharges: 3000,
      permitFees: 2000,
      customItems: [
        { description: "Refreshments", amount: 4000 },
        { description: "Overnight accommodation for driver", amount: 3000 },
      ],
      subtotal: 70000,
      tax: 7000,
      totalAmount: 77000,
      additionalNotes:
        "Vehicle includes full AC, comfortable reclining seats, and entertainment system.",
      validityDays: 7,
      validUntil: new Date("2026-06-08T23:59:59.000Z"),
      sentAt: new Date("2026-06-01T10:30:00.000Z"),
    },
  });

  // Quotation 3: PENDING - Another new request
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer2.id,
      vehicleId: owner3Vehicles[2]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-06-25T06:00:00.000Z"),
      endDate: new Date("2026-06-27T18:00:00.000Z"),
      startTime: "06:00 AM",
      pickupLocation: "Colombo - Hilton Hotel",
      dropoffLocation: "Ella - Railway Station",
      passengerCount: 45,
      estimatedDistance: "230 km",
      estimatedDuration: "6 hours",
      specialRequests:
        "Need luxury bus with full AC and entertainment. Multi-day trip to hill country.",
      status: "PENDING",
    },
  });

  console.log(`Created ${quotationCounter - 1} sample quotations\n`);

  // Add more quotations for customer1 (Dilshan) to enable comparison feature
  // These are responses from different owners for the same trip

  // Quotation for customer1 from owner2 - SENT (can compare)
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer1.id,
      vehicleId: owner2Vehicles[0]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-06-25T08:00:00.000Z"),
      endDate: new Date("2026-06-26T20:00:00.000Z"),
      startTime: "08:00 AM",
      pickupLocation: "Colombo - Galle Face Green",
      dropoffLocation: "Kandy - Temple of the Tooth",
      passengerCount: 35,
      estimatedDistance: "120 km",
      estimatedDuration: "3.5 hours",
      specialRequests:
        "Air conditioning required. Need experienced driver familiar with hill country roads.",
      status: "SENT",
      vehicleRentalCost: 30000,
      driverCost: 6000,
      fuelCost: 10000,
      tollCharges: 2000,
      permitFees: 1500,
      customItems: [
        { description: "Complimentary water bottles", amount: 1000 },
      ],
      subtotal: 50500,
      tax: 5050,
      totalAmount: 55550,
      additionalNotes:
        "Experienced driver with 15+ years in hill country routes. Vehicle equipped with GPS and emergency kit.",
      validityDays: 5,
      validUntil: new Date("2026-06-30T23:59:59.000Z"),
      sentAt: new Date("2026-06-01T14:00:00.000Z"),
    },
  });

  // Quotation for customer1 from owner3 - SENT (can compare)
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer1.id,
      vehicleId: owner3Vehicles[0]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-06-25T08:00:00.000Z"),
      endDate: new Date("2026-06-26T20:00:00.000Z"),
      startTime: "08:00 AM",
      pickupLocation: "Colombo - Galle Face Green",
      dropoffLocation: "Kandy - Temple of the Tooth",
      passengerCount: 35,
      estimatedDistance: "120 km",
      estimatedDuration: "3.5 hours",
      specialRequests:
        "Air conditioning required. Need experienced driver familiar with hill country roads.",
      status: "SENT",
      vehicleRentalCost: 32000,
      driverCost: 7000,
      fuelCost: 11000,
      tollCharges: 2500,
      permitFees: 1800,
      customItems: [
        { description: "Scenic route tour guidance", amount: 3000 },
        { description: "Photo stop arrangements", amount: 1500 },
      ],
      subtotal: 58800,
      tax: 5880,
      totalAmount: 64680,
      additionalNotes:
        "Panoramic windows perfect for scenic views. Driver will take you via the most picturesque route through tea plantations.",
      validityDays: 6,
      validUntil: new Date("2026-06-30T23:59:59.000Z"),
      sentAt: new Date("2026-06-01T09:30:00.000Z"),
    },
  });

  // Quotation for customer1 from owner4 - VIEWED (customer has seen it)
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer1.id,
      vehicleId: owner1Vehicles[1]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-06-25T08:00:00.000Z"),
      endDate: new Date("2026-06-26T20:00:00.000Z"),
      startTime: "08:00 AM",
      pickupLocation: "Colombo - Galle Face Green",
      dropoffLocation: "Kandy - Temple of the Tooth",
      passengerCount: 35,
      estimatedDistance: "120 km",
      estimatedDuration: "3.5 hours",
      specialRequests:
        "Air conditioning required. Need experienced driver familiar with hill country roads.",
      status: "VIEWED",
      vehicleRentalCost: 28000,
      driverCost: 6500,
      fuelCost: 9500,
      tollCharges: 2000,
      permitFees: 1500,
      subtotal: 47500,
      tax: 4750,
      totalAmount: 52250,
      additionalNotes:
        "Budget-friendly option without compromising on comfort. Clean vehicle with reliable service.",
      validityDays: 5,
      validUntil: new Date("2026-06-30T23:59:59.000Z"),
      sentAt: new Date("2026-06-01T11:00:00.000Z"),
      viewedAt: new Date("2026-06-02T16:45:00.000Z"),
    },
  });

  // 4th SENT quotation for customer1's Colombo→Kandy trip — enables 4-column comparison demo
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer1.id,
      vehicleId: owner4Vehicles[0]?.id,
      vehicleType: "SEMI_LUXURY",
      startDate: new Date("2026-06-25T08:00:00.000Z"),
      endDate: new Date("2026-06-26T20:00:00.000Z"),
      startTime: "08:00 AM",
      pickupLocation: "Colombo - Galle Face Green",
      dropoffLocation: "Kandy - Temple of the Tooth",
      passengerCount: 35,
      estimatedDistance: "120 km",
      estimatedDuration: "3.5 hours",
      specialRequests:
        "Air conditioning required. Need experienced driver familiar with hill country roads.",
      status: "SENT",
      vehicleRentalCost: 25000,
      driverCost: 5500,
      fuelCost: 9000,
      tollCharges: 1800,
      permitFees: 1200,
      customItems: [],
      subtotal: 42500,
      tax: 4250,
      totalAmount: 46750,
      additionalNotes:
        "Value-for-money option with a reliable semi-luxury vehicle. Driver has 10+ years of experience on this route.",
      validityDays: 5,
      validUntil: new Date("2026-06-30T23:59:59.000Z"),
      sentAt: new Date("2026-06-01T12:30:00.000Z"),
    },
  });

  // Add more quotations covering all statuses
  // Quotation 4: VIEWED - Customer viewed but hasn't responded
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer3.id,
      vehicleId: owner2Vehicles[0]?.id,
      vehicleType: "SEMI_LUXURY",
      startDate: new Date("2026-06-18T07:00:00.000Z"),
      endDate: new Date("2026-06-18T19:00:00.000Z"),
      startTime: "07:00 AM",
      pickupLocation: "Galle - Fort",
      dropoffLocation: "Colombo - Airport",
      passengerCount: 30,
      estimatedDistance: "150 km",
      estimatedDuration: "3 hours",
      specialRequests: "Airport drop-off, need early morning departure",
      status: "VIEWED",
      vehicleRentalCost: 25000,
      driverCost: 5000,
      fuelCost: 8000,
      tollCharges: 1500,
      permitFees: 500,
      subtotal: 40000,
      tax: 4000,
      totalAmount: 44000,
      additionalNotes:
        "Experienced driver with airport route knowledge included.",
      validityDays: 5,
      validUntil: new Date("2026-06-05T23:59:59.000Z"),
      sentAt: new Date("2026-06-01T09:00:00.000Z"),
      viewedAt: new Date("2026-06-03T14:30:00.000Z"),
    },
  });

  // Quotation 5: ACCEPTED - Customer accepted the quotation
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer4.id,
      vehicleId: owner3Vehicles[0]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-06-18T06:00:00.000Z"),
      endDate: new Date("2026-06-20T18:00:00.000Z"),
      startTime: "06:00 AM",
      pickupLocation: "Negombo - Beach Hotels",
      dropoffLocation: "Sigiriya - Hotel Area",
      passengerCount: 35,
      estimatedDistance: "180 km",
      estimatedDuration: "4.5 hours",
      specialRequests: "Cultural triangle tour, need experienced guide",
      status: "ACCEPTED",
      vehicleRentalCost: 40000,
      driverCost: 8000,
      fuelCost: 12000,
      tollCharges: 2000,
      permitFees: 1500,
      customItems: [
        { description: "Tour guide service", amount: 5000 },
        { description: "Entrance tickets coordination", amount: 2500 },
      ],
      subtotal: 71000,
      tax: 7100,
      totalAmount: 78100,
      additionalNotes:
        "Professional driver with cultural tour experience. Vehicle includes entertainment system and WiFi.",
      validityDays: 7,
      validUntil: new Date("2026-06-08T23:59:59.000Z"),
      sentAt: new Date("2026-06-01T11:00:00.000Z"),
      viewedAt: new Date("2026-06-02T10:00:00.000Z"),
      respondedAt: new Date("2026-06-03T15:30:00.000Z"),
    },
  });

  // Quotation 6: REJECTED - Customer rejected the quotation
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer5.id,
      vehicleId: owner1Vehicles[1]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-06-05T08:00:00.000Z"),
      endDate: new Date("2026-06-05T20:00:00.000Z"),
      startTime: "08:00 AM",
      pickupLocation: "Matara - Town",
      dropoffLocation: "Kandy - City Center",
      passengerCount: 25,
      estimatedDistance: "220 km",
      estimatedDuration: "5 hours",
      specialRequests: "One day trip, return same day",
      status: "REJECTED",
      vehicleRentalCost: 35000,
      driverCost: 7000,
      fuelCost: 11000,
      tollCharges: 2500,
      permitFees: 1000,
      subtotal: 56500,
      tax: 5650,
      totalAmount: 62150,
      additionalNotes: "Full day rental with experienced driver.",
      validityDays: 5,
      validUntil: new Date("2026-05-30T23:59:59.000Z"),
      sentAt: new Date("2026-05-25T13:00:00.000Z"),
      viewedAt: new Date("2026-05-27T09:00:00.000Z"),
      respondedAt: new Date("2026-05-27T16:00:00.000Z"),
      rejectionReason: "Found a more economical option from another provider",
    },
  });

  // Quotation 7: EXPIRED - Quotation validity period passed
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer2.id,
      vehicleId: owner2Vehicles[1]?.id,
      vehicleType: "SEMI_LUXURY",
      startDate: new Date("2026-06-03T07:00:00.000Z"),
      endDate: new Date("2026-06-05T19:00:00.000Z"),
      startTime: "07:00 AM",
      pickupLocation: "Colombo - Colombo Fort",
      dropoffLocation: "Trincomalee - Beach Area",
      passengerCount: 30,
      estimatedDistance: "260 km",
      estimatedDuration: "6 hours",
      specialRequests: "Beach holiday transport",
      status: "EXPIRED",
      vehicleRentalCost: 38000,
      driverCost: 8000,
      fuelCost: 13000,
      tollCharges: 2000,
      permitFees: 1500,
      subtotal: 62500,
      tax: 6250,
      totalAmount: 68750,
      additionalNotes: "Coastal route specialist driver included.",
      validityDays: 3,
      validUntil: new Date("2026-05-30T23:59:59.000Z"),
      sentAt: new Date("2026-05-25T10:00:00.000Z"),
      viewedAt: new Date("2026-05-27T11:00:00.000Z"),
    },
  });

  // Quotation 7b: EXPIRED - Customer request that received no responses and expired
  // vehicleId is null to represent a pure customer-side quotation_request (no owner response arrived).
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer1.id,
      vehicleType: "ORDINARY",
      startDate: new Date("2026-06-01T09:00:00.000Z"),
      endDate: new Date("2026-06-01T18:00:00.000Z"),
      startTime: "09:00 AM",
      pickupLocation: "Kurunegala - Town Hall",
      dropoffLocation: "Anuradhapura - Sacred City",
      passengerCount: 25,
      estimatedDistance: "95 km",
      estimatedDuration: "2.5 hours",
      specialRequests: "School field trip — no responses received before expiry",
      status: "EXPIRED",
    },
  });

  // Quotation 8: PENDING - Another pending request from new customer
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer5.id,
      vehicleId: owner3Vehicles[1]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-06-25T06:00:00.000Z"),
      endDate: new Date("2026-06-27T18:00:00.000Z"),
      startTime: "06:00 AM",
      pickupLocation: "Matara - Railway Station",
      dropoffLocation: "Jaffna - Town Center",
      passengerCount: 40,
      estimatedDistance: "450 km",
      estimatedDuration: "9 hours",
      specialRequests:
        "Long distance trip, need overnight stop arrangements. Comfortable seating essential.",
      status: "PENDING",
    },
  });

  // Add more quotations for better demo (Feb 21, 2026)
  // Quotation 9: PENDING - New urgent request
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer3.id,
      vehicleId: owner1Vehicles[0]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-06-22T09:00:00.000Z"),
      endDate: new Date("2026-06-22T18:00:00.000Z"),
      startTime: "09:00 AM",
      pickupLocation: "Colombo - Mount Lavinia Hotel",
      dropoffLocation: "Bentota - Beach Resorts",
      passengerCount: 42,
      estimatedDistance: "85 km",
      estimatedDuration: "2 hours",
      specialRequests:
        "Urgent request for weekend beach party. Full AC luxury bus needed.",
      status: "PENDING",
    },
  });

  // Quotation 10: SENT - Recent quotation sent today
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer4.id,
      vehicleId: owner2Vehicles[1]?.id,
      vehicleType: "SEMI_LUXURY",
      startDate: new Date("2026-06-20T07:00:00.000Z"),
      endDate: new Date("2026-06-22T19:00:00.000Z"),
      startTime: "07:00 AM",
      pickupLocation: "Negombo - Hotels Area",
      dropoffLocation: "Anuradhapura - Sacred City",
      passengerCount: 35,
      estimatedDistance: "165 km",
      estimatedDuration: "4 hours",
      specialRequests: "Buddhist pilgrimage tour, need respectful driver",
      status: "SENT",
      vehicleRentalCost: 42000,
      driverCost: 9000,
      fuelCost: 14000,
      tollCharges: 2500,
      permitFees: 2000,
      customItems: [
        { description: "Temple visit coordination", amount: 2500 },
        { description: "Refreshments", amount: 3000 },
      ],
      subtotal: 75000,
      tax: 7500,
      totalAmount: 82500,
      additionalNotes:
        "Driver experienced with temple routes and protocols. Vehicle includes comfortable seating for long journey.",
      validityDays: 5,
      validUntil: new Date("2026-06-07T23:59:59.000Z"),
      sentAt: new Date("2026-06-02T08:30:00.000Z"),
    },
  });

  // Quotation 11: VIEWED - Customer viewed this morning
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer5.id,
      vehicleId: owner3Vehicles[2]?.id,
      vehicleType: "SEMI_LUXURY",
      startDate: new Date("2026-06-17T10:00:00.000Z"),
      endDate: new Date("2026-06-17T17:00:00.000Z"),
      startTime: "10:00 AM",
      pickupLocation: "Matara - City Center",
      dropoffLocation: "Mirissa - Whale Watching Point",
      passengerCount: 18,
      estimatedDistance: "25 km",
      estimatedDuration: "45 minutes",
      specialRequests: "Short coastal trip for whale watching tour group",
      status: "VIEWED",
      vehicleRentalCost: 18000,
      driverCost: 4000,
      fuelCost: 3000,
      tollCharges: 500,
      permitFees: 500,
      subtotal: 26000,
      tax: 2600,
      totalAmount: 28600,
      additionalNotes:
        "Perfect mini bus for small groups. Driver familiar with coastal routes.",
      validityDays: 3,
      validUntil: new Date("2026-06-04T23:59:59.000Z"),
      sentAt: new Date("2026-06-01T15:00:00.000Z"),
      viewedAt: new Date("2026-06-03T09:15:00.000Z"),
    },
  });

  // Quotation 12: ACCEPTED - Just accepted today!
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer1.id,
      vehicleId: owner1Vehicles[2]?.id,
      vehicleType: "SEMI_LUXURY",
      startDate: new Date("2026-06-17T08:00:00.000Z"),
      endDate: new Date("2026-06-17T20:00:00.000Z"),
      startTime: "08:00 AM",
      pickupLocation: "Colombo - Nugegoda",
      dropoffLocation: "Yala - National Park Entrance",
      passengerCount: 25,
      estimatedDistance: "250 km",
      estimatedDuration: "5.5 hours",
      specialRequests: "Safari day trip, early morning departure required",
      status: "ACCEPTED",
      vehicleRentalCost: 38000,
      driverCost: 8000,
      fuelCost: 15000,
      tollCharges: 3000,
      permitFees: 2000,
      customItems: [{ description: "Park entry coordination", amount: 5000 }],
      subtotal: 71000,
      tax: 7100,
      totalAmount: 78100,
      additionalNotes:
        "Mini bus perfect for safari tours. Driver experienced with wildlife routes.",
      validityDays: 4,
      validUntil: new Date("2026-06-05T23:59:59.000Z"),
      sentAt: new Date("2026-06-01T10:00:00.000Z"),
      viewedAt: new Date("2026-06-02T14:30:00.000Z"),
      respondedAt: new Date("2026-06-03T10:45:00.000Z"),
    },
  });

  // Quotation 13: REJECTED - Recently rejected
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer2.id,
      vehicleId: owner4Vehicles[0]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-06-10T06:00:00.000Z"),
      endDate: new Date("2026-06-12T18:00:00.000Z"),
      startTime: "06:00 AM",
      pickupLocation: "Wellawatte - Sea Beach Hotel",
      dropoffLocation: "Trincomalee - Fort Area",
      passengerCount: 48,
      estimatedDistance: "280 km",
      estimatedDuration: "6.5 hours",
      specialRequests: "Multi-day eastern province tour",
      status: "REJECTED",
      vehicleRentalCost: 95000,
      driverCost: 18000,
      fuelCost: 22000,
      tollCharges: 4000,
      permitFees: 3000,
      customItems: [
        { description: "Overnight accommodation for driver", amount: 8000 },
      ],
      subtotal: 150000,
      tax: 15000,
      totalAmount: 165000,
      additionalNotes: "Premium service with experienced driver.",
      validityDays: 7,
      validUntil: new Date("2026-06-01T23:59:59.000Z"),
      sentAt: new Date("2026-05-25T11:00:00.000Z"),
      viewedAt: new Date("2026-05-28T09:00:00.000Z"),
      respondedAt: new Date("2026-05-29T15:30:00.000Z"),
      rejectionReason: "Budget exceeded, found alternative option",
    },
  });

  // Quotation 14: PENDING - Multiple vehicles comparison scenario
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer3.id,
      vehicleId: owner2Vehicles[0]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-06-22T07:00:00.000Z"),
      endDate: new Date("2026-06-26T18:00:00.000Z"),
      startTime: "07:00 AM",
      pickupLocation: "Kandy - City Center",
      dropoffLocation: "Kandy - City Center",
      passengerCount: 40,
      estimatedDistance: "800 km",
      estimatedDuration: "Multi-day tour",
      specialRequests:
        "5-day cultural triangle tour: Kandy, Sigiriya, Polonnaruwa, Dambulla, Anuradhapura",
      status: "PENDING",
    },
  });

  // Quotation 15: SENT - Same route as #14 for comparison
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer3.id,
      vehicleId: owner3Vehicles[0]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-06-22T07:00:00.000Z"),
      endDate: new Date("2026-06-26T18:00:00.000Z"),
      startTime: "07:00 AM",
      pickupLocation: "Kandy - City Center",
      dropoffLocation: "Kandy - City Center",
      passengerCount: 40,
      estimatedDistance: "800 km",
      estimatedDuration: "Multi-day tour",
      specialRequests:
        "5-day cultural triangle tour: Kandy, Sigiriya, Polonnaruwa, Dambulla, Anuradhapura",
      status: "SENT",
      vehicleRentalCost: 175000,
      driverCost: 35000,
      fuelCost: 50000,
      tollCharges: 5000,
      permitFees: 5000,
      customItems: [
        { description: "Driver accommodation (4 nights)", amount: 20000 },
        { description: "Tour guide services", amount: 25000 },
        { description: "Site entrance coordination", amount: 10000 },
      ],
      subtotal: 325000,
      tax: 32500,
      totalAmount: 357500,
      additionalNotes:
        "Comprehensive cultural triangle package with experienced guide-driver. All logistics handled.",
      validityDays: 10,
      validUntil: new Date("2026-06-22T23:59:59.000Z"),
      sentAt: new Date("2026-06-02T14:00:00.000Z"),
    },
  });

  // Quotation 16: SENT - Same route as #14 #15 for triple comparison
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer3.id,
      vehicleId: owner4Vehicles[1]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-06-22T07:00:00.000Z"),
      endDate: new Date("2026-06-26T18:00:00.000Z"),
      startTime: "07:00 AM",
      pickupLocation: "Kandy - City Center",
      dropoffLocation: "Kandy - City Center",
      passengerCount: 40,
      estimatedDistance: "800 km",
      estimatedDuration: "Multi-day tour",
      specialRequests:
        "5-day cultural triangle tour: Kandy, Sigiriya, Polonnaruwa, Dambulla, Anuradhapura",
      status: "SENT",
      vehicleRentalCost: 165000,
      driverCost: 30000,
      fuelCost: 45000,
      tollCharges: 5000,
      permitFees: 5000,
      customItems: [
        { description: "Driver accommodation (4 nights)", amount: 16000 },
        { description: "Refreshments package", amount: 12000 },
      ],
      subtotal: 278000,
      tax: 27800,
      totalAmount: 305800,
      additionalNotes:
        "Budget-friendly cultural tour package. Clean vehicle with knowledgeable driver.",
      validityDays: 10,
      validUntil: new Date("2026-06-22T23:59:59.000Z"),
      sentAt: new Date("2026-06-02T16:30:00.000Z"),
    },
  });

  // ===========================================
  // Additional PENDING Quotations (P3 — owner 4 + type variety)
  // ===========================================
  // Owner 4 currently has zero PENDING quotations — his page would be empty

  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer2.id,
      vehicleId: owner4Vehicles[0]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-06-22T06:00:00.000Z"),
      endDate: new Date("2026-06-24T18:00:00.000Z"),
      startTime: "06:00 AM",
      pickupLocation: "Batticaloa - Bus Stand",
      dropoffLocation: "Colombo - Fort",
      passengerCount: 45,
      estimatedDistance: "310 km",
      estimatedDuration: "7 hours",
      specialRequests: "Eastern province to Colombo inter-city charter. AC required.",
      status: "PENDING",
    },
  });

  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer3.id,
      vehicleId: owner4Vehicles[1]?.id,
      vehicleType: "SEMI_LUXURY",
      startDate: new Date("2026-06-25T08:00:00.000Z"),
      endDate: new Date("2026-06-25T20:00:00.000Z"),
      startTime: "08:00 AM",
      pickupLocation: "Batticaloa - City Center",
      dropoffLocation: "Arugam Bay - Beach Area",
      passengerCount: 22,
      estimatedDistance: "80 km",
      estimatedDuration: "2 hours",
      specialRequests: "Small group surf trip. Need mini coach with luggage space.",
      status: "PENDING",
    },
  });

  // ORDINARY vehicle type request — demonstrates the vehicleType filter
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer5.id,
      vehicleId: owner1Vehicles[3]?.id,
      vehicleType: "ORDINARY",
      startDate: new Date("2026-06-25T07:00:00.000Z"),
      endDate: new Date("2026-06-25T17:00:00.000Z"),
      startTime: "07:00 AM",
      pickupLocation: "Colombo - Pettah Bus Stand",
      dropoffLocation: "Galle - Fort",
      passengerCount: 50,
      estimatedDistance: "120 km",
      estimatedDuration: "2.5 hours",
      specialRequests: "Budget option for large group day trip. Non-AC acceptable.",
      status: "PENDING",
    },
  });

  console.log(
    `Created ${quotationCounter - 1} quotations covering all statuses\n`,
  );

  // ===========================================
  // Backfill Trip records from existing quotations.
  // Each (customer, pickup, dropoff, startDate) group becomes one Trip and
  // every member quotation gets its tripId set. Status is derived from the
  // member quotations so the demo data matches the Trip lifecycle.
  // ===========================================
  console.log("Backfilling trip records from quotations...\n");

  // Coordinate table for cities seen in quotation/trip seed data. The route
  // map on /dashboard/trips/[id] uses pickupLatitude/Longitude (and the
  // intermediateStops JSON) to draw waypoints; without coordinates the map
  // renders empty. Keeping this list in seed because OSRM lookups during seed
  // would pound the public demo endpoint.
  const CITY_COORDS: Record<string, { lat: number; lng: number; district: string }> = {
    Colombo: { lat: 6.9271, lng: 79.8612, district: "Colombo" },
    Negombo: { lat: 7.2008, lng: 79.8737, district: "Gampaha" },
    Kandy: { lat: 7.2906, lng: 80.6337, district: "Kandy" },
    Galle: { lat: 6.0535, lng: 80.221, district: "Galle" },
    Matara: { lat: 5.9549, lng: 80.555, district: "Matara" },
    Mirissa: { lat: 5.9483, lng: 80.4719, district: "Matara" },
    Hambantota: { lat: 6.1241, lng: 81.1185, district: "Hambantota" },
    Anuradhapura: { lat: 8.3114, lng: 80.4037, district: "Anuradhapura" },
    Sigiriya: { lat: 7.957, lng: 80.7603, district: "Matale" },
    Jaffna: { lat: 9.6615, lng: 80.0255, district: "Jaffna" },
    Trincomalee: { lat: 8.5874, lng: 81.2152, district: "Trincomalee" },
    Batticaloa: { lat: 7.7102, lng: 81.6924, district: "Batticaloa" },
    Kurunegala: { lat: 7.4863, lng: 80.3647, district: "Kurunegala" },
    Ella: { lat: 6.8667, lng: 81.0466, district: "Badulla" },
    Kegalle: { lat: 7.2513, lng: 80.3464, district: "Kegalle" },
    Dambulla: { lat: 7.8731, lng: 80.6517, district: "Matale" },
    Bentota: { lat: 6.4259, lng: 79.9947, district: "Galle" },
    Polonnaruwa: { lat: 7.9403, lng: 81.0188, district: "Polonnaruwa" },
    "Nuwara Eliya": { lat: 6.9497, lng: 80.7891, district: "Nuwara Eliya" },
    "Arugam Bay": { lat: 6.8399, lng: 81.8385, district: "Ampara" },
    Hikkaduwa: { lat: 6.1395, lng: 80.1019, district: "Galle" },
    Yala: { lat: 6.3719, lng: 81.5117, district: "Hambantota" },
    Vavuniya: { lat: 8.7514, lng: 80.4971, district: "Vavuniya" },
    Kelaniya: { lat: 7.0, lng: 79.9167, district: "Gampaha" },
    Kataragama: { lat: 6.4163, lng: 81.3356, district: "Monaragala" },
    Panadura: { lat: 6.7133, lng: 79.9042, district: "Kalutara" },
    Gampaha: { lat: 7.0837, lng: 80.0, district: "Gampaha" },
  };

  // Intermediate stops for well-known long-distance routes so the map shows
  // a multi-waypoint path instead of a straight A → B line. Order matters.
  const ROUTE_STOPS: Record<string, string[]> = {
    "Colombo|Kandy": ["Kegalle"],
    "Colombo|Anuradhapura": ["Kurunegala"],
    "Colombo|Jaffna": ["Kurunegala", "Anuradhapura"],
    "Colombo|Trincomalee": ["Kurunegala", "Anuradhapura"],
    "Colombo|Ella": ["Kandy"],
    "Colombo|Mirissa": ["Bentota", "Galle"],
    "Colombo|Sigiriya": ["Kurunegala", "Dambulla"],
    "Colombo|Nuwara Eliya": ["Kegalle", "Kandy"],
    "Colombo|Galle": ["Bentota"],
    "Colombo|Yala": ["Galle", "Hambantota"],
    "Colombo|Arugam Bay": ["Kandy", "Batticaloa"],
    "Negombo|Jaffna": ["Kurunegala", "Anuradhapura"],
    "Negombo|Sigiriya": ["Kurunegala", "Dambulla"],
    "Negombo|Anuradhapura": ["Kurunegala"],
    "Kurunegala|Anuradhapura": [],
    "Matara|Kandy": ["Colombo", "Kegalle"],
    "Matara|Jaffna": ["Colombo", "Kurunegala", "Anuradhapura"],
    "Kandy|Ella": ["Nuwara Eliya"],
    "Batticaloa|Colombo": ["Kurunegala"],
    "Galle|Colombo": ["Bentota"],
    "Jaffna|Trincomalee": ["Vavuniya"],
    "Wellawatte|Trincomalee": ["Kurunegala", "Anuradhapura"],
  };

  const lookupCity = (raw: string | null | undefined) => {
    if (!raw) return null;
    const cityToken = raw.split(" - ")[0]?.trim();
    if (!cityToken) return null;
    return CITY_COORDS[cityToken] ?? null;
  };

  const buildIntermediateStops = (
    pickupCity: string | null,
    dropoffCity: string | null,
  ) => {
    if (!pickupCity || !dropoffCity) return null;
    const key = `${pickupCity}|${dropoffCity}`;
    const stops = ROUTE_STOPS[key];
    if (!stops || stops.length === 0) return null;
    return stops
      .map((cityName, i) => {
        const coord = CITY_COORDS[cityName];
        if (!coord) return null;
        return {
          id: `stop-${i}`,
          location: {
            address: cityName,
            city: cityName,
            district: coord.district,
            lat: coord.lat,
            lng: coord.lng,
          },
        };
      })
      .filter(Boolean);
  };

  const allQuotations = await prisma.quotation.findMany({
    orderBy: { createdAt: "asc" },
  });

  const tripGroups = new Map<string, typeof allQuotations>();
  for (const q of allQuotations) {
    const key = [
      q.customerId,
      q.pickupLocation || "",
      q.dropoffLocation || "",
      q.startDate.toISOString().slice(0, 10),
    ].join("|");
    if (!tripGroups.has(key)) tripGroups.set(key, []);
    tripGroups.get(key)!.push(q);
  }

  let tripCounter = 1;
  const now = new Date();
  for (const [, members] of tripGroups) {
    const primary = members[0];
    const tripCode = `TRP-2026-${String(tripCounter).padStart(3, "0")}`;
    tripCounter += 1;

    // Derive trip status from members.
    let status: string = "PLANNING";
    const statuses = members.map((m) => m.status);
    if (statuses.includes("ACCEPTED")) {
      status = "CONFIRMED";
    } else if (
      statuses.some((s) => s === "SENT" || s === "VIEWED" || s === "REJECTED")
    ) {
      status = "AWAITING_QUOTES";
    } else if (statuses.every((s) => s === "EXPIRED")) {
      status = "EXPIRED";
    } else if (statuses.every((s) => s === "REJECTED")) {
      status = "CANCELLED";
    } else if (primary.endDate < now) {
      status = "EXPIRED";
    } else {
      status = "AWAITING_QUOTES";
    }

    // Use the first non-empty special requests / estimates among members.
    const specialRequests =
      members.find((m) => m.specialRequests)?.specialRequests ?? null;
    const estimatedDistance =
      members.find((m) => m.estimatedDistance)?.estimatedDistance ?? null;
    const estimatedDuration =
      members.find((m) => m.estimatedDuration)?.estimatedDuration ?? null;
    const vehicleTypePreference =
      members.find((m) => m.vehicleType)?.vehicleType ?? null;

    const pickupCity =
      primary.pickupLocation.split(" - ")[0]?.trim() || null;
    const dropoffCity =
      primary.dropoffLocation?.split(" - ")[0]?.trim() || null;
    const pickupCoord = lookupCity(primary.pickupLocation);
    const dropoffCoord = lookupCity(primary.dropoffLocation);
    const intermediateStops = buildIntermediateStops(pickupCity, dropoffCity);

    const trip = await prismaAny.trip.create({
      data: {
        tripCode,
        customerId: primary.customerId,
        title: null,
        pickupLocation: primary.pickupLocation,
        pickupCity,
        pickupDistrict: pickupCoord?.district ?? null,
        pickupLatitude: pickupCoord?.lat ?? null,
        pickupLongitude: pickupCoord?.lng ?? null,
        dropoffLocation: primary.dropoffLocation,
        dropoffCity,
        dropoffDistrict: dropoffCoord?.district ?? null,
        dropoffLatitude: dropoffCoord?.lat ?? null,
        dropoffLongitude: dropoffCoord?.lng ?? null,
        startDate: primary.startDate,
        endDate: primary.endDate,
        startTime: primary.startTime,
        isRoundTrip: false,
        passengerCount: primary.passengerCount ?? 1,
        vehicleTypePreference,
        needsAC: true,
        specialRequests,
        estimatedDistance,
        estimatedDuration,
        intermediateStops: intermediateStops ?? undefined,
        status,
      },
    });

    // Attach all member quotations to this trip.
    await prisma.quotation.updateMany({
      where: { id: { in: members.map((m) => m.id) } },
      data: { tripId: trip.id },
    });
  }

  console.log(
    `Created ${tripCounter - 1} trip records and linked ${allQuotations.length} quotations\n`,
  );

  // Add a couple of standalone "PLANNING" trips so the dashboard CTA and the
  // trips-list page show realistic empty/in-flight states without quotations
  // attached yet.
  await prismaAny.trip.create({
    data: {
      tripCode: `TRP-2026-${String(tripCounter).padStart(3, "0")}`,
      customerId: customer1.id,
      title: "Mirissa weekend with friends",
      pickupLocation: "Colombo - Colpetty",
      pickupCity: "Colombo",
      pickupDistrict: "Colombo",
      pickupLatitude: CITY_COORDS.Colombo.lat,
      pickupLongitude: CITY_COORDS.Colombo.lng,
      dropoffLocation: "Mirissa - Beach Strip",
      dropoffCity: "Mirissa",
      dropoffDistrict: "Matara",
      dropoffLatitude: CITY_COORDS.Mirissa.lat,
      dropoffLongitude: CITY_COORDS.Mirissa.lng,
      startDate: new Date("2026-06-12T07:00:00.000Z"),
      endDate: new Date("2026-06-14T20:00:00.000Z"),
      startTime: "07:00 AM",
      isRoundTrip: true,
      passengerCount: 18,
      vehicleTypePreference: "LUXURY_AC",
      needsAC: true,
      specialRequests:
        "Friends weekend — looking for a comfortable AC bus with ample luggage space.",
      estimatedDistance: "155 km",
      estimatedDuration: "3.5 hours",
      intermediateStops: [
        {
          id: "stop-galle",
          location: {
            address: "Galle",
            city: "Galle",
            district: "Galle",
            lat: CITY_COORDS.Galle.lat,
            lng: CITY_COORDS.Galle.lng,
          },
        },
        {
          id: "stop-bentota",
          location: {
            address: "Bentota",
            city: "Bentota",
            district: "Galle",
            lat: CITY_COORDS.Bentota.lat,
            lng: CITY_COORDS.Bentota.lng,
          },
        },
      ],
      status: "PLANNING",
    },
  });
  tripCounter += 1;

  await prismaAny.trip.create({
    data: {
      tripCode: `TRP-2026-${String(tripCounter).padStart(3, "0")}`,
      customerId: customer3.id,
      title: "Sigiriya school excursion",
      pickupLocation: "Colombo - Lyceum International",
      pickupCity: "Colombo",
      pickupDistrict: "Colombo",
      pickupLatitude: CITY_COORDS.Colombo.lat,
      pickupLongitude: CITY_COORDS.Colombo.lng,
      dropoffLocation: "Sigiriya - Rock Fortress",
      dropoffCity: "Sigiriya",
      dropoffDistrict: "Matale",
      dropoffLatitude: CITY_COORDS.Sigiriya.lat,
      dropoffLongitude: CITY_COORDS.Sigiriya.lng,
      startDate: new Date("2026-07-08T05:30:00.000Z"),
      endDate: new Date("2026-07-08T22:00:00.000Z"),
      startTime: "05:30 AM",
      isRoundTrip: true,
      passengerCount: 45,
      vehicleTypePreference: "SEMI_LUXURY",
      needsAC: true,
      specialRequests:
        "School field trip. Need a verified driver and bus with first-aid kit.",
      estimatedDistance: "175 km",
      estimatedDuration: "4 hours",
      intermediateStops: [
        {
          id: "stop-kurunegala",
          location: {
            address: "Kurunegala",
            city: "Kurunegala",
            district: "Kurunegala",
            lat: CITY_COORDS.Kurunegala.lat,
            lng: CITY_COORDS.Kurunegala.lng,
          },
        },
        {
          id: "stop-dambulla",
          location: {
            address: "Dambulla",
            city: "Dambulla",
            district: "Matale",
            lat: CITY_COORDS.Dambulla.lat,
            lng: CITY_COORDS.Dambulla.lng,
          },
        },
      ],
      status: "PLANNING",
    },
  });
  tripCounter += 1;

  console.log(
    `Added ${tripCounter - 1} total trip records (including 2 PLANNING demos)\n`,
  );

  // ===========================================
  // Create sample bookings for demo data
  // ===========================================
  console.log("Creating sample bookings...\n");

  let totalBookings = 0;

  // OWNER 1 BOOKINGS (Nuwan Perera - Colombo)
  if (owner1Vehicles.length > 0) {
    // Confirmed booking - upcoming next week
    const booking1 = await prisma.booking.create({
      data: {
        customerId: customer1.id,
        vehicleId: owner1Vehicles[0].id,
        startDate: new Date("2026-06-15T06:00:00.000Z"),
        endDate: new Date("2026-06-17T18:00:00.000Z"),
        pickupLocation: "Colombo - Fort Railway Station",
        dropoffLocation: "Nuwara Eliya - Grand Hotel",
        totalPassengers: 40,
        totalAmount: 150000,
        status: "CONFIRMED",
        notes: "Corporate tour with 40 employees",
      },
    });
    await prisma.payment.create({
      data: {
        userId: customer1.id,
        bookingId: booking1.id,
        amount: 150000,
        currency: "LKR",
        status: "COMPLETED",
        method: "Card",
      },
    });
    totalBookings++;

    // Demo booking for payment redirection (Dilshan)
    const demoBooking = await prisma.booking.create({
      data: {
        customerId: customer1.id,
        vehicleId: owner1Vehicles[0].id,
        startDate: new Date("2026-06-13T07:30:00.000Z"),
        endDate: new Date("2026-06-13T19:30:00.000Z"),
        pickupLocation: "Colombo - Town Hall",
        dropoffLocation: "Galle - Fort",
        totalPassengers: 32,
        totalAmount: 60000,
        status: "PENDING",
        notes: "Demo booking for payment redirection",
      },
    });
    await prisma.payment.create({
      data: {
        userId: customer1.id,
        bookingId: demoBooking.id,
        amount: 60000,
        currency: "LKR",
        status: "PENDING",
        method: "PayHere",
        payherePaymentId: "PH-DEMO-20260221-001",
        payhereCustomerId: customer1.id,
      },
    });
    totalBookings++;

    // Pending booking - awaiting confirmation
    await prisma.booking.create({
      data: {
        customerId: customer2.id,
        vehicleId: owner1Vehicles[1].id,
        startDate: new Date("2026-06-16T08:00:00.000Z"),
        endDate: new Date("2026-06-18T20:00:00.000Z"),
        pickupLocation: "Colombo - Cinnamon Grand Hotel",
        dropoffLocation: "Galle - Lighthouse Hotel",
        totalPassengers: 50,
        totalAmount: 95000,
        status: "PENDING",
        notes: "Wedding party transport",
      },
    });
    totalBookings++;

    // Completed booking - past trip
    const booking3 = await prisma.booking.create({
      data: {
        customerId: customer3.id,
        vehicleId: owner1Vehicles[0].id,
        startDate: new Date("2026-05-25T06:00:00.000Z"),
        endDate: new Date("2026-05-28T18:00:00.000Z"),
        pickupLocation: "Colombo - Bandaranaike Airport",
        dropoffLocation: "Colombo - Bandaranaike Airport",
        totalPassengers: 35,
        totalAmount: 120000,
        status: "COMPLETED",
        notes: "Airport shuttle and city tour",
      },
    });
    await prisma.payment.create({
      data: {
        userId: customer3.id,
        bookingId: booking3.id,
        amount: 120000,
        currency: "LKR",
        status: "COMPLETED",
        method: "Card",
      },
    });
    totalBookings++;

    // Cancelled booking
    await prisma.booking.create({
      data: {
        customerId: customer1.id,
        vehicleId: owner1Vehicles[2].id,
        startDate: new Date("2026-05-28T10:00:00.000Z"),
        endDate: new Date("2026-05-28T18:00:00.000Z"),
        pickupLocation: "Colombo - Slave Island",
        dropoffLocation: "Kandy - City Center",
        totalPassengers: 25,
        totalAmount: 45000,
        status: "CANCELLED",
        notes: "Customer cancelled due to schedule change",
      },
    });
    totalBookings++;
  }

  // OWNER 2 BOOKINGS (Sivakumar - Jaffna)
  if (owner2Vehicles.length > 0) {
    // Confirmed booking
    const booking5 = await prisma.booking.create({
      data: {
        customerId: customer2.id,
        vehicleId: owner2Vehicles[0].id,
        startDate: new Date("2026-06-18T08:00:00.000Z"),
        endDate: new Date("2026-06-18T18:00:00.000Z"),
        pickupLocation: "Jaffna - Railway Station",
        dropoffLocation: "Jaffna - Nallur Kovil",
        totalPassengers: 45,
        totalAmount: 35000,
        status: "CONFIRMED",
        notes: "Temple pilgrimage group",
      },
    });
    await prisma.payment.create({
      data: {
        userId: customer2.id,
        bookingId: booking5.id,
        amount: 35000,
        currency: "LKR",
        status: "COMPLETED",
        method: "Card",
      },
    });
    totalBookings++;

    // Pending booking
    await prisma.booking.create({
      data: {
        customerId: customer3.id,
        vehicleId: owner2Vehicles[1].id,
        startDate: new Date("2026-06-16T06:00:00.000Z"),
        endDate: new Date("2026-06-18T20:00:00.000Z"),
        pickupLocation: "Jaffna - City Center",
        dropoffLocation: "Trincomalee - Beach Area",
        totalPassengers: 30,
        totalAmount: 85000,
        status: "PENDING",
        notes: "Family vacation to eastern beaches",
      },
    });
    totalBookings++;

    // Completed booking
    const booking7 = await prisma.booking.create({
      data: {
        customerId: customer1.id,
        vehicleId: owner2Vehicles[0].id,
        startDate: new Date("2026-05-20T08:00:00.000Z"),
        endDate: new Date("2026-05-22T18:00:00.000Z"),
        pickupLocation: "Jaffna - City Center",
        dropoffLocation: "Jaffna - City Center",
        totalPassengers: 40,
        totalAmount: 75000,
        status: "COMPLETED",
        notes: "Northern heritage tour",
      },
    });
    await prisma.payment.create({
      data: {
        userId: customer1.id,
        bookingId: booking7.id,
        amount: 75000,
        currency: "LKR",
        status: "COMPLETED",
        method: "Card",
      },
    });
    totalBookings++;
  }

  // OWNER 3 BOOKINGS (Chaminda - Kandy)
  if (owner3Vehicles.length > 0) {
    // Confirmed booking
    const booking8 = await prisma.booking.create({
      data: {
        customerId: customer3.id,
        vehicleId: owner3Vehicles[0].id,
        startDate: new Date("2026-06-18T06:00:00.000Z"),
        endDate: new Date("2026-06-20T18:00:00.000Z"),
        pickupLocation: "Kandy - City Center",
        dropoffLocation: "Ella - Railway Station",
        totalPassengers: 38,
        totalAmount: 95000,
        status: "CONFIRMED",
        notes: "Hill country scenic tour",
      },
    });
    await prisma.payment.create({
      data: {
        userId: customer3.id,
        bookingId: booking8.id,
        amount: 95000,
        currency: "LKR",
        status: "COMPLETED",
        method: "Card",
      },
    });
    totalBookings++;

    // Completed booking
    const booking9 = await prisma.booking.create({
      data: {
        customerId: customer2.id,
        vehicleId: owner3Vehicles[1].id,
        startDate: new Date("2026-05-22T06:00:00.000Z"),
        endDate: new Date("2026-05-24T20:00:00.000Z"),
        pickupLocation: "Kandy - Temple of the Tooth",
        dropoffLocation: "Nuwara Eliya - Victoria Park",
        totalPassengers: 12,
        totalAmount: 65000,
        status: "COMPLETED",
        notes: "Year-end family trip",
      },
    });
    await prisma.payment.create({
      data: {
        userId: customer2.id,
        bookingId: booking9.id,
        amount: 65000,
        currency: "LKR",
        status: "COMPLETED",
        method: "Card",
      },
    });
    totalBookings++;

    // Ongoing booking - currently in progress
    await prisma.booking.create({
      data: {
        customerId: customer1.id,
        vehicleId: owner3Vehicles[2].id,
        startDate: new Date("2026-06-01T06:00:00.000Z"),
        endDate: new Date("2026-06-05T18:00:00.000Z"),
        pickupLocation: "Kandy - City Center",
        dropoffLocation: "Sigiriya - Rock Fortress",
        totalPassengers: 28,
        totalAmount: 55000,
        status: "ONGOING",
        notes: "Cultural triangle tour - currently in progress",
      },
    });
    totalBookings++;
  }

  // OWNER 4 BOOKINGS (Mohamed Farook - Batticaloa)
  if (owner4Vehicles.length > 0) {
    // Confirmed booking
    const booking11 = await prisma.booking.create({
      data: {
        customerId: customer1.id,
        vehicleId: owner4Vehicles[0].id,
        startDate: new Date("2026-06-20T06:00:00.000Z"),
        endDate: new Date("2026-06-22T18:00:00.000Z"),
        pickupLocation: "Batticaloa - Bus Stand",
        dropoffLocation: "Colombo - Fort",
        totalPassengers: 48,
        totalAmount: 70000,
        status: "CONFIRMED",
        notes: "Business trip to Colombo",
      },
    });
    await prisma.payment.create({
      data: {
        userId: customer1.id,
        bookingId: booking11.id,
        amount: 70000,
        currency: "LKR",
        status: "COMPLETED",
        method: "Card",
      },
    });
    totalBookings++;

    // Completed booking
    const booking12 = await prisma.booking.create({
      data: {
        customerId: customer3.id,
        vehicleId: owner4Vehicles[1].id,
        startDate: new Date("2026-05-15T08:00:00.000Z"),
        endDate: new Date("2026-05-17T18:00:00.000Z"),
        pickupLocation: "Batticaloa - City Center",
        dropoffLocation: "Arugam Bay - Beach",
        totalPassengers: 20,
        totalAmount: 45000,
        status: "COMPLETED",
        notes: "Surfing trip",
      },
    });
    await prisma.payment.create({
      data: {
        userId: customer3.id,
        bookingId: booking12.id,
        amount: 45000,
        currency: "LKR",
        status: "COMPLETED",
        method: "Card",
      },
    });
    totalBookings++;
  }

  console.log(`Created ${totalBookings} bookings across all owners\n`);

  // ===========================================
  // Add More Bookings with Various States
  // ===========================================
  console.log("Creating additional bookings with various states...\n");

  // Get owner5 vehicles
  const owner5Vehicles = await prisma.vehicle.findMany({
    where: { ownerId: owner5.id },
    take: 2,
  });

  // Booking with PENDING payment
  const pendingPaymentBooking = await prisma.booking.create({
    data: {
      customerId: customer4.id,
      vehicleId: owner1Vehicles[2]?.id,
      startDate: new Date("2026-05-25T07:00:00.000Z"),
      endDate: new Date("2026-05-25T19:00:00.000Z"),
      pickupLocation: "Negombo - Hotels Area",
      dropoffLocation: "Dambulla - Cave Temple",
      totalPassengers: 32,
      totalAmount: 55000,
      status: "CONFIRMED",
      notes: "Day trip to cultural sites",
    },
  });
  await prisma.payment.create({
    data: {
      userId: customer4.id,
      bookingId: pendingPaymentBooking.id,
      amount: 55000,
      currency: "LKR",
      status: "PENDING",
      method: "Bank Transfer",
    },
  });
  totalBookings++;

  // Booking with PROCESSING payment
  const processingPaymentBooking = await prisma.booking.create({
    data: {
      customerId: customer5.id,
      vehicleId: owner2Vehicles[0]?.id,
      startDate: new Date("2026-05-28T06:00:00.000Z"),
      endDate: new Date("2026-05-30T18:00:00.000Z"),
      pickupLocation: "Matara - Bus Stand",
      dropoffLocation: "Colombo - Airport",
      totalPassengers: 28,
      totalAmount: 65000,
      status: "CONFIRMED",
      notes: "Return trip with airport drop-off",
    },
  });
  await prisma.payment.create({
    data: {
      userId: customer5.id,
      bookingId: processingPaymentBooking.id,
      amount: 65000,
      currency: "LKR",
      status: "PROCESSING",
      method: "Card",
    },
  });
  totalBookings++;

  // Booking with FAILED payment
  const failedPaymentBooking = await prisma.booking.create({
    data: {
      customerId: customer3.id,
      vehicleId: owner3Vehicles[1]?.id,
      startDate: new Date("2026-05-20T08:00:00.000Z"),
      endDate: new Date("2026-05-22T20:00:00.000Z"),
      pickupLocation: "Kandy - City Center",
      dropoffLocation: "Anuradhapura - Sacred City",
      totalPassengers: 35,
      totalAmount: 72000,
      status: "PENDING",
      notes: "Religious pilgrimage tour",
    },
  });
  await prisma.payment.create({
    data: {
      userId: customer3.id,
      bookingId: failedPaymentBooking.id,
      amount: 72000,
      currency: "LKR",
      status: "FAILED",
      method: "Card",
    },
  });
  totalBookings++;

  // Cancelled booking with REFUNDED payment
  const refundedBooking = await prisma.booking.create({
    data: {
      customerId: customer2.id,
      vehicleId: owner1Vehicles[1]?.id,
      startDate: new Date("2026-05-10T06:00:00.000Z"),
      endDate: new Date("2026-05-12T18:00:00.000Z"),
      pickupLocation: "Colombo - Wellawatte",
      dropoffLocation: "Galle - Fort Area",
      totalPassengers: 30,
      totalAmount: 58000,
      status: "CANCELLED",
      notes: "Cancelled due to weather concerns",
    },
  });
  await prisma.payment.create({
    data: {
      userId: customer2.id,
      bookingId: refundedBooking.id,
      amount: 58000,
      currency: "LKR",
      status: "REFUNDED",
      method: "Card",
    },
  });
  totalBookings++;

  // Additional PENDING booking
  await prisma.booking.create({
    data: {
      customerId: customer4.id,
      vehicleId: owner3Vehicles[2]?.id,
      startDate: new Date("2026-06-20T07:00:00.000Z"),
      endDate: new Date("2026-06-22T19:00:00.000Z"),
      pickupLocation: "Negombo - Beach Hotels",
      dropoffLocation: "Ella - Railway Station",
      totalPassengers: 38,
      totalAmount: 95000,
      status: "PENDING",
      notes: "Hill country exploration - awaiting confirmation",
    },
  });
  totalBookings++;

  console.log(
    `Created ${totalBookings} total bookings with various payment statuses\n`,
  );

  // ===========================================
  // Add More Demo Bookings (Feb 21, 2026 relevant dates)
  // ===========================================
  console.log("Creating additional demo bookings for Feb 21, 2026...\n");

  // Create more customers for diverse bookings
  const customer6 = await prisma.user.create({
    data: {
      email: "rashmi.perera@gmail.com",
      password: customerPassword,
      firstName: "Rashmi",
      lastName: "Perera",
      phone: "+94779012345",
      role: "CUSTOMER",
      status: "ACTIVE",
      isVerified: true,
      city: "Panadura",
      district: "Kalutara",
    },
  });

  const customer7 = await prisma.user.create({
    data: {
      email: "ruwan.fernando@yahoo.com",
      password: customerPassword,
      firstName: "Ruwan",
      lastName: "Fernando",
      phone: "+94770123456",
      role: "CUSTOMER",
      status: "ACTIVE",
      isVerified: true,
      address: "No. 12, Temple Road",
      city: "Kelaniya",
      district: "Gampaha",
    },
  });

  console.log(`Customer 6: ${customer6.firstName} ${customer6.lastName}`);
  console.log(`Customer 7: ${customer7.firstName} ${customer7.lastName}\n`);

  // Booking: ONGOING - Trip happening right now!
  const ongoingBooking2 = await prisma.booking.create({
    data: {
      customerId: customer6.id,
      vehicleId: owner2Vehicles[0]?.id,
      startDate: new Date("2026-06-02T06:00:00.000Z"),
      endDate: new Date("2026-06-03T18:00:00.000Z"),
      pickupLocation: "Colombo - Shangri-La Hotel",
      dropoffLocation: "Trincomalee - Uppuveli Beach",
      totalPassengers: 44,
      totalAmount: 98000,
      status: "ONGOING",
      notes: "Corporate beach retreat - currently en route",
    },
  });
  await prisma.payment.create({
    data: {
      userId: customer6.id,
      bookingId: ongoingBooking2.id,
      amount: 98000,
      currency: "LKR",
      status: "COMPLETED",
      method: "Card",
    },
  });
  totalBookings++;

  // Booking: CONFIRMED - Starting tomorrow
  const tomorrowBooking = await prisma.booking.create({
    data: {
      customerId: customer7.id,
      vehicleId: owner1Vehicles[0]?.id,
      startDate: new Date("2026-06-14T05:00:00.000Z"),
      endDate: new Date("2026-06-14T22:00:00.000Z"),
      pickupLocation: "Kelaniya - Raja Maha Vihara",
      dropoffLocation: "Kataragama - Temple",
      totalPassengers: 50,
      totalAmount: 145000,
      status: "CONFIRMED",
      notes: "Full day pilgrimage tour - early morning departure",
    },
  });
  await prisma.payment.create({
    data: {
      userId: customer7.id,
      bookingId: tomorrowBooking.id,
      amount: 145000,
      currency: "LKR",
      status: "COMPLETED",
      method: "Bank Transfer",
    },
  });
  totalBookings++;

  // Booking: CONFIRMED - Weekend trip
  const weekendBooking = await prisma.booking.create({
    data: {
      customerId: customer4.id,
      vehicleId: owner3Vehicles[1]?.id,
      startDate: new Date("2026-06-15T07:00:00.000Z"),
      endDate: new Date("2026-06-17T19:00:00.000Z"),
      pickupLocation: "Negombo - St. Mary's Church",
      dropoffLocation: "Negombo - St. Mary's Church",
      totalPassengers: 35,
      totalAmount: 125000,
      status: "CONFIRMED",
      notes: "Weekend cultural tour - round trip from Negombo",
    },
  });
  await prisma.payment.create({
    data: {
      userId: customer4.id,
      bookingId: weekendBooking.id,
      amount: 125000,
      currency: "LKR",
      status: "COMPLETED",
      method: "Card",
    },
  });
  totalBookings++;

  // Booking: PENDING - Just submitted today
  const newPendingBooking = await prisma.booking.create({
    data: {
      customerId: customer6.id,
      vehicleId: owner3Vehicles[0]?.id,
      startDate: new Date("2026-06-17T08:00:00.000Z"),
      endDate: new Date("2026-06-17T20:00:00.000Z"),
      pickupLocation: "Panadura - Town",
      dropoffLocation: "Galle - Fort",
      totalPassengers: 38,
      totalAmount: 52000,
      status: "PENDING",
      notes: "Day trip to Galle Fort - awaiting owner confirmation",
    },
  });
  totalBookings++;

  // Booking: CONFIRMED - Next week
  const nextWeekBooking = await prisma.booking.create({
    data: {
      customerId: customer5.id,
      vehicleId: owner4Vehicles[0]?.id,
      startDate: new Date("2026-06-18T06:00:00.000Z"),
      endDate: new Date("2026-06-20T18:00:00.000Z"),
      pickupLocation: "Matara - Railway Station",
      dropoffLocation: "Arugam Bay - Beach",
      totalPassengers: 42,
      totalAmount: 135000,
      status: "CONFIRMED",
      notes: "Surfing trip to east coast",
    },
  });
  await prisma.payment.create({
    data: {
      userId: customer5.id,
      bookingId: nextWeekBooking.id,
      amount: 135000,
      currency: "LKR",
      status: "COMPLETED",
      method: "Card",
    },
  });
  totalBookings++;

  // Booking: COMPLETED - Just completed yesterday
  const recentCompletedBooking = await prisma.booking.create({
    data: {
      customerId: customer7.id,
      vehicleId: owner2Vehicles[1]?.id,
      startDate: new Date("2026-05-31T07:00:00.000Z"),
      endDate: new Date("2026-06-01T19:00:00.000Z"),
      pickupLocation: "Gampaha - Town Center",
      dropoffLocation: "Polonnaruwa - Ancient City",
      totalPassengers: 32,
      totalAmount: 88000,
      status: "COMPLETED",
      notes: "Historical site tour - completed successfully",
    },
  });
  await prisma.payment.create({
    data: {
      userId: customer7.id,
      bookingId: recentCompletedBooking.id,
      amount: 88000,
      currency: "LKR",
      status: "COMPLETED",
      method: "Card",
    },
  });
  totalBookings++;

  // Booking: COMPLETED - Ready for review
  const readyForReviewBooking = await prisma.booking.create({
    data: {
      customerId: customer6.id,
      vehicleId: owner1Vehicles[1]?.id,
      startDate: new Date("2026-05-30T08:00:00.000Z"),
      endDate: new Date("2026-05-30T18:00:00.000Z"),
      pickupLocation: "Panadura - Beach Road",
      dropoffLocation: "Colombo - Bandaranaike Airport",
      totalPassengers: 28,
      totalAmount: 42000,
      status: "COMPLETED",
      notes: "Airport transfer service - Customer can now leave review",
    },
  });
  await prisma.payment.create({
    data: {
      userId: customer6.id,
      bookingId: readyForReviewBooking.id,
      amount: 42000,
      currency: "LKR",
      status: "COMPLETED",
      method: "Card",
    },
  });
  totalBookings++;

  // Booking: PENDING with payment issues
  const pendingPaymentIssue = await prisma.booking.create({
    data: {
      customerId: customer7.id,
      vehicleId: owner4Vehicles[1]?.id,
      startDate: new Date("2026-06-16T09:00:00.000Z"),
      endDate: new Date("2026-06-16T17:00:00.000Z"),
      pickupLocation: "Kelaniya - University",
      dropoffLocation: "Hikkaduwa - Beach",
      totalPassengers: 22,
      totalAmount: 38000,
      status: "PENDING",
      notes: "Beach day trip - payment pending",
    },
  });
  await prisma.payment.create({
    data: {
      userId: customer7.id,
      bookingId: pendingPaymentIssue.id,
      amount: 38000,
      currency: "LKR",
      status: "PENDING",
      method: "Bank Transfer",
    },
  });
  totalBookings++;

  // Booking: CONFIRMED - For Yala Safari (from accepted quotation #12)
  const safariBooking = await prisma.booking.create({
    data: {
      customerId: customer1.id,
      vehicleId: owner1Vehicles[2]?.id,
      startDate: new Date("2026-06-17T08:00:00.000Z"),
      endDate: new Date("2026-06-17T20:00:00.000Z"),
      pickupLocation: "Colombo - Nugegoda",
      dropoffLocation: "Yala - National Park Entrance",
      totalPassengers: 25,
      totalAmount: 78100,
      status: "CONFIRMED",
      notes: "Safari day trip (from accepted quotation QUO-2026-017)",
    },
  });
  await prisma.payment.create({
    data: {
      userId: customer1.id,
      bookingId: safariBooking.id,
      amount: 78100,
      currency: "LKR",
      status: "COMPLETED",
      method: "Card",
    },
  });
  totalBookings++;

  // Booking: ONGOING - Multi-day trip in progress
  const multiDayOngoing = await prisma.booking.create({
    data: {
      customerId: customer3.id,
      vehicleId: owner3Vehicles[2]?.id,
      startDate: new Date("2026-06-01T06:00:00.000Z"),
      endDate: new Date("2026-06-07T18:00:00.000Z"),
      pickupLocation: "Kandy - Queens Hotel",
      dropoffLocation: "Kandy - Queens Hotel",
      totalPassengers: 30,
      totalAmount: 185000,
      status: "ONGOING",
      notes: "5-day hill country exploration - mid-trip",
    },
  });
  await prisma.payment.create({
    data: {
      userId: customer3.id,
      bookingId: multiDayOngoing.id,
      amount: 185000,
      currency: "LKR",
      status: "COMPLETED",
      method: "Bank Transfer",
    },
  });
  totalBookings++;

  // Booking: CANCELLED - Recent cancellation
  const recentCancellation = await prisma.booking.create({
    data: {
      customerId: customer4.id,
      vehicleId: owner2Vehicles[0]?.id,
      startDate: new Date("2026-05-25T10:00:00.000Z"),
      endDate: new Date("2026-05-25T18:00:00.000Z"),
      pickupLocation: "Negombo - Beach Hotels",
      dropoffLocation: "Sigiriya - Rock Fortress",
      totalPassengers: 30,
      totalAmount: 68000,
      status: "CANCELLED",
      notes: "Cancelled by customer - last minute schedule change",
    },
  });
  await prisma.payment.create({
    data: {
      userId: customer4.id,
      bookingId: recentCancellation.id,
      amount: 68000,
      currency: "LKR",
      status: "REFUNDED",
      method: "Card",
    },
  });
  totalBookings++;

  console.log(`Added 11 more bookings for comprehensive demo\n`);

  // ===========================================
  // Historical Analytics Bookings (Owner 1)
  // Spread COMPLETED bookings across Dec 2025 – May 2026 so the analytics
  // revenue/bookings trend charts show meaningful data instead of all-zero bars.
  // We create the records normally then backdate createdAt + updatedAt via raw SQL
  // because Prisma's @updatedAt decorator cannot be overridden through the client.
  // ===========================================
  console.log("Creating historical analytics data for owner1...\n");

  const analyticsMonths = [
    { label: "Dec 2025", createdAt: "2025-12-15T10:00:00.000Z", updatedAt: "2025-12-20T18:00:00.000Z", amount: 95000 },
    { label: "Jan 2026", createdAt: "2026-01-10T09:00:00.000Z", updatedAt: "2026-01-14T17:00:00.000Z", amount: 130000 },
    { label: "Feb 2026", createdAt: "2026-02-08T08:00:00.000Z", updatedAt: "2026-02-12T16:00:00.000Z", amount: 175000 },
    { label: "Mar 2026", createdAt: "2026-03-05T07:00:00.000Z", updatedAt: "2026-03-09T15:00:00.000Z", amount: 210000 },
    { label: "Apr 2026", createdAt: "2026-04-12T10:00:00.000Z", updatedAt: "2026-04-16T18:00:00.000Z", amount: 155000 },
    { label: "May 2026", createdAt: "2026-05-03T09:00:00.000Z", updatedAt: "2026-05-07T17:00:00.000Z", amount: 190000 },
  ];

  for (const monthData of analyticsMonths) {
    const analyticsBooking = await prisma.booking.create({
      data: {
        customerId: customer2.id,
        vehicleId: owner1Vehicles[0]!.id,
        startDate: new Date(monthData.createdAt),
        endDate: new Date(monthData.updatedAt),
        pickupLocation: "Colombo - Fort",
        dropoffLocation: "Kandy - City Center",
        totalPassengers: 40,
        totalAmount: monthData.amount,
        status: "COMPLETED",
        notes: `Historical analytics booking — ${monthData.label}`,
      },
    });
    await prisma.payment.create({
      data: {
        userId: customer2.id,
        bookingId: analyticsBooking.id,
        amount: monthData.amount,
        currency: "LKR",
        status: "COMPLETED",
        method: "Card",
      },
    });
    // Backdate both timestamps so the analytics queries bucket this into the correct month.
    await prisma.$executeRaw`
      UPDATE bookings
      SET "createdAt" = ${new Date(monthData.createdAt)}::timestamptz,
          "updatedAt" = ${new Date(monthData.updatedAt)}::timestamptz
      WHERE "id" = ${analyticsBooking.id}
    `;
  }

  // Add a second booking per month for owner1 to give bookings-count chart variety
  const analyticsMonths2 = [
    { label: "Dec 2025 B", createdAt: "2025-12-22T10:00:00.000Z", updatedAt: "2025-12-26T18:00:00.000Z", amount: 65000 },
    { label: "Jan 2026 B", createdAt: "2026-01-20T09:00:00.000Z", updatedAt: "2026-01-24T17:00:00.000Z", amount: 80000 },
    { label: "Feb 2026 B", createdAt: "2026-02-18T08:00:00.000Z", updatedAt: "2026-02-22T16:00:00.000Z", amount: 110000 },
    { label: "Mar 2026 B", createdAt: "2026-03-18T07:00:00.000Z", updatedAt: "2026-03-22T15:00:00.000Z", amount: 145000 },
    { label: "Apr 2026 B", createdAt: "2026-04-22T10:00:00.000Z", updatedAt: "2026-04-26T18:00:00.000Z", amount: 90000 },
    { label: "May 2026 B", createdAt: "2026-05-10T09:00:00.000Z", updatedAt: "2026-05-14T17:00:00.000Z", amount: 120000 },
  ];

  for (const monthData of analyticsMonths2) {
    const analyticsBooking2 = await prisma.booking.create({
      data: {
        customerId: customer3.id,
        vehicleId: owner1Vehicles[1]!.id,
        startDate: new Date(monthData.createdAt),
        endDate: new Date(monthData.updatedAt),
        pickupLocation: "Galle - Fort",
        dropoffLocation: "Colombo - Airport",
        totalPassengers: 35,
        totalAmount: monthData.amount,
        status: "COMPLETED",
        notes: `Historical analytics booking (2nd) — ${monthData.label}`,
      },
    });
    await prisma.payment.create({
      data: {
        userId: customer3.id,
        bookingId: analyticsBooking2.id,
        amount: monthData.amount,
        currency: "LKR",
        status: "COMPLETED",
        method: "Card",
      },
    });
    await prisma.$executeRaw`
      UPDATE bookings
      SET "createdAt" = ${new Date(monthData.createdAt)}::timestamptz,
          "updatedAt" = ${new Date(monthData.updatedAt)}::timestamptz
      WHERE "id" = ${analyticsBooking2.id}
    `;
  }

  console.log(`Created ${analyticsMonths.length * 2} historical analytics bookings for owner1\n`);

  // ===========================================
  // Create Reviews for Completed Bookings
  // ===========================================
  console.log("Creating reviews for completed bookings...\n");

  const completedBookings = await prisma.booking.findMany({
    where: { status: "COMPLETED" },
    include: {
      vehicle: true,
      customer: true,
    },
  });

  let totalReviews = 0;

  // Review 1: Excellent experience — full 6-dimension set
  if (completedBookings[0]) {
    await prisma.review.create({
      data: {
        bookingId:  completedBookings[0].id,
        vehicleId:  completedBookings[0].vehicleId,
        customerId: completedBookings[0].customerId,
        rating: 5,
        title: "Exceptional from start to finish",
        comment:
          "Excellent service! The bus was very clean and comfortable. The driver was professional and knew the routes very well. Air conditioning worked perfectly throughout the trip. Highly recommend Perera Transport for any long-distance travel in Sri Lanka. Will definitely use again!",
        isRecommended: true,
        ratingVehicleCondition: 5,
        ratingDriverBehavior:   5,
        ratingPunctuality:      5,
        ratingCleanliness:      5,
        ratingValueForMoney:    4,
      },
    });
    totalReviews++;

    await prisma.review.update({
      where: { bookingId: completedBookings[0].id },
      data: {
        ownerResponse:
          "Thank you so much for your wonderful feedback! We're delighted that you enjoyed your journey with us. Your satisfaction is our priority. Looking forward to serving you again!",
      },
    });
  }

  // Review 2: Very good experience — full 6-dimension set
  if (completedBookings[1]) {
    await prisma.review.create({
      data: {
        bookingId:  completedBookings[1].id,
        vehicleId:  completedBookings[1].vehicleId,
        customerId: completedBookings[1].customerId,
        rating: 4,
        title: "Good journey, small AC issue",
        comment:
          "Very good experience overall. The vehicle arrived on time and was well-maintained. The journey through the Northern Province was comfortable. Driver was courteous and accommodating. Only minor issue was the AC was a bit too cold at times, but they adjusted it when we asked. Good value for money!",
        isRecommended: true,
        ratingVehicleCondition: 4,
        ratingDriverBehavior:   5,
        ratingPunctuality:      4,
        ratingCleanliness:      4,
        ratingValueForMoney:    4,
      },
    });
    totalReviews++;

    await prisma.review.update({
      where: { bookingId: completedBookings[1].id },
      data: {
        ownerResponse:
          "Thank you for choosing Northern Express Tours! We appreciate your feedback about the AC temperature. We'll ensure our drivers are more attentive to passenger comfort. Hope to serve you again soon!",
      },
    });
  }

  // Review 3: Great hill country tour — full 6-dimension set
  if (completedBookings[2]) {
    await prisma.review.create({
      data: {
        bookingId:  completedBookings[2].id,
        vehicleId:  completedBookings[2].vehicleId,
        customerId: completedBookings[2].customerId,
        rating: 5,
        title: "Perfect for the hill country scenery",
        comment:
          "Perfect for hill country tours! The panoramic windows were great for enjoying the scenic views. Driver was experienced with mountain roads and made us feel safe throughout the journey. The bus was spacious and clean. Chaminda's service is top-notch. Highly recommended for Kandy and Nuwara Eliya trips!",
        isRecommended: true,
        ratingVehicleCondition: 5,
        ratingDriverBehavior:   5,
        ratingPunctuality:      5,
        ratingCleanliness:      5,
        ratingValueForMoney:    5,
      },
    });
    totalReviews++;
  }

  // Review 4: Satisfactory service — partial dimensions
  if (completedBookings[3]) {
    await prisma.review.create({
      data: {
        bookingId:  completedBookings[3].id,
        vehicleId:  completedBookings[3].vehicleId,
        customerId: completedBookings[3].customerId,
        rating: 4,
        title: "Solid budget option for smaller groups",
        comment:
          "Good service for a budget-friendly option. The mini bus was suitable for our small group. Everything went smoothly. Driver was punctual and helpful with our luggage. The vehicle could use some interior updates but overall served our purpose well for the eastern coast trip.",
        isRecommended: true,
        ratingVehicleCondition: 3,
        ratingDriverBehavior:   4,
        ratingPunctuality:      5,
        ratingCleanliness:      4,
        ratingValueForMoney:    4,
      },
    });
    totalReviews++;
  }

  // Leave one booking without review (pending review)
  console.log(`Created ${totalReviews} reviews\n`);

  // Add more reviews from different customers
  if (completedBookings[5]) {
    await prisma.review.create({
      data: {
        bookingId:  completedBookings[5].id,
        vehicleId:  completedBookings[5].vehicleId,
        customerId: completedBookings[5].customerId,
        rating: 3,
        title: "Punctuality needs improvement",
        comment:
          "Average experience. Bus arrived late by 30 minutes. The vehicle condition was acceptable but seats could be more comfortable. Driver was friendly though. Service needs improvement in terms of punctuality.",
        isRecommended: false,
        ratingVehicleCondition: 3,
        ratingDriverBehavior:   4,
        ratingPunctuality:      2,
        ratingCleanliness:      3,
        ratingValueForMoney:    3,
      },
    });
    totalReviews++;
  }

  if (completedBookings[6]) {
    await prisma.review.create({
      data: {
        bookingId:  completedBookings[6].id,
        vehicleId:  completedBookings[6].vehicleId,
        customerId: completedBookings[6].customerId,
        rating: 5,
        title: "Outstanding luxury experience",
        comment:
          "Outstanding service! The luxury coach exceeded our expectations. Professional driver, spotless interior, and smooth ride. Perfect for long-distance travel. Will recommend to everyone!",
        isRecommended: true,
        ratingVehicleCondition: 5,
        ratingDriverBehavior:   5,
        ratingPunctuality:      5,
        ratingCleanliness:      5,
        ratingValueForMoney:    5,
      },
    });
    totalReviews++;

    await prisma.review.update({
      where: { bookingId: completedBookings[6].id },
      data: {
        ownerResponse:
          "We're thrilled to hear you had such a great experience! Thank you for choosing our service and for the recommendation. We look forward to serving you again!",
      },
    });
  }

  console.log(`Created ${totalReviews} reviews total\n`);

  // ===========================================
  // Add Reviews for Recent Demo Bookings
  // ===========================================
  console.log("Creating additional reviews for demo...\n");

  // Review for recentCompletedBooking
  const recentCompletedReview = await prisma.review.findUnique({
    where: { bookingId: recentCompletedBooking.id },
  });
  if (recentCompletedReview) {
    await prisma.review.update({
      where: { bookingId: recentCompletedBooking.id },
      data: {
        rating: 5,
        title: "Excellent Polonnaruwa Heritage Tour",
        comment:
          "Fantastic experience exploring Polonnaruwa! The driver was very knowledgeable about the historical sites and gave us excellent recommendations. The bus was spotless and comfortable. AC worked perfectly in the hot weather. Will definitely book again for our next heritage tour!",
        isRecommended: true,
        ratingVehicleCondition: 5,
        ratingDriverBehavior: 5,
        ratingPunctuality: 5,
        ratingCleanliness: 5,
        ratingValueForMoney: 4,
      },
    });
  } else {
    await prisma.review.create({
      data: {
        bookingId: recentCompletedBooking.id,
        vehicleId: recentCompletedBooking.vehicleId,
        customerId: recentCompletedBooking.customerId,
        rating: 5,
        title: "Excellent Polonnaruwa Heritage Tour",
        comment:
          "Fantastic experience exploring Polonnaruwa! The driver was very knowledgeable about the historical sites and gave us excellent recommendations. The bus was spotless and comfortable. AC worked perfectly in the hot weather. Will definitely book again for our next heritage tour!",
        isRecommended: true,
        ratingVehicleCondition: 5,
        ratingDriverBehavior: 5,
        ratingPunctuality: 5,
        ratingCleanliness: 5,
        ratingValueForMoney: 4,
      },
    });
    totalReviews++;
  }

  // Review for readyForReviewBooking (recent, shows pending review opportunity)
  const readyForReview = await prisma.review.findUnique({
    where: { bookingId: readyForReviewBooking.id },
  });
  if (readyForReview) {
    await prisma.review.update({
      where: { bookingId: readyForReviewBooking.id },
      data: {
        rating: 4,
        title: "Reliable Airport Transfer",
        comment:
          "Good airport transfer service. Driver arrived 10 minutes early which was perfect. The minibus was clean and comfortable. Smooth ride to the airport with no issues. Only suggestion would be to provide bottled water. Overall very satisfied!",
        isRecommended: true,
        ratingVehicleCondition: 4,
        ratingDriverBehavior: 5,
        ratingPunctuality: 5,
        ratingCleanliness: 4,
        ratingValueForMoney: 3,
      },
    });
  } else {
    await prisma.review.create({
      data: {
        bookingId: readyForReviewBooking.id,
        vehicleId: readyForReviewBooking.vehicleId,
        customerId: readyForReviewBooking.customerId,
        rating: 4,
        title: "Reliable Airport Transfer",
        comment:
          "Good airport transfer service. Driver arrived 10 minutes early which was perfect. The minibus was clean and comfortable. Smooth ride to the airport with no issues. Only suggestion would be to provide bottled water. Overall very satisfied!",
        isRecommended: true,
        ratingVehicleCondition: 4,
        ratingDriverBehavior: 5,
        ratingPunctuality: 5,
        ratingCleanliness: 4,
        ratingValueForMoney: 3,
      },
    });
    totalReviews++;
  }

  // Owner response to recent review
  await prisma.review.update({
    where: { bookingId: recentCompletedBooking.id },
    data: {
      ownerResponse:
        "Thank you for your wonderful feedback! We're delighted you enjoyed the Polonnaruwa tour. Our drivers take pride in their historical knowledge. Looking forward to your next booking!",
    },
  });

  console.log(`Created ${totalReviews} reviews total with demo data\n`);

  // ===========================================
  // Driver Info on CONFIRMED/ONGOING Bookings (P2 — booking details page)
  // ===========================================
  console.log("Assigning driver info to CONFIRMED/ONGOING bookings...\n");

  await prisma.booking.updateMany({
    where: {
      status: { in: ["CONFIRMED", "ONGOING"] },
      vehicle: { ownerId: owner1.id },
    },
    data: {
      driverName: "Sunil Rathnayake",
      driverPhone: "+94711234567",
      driverLicense: "B1234567",
    },
  });

  await prisma.booking.updateMany({
    where: {
      status: { in: ["CONFIRMED", "ONGOING"] },
      vehicle: { ownerId: owner2.id },
    },
    data: {
      driverName: "Arjunan Selvam",
      driverPhone: "+94712345678",
      driverLicense: "B2345678",
    },
  });

  await prisma.booking.updateMany({
    where: {
      status: { in: ["CONFIRMED", "ONGOING"] },
      vehicle: { ownerId: owner3.id },
    },
    data: {
      driverName: "Pradeep Gunasekara",
      driverPhone: "+94713456789",
      driverLicense: "B3456789",
    },
  });

  await prisma.booking.updateMany({
    where: {
      status: { in: ["CONFIRMED", "ONGOING"] },
      vehicle: { ownerId: owner4.id },
    },
    data: {
      driverName: "Fathima Hassan",
      driverPhone: "+94714567890",
      driverLicense: "B4567890",
    },
  });

  console.log("Driver info assigned to CONFIRMED/ONGOING bookings\n");

  // ===========================================
  // TripItinerary for Multi-Day Bookings (P2 — booking details itinerary tab)
  // ===========================================
  console.log("Creating trip itineraries for multi-day bookings...\n");

  // Fetch the first CONFIRMED multi-day booking for owner1 (Colombo–Nuwara Eliya 3-day)
  const firstOwner1ConfirmedBooking = await prisma.booking.findFirst({
    where: {
      status: "CONFIRMED",
      vehicle: { ownerId: owner1.id },
      pickupLocation: { contains: "Fort Railway Station" },
    },
  });

  if (firstOwner1ConfirmedBooking) {
    await prisma.tripItinerary.createMany({
      data: [
        {
          bookingId: firstOwner1ConfirmedBooking.id,
          dayNumber: 1,
          date: new Date("2026-02-26T00:00:00.000Z"),
          startLocation: "Colombo - Fort Railway Station",
          endLocation: "Kandy - City Center",
          overnightStop: "Kandy",
          description:
            "Depart Colombo at 06:00. Stop at Pinnawala Elephant Orphanage. Arrive Kandy by 13:00. Afternoon visit to Temple of the Tooth.",
          estimatedKm: 115,
        },
        {
          bookingId: firstOwner1ConfirmedBooking.id,
          dayNumber: 2,
          date: new Date("2026-02-27T00:00:00.000Z"),
          startLocation: "Kandy",
          endLocation: "Nuwara Eliya - Grand Hotel",
          overnightStop: "Nuwara Eliya",
          description:
            "Scenic drive through tea country via Ramboda Falls and Hakgala Gardens. Arrive Nuwara Eliya by afternoon.",
          estimatedKm: 80,
        },
        {
          bookingId: firstOwner1ConfirmedBooking.id,
          dayNumber: 3,
          date: new Date("2026-02-28T00:00:00.000Z"),
          startLocation: "Nuwara Eliya - Grand Hotel",
          endLocation: "Colombo",
          description:
            "Return journey via Hatton and Avissawella. Stop at Gregory Lake viewpoint. Arrive Colombo by 18:00.",
          estimatedKm: 180,
        },
      ],
    });
  }

  // Fetch the first CONFIRMED multi-day booking for owner3 (Kandy–Ella)
  const firstOwner3ConfirmedBooking = await prisma.booking.findFirst({
    where: {
      status: "CONFIRMED",
      vehicle: { ownerId: owner3.id },
      pickupLocation: { contains: "Kandy" },
    },
  });

  if (firstOwner3ConfirmedBooking) {
    await prisma.tripItinerary.createMany({
      data: [
        {
          bookingId: firstOwner3ConfirmedBooking.id,
          dayNumber: 1,
          date: new Date("2026-03-08T00:00:00.000Z"),
          startLocation: "Kandy - City Center",
          endLocation: "Nuwara Eliya",
          overnightStop: "Nuwara Eliya",
          description:
            "Morning departure from Kandy. Pass through tea plantations. Lunch at Ramboda. Arrive Nuwara Eliya by 15:00.",
          estimatedKm: 80,
        },
        {
          bookingId: firstOwner3ConfirmedBooking.id,
          dayNumber: 2,
          date: new Date("2026-03-09T00:00:00.000Z"),
          startLocation: "Nuwara Eliya",
          endLocation: "Ella - Railway Station",
          overnightStop: "Ella",
          description:
            "Drive through Horton Plains National Park viewpoint. Arrive Ella by afternoon. Optional hike to Little Adam's Peak.",
          estimatedKm: 75,
        },
        {
          bookingId: firstOwner3ConfirmedBooking.id,
          dayNumber: 3,
          date: new Date("2026-03-10T00:00:00.000Z"),
          startLocation: "Ella",
          endLocation: "Kandy - City Center",
          description:
            "Morning visit to Nine Arch Bridge. Drive back to Kandy via Wellawaya and Kandy road. Arrive by 18:00.",
          estimatedKm: 180,
        },
      ],
    });
  }

  console.log("Created trip itineraries for multi-day bookings\n");

  // ===========================================
  // Historical Bookings for Analytics Charts (P0 — Aug 2025–Jan 2026)
  // ===========================================
  console.log(
    "Creating historical bookings for analytics trend data (Aug 2025 – Jan 2026)...\n",
  );

  const historicalMonths = [
    { yearMonth: "2025-11", label: "November 2025" },
    { yearMonth: "2025-12", label: "December 2025" },
    { yearMonth: "2026-01", label: "January 2026" },
    { yearMonth: "2026-02", label: "February 2026" },
    { yearMonth: "2026-03", label: "March 2026" },
    { yearMonth: "2026-04", label: "April 2026" },
  ];

  // Slightly varying amounts to make the trend chart realistic
  const historicalAmounts = [72000, 95000, 115000, 88000, 132000, 105000];

  for (let i = 0; i < historicalMonths.length; i++) {
    const { yearMonth } = historicalMonths[i];
    const baseAmount = historicalAmounts[i];
    const startDate = new Date(`${yearMonth}-10T06:00:00.000Z`);
    const endDate = new Date(`${yearMonth}-11T18:00:00.000Z`);

    // Use mid-month timestamp so the booking falls clearly within the correct
    // monthly bucket for the analytics updatedAt/createdAt range queries.
    const historicalDate = new Date(`${yearMonth}-15T12:00:00.000Z`);
    const historicalCreatedAt = new Date(`${yearMonth}-05T08:00:00.000Z`);

    // Owner 1 historical booking
    if (owner1Vehicles[0]) {
      const hb1 = await prisma.booking.create({
        data: {
          customerId: customer1.id,
          vehicleId: owner1Vehicles[0].id,
          startDate,
          endDate,
          pickupLocation: "Colombo - Fort",
          dropoffLocation: "Kandy - City Center",
          totalPassengers: 38,
          totalAmount: baseAmount + 20000,
          status: "COMPLETED",
          notes: `Historical booking for analytics — ${yearMonth}`,
          driverName: "Sunil Rathnayake",
          driverPhone: "+94711234567",
          driverLicense: "B1234567",
          estimatedDistance: "115 km",
          estimatedDuration: "3 hours",
        },
      });
      await prisma.$executeRawUnsafe(
        `UPDATE bookings SET "updatedAt" = $1, "createdAt" = $2 WHERE id = $3`,
        historicalDate,
        historicalCreatedAt,
        hb1.id,
      );
      await prisma.payment.create({
        data: {
          userId: customer1.id,
          bookingId: hb1.id,
          amount: baseAmount + 20000,
          currency: "LKR",
          status: "COMPLETED",
          method: "Card",
        },
      });
      totalBookings++;
    }

    // Owner 2 historical booking
    if (owner2Vehicles[0]) {
      const hb2 = await prisma.booking.create({
        data: {
          customerId: customer2.id,
          vehicleId: owner2Vehicles[0].id,
          startDate,
          endDate,
          pickupLocation: "Jaffna - Main Stand",
          dropoffLocation: "Colombo - Fort",
          totalPassengers: 42,
          totalAmount: baseAmount + 5000,
          status: "COMPLETED",
          notes: `Historical booking for analytics — ${yearMonth}`,
          driverName: "Arjunan Selvam",
          driverPhone: "+94712345678",
          driverLicense: "B2345678",
          estimatedDistance: "320 km",
          estimatedDuration: "7 hours",
        },
      });
      await prisma.$executeRawUnsafe(
        `UPDATE bookings SET "updatedAt" = $1, "createdAt" = $2 WHERE id = $3`,
        historicalDate,
        historicalCreatedAt,
        hb2.id,
      );
      await prisma.payment.create({
        data: {
          userId: customer2.id,
          bookingId: hb2.id,
          amount: baseAmount + 5000,
          currency: "LKR",
          status: "COMPLETED",
          method: "Card",
        },
      });
      totalBookings++;
    }

    // Owner 3 historical booking
    if (owner3Vehicles[0]) {
      const hb3 = await prisma.booking.create({
        data: {
          customerId: customer3.id,
          vehicleId: owner3Vehicles[0].id,
          startDate,
          endDate,
          pickupLocation: "Kandy - Temple of the Tooth",
          dropoffLocation: "Ella - Railway Station",
          totalPassengers: 35,
          totalAmount: baseAmount + 10000,
          status: "COMPLETED",
          notes: `Historical booking for analytics — ${yearMonth}`,
          driverName: "Pradeep Gunasekara",
          driverPhone: "+94713456789",
          driverLicense: "B3456789",
          estimatedDistance: "150 km",
          estimatedDuration: "4 hours",
        },
      });
      await prisma.$executeRawUnsafe(
        `UPDATE bookings SET "updatedAt" = $1, "createdAt" = $2 WHERE id = $3`,
        historicalDate,
        historicalCreatedAt,
        hb3.id,
      );
      await prisma.payment.create({
        data: {
          userId: customer3.id,
          bookingId: hb3.id,
          amount: baseAmount + 10000,
          currency: "LKR",
          status: "COMPLETED",
          method: "Card",
        },
      });
      totalBookings++;
    }

    // Owner 4 historical booking
    if (owner4Vehicles[0]) {
      const hb4 = await prisma.booking.create({
        data: {
          customerId: customer4.id,
          vehicleId: owner4Vehicles[0].id,
          startDate,
          endDate,
          pickupLocation: "Batticaloa - Bus Stand",
          dropoffLocation: "Colombo - Fort",
          totalPassengers: 44,
          totalAmount: baseAmount - 10000,
          status: "COMPLETED",
          notes: `Historical booking for analytics — ${yearMonth}`,
          driverName: "Fathima Hassan",
          driverPhone: "+94714567890",
          driverLicense: "B4567890",
          estimatedDistance: "310 km",
          estimatedDuration: "7 hours",
        },
      });
      await prisma.$executeRawUnsafe(
        `UPDATE bookings SET "updatedAt" = $1, "createdAt" = $2 WHERE id = $3`,
        historicalDate,
        historicalCreatedAt,
        hb4.id,
      );
      await prisma.payment.create({
        data: {
          userId: customer4.id,
          bookingId: hb4.id,
          amount: baseAmount - 10000,
          currency: "LKR",
          status: "COMPLETED",
          method: "Card",
        },
      });
      totalBookings++;
    }
  }

  console.log(
    `Created ${historicalMonths.length * 4} historical bookings for analytics trend (Nov 2025–Apr 2026)\n`,
  );

  // ===========================================
  // Low-Rating Reviews for Distribution Chart (P4 — Page 32 Reviews)
  // ===========================================
  console.log("Creating low-rating reviews for distribution chart...\n");

  const completedOwner4Bookings = await prisma.booking.findMany({
    where: { status: "COMPLETED", vehicle: { ownerId: owner4.id } },
    include: { review: true },
    take: 2,
  });

  for (const booking of completedOwner4Bookings) {
    if (!booking.review) {
      const rating = completedOwner4Bookings.indexOf(booking) === 0 ? 2 : 1;
      const comment =
        rating === 2
          ? "The bus broke down halfway through our journey. The driver handled it professionally but we were delayed by 3 hours. Vehicle condition needs improvement for long-distance trips."
          : "Very disappointing. Vehicle arrived 2 hours late and the AC was not working despite booking a full AC bus. Would not recommend until service quality improves.";
      await prisma.review.create({
        data: {
          bookingId: booking.id,
          vehicleId: booking.vehicleId,
          customerId: booking.customerId,
          rating,
          comment,
        },
      });
      totalReviews++;
    }
  }

  // One 3★ review for a different vehicle to round out distribution
  const unreviewed3star = await prisma.booking.findFirst({
    where: {
      status: "COMPLETED",
      vehicle: { ownerId: owner2.id },
      review: null,
    },
  });
  if (unreviewed3star) {
    await prisma.review.create({
      data: {
        bookingId: unreviewed3star.id,
        vehicleId: unreviewed3star.vehicleId,
        customerId: unreviewed3star.customerId,
        rating: 3,
        comment:
          "Average experience. Bus arrived 20 minutes late. The vehicle condition was acceptable but the seats could be more comfortable. Driver was friendly and helpful. Overall an okay trip.",
      },
    });
    totalReviews++;
  }

  console.log(
    `Created low-rating reviews — total reviews now ${totalReviews}\n`,
  );

  // ===========================================
  // Settlement Records for Earnings Page (P0 — Page 34 Earnings)
  // ===========================================
  console.log("Creating settlement records for earnings page...\n");

  const settlements = [
    {
      settlementCode: "SET-2026-001",
      ownerId: owner1.id,
      period: "2026-01",
      totalBookings: 3,
      grossAmount: 280000,
      commissionAmount: 28000,
      netAmount: 252000,
      status: "COMPLETED" as const,
      bankAccountName: "Nuwan Perera",
      bankAccountNumber: "****4321",
      bankCode: "BOC",
      processedBy: admin.id,
      processedAt: new Date("2026-02-05T10:00:00.000Z"),
      notes: "January 2026 settlement — processed on schedule",
    },
    {
      settlementCode: "SET-2026-002",
      ownerId: owner1.id,
      period: "2026-02",
      totalBookings: 4,
      grossAmount: 345000,
      commissionAmount: 34500,
      netAmount: 310500,
      status: "PROCESSING" as const,
      bankAccountName: "Nuwan Perera",
      bankAccountNumber: "****4321",
      bankCode: "BOC",
      processedBy: admin.id,
      notes: "February 2026 settlement — transfer initiated",
    },
    {
      settlementCode: "SET-2026-003",
      ownerId: owner1.id,
      period: "2026-03",
      totalBookings: 2,
      grossAmount: 195000,
      commissionAmount: 19500,
      netAmount: 175500,
      status: "PENDING" as const,
      bankAccountName: "Nuwan Perera",
      bankAccountNumber: "****4321",
      bankCode: "BOC",
    },
    {
      settlementCode: "SET-2026-004",
      ownerId: owner2.id,
      period: "2026-01",
      totalBookings: 2,
      grossAmount: 160000,
      commissionAmount: 16000,
      netAmount: 144000,
      status: "COMPLETED" as const,
      bankAccountName: "Sivakumar Rajaratnam",
      bankAccountNumber: "****8765",
      bankCode: "HNB",
      processedBy: admin.id,
      processedAt: new Date("2026-02-05T10:00:00.000Z"),
    },
    {
      settlementCode: "SET-2026-005",
      ownerId: owner2.id,
      period: "2026-02",
      totalBookings: 2,
      grossAmount: 173000,
      commissionAmount: 17300,
      netAmount: 155700,
      status: "PENDING" as const,
      bankAccountName: "Sivakumar Rajaratnam",
      bankAccountNumber: "****8765",
      bankCode: "HNB",
    },
    {
      settlementCode: "SET-2026-006",
      ownerId: owner3.id,
      period: "2026-01",
      totalBookings: 2,
      grossAmount: 140000,
      commissionAmount: 14000,
      netAmount: 126000,
      status: "COMPLETED" as const,
      bankAccountName: "Chaminda Silva",
      bankAccountNumber: "****2109",
      bankCode: "Seylan",
      processedBy: admin.id,
      processedAt: new Date("2026-02-05T10:00:00.000Z"),
    },
    {
      settlementCode: "SET-2026-007",
      ownerId: owner3.id,
      period: "2026-02",
      totalBookings: 3,
      grossAmount: 345000,
      commissionAmount: 34500,
      netAmount: 310500,
      status: "PENDING" as const,
      bankAccountName: "Chaminda Silva",
      bankAccountNumber: "****2109",
      bankCode: "Seylan",
    },
    {
      settlementCode: "SET-2026-008",
      ownerId: owner4.id,
      period: "2026-01",
      totalBookings: 1,
      grossAmount: 45000,
      commissionAmount: 4500,
      netAmount: 40500,
      status: "COMPLETED" as const,
      bankAccountName: "Mohamed Farook",
      bankAccountNumber: "****3344",
      bankCode: "NSB",
      processedBy: admin.id,
      processedAt: new Date("2026-02-05T10:00:00.000Z"),
    },
    {
      settlementCode: "SET-2026-009",
      ownerId: owner4.id,
      period: "2026-02",
      totalBookings: 2,
      grossAmount: 115000,
      commissionAmount: 11500,
      netAmount: 103500,
      status: "PENDING" as const,
      bankAccountName: "Mohamed Farook",
      bankAccountNumber: "****3344",
      bankCode: "NSB",
    },
  ];

  for (const settlementItem of settlements) {
    await prisma.settlement.create({ data: settlementItem });
  }

  console.log(
    `Created ${settlements.length} settlement records for earnings page demo\n`,
  );

  // ===========================================
  // Owner Bank Accounts (Page 34 — Earnings & Settlements)
  // ===========================================
  console.log("Creating owner bank accounts...\n");

  const bankAccounts = [
    {
      ownerId: owner1.id,
      accountHolderName: "Nuwan Perera",
      accountNumber: "1234567894321",
      bankName: "Bank of Ceylon",
      bankCode: "BOC",
      branchName: "Maharagama",
      branchCode: "078",
    },
    {
      ownerId: owner2.id,
      accountHolderName: "Sivakumar Rajaratnam",
      accountNumber: "9876543218765",
      bankName: "Hatton National Bank",
      bankCode: "HNB",
      branchName: "Jaffna",
      branchCode: "041",
    },
    {
      ownerId: owner3.id,
      accountHolderName: "Chaminda Silva",
      accountNumber: "5551112222109",
      bankName: "Seylan Bank",
      bankCode: "Seylan",
      branchName: "Kandy",
      branchCode: "032",
    },
    {
      ownerId: owner4.id,
      accountHolderName: "Mohamed Farook",
      accountNumber: "9988776653344",
      bankName: "National Savings Bank",
      bankCode: "NSB",
      branchName: "Batticaloa",
      branchCode: "029",
    },
  ];

  for (const account of bankAccounts) {
    const encryptedAccountNumber = encryptSettlementBankValue(
      account.accountNumber,
    );
    if (!encryptedAccountNumber) {
      throw new Error(
        `Failed to encrypt account number for ${account.accountHolderName}`,
      );
    }
    await prisma.ownerBankAccount.create({
      data: {
        ownerId: account.ownerId,
        accountHolderName: account.accountHolderName,
        accountNumber: encryptedAccountNumber,
        bankName: account.bankName,
        bankCode: account.bankCode,
        branchName: account.branchName,
        branchCode: account.branchCode,
        isPrimary: true,
      },
    });
  }

  console.log(
    `Created ${bankAccounts.length} owner bank accounts (encrypted at rest)\n`,
  );

  // ===========================================
  // Create Notifications
  // ===========================================
  console.log("Creating notifications...\n");

  let notificationCount = 0;

  // Notifications for customer1 (Dilshan)
  await prisma.notification.createMany({
    data: [
      {
        userId: customer1.id,
        title: "Booking Confirmed",
        message: "Your booking for Colombo to Nuwara Eliya has been confirmed!",
        type: "info",
        category: "Bookings",
        isRead: false,
      },
      {
        userId: customer1.id,
        title: "Quotation Received",
        message: "You have received a new quotation for your trip request.",
        type: "info",
        category: "Quotations",
        isRead: true,
      },
      {
        userId: customer1.id,
        title: "Payment Successful",
        message: "Your payment of LKR 150,000 has been processed successfully.",
        type: "success",
        category: "Payments",
        isRead: true,
      },
    ],
  });
  notificationCount += 3;

  // Notifications for customer2 (Priya)
  await prisma.notification.createMany({
    data: [
      {
        userId: customer2.id,
        title: "New Quotation Available",
        message: "Check out the quotation for your Negombo to Jaffna trip!",
        type: "info",
        category: "Quotations",
        isRead: false,
      },
      {
        userId: customer2.id,
        title: "Booking Reminder",
        message:
          "Your trip starts tomorrow. Please be ready at the pickup location.",
        type: "warning",
        category: "Bookings",
        isRead: false,
      },
    ],
  });
  notificationCount += 2;

  // Notifications for owner1 (Nuwan)
  await prisma.notification.createMany({
    data: [
      {
        userId: owner1.id,
        title: "New Quotation Request",
        message: "You have a new quotation request from Dilshan Jayawardena.",
        type: "info",
        category: "Quotations",
        isRead: false,
      },
      {
        userId: owner1.id,
        title: "Booking Confirmed",
        message: "A new booking has been confirmed for your vehicle.",
        type: "success",
        category: "Bookings",
        isRead: true,
      },
      {
        userId: owner1.id,
        title: "Payment Received",
        message: "Payment of LKR 150,000 has been credited to your account.",
        type: "success",
        category: "Payments",
        isRead: true,
      },
      {
        userId: owner1.id,
        title: "New Review",
        message: "A customer has left a 5-star review for your service!",
        type: "info",
        category: "Reviews",
        isRead: false,
      },
    ],
  });
  notificationCount += 4;

  // Notifications for owner2 (Siva)
  await prisma.notification.createMany({
    data: [
      {
        userId: owner2.id,
        title: "Document Update Required",
        message:
          "Your insurance certificate has been rejected. Please upload a valid document.",
        type: "error",
        category: "System",
        isRead: false,
      },
      {
        userId: owner2.id,
        title: "Vehicle Maintenance Reminder",
        message: "It's time for your vehicle's regular maintenance check.",
        type: "warning",
        category: "System",
        isRead: true,
      },
    ],
  });
  notificationCount += 2;

  // Notifications for owner5 (Kasun - Pending verification)
  await prisma.notification.createMany({
    data: [
      {
        userId: owner5.id,
        title: "Registration Under Review",
        message:
          "Your owner registration is currently being reviewed by our team.",
        type: "info",
        category: "System",
        isRead: false,
      },
      {
        userId: owner5.id,
        title: "Documents Pending Verification",
        message: "Please wait while we verify your submitted documents.",
        type: "warning",
        category: "System",
        isRead: true,
      },
    ],
  });
  notificationCount += 2;

  console.log(`Created ${notificationCount} notifications\n`);

  // ===========================================
  // Add More Demo-Relevant Notifications (Feb 21, 2026)
  // ===========================================
  console.log("Creating additional demo notifications...\n");

  // Notifications for customer3 (multiple quotations for comparison)
  await prisma.notification.createMany({
    data: [
      {
        userId: customer3.id,
        title: "Multiple Quotations Received",
        message:
          "You have received 3 quotations for your Cultural Triangle tour. Compare and choose the best option!",
        type: "info",
        category: "Quotations",
        isRead: false,
      },
      {
        userId: customer3.id,
        title: "New Quotation Available",
        message:
          "Check out the latest quotation for your beach party trip to Bentota!",
        type: "info",
        category: "Quotations",
        isRead: false,
      },
      {
        userId: customer3.id,
        title: "Booking In Progress",
        message:
          "Your 5-day hill country tour is currently ongoing. Have a great trip!",
        type: "success",
        category: "Bookings",
        isRead: true,
      },
    ],
  });
  notificationCount += 3;

  // Notifications for customer6 (new customer, active)
  await prisma.notification.createMany({
    data: [
      {
        userId: customer6.id,
        title: "Trip In Progress",
        message:
          "Your trip to Trincomalee is currently in progress. Safe travels!",
        type: "success",
        category: "Bookings",
        isRead: true,
      },
      {
        userId: customer6.id,
        title: "Review Request",
        message:
          "How was your airport transfer? Please leave a review to help other travelers!",
        type: "info",
        category: "Reviews",
        isRead: false,
      },
      {
        userId: customer6.id,
        title: "Booking Pending",
        message:
          "Your booking for Galle Fort day trip is awaiting owner confirmation.",
        type: "warning",
        category: "Bookings",
        isRead: false,
      },
    ],
  });
  notificationCount += 3;

  // Notifications for customer7 (new customer)
  await prisma.notification.createMany({
    data: [
      {
        userId: customer7.id,
        title: "Booking Confirmed",
        message:
          "Your pilgrimage tour to Kataragama starting tomorrow has been confirmed!",
        type: "success",
        category: "Bookings",
        isRead: true,
      },
      {
        userId: customer7.id,
        title: "Payment Reminder",
        message:
          "Payment pending for your Hikkaduwa beach trip. Please complete payment to confirm booking.",
        type: "warning",
        category: "Payments",
        isRead: false,
      },
      {
        userId: customer7.id,
        title: "Trip Reminder",
        message:
          "Reminder: Your trip starts tomorrow at 5:00 AM. Please be at pickup location 15 minutes early.",
        type: "warning",
        category: "Bookings",
        isRead: false,
      },
    ],
  });
  notificationCount += 3;

  // Notifications for customer1 (quotation accepted, booking created)
  await prisma.notification.createMany({
    data: [
      {
        userId: customer1.id,
        title: "Quotation Accepted",
        message:
          "Your quotation for Yala Safari trip has been accepted! Booking created successfully.",
        type: "success",
        category: "Quotations",
        isRead: true,
      },
      {
        userId: customer1.id,
        title: "Payment Successful",
        message: "Payment of LKR 78,100 received for your Yala Safari booking.",
        type: "success",
        category: "Payments",
        isRead: true,
      },
    ],
  });
  notificationCount += 2;

  // Notifications for customer4 (quotation sent, cancellation)
  await prisma.notification.createMany({
    data: [
      {
        userId: customer4.id,
        title: "Quotation Available",
        message:
          "New quotation received for your Anuradhapura pilgrimage tour!",
        type: "info",
        category: "Quotations",
        isRead: false,
      },
      {
        userId: customer4.id,
        title: "Cancellation Confirmed",
        message:
          "Your booking to Sigiriya has been cancelled. Refund will be processed within 5-7 business days.",
        type: "info",
        category: "Bookings",
        isRead: true,
      },
    ],
  });
  notificationCount += 2;

  // Notifications for owner3 (multiple quotations sent, booking confirmed)
  await prisma.notification.createMany({
    data: [
      {
        userId: owner3.id,
        title: "Quotation Sent Successfully",
        message:
          "Your quotation for the 5-day Cultural Triangle tour has been sent to the customer.",
        type: "success",
        category: "Quotations",
        isRead: true,
      },
      {
        userId: owner3.id,
        title: "Multiple Quotation Requests",
        message: "You have 2 new quotation requests awaiting your response!",
        type: "warning",
        category: "Quotations",
        isRead: false,
      },
      {
        userId: owner3.id,
        title: "Trip In Progress",
        message:
          "Your vehicle is currently on a 5-day hill country tour. Trip ends on Feb 23.",
        type: "info",
        category: "Bookings",
        isRead: true,
      },
      {
        userId: owner3.id,
        title: "Booking Confirmed",
        message:
          "New booking confirmed for Cultural Triangle tour starting Feb 28!",
        type: "success",
        category: "Bookings",
        isRead: false,
      },
    ],
  });
  notificationCount += 4;

  // Notifications for owner4 (quotations, bookings)
  await prisma.notification.createMany({
    data: [
      {
        userId: owner4.id,
        title: "Quotation Rejected",
        message:
          "Customer rejected your quotation for Trincomalee tour. View feedback for improvement.",
        type: "warning",
        category: "Quotations",
        isRead: true,
      },
      {
        userId: owner4.id,
        title: "New Booking",
        message:
          "New booking confirmed for Arugam Bay surfing trip starting March 3!",
        type: "success",
        category: "Bookings",
        isRead: false,
      },
      {
        userId: owner4.id,
        title: "Payment Received",
        message: "Payment of LKR 135,000 has been credited to your account.",
        type: "success",
        category: "Payments",
        isRead: false,
      },
    ],
  });
  notificationCount += 3;

  // Notifications for admin
  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        title: "New Owner Registration",
        message:
          "Owner Kasun Fernando has submitted documents for verification.",
        type: "warning",
        category: "System",
        isRead: false,
      },
      {
        userId: admin.id,
        title: "System Activity",
        message:
          "Today: 8 new quotations, 5 bookings confirmed, 2 trips ongoing.",
        type: "info",
        category: "System",
        isRead: false,
      },
      {
        userId: admin.id,
        title: "Document Rejection",
        message:
          "Insurance document rejected for owner Sivakumar. Owner notified to resubmit.",
        type: "info",
        category: "System",
        isRead: true,
      },
    ],
  });
  notificationCount += 3;

  console.log(
    `Created ${notificationCount} total notifications for comprehensive demo\n`,
  );

  // ===========================================
  // Booking-scoped Conversations + Messages
  // ===========================================
  console.log("Seeding booking-scoped conversations and messages...");

  const bookingsForChat = await prisma.booking.findMany({
    select: {
      id: true,
      status: true,
      customerId: true,
      pickupLocation: true,
      dropoffLocation: true,
      vehicle: { select: { ownerId: true, name: true } },
    },
  });

  const messageTemplates: Record<
    string,
    Array<{ from: "customer" | "owner"; text: (b: typeof bookingsForChat[number]) => string; offsetMin: number }>
  > = {
    PENDING: [
      {
        from: "customer",
        offsetMin: -180,
        text: (b) =>
          `Hi! I just submitted a booking for the trip to ${b.dropoffLocation ?? "the destination"}. Could you confirm availability?`,
      },
      {
        from: "owner",
        offsetMin: -150,
        text: () =>
          "Hello! Thanks for booking. I'll review and confirm within the next hour. Anything special I should arrange?",
      },
      {
        from: "customer",
        offsetMin: -120,
        text: () => "We'll have some elderly passengers — pickup at the gate would be ideal.",
      },
    ],
    CONFIRMED: [
      {
        from: "owner",
        offsetMin: -2880,
        text: () =>
          "Your booking is confirmed. The driver will reach the pickup point 15 minutes early.",
      },
      {
        from: "customer",
        offsetMin: -2820,
        text: () => "Perfect, thank you. Can you share the driver's contact closer to the date?",
      },
      {
        from: "owner",
        offsetMin: -1440,
        text: () => "Of course — I'll share it the day before. Have a great trip planned!",
      },
      {
        from: "customer",
        offsetMin: -60,
        text: (b) =>
          `Quick check — is the pickup from ${b.pickupLocation} still on time?`,
      },
    ],
    ONGOING: [
      {
        from: "owner",
        offsetMin: -240,
        text: () => "Driver has reached the pickup point. He'll call once he's outside.",
      },
      {
        from: "customer",
        offsetMin: -200,
        text: () => "We're all set, boarding now. Thanks for the smooth handoff!",
      },
      {
        from: "owner",
        offsetMin: -60,
        text: () => "Have a wonderful trip. Let me know if you need anything along the way.",
      },
    ],
    COMPLETED: [
      {
        from: "owner",
        offsetMin: -10080,
        text: () =>
          "Hope you enjoyed the trip! If you have a minute, a quick review would mean a lot.",
      },
      {
        from: "customer",
        offsetMin: -9900,
        text: () =>
          "Trip went really well — driver was punctual and the bus was clean. Will leave a review today.",
      },
      {
        from: "owner",
        offsetMin: -9800,
        text: () => "Thank you so much! Looking forward to hosting you again.",
      },
    ],
    CANCELLED: [
      {
        from: "customer",
        offsetMin: -4320,
        text: () =>
          "Unfortunately we have to cancel — our group's plans changed. Apologies for the inconvenience.",
      },
      {
        from: "owner",
        offsetMin: -4260,
        text: () =>
          "Understood, things happen. I've processed the cancellation per policy. Hope to host you next time.",
      },
    ],
  };

  let conversationCount = 0;
  let messageCount = 0;

  for (const booking of bookingsForChat) {
    if (!booking.vehicle?.ownerId) continue;

    const template = messageTemplates[booking.status] ?? messageTemplates.CONFIRMED;
    const now = Date.now();

    const conversation = await prisma.conversation.create({
      data: {
        bookingId: booking.id,
        lastMessageAt: new Date(now + template[template.length - 1].offsetMin * 60_000),
      },
    });
    conversationCount += 1;

    for (let i = 0; i < template.length; i += 1) {
      const entry = template[i];
      const isLast = i === template.length - 1;
      const senderId =
        entry.from === "customer" ? booking.customerId : booking.vehicle.ownerId;
      // Mark all but the most recent message as read for completed/cancelled/ongoing
      // threads so the unread badge tells a realistic story.
      const shouldBeRead =
        !isLast ||
        booking.status === "COMPLETED" ||
        booking.status === "CANCELLED";

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId,
          content: entry.text(booking),
          createdAt: new Date(now + entry.offsetMin * 60_000),
          readAt: shouldBeRead ? new Date(now + entry.offsetMin * 60_000 + 30_000) : null,
        },
      });
      messageCount += 1;
    }
  }

  console.log(
    `Created ${conversationCount} conversations and ${messageCount} messages.\n`,
  );

  const totalVehicles =
    owner1VehicleData.length +
    owner2VehicleData.length +
    owner3VehicleData.length +
    owner4VehicleData.length +
    owner5VehicleData.length;

  // ===========================================
  // Summary
  // ===========================================
  console.log("\n" + "=".repeat(60));
  console.log("Sri Lankan TraveNest Database Seed Completed!");
  console.log("ENHANCED FOR OWNER PORTAL DEMO - May 2026");
  // ===========================================
  // Fetch OSRM Routes for Quotations and Bookings
  // ===========================================
  console.log("Fetching OSRM routes and calculating geometries...\n");
  
  const extractCity = (locStr: string) => {
    if (!locStr) return null;
    for (const city of Object.keys(LOCATIONS)) {
      if (locStr.includes(city)) return LOCATIONS[city];
    }
    return null;
  };

  const quotations = await prisma.quotation.findMany();
  for (const q of quotations) {
    const start = extractCity(q.pickupLocation);
    const end = extractCity(q.dropoffLocation || "");
    if (!start || !end) continue;

    // Pull the linked trip's intermediate stops so the seeded route and the
    // itinerary_stops pass through them. This keeps the booking detail map
    // (which reads itinerary_stops) consistent with the trip/quotation pages
    // (which read trip.intermediateStops).
    const midStops: Array<{ lat: number; lng: number; name: string }> = [];
    if (q.tripId) {
      const linkedTrip = await prismaAny.trip.findUnique({
        where: { id: q.tripId },
        select: { intermediateStops: true },
      });
      if (linkedTrip && Array.isArray(linkedTrip.intermediateStops)) {
        for (const s of linkedTrip.intermediateStops as any[]) {
          const lat = s?.location?.lat;
          const lng = s?.location?.lng;
          if (typeof lat === "number" && typeof lng === "number") {
            midStops.push({
              lat,
              lng,
              name: s?.location?.city || s?.location?.address || "",
            });
          }
        }
      }
    }

    // Ordered waypoint list: pickup → intermediate stops → dropoff.
    const orderedStops: Array<{ lat: number; lng: number; name: string }> = [
      { lat: start.latitude, lng: start.longitude, name: q.pickupLocation },
      ...midStops,
      { lat: end.latitude, lng: end.longitude, name: q.dropoffLocation || "" },
    ];

    try {
      // Use the route service (not trip/TSP) so waypoint order is preserved.
      const coordStr = orderedStops
        .map((s) => `${s.lng},${s.lat}`)
        .join(";");
      const url = `http://127.0.0.1:5001/route/v1/driving/${coordStr}?steps=true&geometries=geojson&overview=full&annotations=true`;
      const res = await fetch(url);
      const data = (await res.json()) as any;
      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceMeters = route.distance;
        const durationSeconds = route.duration;
        const geometry = route.geometry;

        await prismaAny.$executeRawUnsafe(
          `INSERT INTO "itinerary_routes"
             ("id", "quotationId", "waypoints", "routeGeometry", "distanceMeters", "durationSeconds", "createdAt")
           VALUES (
             gen_random_uuid()::text, $1,
             ST_GeomFromGeoJSON($2), ST_GeomFromGeoJSON($3),
             $4, $5, NOW()
           ) ON CONFLICT ("quotationId") DO NOTHING`,
          q.id,
          JSON.stringify({
            type: "LineString",
            coordinates: orderedStops.map((s) => [s.lng, s.lat]),
          }),
          JSON.stringify(geometry),
          distanceMeters,
          durationSeconds
        );

        // Mirror the route geometry onto the linked trip so the trip-detail and
        // quotation-detail maps can render the line from stored data (the route
        // service uses OSRM's roundtrip Trip API, which would loop back to the
        // start for multi-stop routes if computed client-side).
        if (q.tripId) {
          await prismaAny.trip.update({
            where: { id: q.tripId },
            data: { itineraryRoute: geometry },
          });
        }

        for (let i = 0; i < orderedStops.length; i++) {
          const s = orderedStops[i]!;
          await prismaAny.$executeRawUnsafe(
            `INSERT INTO "itinerary_stops" ("id", "quotationId", "stopOrder", "locationName", "coordinates", "createdAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), NOW())`,
            q.id, i, s.name, s.lng, s.lat
          );
        }

        const distanceKm = (distanceMeters / 1000).toFixed(1) + " km";
        const durationHrs = (durationSeconds / 3600).toFixed(1) + " hours";

        await prisma.quotation.update({
          where: { id: q.id },
          data: { estimatedDistance: distanceKm, estimatedDuration: durationHrs }
        });
      }
    } catch (err) {
      console.log("Failed to seed route for quotation " + q.id);
    }
  }

  const bookings = await prisma.booking.findMany();
  for (const b of bookings) {
    const start = extractCity(b.pickupLocation);
    const end = extractCity(b.dropoffLocation || "");
    if (!start || !end) continue;
    
    try {
      const url = `http://127.0.0.1:5001/trip/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?steps=true&geometries=geojson&overview=full&annotations=true`;
      const res = await fetch(url);
      const data = (await res.json()) as any;
      if (data.code === "Ok" && data.trips && data.trips.length > 0) {
        const distanceKm = (data.trips[0].distance / 1000).toFixed(1) + " km";
        const durationHrs = (data.trips[0].duration / 3600).toFixed(1) + " hours";
        await prisma.booking.update({
          where: { id: b.id },
          data: { estimatedDistance: distanceKm, estimatedDuration: durationHrs }
        });
      }
    } catch (err) {
      // ignore
    }
  }

  console.log("=".repeat(60));
  console.log("\nSummary:");
  console.log(`   • Admin users: 1`);
  console.log(`   • Bus owners: ${owners.length}`);
  console.log(`   • Customers: 7`);
  console.log(`   • Owner documents: 7 (with various statuses)`);
  console.log(`   • Total vehicles: ${totalVehicles}`);
  console.log(`   • Vehicle photos: seeded for owners 1–3 first vehicles`);
  console.log(`   • Vehicle documents: seeded for owners 1–2 vehicles`);
  console.log(`   • Vehicle availability blocks: 3 records (May 2026)`);
  console.log(`   • Total bookings: ${totalBookings} (incl. 24 historical Aug 2025–Jan 2026)`);
  console.log(`   • Total quotations: ${quotationCounter - 1} (incl. 3 new for owner 4 + type variety)`);
  console.log(`   • Total reviews: ${totalReviews} (incl. 1★ and 2★ for distribution chart)`);
  console.log(`   • Total notifications: ${notificationCount}`);
  console.log(`   • Conversations: ${conversationCount} (one per booking, with realistic message threads)`);
  console.log(`   • Messages: ${messageCount}`);
  console.log(`   • Settlements: 9 records (owners 1–4, Jan–Mar 2026)`);
  console.log(`   • Trip itineraries: 2 multi-day bookings (3 days each)`);
  console.log("\nQuotation Statuses Covered:");
  console.log("   ✓ PENDING (7) - incl. owner4 (×2) and ORDINARY type request");
  console.log("   ✓ SENT (5) - Quotations sent, awaiting customer decision");
  console.log("   ✓ VIEWED (3) - Customers have viewed quotations");
  console.log("   ✓ ACCEPTED (2) - Customers accepted, bookings created");
  console.log("   ✓ REJECTED (2) - Customers declined quotations");
  console.log("   ✓ EXPIRED (1) - Validity period passed");
  console.log("\nBooking Statuses Covered:");
  console.log("   ✓ PENDING - New bookings awaiting confirmation");
  console.log("   ✓ CONFIRMED - Upcoming trips (with driver info assigned)");
  console.log("   ✓ ONGOING (3) - Trips currently in progress");
  console.log("   ✓ COMPLETED - Past trips (incl. 24 historical for analytics)");
  console.log("   ✓ CANCELLED - Cancelled bookings with refunds");
  console.log("\nPayment Statuses Covered:");
  console.log("   ✓ PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED");
  console.log("\nDocument Statuses Covered (owner + vehicle):");
  console.log("   ✓ PENDING, VERIFIED, REJECTED");
  console.log("\nSettlement Statuses Covered:");
  console.log("   ✓ COMPLETED (3) - Processed and transferred");
  console.log("   ✓ PROCESSING (1) - Transfer in progress");
  console.log("   ✓ PENDING (5) - Awaiting processing");
  console.log("\nReview Ratings Covered:");
  console.log("   ✓ 1★ (1) · 2★ (1) · 3★ (2) · 4★ (2) · 5★ (4+)");
  console.log("\nAnalytics Historical Coverage:");
  console.log("   ✓ Aug 2025, Sep 2025, Oct 2025, Nov 2025, Dec 2025, Jan 2026");
  console.log("   ✓ Feb 2026, Mar 2026 (existing demo data)");
  console.log("\nDemo Scenarios to Showcase:");
  console.log("   1.  Analytics page — 8-month revenue trend visible");
  console.log("   2.  Earnings page — 9 settlement records across 4 owners");
  console.log("   3.  Edit vehicle — photo tab and document tab pre-filled");
  console.log("   4.  Availability calendar — 3 blocked periods in May 2026");
  console.log("   5.  Quotation requests — all 4 owners have PENDING requests");
  console.log("   6.  Booking details — driver info on all CONFIRMED bookings");
  console.log("   7.  Booking details — itinerary on 2 multi-day bookings");
  console.log("   8.  Reviews distribution — 1★ through 5★ all represented");
  console.log("   9.  Customer3 has 3 quotations for same trip (comparison)");
  console.log("   10. Owner5 pending verification — admin approval flow");
  console.log("\nLogin Credentials:");
  console.log("   Admin:      admin@travenest.lk / admin@123");
  console.log("   Owner 1:    nuwan.perera@gmail.com / owner@123 (Verified, Colombo)");
  console.log("   Owner 2:    siva.kumar@yahoo.com / owner@123 (Verified, Jaffna)");
  console.log("   Owner 3:    chaminda.silva@hotmail.com / owner@123 (Verified, Kandy)");
  console.log("   Owner 4:    mohamed.farook@gmail.com / owner@123 (Verified, Batticaloa)");
  console.log("   Owner 5:    kasun.fernando@outlook.com / owner@123 (Pending, Galle)");
  console.log("   Customer 1: dilshan.jayawardena@gmail.com / customer@123");
  console.log("   Customer 2: priya.nathan@yahoo.com / customer@123");
  console.log("   Customer 3: amal.senanayake@outlook.com / customer@123");
  console.log("   Customer 4: tharaka.wijesinghe@hotmail.com / customer@123");
  console.log("   Customer 5: nadeeka.silva@outlook.com / customer@123");
  console.log("   Customer 6: rashmi.perera@gmail.com / customer@123");
  console.log("   Customer 7: ruwan.fernando@yahoo.com / customer@123");
  console.log("=".repeat(60) + "\n");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
