import bcrypt from "bcryptjs";
import xss from "xss";
import prisma from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";
import { deleteByUrl } from "../../utils/storage.js";
import type {
  UpdatePersonalInfoInput,
  UpdateAddressInput,
  ChangePasswordInput,
} from "./user.schemas.js";

/**
 * Get user profile by ID
 */
export const getUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      nicNumber: true,
      avatar: true,
      address: true,
      city: true,
      district: true,
      postalCode: true,
      role: true,
      status: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  return user;
};

/**
 * Update user personal information
 */
export const updatePersonalInfo = async (
  userId: string,
  data: UpdatePersonalInfoInput,
) => {
  const sanitizedData: any = {};

  if (data.firstName)
    sanitizedData.firstName = xss(data.firstName.trim(), {
      whiteList: {},
      stripIgnoreTag: true,
    });
  if (data.lastName)
    sanitizedData.lastName = xss(data.lastName.trim(), {
      whiteList: {},
      stripIgnoreTag: true,
    });
  if (data.phone)
    sanitizedData.phone = xss(data.phone.trim(), {
      whiteList: {},
      stripIgnoreTag: true,
    });
  if (data.nicNumber)
    sanitizedData.nicNumber = xss(data.nicNumber.trim(), {
      whiteList: {},
      stripIgnoreTag: true,
    });

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: sanitizedData,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      nicNumber: true,
      avatar: true,
      address: true,
      city: true,
      district: true,
      postalCode: true,
      role: true,
      status: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

/**
 * Update user address information
 */
export const updateAddress = async (
  userId: string,
  data: UpdateAddressInput,
) => {
  const sanitizedData: any = {};

  if (data.address)
    sanitizedData.address = xss(data.address.trim(), {
      whiteList: {},
      stripIgnoreTag: true,
    });
  if (data.city)
    sanitizedData.city = xss(data.city.trim(), {
      whiteList: {},
      stripIgnoreTag: true,
    });
  if (data.district)
    sanitizedData.district = xss(data.district.trim(), {
      whiteList: {},
      stripIgnoreTag: true,
    });
  if (data.postalCode)
    sanitizedData.postalCode = xss(data.postalCode.trim(), {
      whiteList: {},
      stripIgnoreTag: true,
    });

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: sanitizedData,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      nicNumber: true,
      avatar: true,
      address: true,
      city: true,
      district: true,
      postalCode: true,
      role: true,
      status: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

/**
 * Update user avatar
 */
export const updateAvatar = async (userId: string, avatarUrl: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatar: true },
  });

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  if (user.avatar) {
    await deleteByUrl(user.avatar);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { avatar: avatarUrl },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      nicNumber: true,
      avatar: true,
      address: true,
      city: true,
      district: true,
      postalCode: true,
      role: true,
      status: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

/**
 * Delete user avatar
 */
export const deleteAvatar = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatar: true },
  });

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  if (user.avatar) {
    await deleteByUrl(user.avatar);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { avatar: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      nicNumber: true,
      avatar: true,
      address: true,
      city: true,
      district: true,
      postalCode: true,
      role: true,
      status: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

/**
 * Change user password
 */
export const changePassword = async (
  userId: string,
  data: ChangePasswordInput,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, tokenVersion: true },
  });

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(
    data.currentPassword,
    user.password,
  );

  if (!isValidPassword) {
    throw ApiError.badRequest("Current password is incorrect");
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(data.newPassword, 12);

  // Update password and increment token version to invalidate old tokens
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      tokenVersion: user.tokenVersion + 1,
    },
  });

  return { message: "Password changed successfully" };
};

/**
 * Delete user account
 */
export const deleteAccount = async (userId: string) => {
  // Check if user has any active bookings
  const activeBookings = await prisma.booking.count({
    where: {
      customerId: userId,
      status: {
        in: ["PENDING", "CONFIRMED", "ONGOING"],
      },
    },
  });

  if (activeBookings > 0) {
    throw ApiError.badRequest(
      "Cannot delete account with active bookings. Please cancel or complete all bookings first.",
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      avatar: true,
      documents: { select: { url: true } },
      vehicles: {
        select: {
          documents: { select: { url: true } },
          photos: { select: { url: true } },
        },
      },
    },
  });

  const urls: string[] = [];
  if (user?.avatar) urls.push(user.avatar);
  user?.documents.forEach((doc) => urls.push(doc.url));
  user?.vehicles.forEach((vehicle) => {
    vehicle.documents.forEach((doc) => urls.push(doc.url));
    vehicle.photos.forEach((photo) => urls.push(photo.url));
  });

  await Promise.all(urls.map((url) => deleteByUrl(url)));

  // Delete user (cascades to related records due to Prisma relations)
  await prisma.user.delete({
    where: { id: userId },
  });

  return { message: "Account deleted successfully" };
};

/**
 * Get customer dashboard statistics
 */
export const getCustomerDashboardStats = async (customerId: string) => {
  const [
    totalBookings,
    completedBookings,
    pendingBookings,
    pendingQuotations,
    totalReviews,
  ] = await Promise.all([
    prisma.booking.count({
      where: { customerId },
    }),
    prisma.booking.count({
      where: { customerId, status: "COMPLETED" },
    }),
    prisma.booking.count({
      where: { customerId, status: "PENDING" },
    }),
    prisma.quotation.count({
      where: { customerId, status: "PENDING" },
    }),
    prisma.review.count({
      where: { customerId },
    }),
  ]);

  // Calculate total spent
  const bookingsTotal = await prisma.booking.aggregate({
    where: {
      customerId,
      status: "COMPLETED",
    },
    _sum: {
      totalAmount: true,
    },
  });

  return {
    totalBookings,
    completedBookings,
    pendingBookings,
    pendingQuotations,
    totalReviews,
    totalSpent: bookingsTotal._sum.totalAmount || 0,
  };
};
