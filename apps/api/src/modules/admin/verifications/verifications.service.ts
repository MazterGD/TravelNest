import { prisma, type Prisma } from "@travenest/database";
import { ApiError } from "../../../middleware/errorHandler.js";
import { parsePagination } from "../types.js";
import { recordAuditLog } from "../audit/audit.service.js";

type OwnerVerificationFilters = {
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
  documentStatus?: "PENDING" | "VERIFIED" | "REJECTED";
};

type VehicleVerificationFilters = {
  search?: string;
  verificationState?: "PENDING" | "MISSING_DOCUMENTS" | "ACTIVATION_REQUEST";
};

const buildOwnerWhere = (filters: OwnerVerificationFilters): Prisma.UserWhereInput => {
  const where: Prisma.UserWhereInput = {
    role: "VEHICLE_OWNER",
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.documentStatus) {
    where.documents = {
      some: {
        status: filters.documentStatus,
      },
    };
  }

  if (filters.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: "insensitive" } },
      { lastName: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { phone: { contains: filters.search, mode: "insensitive" } },
      { nicNumber: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
};

const buildVehicleWhere = (
  filters: VehicleVerificationFilters,
): Prisma.VehicleWhereInput => {
  // Always restrict to vehicles that need admin attention.
  // Optionally narrow to just one state via verificationState filter.
  let stateFilter: Prisma.VehicleWhereInput;

  if (filters.verificationState === "PENDING") {
    stateFilter = { documents: { some: { status: "PENDING" } } };
  } else if (filters.verificationState === "MISSING_DOCUMENTS") {
    stateFilter = { documents: { none: {} } };
  } else if (filters.verificationState === "ACTIVATION_REQUEST") {
    // Owner submitted an activation request: isActive=false, isAvailable=true
    stateFilter = { isActive: false, isAvailable: true };
  } else {
    // All vehicles needing admin attention: pending/missing docs OR activation requests
    stateFilter = {
      OR: [
        { documents: { none: {} } },
        { documents: { some: { status: "PENDING" } } },
        { isActive: false, isAvailable: true },
      ],
    };
  }

  const where: Prisma.VehicleWhereInput = { ...stateFilter };

  if (filters.search) {
    where.AND = [
      {
        OR: [
          { name: { contains: filters.search, mode: "insensitive" } },
          { licensePlate: { contains: filters.search, mode: "insensitive" } },
          { brand: { contains: filters.search, mode: "insensitive" } },
          { model: { contains: filters.search, mode: "insensitive" } },
          {
            owner: {
              OR: [
                { firstName: { contains: filters.search, mode: "insensitive" } },
                { lastName: { contains: filters.search, mode: "insensitive" } },
                { email: { contains: filters.search, mode: "insensitive" } },
              ],
            },
          },
        ],
      },
    ];
  }

  return where;
};

const summarizeDocumentStatuses = (
  documents: Array<{ status: "PENDING" | "VERIFIED" | "REJECTED"; createdAt: Date }>,
) => {
  const pending = documents.filter((document) => document.status === "PENDING").length;
  const verified = documents.filter((document) => document.status === "VERIFIED").length;
  const rejected = documents.filter((document) => document.status === "REJECTED").length;

  return {
    pending,
    verified,
    rejected,
    latestDocumentAt: documents[0]?.createdAt ?? null,
  };
};

export const listOwnerVerifications = async (
  filters: OwnerVerificationFilters,
  page?: number,
  limit?: number,
) => {
  const paging = parsePagination(page, limit);
  const where = buildOwnerWhere(filters);

  const [owners, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: paging.skip,
      take: paging.limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        nicNumber: true,
        status: true,
        isVerified: true,
        createdAt: true,
        verifiedAt: true,
        rejectedAt: true,
        rejectionReason: true,
        documents: {
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            vehicles: true,
            documents: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const items = owners.map((owner) => {
    const documentSummary = summarizeDocumentStatuses(owner.documents);

    return {
      ...owner,
      documentSummary,
    };
  });

  return {
    items,
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const getOwnerVerificationDetails = async (ownerId: string) => {
  const owner = await prisma.user.findFirst({
    where: {
      id: ownerId,
      role: "VEHICLE_OWNER",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      nicNumber: true,
      avatar: true,
      address: true,
      city: true,
      district: true,
      postalCode: true,
      baseLocation: true,
      status: true,
      isVerified: true,
      verifiedAt: true,
      verifiedBy: true,
      rejectedAt: true,
      rejectionReason: true,
      createdAt: true,
      updatedAt: true,
      documents: {
        orderBy: { createdAt: "desc" },
      },
      vehicles: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          licensePlate: true,
          brand: true,
          model: true,
          isActive: true,
          createdAt: true,
          documents: {
            select: {
              id: true,
              status: true,
              type: true,
            },
          },
        },
      },
    },
  });

  if (!owner) {
    throw new ApiError(404, "Owner verification record not found");
  }

  const documentSummary = summarizeDocumentStatuses(
    owner.documents.map((document) => ({
      status: document.status,
      createdAt: document.createdAt,
    })),
  );

  return {
    ...owner,
    documentSummary,
  };
};

export const approveOwnerVerification = async (
  adminId: string,
  ownerId: string,
  note?: string,
) => {
  const owner = await prisma.user.findFirst({
    where: {
      id: ownerId,
      role: "VEHICLE_OWNER",
    },
    select: {
      id: true,
      email: true,
      status: true,
      isVerified: true,
    },
  });

  if (!owner) {
    throw new ApiError(404, "Owner verification record not found");
  }

  const updatedOwner = await prisma.$transaction(async (tx) => {
    const ownerRecord = await tx.user.update({
      where: { id: ownerId },
      data: {
        status: "ACTIVE",
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: adminId,
        rejectedAt: null,
        rejectionReason: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        isVerified: true,
        verifiedAt: true,
        verifiedBy: true,
        updatedAt: true,
      },
    });

    await tx.ownerDocument.updateMany({
      where: {
        ownerId,
        status: {
          in: ["PENDING", "REJECTED"],
        },
      },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
        verifiedBy: adminId,
        rejectionReason: null,
      },
    });

    await tx.notification.create({
      data: {
        userId: ownerId,
        type: "owner_verification_approved",
        title: "Owner verification approved",
        message:
          "Your owner account has been approved. You can now operate vehicles on TravelNest.",
        data: {
          ownerId,
          note,
        },
      },
    });

    return ownerRecord;
  });

  await recordAuditLog(
    adminId,
    "UPDATE",
    "OWNER_VERIFICATION",
    ownerId,
    {
      previousStatus: owner.status,
      previousVerification: owner.isVerified,
      newStatus: "ACTIVE",
      newVerification: true,
      note,
    },
    `Owner verification approved for ${owner.email}`,
  );

  return updatedOwner;
};

export const rejectOwnerVerification = async (
  adminId: string,
  ownerId: string,
  reason: string,
) => {
  const owner = await prisma.user.findFirst({
    where: {
      id: ownerId,
      role: "VEHICLE_OWNER",
    },
    select: {
      id: true,
      email: true,
      status: true,
      isVerified: true,
    },
  });

  if (!owner) {
    throw new ApiError(404, "Owner verification record not found");
  }

  const updatedOwner = await prisma.$transaction(async (tx) => {
    const ownerRecord = await tx.user.update({
      where: { id: ownerId },
      data: {
        status: "INACTIVE",
        isVerified: false,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        isVerified: true,
        rejectedAt: true,
        rejectionReason: true,
        updatedAt: true,
      },
    });

    await tx.ownerDocument.updateMany({
      where: {
        ownerId,
        status: "PENDING",
      },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
      },
    });

    await tx.notification.create({
      data: {
        userId: ownerId,
        type: "owner_verification_rejected",
        title: "Owner verification rejected",
        message: "Your verification was rejected. Please review the reason and submit again.",
        data: {
          ownerId,
          reason,
        },
      },
    });

    return ownerRecord;
  });

  await recordAuditLog(
    adminId,
    "UPDATE",
    "OWNER_VERIFICATION",
    ownerId,
    {
      previousStatus: owner.status,
      previousVerification: owner.isVerified,
      newStatus: "INACTIVE",
      newVerification: false,
      reason,
    },
    `Owner verification rejected for ${owner.email}`,
  );

  return updatedOwner;
};

export const requestOwnerResubmission = async (
  adminId: string,
  ownerId: string,
  reason: string,
) => {
  const owner = await prisma.user.findFirst({
    where: {
      id: ownerId,
      role: "VEHICLE_OWNER",
    },
    select: {
      id: true,
      email: true,
      status: true,
      isVerified: true,
    },
  });

  if (!owner) {
    throw new ApiError(404, "Owner verification record not found");
  }

  const updatedOwner = await prisma.$transaction(async (tx) => {
    const ownerRecord = await tx.user.update({
      where: { id: ownerId },
      data: {
        status: "PENDING_VERIFICATION",
        isVerified: false,
        rejectionReason: reason,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        isVerified: true,
        rejectionReason: true,
        updatedAt: true,
      },
    });

    await tx.ownerDocument.updateMany({
      where: {
        ownerId,
        status: "PENDING",
      },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
      },
    });

    await tx.notification.create({
      data: {
        userId: ownerId,
        type: "owner_verification_resubmission_requested",
        title: "Owner verification needs resubmission",
        message:
          "Please re-submit the requested documents to continue your owner verification.",
        data: {
          ownerId,
          reason,
        },
      },
    });

    return ownerRecord;
  });

  await recordAuditLog(
    adminId,
    "UPDATE",
    "OWNER_RESUBMISSION",
    ownerId,
    {
      previousStatus: owner.status,
      previousVerification: owner.isVerified,
      newStatus: "PENDING_VERIFICATION",
      newVerification: false,
      reason,
    },
    `Owner resubmission requested for ${owner.email}`,
  );

  return updatedOwner;
};

