import prisma from "@travenest/database";

interface MonthBucket {
  key: string;
  label: string;
  from: Date;
  to: Date;
}

const toMonthKey = (value: Date): string => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const buildMonthBuckets = (months: number): MonthBucket[] => {
  const now = new Date();
  const buckets: MonthBucket[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const from = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1),
    );
    const to = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset + 1, 1),
    );

    buckets.push({
      key: toMonthKey(from),
      label: from.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }),
      from,
      to,
    });
  }

  return buckets;
};

export const getDashboardOverview = async () => {
  const [
    totalUsers,
    activeUsers,
    totalOwners,
    verifiedOwners,
    totalVehicles,
    activeVehicles,
    totalBookings,
    pendingBookings,
    completedBookings,
    totalCompletedPayments,
    failedPayments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "VEHICLE_OWNER" } }),
    prisma.user.count({ where: { role: "VEHICLE_OWNER", isVerified: true } }),
    prisma.vehicle.count(),
    prisma.vehicle.count({ where: { isActive: true } }),
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "PENDING" } }),
    prisma.booking.count({ where: { status: "COMPLETED" } }),
    prisma.payment.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.count({ where: { status: "FAILED" } }),
  ]);

  const ownerVerificationRate =
    totalOwners > 0 ? Number(((verifiedOwners / totalOwners) * 100).toFixed(2)) : 0;
  const completionRate =
    totalBookings > 0
      ? Number(((completedBookings / totalBookings) * 100).toFixed(2))
      : 0;

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      owners: totalOwners,
      verifiedOwners,
      ownerVerificationRate,
    },
    vehicles: {
      total: totalVehicles,
      active: activeVehicles,
    },
    bookings: {
      total: totalBookings,
      pending: pendingBookings,
      completed: completedBookings,
      completionRate,
    },
    finance: {
      totalRevenue: totalCompletedPayments._sum.amount || 0,
      successfulPaymentCount: totalCompletedPayments._count._all,
      failedPaymentCount: failedPayments,
    },
  };
};

export const getRevenueChart = async (months = 6) => {
  const buckets = buildMonthBuckets(months);
  const oldestMonth = buckets[0]?.from;

  const [payments, bookings] = await Promise.all([
    prisma.payment.findMany({
      where: {
        status: "COMPLETED",
        ...(oldestMonth && { createdAt: { gte: oldestMonth } }),
      },
      select: {
        amount: true,
        createdAt: true,
      },
    }),
    prisma.booking.findMany({
      where: {
        ...(oldestMonth && { createdAt: { gte: oldestMonth } }),
      },
      select: {
        createdAt: true,
      },
    }),
  ]);

  const paymentMap = new Map<string, number>();
  const bookingMap = new Map<string, number>();

  for (const payment of payments) {
    const key = toMonthKey(payment.createdAt);
    paymentMap.set(key, (paymentMap.get(key) || 0) + payment.amount);
  }

  for (const booking of bookings) {
    const key = toMonthKey(booking.createdAt);
    bookingMap.set(key, (bookingMap.get(key) || 0) + 1);
  }

  return buckets.map((bucket) => ({
    month: bucket.label,
    key: bucket.key,
    revenue: Number((paymentMap.get(bucket.key) || 0).toFixed(2)),
    bookings: bookingMap.get(bucket.key) || 0,
  }));
};

export const getUserGrowthChart = async (months = 6) => {
  const buckets = buildMonthBuckets(months);
  const oldestMonth = buckets[0]?.from;

  const users = await prisma.user.findMany({
    where: {
      ...(oldestMonth && { createdAt: { gte: oldestMonth } }),
    },
    select: {
      createdAt: true,
      role: true,
    },
  });

  const dataMap = new Map<
    string,
    { total: number; customers: number; owners: number; admins: number }
  >();

  for (const user of users) {
    const key = toMonthKey(user.createdAt);
    const current = dataMap.get(key) || {
      total: 0,
      customers: 0,
      owners: 0,
      admins: 0,
    };

    current.total += 1;
    if (user.role === "CUSTOMER") {
      current.customers += 1;
    }
    if (user.role === "VEHICLE_OWNER") {
      current.owners += 1;
    }
    if (user.role === "ADMIN") {
      current.admins += 1;
    }

    dataMap.set(key, current);
  }

  return buckets.map((bucket) => ({
    month: bucket.label,
    key: bucket.key,
    ...(dataMap.get(bucket.key) || {
      total: 0,
      customers: 0,
      owners: 0,
      admins: 0,
    }),
  }));
};

