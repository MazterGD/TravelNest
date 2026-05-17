import { prisma, type Prisma } from "@travenest/database";
import { recordAuditLog } from "../audit/audit.service.js";
import type { UpdatePlatformSettingsInput } from "./settings.schemas.js";

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
  maintenanceMode: false,
  maintenanceMessage: null,
} as const;

const toJsonValue = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

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