export const listVehicleVerifications = async (
  filters: VehicleVerificationFilters,
  page?: number,
  limit?: number,
) => {
  const paging = parsePagination(page, limit);
  const where = buildVehicleWhere(filters);

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: paging.skip,
      take: paging.limit,
      select: {
        id: true,
        ownerId: true,
        name: true,
        brand: true,
        model: true,
        licensePlate: true,
        type: true,
        isActive: true,
        isAvailable: true,
        location: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
            isVerified: true,
          },
        },
        documents: {
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            bookings: true,
            documents: true,
          },
        },
      },
    }),
    prisma.vehicle.count({ where }),
  ]);

  const items = vehicles.map((vehicle) => {
    const documentSummary = summarizeDocumentStatuses(vehicle.documents);

    // Activation request takes precedence — owner is waiting for admin to approve isActive
    const verificationState =
      !vehicle.isActive && vehicle.isAvailable
        ? "ACTIVATION_REQUEST"
        : documentSummary.pending > 0
          ? "PENDING"
          : documentSummary.rejected > 0
            ? "REJECTED"
            : documentSummary.verified > 0
              ? "VERIFIED"
              : "MISSING_DOCUMENTS";

    return {
      ...vehicle,
      documentSummary,
      verificationState,
    };
  });

  return {
    items,
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const getVehicleVerificationDetails = async (vehicleId: string) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          isVerified: true,
          verifiedAt: true,
        },
      },
      documents: {
        orderBy: { createdAt: "desc" },
      },
      photos: {
        orderBy: { sortOrder: "asc" },
      },
      _count: {
        select: {
          bookings: true,
          reviews: true,
        },
      },
    },
  });

  if (!vehicle) {
    throw new ApiError(404, "Vehicle verification record not found");
  }

  const documentSummary = summarizeDocumentStatuses(
    vehicle.documents.map((document) => ({
      status: document.status,
      createdAt: document.createdAt,
    })),
  );

  return {
    ...vehicle,
    documentSummary,
  };
};