export const getBookingTrendsChart = async (months = 6) => {
  const buckets = buildMonthBuckets(months);
  const oldestMonth = buckets[0]?.from;

  const bookings = await prisma.booking.findMany({
    where: {
      ...(oldestMonth && { createdAt: { gte: oldestMonth } }),
    },
    select: {
      createdAt: true,
      status: true,
    },
  });

  const dataMap = new Map<
    string,
    {
      total: number;
      pending: number;
      confirmed: number;
      ongoing: number;
      completed: number;
      cancelled: number;
    }
  >();

  for (const booking of bookings) {
    const key = toMonthKey(booking.createdAt);
    const current = dataMap.get(key) || {
      total: 0,
      pending: 0,
      confirmed: 0,
      ongoing: 0,
      completed: 0,
      cancelled: 0,
    };

    current.total += 1;
    if (booking.status === "PENDING") current.pending += 1;
    if (booking.status === "CONFIRMED") current.confirmed += 1;
    if (booking.status === "ONGOING") current.ongoing += 1;
    if (booking.status === "COMPLETED") current.completed += 1;
    if (booking.status === "CANCELLED") current.cancelled += 1;

    dataMap.set(key, current);
  }

  return buckets.map((bucket) => ({
    month: bucket.label,
    key: bucket.key,
    ...(dataMap.get(bucket.key) || {
      total: 0,
      pending: 0,
      confirmed: 0,
      ongoing: 0,
      completed: 0,
      cancelled: 0,
    }),
  }));
};

export const getActivityFeed = async (limit = 20) => {
  const [recentBookings, recentUsers, recentAudits] = await Promise.all([
    prisma.booking.findMany({
      take: Math.max(limit, 10),
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        vehicle: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      take: Math.max(limit, 10),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.findMany({
      take: Math.max(limit, 10),
      orderBy: { createdAt: "desc" },
      include: {
        admin: { select: { firstName: true, lastName: true } },
        actor: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const events = [
    ...recentBookings.map((booking) => ({
      id: `booking-${booking.id}`,
      type: "booking",
      title: "Booking created",
      description: `${booking.customer.firstName} ${booking.customer.lastName} created a booking for ${booking.vehicle.name}`,
      timestamp: booking.createdAt.toISOString(),
    })),
    ...recentUsers.map((user) => ({
      id: `user-${user.id}`,
      type: "user",
      title: "User registered",
      description: `${user.firstName} ${user.lastName} joined as ${user.role}`,
      timestamp: user.createdAt.toISOString(),
    })),
    ...recentAudits.map((audit) => {
      const who = audit.actor ?? audit.admin;
      const name = who ? `${who.firstName} ${who.lastName}`.trim() : "A user";
      return {
        id: `audit-${audit.id}`,
        type: "audit",
        title: audit.action,
        description: `${name} performed ${audit.action}`,
        timestamp: audit.createdAt.toISOString(),
        status: audit.status,
      };
    }),
  ]
    .sort(
      (left, right) =>
        new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    )
    .slice(0, limit);

  return events;
};

export const getPendingActions = async () => {
  const [
    pendingOwnerApprovals,
    pendingVehicleApprovals,
    pendingBookings,
    failedPayments,
    pendingDisputes,
    pendingSettlements,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        role: "VEHICLE_OWNER",
        status: "PENDING_VERIFICATION",
      },
    }),
    // Count distinct vehicles with at least one pending document, not document rows.
    prisma.vehicle.count({
      where: {
        documents: {
          some: { status: "PENDING" },
        },
      },
    }),
    prisma.booking.count({ where: { status: "PENDING" } }),
    prisma.payment.count({ where: { status: "FAILED" } }),
    prisma.dispute.count({
      where: {
        status: {
          in: ["OPEN", "INVESTIGATING", "ESCALATED"],
        },
      },
    }),
    prisma.settlement.count({ where: { status: "PENDING" } }),
  ]);

  const actions = [
    {
      id: "owner-approvals",
      title: "Owner verification approvals",
      count: pendingOwnerApprovals,
      href: "/admin/verifications/owners",
    },
    {
      id: "vehicle-approvals",
      title: "Vehicle verification approvals",
      count: pendingVehicleApprovals,
      href: "/admin/verifications/vehicles",
    },
    {
      id: "pending-bookings",
      title: "Pending bookings",
      count: pendingBookings,
      href: "/admin/bookings",
    },
    {
      id: "failed-payments",
      title: "Failed payments to inspect",
      count: failedPayments,
      href: "/admin/financial",
    },
    {
      id: "open-disputes",
      title: "Disputes needing attention",
      count: pendingDisputes,
      href: "/admin/disputes",
    },
    {
      id: "pending-settlements",
      title: "Pending owner settlements",
      count: pendingSettlements,
      href: "/admin/financial",
    },
  ];

  return actions.map((action) => ({
    ...action,
    severity:
      action.count >= 20 ? "high" : action.count >= 5 ? "medium" : "low",
  }));
};
