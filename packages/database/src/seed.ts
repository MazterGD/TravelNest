import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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
  await prisma.notification.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.tripPackage.deleteMany({});
  await prisma.quotation.deleteMany({});
  await prisma.vehiclePhoto.deleteMany({});
  await prisma.vehicleDocument.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.ownerDocument.deleteMany({});
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
      firstName: "Rajitha",
      lastName: "Wickramasinghe",
      phone: "+94112345678",
      role: "ADMIN",
      status: "ACTIVE",
      isVerified: true,
      address: "No. 45, Galle Road",
      city: "Colombo 03",
      district: "Colombo",
      postalCode: "00300",
    },
  });
  console.log(`Admin created: ${admin.email}\n`);

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
  // Create Owner Documents (Different Statuses)
  // ===========================================
  console.log("Creating owner documents...\n");

  // Owner 1 - All verified
  await prisma.ownerDocument.createMany({
    data: [
      {
        ownerId: owner1.id,
        type: "NIC",
        url: "https://storage.example.com/docs/owner1-nic.pdf",
        fileName: "nic-front.pdf",
        fileSize: 524288,
        mimeType: "application/pdf",
        status: "VERIFIED",
        verifiedAt: new Date("2025-12-15T10:00:00.000Z"),
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
        verifiedAt: new Date("2025-12-15T10:00:00.000Z"),
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
        verifiedAt: new Date("2025-12-15T10:00:00.000Z"),
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
        verifiedAt: new Date("2025-11-20T14:00:00.000Z"),
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
      startDate: new Date("2026-02-15T08:00:00.000Z"),
      endDate: new Date("2026-02-16T20:00:00.000Z"),
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
      startDate: new Date("2026-02-20T06:00:00.000Z"),
      endDate: new Date("2026-02-22T18:00:00.000Z"),
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
      validUntil: new Date("2026-01-28T23:59:59.000Z"),
      sentAt: new Date("2026-01-20T10:30:00.000Z"),
    },
  });

  // Quotation 3: PENDING - Another new request
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer2.id,
      vehicleId: owner3Vehicles[2]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-03-10T06:00:00.000Z"),
      endDate: new Date("2026-03-12T18:00:00.000Z"),
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
      startDate: new Date("2026-02-15T08:00:00.000Z"),
      endDate: new Date("2026-02-16T20:00:00.000Z"),
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
      validUntil: new Date("2026-02-10T23:59:59.000Z"),
      sentAt: new Date("2026-01-28T14:00:00.000Z"),
    },
  });

  // Quotation for customer1 from owner3 - SENT (can compare)
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer1.id,
      vehicleId: owner3Vehicles[0]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-02-15T08:00:00.000Z"),
      endDate: new Date("2026-02-16T20:00:00.000Z"),
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
      validUntil: new Date("2026-02-12T23:59:59.000Z"),
      sentAt: new Date("2026-01-29T09:30:00.000Z"),
    },
  });

  // Quotation for customer1 from owner4 - VIEWED (customer has seen it)
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer1.id,
      vehicleId: owner1Vehicles[1]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-02-15T08:00:00.000Z"),
      endDate: new Date("2026-02-16T20:00:00.000Z"),
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
      validUntil: new Date("2026-02-10T23:59:59.000Z"),
      sentAt: new Date("2026-01-28T11:00:00.000Z"),
      viewedAt: new Date("2026-01-29T16:45:00.000Z"),
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
      startDate: new Date("2026-02-25T07:00:00.000Z"),
      endDate: new Date("2026-02-25T19:00:00.000Z"),
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
      validUntil: new Date("2026-02-05T23:59:59.000Z"),
      sentAt: new Date("2026-01-25T09:00:00.000Z"),
      viewedAt: new Date("2026-01-27T14:30:00.000Z"),
    },
  });

  // Quotation 5: ACCEPTED - Customer accepted the quotation
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer4.id,
      vehicleId: owner3Vehicles[0]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-03-05T06:00:00.000Z"),
      endDate: new Date("2026-03-07T18:00:00.000Z"),
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
      validUntil: new Date("2026-02-10T23:59:59.000Z"),
      sentAt: new Date("2026-01-28T11:00:00.000Z"),
      viewedAt: new Date("2026-01-29T10:00:00.000Z"),
      respondedAt: new Date("2026-01-29T15:30:00.000Z"),
    },
  });

  // Quotation 6: REJECTED - Customer rejected the quotation
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer5.id,
      vehicleId: owner1Vehicles[1]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-02-18T08:00:00.000Z"),
      endDate: new Date("2026-02-18T20:00:00.000Z"),
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
      validUntil: new Date("2026-02-08T23:59:59.000Z"),
      sentAt: new Date("2026-01-26T13:00:00.000Z"),
      viewedAt: new Date("2026-01-28T09:00:00.000Z"),
      respondedAt: new Date("2026-01-28T16:00:00.000Z"),
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
      startDate: new Date("2026-02-10T07:00:00.000Z"),
      endDate: new Date("2026-02-12T19:00:00.000Z"),
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
      validUntil: new Date("2026-01-18T23:59:59.000Z"),
      sentAt: new Date("2026-01-15T10:00:00.000Z"),
      viewedAt: new Date("2026-01-16T11:00:00.000Z"),
    },
  });

  // Quotation 8: PENDING - Another pending request from new customer
  await prisma.quotation.create({
    data: {
      quotationId: generateQuotationId(),
      customerId: customer5.id,
      vehicleId: owner3Vehicles[1]?.id,
      vehicleType: "LUXURY_AC",
      startDate: new Date("2026-03-15T06:00:00.000Z"),
      endDate: new Date("2026-03-17T18:00:00.000Z"),
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

  console.log(
    `Created ${quotationCounter - 1} quotations covering all statuses\n`,
  );

  // ===========================================
  // Create sample bookings for demo data
  // ===========================================
  console.log("Creating sample bookings...\n");

  // Get vehicles for owner 4 (others already fetched for quotations)
  const owner4Vehicles = await prisma.vehicle.findMany({
    where: { ownerId: owner4.id },
    take: 2,
  });

  let totalBookings = 0;

  // OWNER 1 BOOKINGS (Nuwan Perera - Colombo)
  if (owner1Vehicles.length > 0) {
    // Confirmed booking - upcoming
    const booking1 = await prisma.booking.create({
      data: {
        customerId: customer1.id,
        vehicleId: owner1Vehicles[0].id,
        startDate: new Date("2026-01-25T06:00:00.000Z"),
        endDate: new Date("2026-01-27T18:00:00.000Z"),
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

    // Pending booking - awaiting confirmation
    await prisma.booking.create({
      data: {
        customerId: customer2.id,
        vehicleId: owner1Vehicles[1].id,
        startDate: new Date("2026-02-05T08:00:00.000Z"),
        endDate: new Date("2026-02-07T20:00:00.000Z"),
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
        startDate: new Date("2025-12-15T06:00:00.000Z"),
        endDate: new Date("2025-12-18T18:00:00.000Z"),
        pickupLocation: "Colombo Airport",
        dropoffLocation: "Colombo Airport",
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
        startDate: new Date("2026-01-22T10:00:00.000Z"),
        endDate: new Date("2026-01-22T18:00:00.000Z"),
        pickupLocation: "Colombo - Slave Island",
        dropoffLocation: "Kandy",
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
        startDate: new Date("2026-02-10T08:00:00.000Z"),
        endDate: new Date("2026-02-10T18:00:00.000Z"),
        pickupLocation: "Jaffna - Railway Station",
        dropoffLocation: "Nallur Kandaswamy Kovil",
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
        startDate: new Date("2026-01-28T06:00:00.000Z"),
        endDate: new Date("2026-01-30T20:00:00.000Z"),
        pickupLocation: "Jaffna - City Center",
        dropoffLocation: "Trincomalee Beach",
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
        startDate: new Date("2026-01-10T08:00:00.000Z"),
        endDate: new Date("2026-01-12T18:00:00.000Z"),
        pickupLocation: "Jaffna",
        dropoffLocation: "Jaffna",
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
        startDate: new Date("2026-01-30T06:00:00.000Z"),
        endDate: new Date("2026-02-01T18:00:00.000Z"),
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
        startDate: new Date("2025-12-20T06:00:00.000Z"),
        endDate: new Date("2025-12-22T20:00:00.000Z"),
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
        startDate: new Date("2026-01-19T06:00:00.000Z"),
        endDate: new Date("2026-01-21T18:00:00.000Z"),
        pickupLocation: "Kandy",
        dropoffLocation: "Sigiriya",
        totalPassengers: 28,
        totalAmount: 55000,
        status: "ONGOING",
        notes: "Cultural triangle tour",
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
        startDate: new Date("2026-02-15T06:00:00.000Z"),
        endDate: new Date("2026-02-17T18:00:00.000Z"),
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
        startDate: new Date("2026-01-05T08:00:00.000Z"),
        endDate: new Date("2026-01-07T18:00:00.000Z"),
        pickupLocation: "Batticaloa",
        dropoffLocation: "Arugam Bay",
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
      startDate: new Date("2026-02-05T07:00:00.000Z"),
      endDate: new Date("2026-02-05T19:00:00.000Z"),
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
      startDate: new Date("2026-02-08T06:00:00.000Z"),
      endDate: new Date("2026-02-10T18:00:00.000Z"),
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
      startDate: new Date("2026-02-12T08:00:00.000Z"),
      endDate: new Date("2026-02-14T20:00:00.000Z"),
      pickupLocation: "Kandy - City",
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
      startDate: new Date("2026-01-20T06:00:00.000Z"),
      endDate: new Date("2026-01-22T18:00:00.000Z"),
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
      startDate: new Date("2026-02-20T07:00:00.000Z"),
      endDate: new Date("2026-02-22T19:00:00.000Z"),
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

  // Review 1: Excellent experience
  if (completedBookings[0]) {
    await prisma.review.create({
      data: {
        bookingId: completedBookings[0].id,
        vehicleId: completedBookings[0].vehicleId,
        customerId: completedBookings[0].customerId,
        rating: 5,
        comment:
          "Excellent service! The bus was very clean and comfortable. The driver was professional and knew the routes very well. Air conditioning worked perfectly throughout the trip. Highly recommend Perera Transport for any long-distance travel in Sri Lanka. Will definitely use again!",
      },
    });
    totalReviews++;

    // Owner response
    await prisma.review.update({
      where: { bookingId: completedBookings[0].id },
      data: {
        ownerResponse:
          "Thank you so much for your wonderful feedback! We're delighted that you enjoyed your journey with us. Your satisfaction is our priority. Looking forward to serving you again!",
      },
    });
  }

  // Review 2: Very good experience
  if (completedBookings[1]) {
    await prisma.review.create({
      data: {
        bookingId: completedBookings[1].id,
        vehicleId: completedBookings[1].vehicleId,
        customerId: completedBookings[1].customerId,
        rating: 4,
        comment:
          "Very good experience overall. The vehicle arrived on time and was well-maintained. The journey through the Northern Province was comfortable. Driver was courteous and accommodating. Only minor issue was the AC was a bit too cold at times, but they adjusted it when we asked. Good value for money!",
      },
    });
    totalReviews++;

    // Owner response
    await prisma.review.update({
      where: { bookingId: completedBookings[1].id },
      data: {
        ownerResponse:
          "Thank you for choosing Northern Express Tours! We appreciate your feedback about the AC temperature. We'll ensure our drivers are more attentive to passenger comfort. Hope to serve you again soon!",
      },
    });
  }

  // Review 3: Great hill country tour
  if (completedBookings[2]) {
    await prisma.review.create({
      data: {
        bookingId: completedBookings[2].id,
        vehicleId: completedBookings[2].vehicleId,
        customerId: completedBookings[2].customerId,
        rating: 5,
        comment:
          "Perfect for hill country tours! The panoramic windows were great for enjoying the scenic views. Driver was experienced with mountain roads and made us feel safe throughout the journey. The bus was spacious and clean. Chaminda's service is top-notch. Highly recommended for Kandy and Nuwara Eliya trips!",
      },
    });
    totalReviews++;
  }

  // Review 4: Satisfactory service
  if (completedBookings[3]) {
    await prisma.review.create({
      data: {
        bookingId: completedBookings[3].id,
        vehicleId: completedBookings[3].vehicleId,
        customerId: completedBookings[3].customerId,
        rating: 4,
        comment:
          "Good service for a budget-friendly option. The mini bus was suitable for our small group. Everything went smoothly. Driver was punctual and helpful with our luggage. The vehicle could use some interior updates but overall served our purpose well for the eastern coast trip.",
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
        bookingId: completedBookings[5].id,
        vehicleId: completedBookings[5].vehicleId,
        customerId: completedBookings[5].customerId,
        rating: 3,
        comment:
          "Average experience. Bus arrived late by 30 minutes. The vehicle condition was acceptable but seats could be more comfortable. Driver was friendly though. Service needs improvement in terms of punctuality.",
      },
    });
    totalReviews++;
  }

  if (completedBookings[6]) {
    await prisma.review.create({
      data: {
        bookingId: completedBookings[6].id,
        vehicleId: completedBookings[6].vehicleId,
        customerId: completedBookings[6].customerId,
        rating: 5,
        comment:
          "Outstanding service! The luxury coach exceeded our expectations. Professional driver, spotless interior, and smooth ride. Perfect for long-distance travel. Will recommend to everyone!",
      },
    });
    totalReviews++;

    // Owner response
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
        isRead: false,
      },
      {
        userId: customer1.id,
        title: "Quotation Received",
        message: "You have received a new quotation for your trip request.",
        type: "info",
        isRead: true,
      },
      {
        userId: customer1.id,
        title: "Payment Successful",
        message: "Your payment of LKR 150,000 has been processed successfully.",
        type: "success",
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
        isRead: false,
      },
      {
        userId: customer2.id,
        title: "Booking Reminder",
        message:
          "Your trip starts tomorrow. Please be ready at the pickup location.",
        type: "warning",
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
        isRead: false,
      },
      {
        userId: owner1.id,
        title: "Booking Confirmed",
        message: "A new booking has been confirmed for your vehicle.",
        type: "success",
        isRead: true,
      },
      {
        userId: owner1.id,
        title: "Payment Received",
        message: "Payment of LKR 150,000 has been credited to your account.",
        type: "success",
        isRead: true,
      },
      {
        userId: owner1.id,
        title: "New Review",
        message: "A customer has left a 5-star review for your service!",
        type: "info",
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
        isRead: false,
      },
      {
        userId: owner2.id,
        title: "Vehicle Maintenance Reminder",
        message: "It's time for your vehicle's regular maintenance check.",
        type: "warning",
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
        isRead: false,
      },
      {
        userId: owner5.id,
        title: "Documents Pending Verification",
        message: "Please wait while we verify your submitted documents.",
        type: "warning",
        isRead: true,
      },
    ],
  });
  notificationCount += 2;

  console.log(`Created ${notificationCount} notifications\n`);

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
  console.log("=".repeat(60));
  console.log("\nSummary:");
  console.log(`   • Admin users: 1`);
  console.log(`   • Bus owners: ${owners.length}`);
  console.log(`   • Customers: 5`);
  console.log(`   • Business profiles: 3`);
  console.log(`   • Owner documents: 7 (with various statuses)`);
  console.log(`   • Total vehicles: ${totalVehicles}`);
  console.log(`   • Total bookings: ${totalBookings}`);
  console.log(`   • Total quotations: ${quotationCounter - 1}`);
  console.log(`   • Total reviews: ${totalReviews}`);
  console.log(`   • Total notifications: ${notificationCount}`);
  console.log("\nQuotation Statuses Covered:");
  console.log("   ✓ PENDING, SENT, VIEWED, ACCEPTED, REJECTED, EXPIRED");
  console.log("\nBooking Statuses Covered:");
  console.log("   ✓ PENDING, CONFIRMED, ONGOING, COMPLETED, CANCELLED");
  console.log("\nPayment Statuses Covered:");
  console.log("   ✓ PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED");
  console.log("\nDocument Statuses Covered:");
  console.log("   ✓ PENDING, VERIFIED, REJECTED");
  console.log("\nLogin Credentials:");
  console.log("   Admin:      admin@travenest.lk / admin@123");
  console.log("   Owner 1:    nuwan.perera@gmail.com / owner@123 (Verified)");
  console.log("   Owner 2:    siva.kumar@yahoo.com / owner@123 (Verified)");
  console.log(
    "   Owner 3:    chaminda.silva@hotmail.com / owner@123 (Verified)",
  );
  console.log("   Owner 4:    mohamed.farook@gmail.com / owner@123 (Verified)");
  console.log(
    "   Owner 5:    kasun.fernando@outlook.com / owner@123 (Pending)",
  );
  console.log("   Customer 1: dilshan.jayawardena@gmail.com / customer@123");
  console.log("   Customer 2: priya.nathan@yahoo.com / customer@123");
  console.log("   Customer 3: amal.senanayake@outlook.com / customer@123");
  console.log("   Customer 4: tharaka.wijesinghe@hotmail.com / customer@123");
  console.log("   Customer 5: nadeeka.silva@outlook.com / customer@123");
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
