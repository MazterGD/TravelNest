import { prisma } from "@travenest/database";

export const getAllAdminVehicles = async (filters: {
  page: number;
  limit: number;
  search?: string;
  type?: string;
  isActive?: boolean;
  ownerId?: string;
}) => {
  const { page, limit, search, type, isActive, ownerId } = filters;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (ownerId) {
    where.ownerId = ownerId;
  }

  if (type) {
    where.type = type;
  }

  if (search) {
    const term = search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { licensePlate: { contains: term, mode: "insensitive" } },
      { location: { contains: term, mode: "insensitive" } },
      { owner: { firstName: { contains: term, mode: "insensitive" } } },
      { owner: { lastName: { contains: term, mode: "insensitive" } } },
      { owner: { email: { contains: term, mode: "insensitive" } } },
    ];
  }

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        photos: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true },
        },
        _count: {
          select: { bookings: true, reviews: true },
        },
      },
    }),
    prisma.vehicle.count({ where }),
  ]);

  return {
    vehicles,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
