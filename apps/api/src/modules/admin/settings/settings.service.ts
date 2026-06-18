import { prisma, type Prisma } from "@travenest/database";
import { recordAuditLog } from "../audit/audit.service.js";
import type { UpdatePlatformSettingsInput } from "./settings.schemas.js";

export type VehicleType = "ORDINARY" | "SEMI_LUXURY" | "LUXURY_AC";

export interface VehicleTypePricing {
  pricePerDay: number;
  pricePerKm: number;
  fuelCostPerKm: number;
}

// Platform-set base pricing per vehicle type. Owners no longer set their own
// base rates; these are the single source of truth so listing prices stay
// consistent across the marketplace. Tunable by admins via platform settings.
export const DEFAULT_VEHICLE_PRICING: Record<VehicleType, VehicleTypePricing> = {
  ORDINARY: { pricePerDay: 18000, pricePerKm: 55, fuelCostPerKm: 20 },
  SEMI_LUXURY: { pricePerDay: 24000, pricePerKm: 65, fuelCostPerKm: 24 },
  LUXURY_AC: { pricePerDay: 32000, pricePerKm: 80, fuelCostPerKm: 32 },
};

const DEFAULT_PLATFORM_SETTINGS = {
  generalSettings: {
    platformName: "TravelNest",
    supportEmail: "support@travelnest.lk",
    supportPhone: "+94 11 234 5678",
    defaultLocale: "en",
    defaultCurrency: "LKR",
  },
  notificationSettings: {
    emailEnabled: true,
    smsEnabled: false,
    inAppEnabled: true,
  },
  paymentSettings: {
    provider: "payhere",
    settlementWindowDays: 7,
  },
  bookingSettings: {
    autoCancelUnpaidHours: 24,
    refundWindowHours: 48,
  },
  securitySettings: {
    requireStrongPasswords: true,
    sessionTimeoutMinutes: 60,
  },
  mapSettings: {
    defaultCountry: "LK",
    defaultCity: "Colombo",
  },
  pricingSettings: DEFAULT_VEHICLE_PRICING,
  maintenanceMode: false,
  maintenanceMessage: null,
} as const;

const toJsonValue = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const readPositiveNumber = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
  }
  return fallback;
};

// Defensive merge: stored JSON may be absent or partial, so each field falls
// back to the platform default to guarantee a complete, valid pricing table.
const normalizeVehiclePricing = (
  raw: unknown,
): Record<VehicleType, VehicleTypePricing> => {
  const source = (raw ?? {}) as Record<string, unknown>;
  const result = {} as Record<VehicleType, VehicleTypePricing>;

  (Object.keys(DEFAULT_VEHICLE_PRICING) as VehicleType[]).forEach((type) => {
    const typeSource = (source[type] ?? {}) as Record<string, unknown>;
    const defaults = DEFAULT_VEHICLE_PRICING[type];
    result[type] = {
      pricePerDay: readPositiveNumber(
        typeSource.pricePerDay,
        defaults.pricePerDay,
      ),
      pricePerKm: readPositiveNumber(typeSource.pricePerKm, defaults.pricePerKm),
      fuelCostPerKm: readPositiveNumber(
        typeSource.fuelCostPerKm,
        defaults.fuelCostPerKm,
      ),
    };
  });

  return result;
};

const ensurePlatformSettings = async () => {
  const existing = await prisma.platformSettings.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      updatedByAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.platformSettings.create({
    data: {
      generalSettings: toJsonValue(DEFAULT_PLATFORM_SETTINGS.generalSettings),
      notificationSettings: toJsonValue(
        DEFAULT_PLATFORM_SETTINGS.notificationSettings,
      ),
      paymentSettings: toJsonValue(DEFAULT_PLATFORM_SETTINGS.paymentSettings),
      bookingSettings: toJsonValue(DEFAULT_PLATFORM_SETTINGS.bookingSettings),
      securitySettings: toJsonValue(DEFAULT_PLATFORM_SETTINGS.securitySettings),
      mapSettings: toJsonValue(DEFAULT_PLATFORM_SETTINGS.mapSettings),
      pricingSettings: toJsonValue(DEFAULT_PLATFORM_SETTINGS.pricingSettings),
      maintenanceMode: DEFAULT_PLATFORM_SETTINGS.maintenanceMode,
      maintenanceMessage: DEFAULT_PLATFORM_SETTINGS.maintenanceMessage,
    },
    include: {
      updatedByAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
    },
  });
};

export const getPlatformSettings = async () => {
  return ensurePlatformSettings();
};

/**
 * Resolve the platform's base pricing per vehicle type. Single source of truth
 * for vehicle listing prices — consumed when auto-populating a vehicle's rates
 * and when surfacing reference pricing to owners.
 */
export const getVehicleTypePricing = async (): Promise<
  Record<VehicleType, VehicleTypePricing>
> => {
  const settings = await ensurePlatformSettings();
  return normalizeVehiclePricing(settings.pricingSettings);
};

export const updatePlatformSettings = async (
  adminId: string,
  payload: UpdatePlatformSettingsInput,
) => {
  const existing = await ensurePlatformSettings();

  const updated = await prisma.platformSettings.update({
    where: { id: existing.id },
    data: {
      ...(payload.generalSettings !== undefined
        ? { generalSettings: toJsonValue(payload.generalSettings) }
        : {}),
      ...(payload.notificationSettings !== undefined
        ? {
            notificationSettings: toJsonValue(payload.notificationSettings),
          }
        : {}),
      ...(payload.paymentSettings !== undefined
        ? { paymentSettings: toJsonValue(payload.paymentSettings) }
        : {}),
      ...(payload.bookingSettings !== undefined
        ? { bookingSettings: toJsonValue(payload.bookingSettings) }
        : {}),
      ...(payload.securitySettings !== undefined
        ? { securitySettings: toJsonValue(payload.securitySettings) }
        : {}),
      ...(payload.mapSettings !== undefined
        ? { mapSettings: toJsonValue(payload.mapSettings) }
        : {}),
      ...(payload.pricingSettings !== undefined
        ? {
            pricingSettings: toJsonValue(
              normalizeVehiclePricing(payload.pricingSettings),
            ),
          }
        : {}),
      ...(payload.maintenanceMode !== undefined
        ? { maintenanceMode: payload.maintenanceMode }
        : {}),
      ...(payload.maintenanceMessage !== undefined
        ? { maintenanceMessage: payload.maintenanceMessage || null }
        : {}),
      updatedBy: adminId,
    },
    include: {
      updatedByAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
    },
  });

  await recordAuditLog(
    adminId,
    "UPDATE",
    "PLATFORM_SETTINGS",
    updated.id,
    {
      previous: {
        maintenanceMode: existing.maintenanceMode,
        maintenanceMessage: existing.maintenanceMessage,
      },
      next: {
        maintenanceMode: updated.maintenanceMode,
        maintenanceMessage: updated.maintenanceMessage,
      },
      updatedFields: Object.keys(payload),
    },
    "Platform settings updated",
  );

  return updated;
};