export const approveVehicleVerification = async (
  adminId: string,
  vehicleId: string,
  note?: string,
) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      ownerId: true,
      name: true,
      licensePlate: true,
      isActive: true,
    },
  });

  if (!vehicle) {
    throw new ApiError(404, "Vehicle verification record not found");
  }

  const updatedVehicle = await prisma.$transaction(async (tx) => {
    const vehicleRecord = await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        isActive: true,
        isAvailable: true,
      },
      select: {
        id: true,
        name: true,
        licensePlate: true,
        isActive: true,
        isAvailable: true,
        updatedAt: true,
      },
    });

    await tx.vehicleDocument.updateMany({
      where: {
        vehicleId,
        status: {
          in: ["PENDING", "REJECTED"],
        },
      },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
        verifiedBy: adminId,
        rejectionReason: null,
      },
    });

    await tx.notification.create({
      data: {
        userId: vehicle.ownerId,
        type: "vehicle_verification_approved",
        title: "Vehicle verification approved",
        message: `${vehicle.name} (${vehicle.licensePlate}) has been approved for listings.`,
        data: {
          vehicleId,
          note,
        },
      },
    });

    return vehicleRecord;
  });

  await recordAuditLog(
    adminId,
    "UPDATE",
    "VEHICLE_VERIFICATION",
    vehicleId,
    {
      previousIsActive: vehicle.isActive,
      newIsActive: true,
      note,
    },
    `Vehicle verification approved for ${vehicle.licensePlate}`,
  );

  return updatedVehicle;
};

