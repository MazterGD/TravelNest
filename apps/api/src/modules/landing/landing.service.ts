import { prisma } from "@travenest/database";
import type {
  RouteEstimateInput,
  SubmitContactInput,
} from "./landing.schemas.js";

export const landingService = {
  /**
   * Get all data required for the landing page in a single call
   */
  getLandingData: async () => {
    const [
      stats,
      popularRoutes,
      testimonials,
      trustedPartners,
      featuredVehiclesRaw,
    ] = await Promise.all([
      prisma.platformStat.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.popularRoute.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        take: 6,
      }),
      prisma.testimonial.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        take: 5,
      }),
      prisma.trustedPartner.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.vehicle.findMany({
        where: {
          isActive: true,
          isAvailable: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 6,
        include: {
          owner: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          photos: {
            orderBy: { sortOrder: "asc" },
            take: 1,
          },
          reviews: {
            select: {
              rating: true,
            },
          },
        },
      }),
    ]);

    const featuredVehicles = featuredVehiclesRaw.map((vehicle) => {
      const reviewCount = vehicle.reviews.length;
      const averageRating = reviewCount
        ? vehicle.reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviewCount
        : 0;

      return {
        id: vehicle.id,
        name: vehicle.name,
        seats: vehicle.seats,
        location: vehicle.location,
        amenities: vehicle.amenities,
        pricePerDay: vehicle.pricePerDay,
        imageUrl: vehicle.photos[0]?.url || vehicle.images[0] || null,
        ownerName: `${vehicle.owner.firstName} ${vehicle.owner.lastName}`,
        rating: Number(averageRating.toFixed(1)),
        reviewsCount: reviewCount,
      };
    });

    return {
      stats,
      popularRoutes,
      testimonials,
      trustedPartners,
      featuredVehicles,
    };
  },

  /**
   * Get platform statistics separately if needed
   */
  getStats: async () => {
    return prisma.platformStat.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  },

  getPublicConfig: async () => {
    const [configs, vehicleTypesInUse, acTypesInUse, districtsInUse, faqs] =
      await Promise.all([
        prisma.platformConfig.findMany({
          where: { isActive: true },
        }),
        prisma.vehicle.findMany({
          where: { isActive: true },
          distinct: ["type"],
          select: { type: true },
          orderBy: { type: "asc" },
        }),
        prisma.vehicle.findMany({
          where: { isActive: true, acType: { not: null } },
          distinct: ["acType"],
          select: { acType: true },
          orderBy: { acType: "asc" },
        }),
        prisma.user.findMany({
          where: { district: { not: null } },
          distinct: ["district"],
          select: { district: true },
          orderBy: { district: "asc" },
        }),
        prisma.faq.findMany({
          where: { isPublished: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          take: 8,
          select: {
            id: true,
            question: true,
            answer: true,
            category: true,
          },
        }),
      ]);

    const configMap = new Map(
      configs.map((config) => [config.key, config.value]),
    );

    const vehicleTypeDefaults = vehicleTypesInUse.map((entry) => ({
      value: entry.type,
      label: entry.type,
    }));

    const acTypeDefaults = acTypesInUse
      .filter((entry) => entry.acType)
      .map((entry) => ({
        value: String(entry.acType).toUpperCase().replace(/[- ]/g, "_"),
        label: entry.acType,
      }));

    const districtDefaults = districtsInUse
      .map((entry) => entry.district)
      .filter((district): district is string => Boolean(district));

    const amenitiesDefaults = [
      { id: "wifi", label: "WiFi" },
      { id: "ac", label: "Air Conditioning" },
      { id: "music", label: "Music System" },
      { id: "usb", label: "USB Charging" },
      { id: "tv", label: "TV/Entertainment" },
      { id: "reclining", label: "Reclining Seats" },
      { id: "reading", label: "Reading Lights" },
      { id: "gps", label: "GPS Tracking" },
    ];

    const socialMediaDefaults = {
      facebook: "https://facebook.com/travelnest",
      instagram: "https://instagram.com/travelnest",
      twitter: "https://x.com/travelnest",
      linkedin: "https://linkedin.com/company/travelnest",
    };

    const googleMapsDefaults = {
      embedUrl:
        "https://www.google.com/maps?q=No.+45,+Galle+Road,+Colombo+03&output=embed",
      lat: 6.9271,
      lng: 79.8612,
      zoom: 15,
      address: "No. 45, Galle Road, Colombo 03, Sri Lanka",
    };

    const aboutStatsDefaults = [
      { label: "Verified Buses", value: "500+", icon: "bus" },
      { label: "Happy Customers", value: "10K+", icon: "users" },
      { label: "Districts Covered", value: "25", icon: "map" },
      { label: "Average Rating", value: "4.8★", icon: "star" },
    ];

    const loginMarketingStatsDefaults = {
      verifiedBuses: "500+",
      happyCustomers: "5000+",
      averageRating: "4.8★",
    };

    const faqDefaults = faqs.map((faq) => ({
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
    }));

    return {
      contactInfo: (configMap.get("contact_info") as {
        address?: string;
        email?: string;
        phone?: string;
        hours?: string;
      }) || {
        address: "No. 45, Galle Road, Colombo 03",
        email: "support@travelnest.lk",
        phone: "+94112345678",
        hours: "Mon - Fri, 8:30 AM - 6:00 PM",
      },
      socialMediaLinks:
        (configMap.get("social_media_links") as {
          facebook?: string;
          instagram?: string;
          twitter?: string;
          linkedin?: string;
        }) || socialMediaDefaults,
      googleMapsEmbed:
        (configMap.get("google_maps_embed") as {
          embedUrl?: string;
          lat?: number;
          lng?: number;
          zoom?: number;
          address?: string;
        }) || googleMapsDefaults,
      aboutStats:
        (configMap.get("about_page_stats") as Array<{
          label: string;
          value: string;
          icon?: string;
        }>) || aboutStatsDefaults,
      loginMarketingStats:
        (configMap.get("login_marketing_stats") as {
          verifiedBuses?: string;
          happyCustomers?: string;
          averageRating?: string;
        }) || loginMarketingStatsDefaults,
      faqs:
        (configMap.get("contact_page_faqs") as Array<{
          id: string;
          question: string;
          answer: string;
          category?: string;
        }>) || faqDefaults,
      options: {
        vehicleTypes:
          (configMap.get("vehicle_types") as Array<{
            value: string;
            label: string;
          }>) || vehicleTypeDefaults,
        acTypes:
          (configMap.get("ac_types") as Array<{
            value: string;
            label: string;
          }>) || acTypeDefaults,
        conditions: (configMap.get("vehicle_conditions") as Array<{
          value: string;
          label: string;
        }>) || [
          { value: "excellent", label: "Excellent" },
          { value: "good", label: "Good" },
          { value: "fair", label: "Fair" },
        ],
        amenities:
          (configMap.get("vehicle_amenities") as Array<{
            id: string;
            label: string;
          }>) || amenitiesDefaults,
        districts: (configMap.get("districts") as string[]) || districtDefaults,
        quotationVehicleTypes:
          (configMap.get("quotation_vehicle_types") as Array<{
            value: string;
            label: string;
          }>) || vehicleTypeDefaults,
      },
      recentSearches:
        (configMap.get("recent_searches") as Array<{
          id: string;
          from: string;
          to: string;
          date: string;
          passengers: number;
        }>) || [],
      quotationPricing: (configMap.get("quotation_pricing") as {
        driverCostPercentage: number;
        fuelCostPerKm: number;
        tollChargesBase: number;
        permitFeesBase: number;
        taxRate: number;
        defaultValidityDays: number;
        validityOptionsDays: number[];
      }) || {
        driverCostPercentage: 0,
        fuelCostPerKm: 0,
        tollChargesBase: 0,
        permitFeesBase: 0,
        taxRate: 0,
        defaultValidityDays: 0,
        validityOptionsDays: [],
      },
    };
  },

  getAboutStats: async () => {
    const config = await prisma.platformConfig.findUnique({
      where: { key: "about_page_stats" },
    });

    if (config?.isActive && Array.isArray(config.value)) {
      return config.value as Array<{
        label: string;
        value: string;
        icon?: string;
      }>;
    }

    const stats = await prisma.platformStat.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      take: 4,
      select: {
        label: true,
        value: true,
        key: true,
      },
    });

    return stats.map((stat) => ({
      label: stat.label,
      value: stat.value,
      icon: stat.key,
    }));
  },

  submitContactMessage: async (input: SubmitContactInput) => {
    const reference = `CN-${Date.now()}`;

    await prisma.contactMessage.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        subject: input.subject,
        message: input.message,
        referenceId: reference,
      },
    });

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
      take: 10,
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: "contact_message",
          title: `Contact: ${input.subject}`,
          message: `${input.name} (${input.email}) sent a contact request`,
          data: {
            name: input.name,
            email: input.email,
            phone: input.phone,
            subject: input.subject,
            message: input.message,
          },
        })),
      });
    }

    return {
      accepted: true,
      reference,
    };
  },

  getRouteEstimate: async (input: RouteEstimateInput) => {
    const points = [
      input.pickupLocation,
      ...(input.intermediateStops || []),
      input.dropoffLocation,
    ];

    let estimatedDistanceKm = 0;

    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index];
      const to = points[index + 1];

      const sameCity =
        from.city.trim().toLowerCase() === to.city.trim().toLowerCase();
      const sameDistrict =
        from.district.trim().toLowerCase() === to.district.trim().toLowerCase();

      if (sameCity) {
        estimatedDistanceKm += 12;
      } else if (sameDistrict) {
        estimatedDistanceKm += 38;
      } else {
        estimatedDistanceKm += 92;
      }
    }

    if (input.isRoundTrip) {
      estimatedDistanceKm *= 2;
    }

    const stopBufferKm = (input.intermediateStops?.length || 0) * 8;
    estimatedDistanceKm += stopBufferKm;

    const estimatedDurationHours = estimatedDistanceKm / 42;

    const hours = Math.floor(estimatedDurationHours);
    const minutes = Math.round((estimatedDurationHours - hours) * 60);

    return {
      estimatedDistanceKm: Math.max(0, Math.round(estimatedDistanceKm)),
      estimatedDurationMinutes: Math.max(
        0,
        Math.round(estimatedDurationHours * 60),
      ),
      displayDistance: `${Math.max(0, Math.round(estimatedDistanceKm))} km`,
      displayDuration: `${hours}h ${minutes}min`,
    };
  },
};
