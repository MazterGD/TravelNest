import { prisma } from "@travenest/database";
import { buildCsv } from "../types.js";

type DateRangeInput = {
  startDate?: Date;
  endDate?: Date;
};

type DateRangeResolved = {
  startDate: Date;
  endDate: Date;
};

const resolveDateRange = (input: DateRangeInput): DateRangeResolved => {
  if (input.startDate && input.endDate) {
    return {
      startDate: input.startDate,
      endDate: input.endDate,
    };
  }

  const endDate = input.endDate ?? new Date();
  const startDate =
    input.startDate ?? new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000);

  return {
    startDate,
    endDate,
  };
};

const getDateKey = (date: Date) => date.toISOString().slice(0, 10);

const buildDateSeriesTemplate = (startDate: Date, endDate: Date) => {
  const output: Array<{ date: string; value: number }> = [];
  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const endCursor = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

  while (cursor <= endCursor) {
    output.push({
      date: cursor.toISOString().slice(0, 10),
      value: 0,
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return output;
};

const fillDateSeries = (
  dates: Date[],
  startDate: Date,
  endDate: Date,
): Array<{ date: string; value: number }> => {
  const base = buildDateSeriesTemplate(startDate, endDate);
  const map = new Map(base.map((item) => [item.date, 0]));

  for (const date of dates) {
    const key = getDateKey(date);
    if (map.has(key)) {
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }

  return base.map((item) => ({
    date: item.date,
    value: map.get(item.date) ?? 0,
  }));
};

export const getUsersAnalytics = async (dateRangeInput: DateRangeInput) => {
  const dateRange = resolveDateRange(dateRangeInput);

  const [
    totalUsers,
    newUsersInRange,
    roleCounts,
    statusCounts,
    rangeUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
    }),
    prisma.user.groupBy({
      by: ["role"],
      _count: {
        _all: true,
      },
    }),
    prisma.user.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
    }),
    prisma.user.findMany({
      where: {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        createdAt: true,
      },
    }),
  ]);

  const growthSeries = fillDateSeries(
    rangeUsers.map((user) => user.createdAt),
    dateRange.startDate,
    dateRange.endDate,
  );

  return {
    dateRange,
    totalUsers,
    newUsersInRange,
    roleDistribution: roleCounts.map((item) => ({
      role: item.role,
      count: item._count._all,
    })),
    statusDistribution: statusCounts.map((item) => ({
      status: item.status,
      count: item._count._all,
    })),
    growthSeries,
  };
};

export const getBookingsAnalytics = async (dateRangeInput: DateRangeInput) => {
  const dateRange = resolveDateRange(dateRangeInput);
  const whereInRange = {
    createdAt: {
      gte: dateRange.startDate,
      lte: dateRange.endDate,
    },
  };

  const [
    totalInRange,
    statusCounts,
    amountStats,
    rangeBookings,
  ] = await Promise.all([
    prisma.booking.count({ where: whereInRange }),
    prisma.booking.groupBy({
      by: ["status"],
      where: whereInRange,
      _count: {
        _all: true,
      },
    }),
    prisma.booking.aggregate({
      where: whereInRange,
      _avg: {
        totalAmount: true,
      },
      _sum: {
        totalAmount: true,
      },
    }),
    prisma.booking.findMany({
      where: whereInRange,
      select: {
        createdAt: true,
        status: true,
      },
    }),
  ]);

  const completedCount =
    statusCounts.find((item) => item.status === "COMPLETED")?._count._all ?? 0;
  const cancelledCount =
    statusCounts.find((item) => item.status === "CANCELLED")?._count._all ?? 0;

  const completionRate = totalInRange === 0 ? 0 : (completedCount / totalInRange) * 100;
  const cancellationRate = totalInRange === 0 ? 0 : (cancelledCount / totalInRange) * 100;

  const bookingTrend = fillDateSeries(
    rangeBookings.map((booking) => booking.createdAt),
    dateRange.startDate,
    dateRange.endDate,
  );

  const completedTrend = fillDateSeries(
    rangeBookings
      .filter((booking) => booking.status === "COMPLETED")
      .map((booking) => booking.createdAt),
    dateRange.startDate,
    dateRange.endDate,
  );

  return {
    dateRange,
    totalBookingsInRange: totalInRange,
    completionRate,
    cancellationRate,
    averageBookingValue: amountStats._avg.totalAmount ?? 0,
    grossBookingValue: amountStats._sum.totalAmount ?? 0,
    statusDistribution: statusCounts.map((item) => ({
      status: item.status,
      count: item._count._all,
    })),
    bookingTrend,
    completedTrend,
  };
};