export const rejectVehicleVerification = async (
  adminId: string,
  vehicleId: string,
  reason: string,
) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      ownerId: true,
      name: true,
      licensePlate: true,
      isActive: true,
    },
  });

  if (!vehicle) {
    throw new ApiError(404, "Vehicle verification record not found");
  }

  const updatedVehicle = await prisma.$transaction(async (tx) => {
    const vehicleRecord = await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        isActive: false,
        isAvailable: false,
      },
      select: {
        id: true,
        name: true,
        licensePlate: true,
        isActive: true,
        isAvailable: true,
        updatedAt: true,
      },
    });

    await tx.vehicleDocument.updateMany({
      where: {
        vehicleId,
        status: "PENDING",
      },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
      },
    });

    await tx.notification.create({
      data: {
        userId: vehicle.ownerId,
        type: "vehicle_verification_rejected",
        title: "Vehicle verification rejected",
        message: `${vehicle.name} (${vehicle.licensePlate}) requires updates before approval.`,
        data: {
          vehicleId,
          reason,
        },
      },
    });

    return vehicleRecord;
  });

  await recordAuditLog(
    adminId,
    "UPDATE",
    "VEHICLE_VERIFICATION",
    vehicleId,
    {
      previousIsActive: vehicle.isActive,
      newIsActive: false,
      reason,
    },
    `Vehicle verification rejected for ${vehicle.licensePlate}`,
  );

  return updatedVehicle;
};

export const getVerificationHistory = async (
  entityId: string,
  page?: number,
  limit?: number,
) => {
  const paging = parsePagination(page, limit);

  const where: Prisma.AuditLogWhereInput = {
    entityId,
    entityType: {
      in: [
        "OWNER_VERIFICATION",
        "OWNER_RESUBMISSION",
        "VEHICLE_VERIFICATION",
      ],
    },
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        admin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            adminRole: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: paging.skip,
      take: paging.limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const approveVehicleDocument = async (
  adminId: string,
  vehicleId: string,
  documentId: string,
) => {
  const document = await prisma.vehicleDocument.findFirst({
    where: { id: documentId, vehicleId },
    select: { id: true, type: true },
  });

  if (!document) throw new ApiError(404, "Vehicle document not found");

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, ownerId: true, name: true, licensePlate: true },
  });

  if (!vehicle) throw new ApiError(404, "Vehicle not found");

  await prisma.$transaction(async (tx) => {
    await tx.vehicleDocument.update({
      where: { id: documentId },
      data: { status: "VERIFIED", verifiedAt: new Date(), verifiedBy: adminId, rejectionReason: null },
    });

    const remaining = await tx.vehicleDocument.count({
      where: { vehicleId, status: { not: "VERIFIED" } },
    });

    if (remaining === 0) {
      await tx.vehicle.update({ where: { id: vehicleId }, data: { isActive: true, isAvailable: true } });

      await tx.notification.create({
        data: {
          userId: vehicle.ownerId,
          type: "vehicle_verification_approved",
          title: "Vehicle verification complete",
          message: `${vehicle.name} (${vehicle.licensePlate}) has been approved and is now active.`,
          data: { vehicleId },
        },
      });
    }
  });

  await recordAuditLog(
    adminId, "UPDATE", "VEHICLE_VERIFICATION", vehicleId,
    { documentId, documentType: document.type, action: "document_approved" },
    `Document ${document.type} approved for ${vehicle.licensePlate}`,
  );
};

export const rejectVehicleDocument = async (
  adminId: string,
  vehicleId: string,
  documentId: string,
  reason: string,
) => {
  const document = await prisma.vehicleDocument.findFirst({
    where: { id: documentId, vehicleId },
    select: { id: true, type: true },
  });

  if (!document) throw new ApiError(404, "Vehicle document not found");

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, ownerId: true, name: true, licensePlate: true },
  });

  if (!vehicle) throw new ApiError(404, "Vehicle not found");

  await prisma.$transaction(async (tx) => {
    await tx.vehicleDocument.update({
      where: { id: documentId },
      data: { status: "REJECTED", rejectionReason: reason, verifiedAt: null, verifiedBy: null },
    });

    await tx.vehicle.update({ where: { id: vehicleId }, data: { isActive: false } });

    await tx.notification.create({
      data: {
        userId: vehicle.ownerId,
        type: "vehicle_verification_rejected",
        title: "Vehicle document rejected",
        message: `A document for ${vehicle.name} was rejected. Please review and resubmit.`,
        data: { vehicleId, documentId, reason },
      },
    });
  });

  await recordAuditLog(
    adminId, "UPDATE", "VEHICLE_VERIFICATION", vehicleId,
    { documentId, documentType: document.type, action: "document_rejected", reason },
    `Document ${document.type} rejected for ${vehicle.licensePlate}`,
  );
};

export const approveOwnerDocument = async (
  adminId: string,
  ownerId: string,
  documentId: string,
) => {
  const document = await prisma.ownerDocument.findFirst({
    where: { id: documentId, ownerId },
    select: { id: true, type: true },
  });

  if (!document) throw new ApiError(404, "Owner document not found");

  const owner = await prisma.user.findFirst({
    where: { id: ownerId, role: "VEHICLE_OWNER" },
    select: { id: true, email: true },
  });

  if (!owner) throw new ApiError(404, "Owner not found");

  await prisma.$transaction(async (tx) => {
    await tx.ownerDocument.update({
      where: { id: documentId },
      data: { status: "VERIFIED", verifiedAt: new Date(), verifiedBy: adminId, rejectionReason: null },
    });

    const remaining = await tx.ownerDocument.count({
      where: { ownerId, status: { not: "VERIFIED" } },
    });

    if (remaining === 0) {
      await tx.user.update({
        where: { id: ownerId },
        data: { status: "ACTIVE", isVerified: true, verifiedAt: new Date(), verifiedBy: adminId, rejectedAt: null, rejectionReason: null },
      });

      await tx.notification.create({
        data: {
          userId: ownerId,
          type: "owner_verification_approved",
          title: "Owner verification complete",
          message: "All your documents have been verified. Your account is now active.",
          data: { ownerId },
        },
      });
    }
  });

  await recordAuditLog(
    adminId, "UPDATE", "OWNER_VERIFICATION", ownerId,
    { documentId, documentType: document.type, action: "document_approved" },
    `Document ${document.type} approved for owner ${owner.email}`,
  );
};

export const rejectOwnerDocument = async (
  adminId: string,
  ownerId: string,
  documentId: string,
  reason: string,
) => {
  const document = await prisma.ownerDocument.findFirst({
    where: { id: documentId, ownerId },
    select: { id: true, type: true },
  });

  if (!document) throw new ApiError(404, "Owner document not found");

  const owner = await prisma.user.findFirst({
    where: { id: ownerId, role: "VEHICLE_OWNER" },
    select: { id: true, email: true },
  });

  if (!owner) throw new ApiError(404, "Owner not found");

  await prisma.$transaction(async (tx) => {
    await tx.ownerDocument.update({
      where: { id: documentId },
      data: { status: "REJECTED", rejectionReason: reason, verifiedAt: null, verifiedBy: null },
    });

    await tx.notification.create({
      data: {
        userId: ownerId,
        type: "owner_verification_rejected",
        title: "Owner document rejected",
        message: "A verification document was rejected. Please review and resubmit.",
        data: { ownerId, documentId, reason },
      },
    });
  });

  await recordAuditLog(
    adminId, "UPDATE", "OWNER_VERIFICATION", ownerId,
    { documentId, documentType: document.type, action: "document_rejected", reason },
    `Document ${document.type} rejected for owner ${owner.email}`,
  );
};