export const getFinancialAnalytics = async (dateRangeInput: DateRangeInput) => {
  const dateRange = resolveDateRange(dateRangeInput);
  const whereInRange = {
    createdAt: {
      gte: dateRange.startDate,
      lte: dateRange.endDate,
    },
  };

  const [payments, paymentStatusCounts] = await Promise.all([
    prisma.payment.findMany({
      where: whereInRange,
      select: {
        amount: true,
        status: true,
        refundAmount: true,
        createdAt: true,
      },
    }),
    prisma.payment.groupBy({
      by: ["status"],
      where: whereInRange,
      _count: {
        _all: true,
      },
      _sum: {
        amount: true,
        refundAmount: true,
      },
    }),
  ]);

  const grossRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const completedRevenue = payments
    .filter((payment) => payment.status === "COMPLETED")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const refundedAmount = payments.reduce(
    (sum, payment) => sum + (payment.refundAmount ?? 0),
    0,
  );

  const platformCommissionRate = 0.1;
  const estimatedCommission = completedRevenue * platformCommissionRate;
  const netRevenue = completedRevenue - refundedAmount;

  const completedTrend = fillDateSeries(
    payments
      .filter((payment) => payment.status === "COMPLETED")
      .map((payment) => payment.createdAt),
    dateRange.startDate,
    dateRange.endDate,
  );

  const refundedTrend = fillDateSeries(
    payments
      .filter((payment) => payment.status === "REFUNDED")
      .map((payment) => payment.createdAt),
    dateRange.startDate,
    dateRange.endDate,
  );

  return {
    dateRange,
    grossRevenue,
    completedRevenue,
    netRevenue,
    refundedAmount,
    estimatedCommission,
    paymentStatusDistribution: paymentStatusCounts.map((item) => ({
      status: item.status,
      count: item._count._all,
      totalAmount: item._sum.amount ?? 0,
      totalRefund: item._sum.refundAmount ?? 0,
    })),
    completedTrend,
    refundedTrend,
  };
};

export const getOperationalAnalytics = async (dateRangeInput: DateRangeInput) => {
  const dateRange = resolveDateRange(dateRangeInput);

  const [
    pendingOwnerVerifications,
    pendingOwnerDocuments,
    pendingVehicleDocuments,
    auditEventsInRange,
    finalizedPayments,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        role: "VEHICLE_OWNER",
        status: "PENDING_VERIFICATION",
      },
    }),
    prisma.ownerDocument.count({
      where: {
        status: "PENDING",
      },
    }),
    prisma.vehicleDocument.count({
      where: {
        status: "PENDING",
      },
    }),
    prisma.auditLog.count({
      where: {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        status: { in: ["COMPLETED", "FAILED", "REFUNDED"] },
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const averagePaymentResolutionHours =
    finalizedPayments.length === 0
      ? 0
      : finalizedPayments.reduce((sum, payment) => {
          const durationMs = payment.updatedAt.getTime() - payment.createdAt.getTime();
          return sum + durationMs / (1000 * 60 * 60);
        }, 0) / finalizedPayments.length;

  return {
    dateRange,
    pendingOwnerVerifications,
    pendingOwnerDocuments,
    pendingVehicleDocuments,
    pendingVerificationItems: pendingOwnerDocuments + pendingVehicleDocuments,
    auditEventsInRange,
    averagePaymentResolutionHours,
  };
};

const getCityFromLocation = (location: string | null | undefined) => {
  if (!location) {
    return "Unknown";
  }

  const city = location.split(",")[0]?.trim();
  return city && city.length > 0 ? city : "Unknown";
};

export const getGeographicAnalytics = async (dateRangeInput: DateRangeInput) => {
  const dateRange = resolveDateRange(dateRangeInput);

  const [bookings, users] = await Promise.all([
    prisma.booking.findMany({
      where: {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        pickupLocation: true,
        dropoffLocation: true,
        totalAmount: true,
      },
    }),
    prisma.user.findMany({
      where: {
        district: {
          not: null,
        },
      },
      select: {
        district: true,
      },
    }),
  ]);

  const bookingsByPickupCity = new Map<string, { count: number; totalAmount: number }>();
  const topRoutes = new Map<string, number>();

  for (const booking of bookings) {
    const city = getCityFromLocation(booking.pickupLocation);
    const existing = bookingsByPickupCity.get(city) ?? { count: 0, totalAmount: 0 };
    bookingsByPickupCity.set(city, {
      count: existing.count + 1,
      totalAmount: existing.totalAmount + booking.totalAmount,
    });

    const routeKey = `${city} -> ${getCityFromLocation(booking.dropoffLocation ?? booking.pickupLocation)}`;
    topRoutes.set(routeKey, (topRoutes.get(routeKey) ?? 0) + 1);
  }

  const usersByDistrict = new Map<string, number>();
  for (const user of users) {
    const district = user.district?.trim() || "Unknown";
    usersByDistrict.set(district, (usersByDistrict.get(district) ?? 0) + 1);
  }

  return {
    dateRange,
    bookingsByPickupCity: Array.from(bookingsByPickupCity.entries())
      .map(([city, value]) => ({
        city,
        bookingCount: value.count,
        totalAmount: value.totalAmount,
      }))
      .sort((a, b) => b.bookingCount - a.bookingCount),
    usersByDistrict: Array.from(usersByDistrict.entries())
      .map(([district, count]) => ({
        district,
        count,
      }))
      .sort((a, b) => b.count - a.count),
    topRoutes: Array.from(topRoutes.entries())
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
};

export const exportAnalyticsCsv = async (dateRangeInput: DateRangeInput) => {
  const [users, bookings, financial, operational, geographic] = await Promise.all([
    getUsersAnalytics(dateRangeInput),
    getBookingsAnalytics(dateRangeInput),
    getFinancialAnalytics(dateRangeInput),
    getOperationalAnalytics(dateRangeInput),
    getGeographicAnalytics(dateRangeInput),
  ]);

  const rows: Array<Array<string | number>> = [
    ["users", "totalUsers", users.totalUsers],
    ["users", "newUsersInRange", users.newUsersInRange],
    ["bookings", "totalBookingsInRange", bookings.totalBookingsInRange],
    ["bookings", "completionRate", bookings.completionRate.toFixed(2)],
    ["bookings", "cancellationRate", bookings.cancellationRate.toFixed(2)],
    ["financial", "grossRevenue", financial.grossRevenue.toFixed(2)],
    ["financial", "completedRevenue", financial.completedRevenue.toFixed(2)],
    ["financial", "netRevenue", financial.netRevenue.toFixed(2)],
    ["financial", "refundedAmount", financial.refundedAmount.toFixed(2)],
    ["financial", "estimatedCommission", financial.estimatedCommission.toFixed(2)],
    ["operational", "pendingOwnerVerifications", operational.pendingOwnerVerifications],
    ["operational", "pendingOwnerDocuments", operational.pendingOwnerDocuments],
    ["operational", "pendingVehicleDocuments", operational.pendingVehicleDocuments],
    ["operational", "auditEventsInRange", operational.auditEventsInRange],
    [
      "operational",
      "averagePaymentResolutionHours",
      operational.averagePaymentResolutionHours.toFixed(2),
    ],
    ["geographic", "pickupCitiesTracked", geographic.bookingsByPickupCity.length],
    ["geographic", "districtsTracked", geographic.usersByDistrict.length],
  ];

  return buildCsv(["section", "metric", "value"], rows);
};
