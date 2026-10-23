/**
 * Admin verification queues and decisions: owner/vehicle queue filters and
 * derived states, per-document approve/reject (auto-activation once every
 * document is verified), owner rejection and resubmission, the 404 paths and
 * the sub-role permission gate. Every decision must leave an audit entry and
 * notify the owner.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const BASE = `${API_BASE}/admin/verifications`;
const PREFIX = "admin.verif.wf";
const TAG = `vwf${Date.now().toString(36)}`;

type DocStatus = "PENDING" | "VERIFIED" | "REJECTED";

describe("Admin verifications workflow", () => {
  let superId = "";
  const tokens: Record<"SUPER_ADMIN" | "MODERATOR" | "SUPPORT_ADMIN", string> = {
    SUPER_ADMIN: "",
    MODERATOR: "",
    SUPPORT_ADMIN: "",
  };
  let plateSeq = 0;

  const sign = (id: string, email: string) =>
    jwt.sign({ id, email, role: "ADMIN" }, config.jwt.secret, { expiresIn: "1h" });

  const createUser = (
    label: string,
    role: "ADMIN" | "CUSTOMER" | "VEHICLE_OWNER",
    extra: {
      adminRole?: "SUPER_ADMIN" | "MODERATOR" | "SUPPORT_ADMIN";
      status?: "ACTIVE" | "PENDING_VERIFICATION";
    } = {},
  ) =>
    prisma.user.create({
      data: {
        email: `${PREFIX}.${label}.${TAG}@example.com`,
        password: "hashed",
        firstName: TAG,
        lastName: label,
        role,
        adminRole: extra.adminRole,
        status: extra.status ?? "ACTIVE",
        nicNumber: role === "VEHICLE_OWNER" ? `${TAG}-${label}` : undefined,
      },
    });

  const ownerDoc = (ownerId: string, status: DocStatus, type: "NIC" | "DRIVING_LICENSE" = "NIC") =>
    prisma.ownerDocument.create({
      data: {
        ownerId,
        type,
        status,
        url: "storage://private/owner/doc.pdf",
        fileName: "doc.pdf",
        fileSize: 1000,
        mimeType: "application/pdf",
      },
    });

  const vehicleDoc = (
    vehicleId: string,
    status: DocStatus,
    type: "INSURANCE" | "REGISTRATION_CERTIFICATE" = "INSURANCE",
  ) =>
    prisma.vehicleDocument.create({
      data: {
        vehicleId,
        type,
        status,
        url: "storage://private/vehicle/doc.pdf",
        fileName: "doc.pdf",
        fileSize: 1000,
        mimeType: "application/pdf",
      },
    });

  const createVehicle = (ownerId: string, label: string, extra: { isActive?: boolean; isAvailable?: boolean } = {}) => {
    plateSeq += 1;
    return prisma.vehicle.create({
      data: {
        ownerId,
        name: `${TAG} ${label}`,
        type: "ORDINARY",
        brand: "Lanka",
        model: "Coach",
        year: 2020,
        licensePlate: `${TAG}-${plateSeq}`.toUpperCase(),
        seats: 30,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: "Matara",
        images: [],
        amenities: [],
        ...extra,
      },
    });
  };

  const as = (role: keyof typeof tokens) => `Bearer ${tokens[role]}`;
  const auditFor = (entityId: string) =>
    prisma.auditLog.findMany({ where: { entityId }, orderBy: { createdAt: "desc" } });
  const notificationsFor = (userId: string) =>
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });

  const cleanup = async () => {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    const vehicles = await prisma.vehicle.findMany({
      where: { ownerId: { in: ids } },
      select: { id: true },
    });
    const vehicleIds = vehicles.map((v) => v.id);
    await prisma.auditLog.deleteMany({
      where: { OR: [{ actorId: { in: ids } }, { entityId: { in: [...ids, ...vehicleIds] } }] },
    });
    await prisma.vehicleDocument.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    await prisma.ownerDocument.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.adminPermission.deleteMany({ where: { adminId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  beforeAll(async () => {
    await cleanup();
    for (const role of ["SUPER_ADMIN", "MODERATOR", "SUPPORT_ADMIN"] as const) {
      const admin = await createUser(role.toLowerCase(), "ADMIN", { adminRole: role });
      tokens[role] = sign(admin.id, admin.email);
      if (role === "SUPER_ADMIN") superId = admin.id;
      if (role === "MODERATOR") {
        await prisma.adminPermission.create({
          data: { adminId: admin.id, permission: "admin.verifications.read", grantedBy: admin.id },
        });
      }
    }
  });

  afterAll(cleanup);

  describe("permission gate", () => {
    it("blocks admins without the verification permissions", async () => {
      const owner = await createUser("gate-owner", "VEHICLE_OWNER", { status: "PENDING_VERIFICATION" });

      const support = await request(app).get(`${BASE}/owners`).set("Authorization", as("SUPPORT_ADMIN"));
      const moderatorRead = await request(app)
        .get(`${BASE}/owners/${owner.id}`)
        .set("Authorization", as("MODERATOR"));
      const moderatorApprove = await request(app)
        .post(`${BASE}/owners/${owner.id}/approve`)
        .set("Authorization", as("MODERATOR"))
        .send({});
      const moderatorResubmit = await request(app)
        .post(`${BASE}/owners/${owner.id}/request-resubmission`)
        .set("Authorization", as("MODERATOR"))
        .send({ reason: "Blurry NIC photo" });

      expect(support.status).toBe(403);
      expect(moderatorRead.status).toBe(200);
      expect(moderatorApprove.status).toBe(403);
      expect(moderatorResubmit.status).toBe(403);
      const after = await prisma.user.findUnique({ where: { id: owner.id } });
      expect(after?.status).toBe("PENDING_VERIFICATION");
      expect(after?.isVerified).toBe(false);
    });
  });

  describe("owner queue", () => {
    let pendingOwnerId = "";
    let rejectedOwnerId = "";

    beforeAll(async () => {
      const pendingOwner = await createUser("queue-pending", "VEHICLE_OWNER", { status: "PENDING_VERIFICATION" });
      await ownerDoc(pendingOwner.id, "VERIFIED", "DRIVING_LICENSE");
      await ownerDoc(pendingOwner.id, "PENDING");
      await createVehicle(pendingOwner.id, "queue-owner-bus");
      const rejectedOwner = await createUser("queue-rejected", "VEHICLE_OWNER");
      await ownerDoc(rejectedOwner.id, "REJECTED");
      pendingOwnerId = pendingOwner.id;
      rejectedOwnerId = rejectedOwner.id;
    });

    const list = (query: string) =>
      request(app).get(`${BASE}/owners?${query}`).set("Authorization", as("SUPER_ADMIN"));

    it("filters by status and document status within a search", async () => {
      const byStatus = await list(`search=queue-&status=PENDING_VERIFICATION`);
      const byDocs = await list(`search=queue-&documentStatus=REJECTED`);

      expect(byStatus.status).toBe(200);
      const statusIds = byStatus.body.data.items.map((o: { id: string }) => o.id);
      expect(statusIds).toContain(pendingOwnerId);
      expect(statusIds).not.toContain(rejectedOwnerId);
      expect(byDocs.body.data.items.map((o: { id: string }) => o.id)).toEqual([rejectedOwnerId]);
    });

    it("summarises documents and paginates", async () => {
      const firstPage = await list(`search=${TAG}-queue&limit=1&page=1`);
      const secondPage = await list(`search=${TAG}-queue&limit=1&page=2`);

      expect(firstPage.body.data).toMatchObject({ total: 2, page: 1, limit: 1, totalPages: 2 });
      const items = [...firstPage.body.data.items, ...secondPage.body.data.items];
      const pending = items.find((o: { id: string }) => o.id === pendingOwnerId);
      expect(pending.documentSummary).toMatchObject({ pending: 1, verified: 1, rejected: 0 });
      expect(pending.documentSummary.latestDocumentAt).not.toBeNull();
      expect(pending._count).toEqual({ vehicles: 1, documents: 2 });
    });

    it("returns an empty first page when nothing matches", async () => {
      const response = await list(`search=${TAG}-nobody`);

      expect(response.body.data).toMatchObject({ items: [], total: 0, totalPages: 1 });
    });

    it("rejects invalid filters", async () => {
      const badStatus = await list("status=BANNED");
      const badLimit = await list("limit=500");

      expect(badStatus.status).toBe(422);
      expect(badLimit.status).toBe(422);
    });

    it("returns owner details with vehicles and a document summary", async () => {
      const response = await request(app)
        .get(`${BASE}/owners/${pendingOwnerId}`)
        .set("Authorization", as("SUPER_ADMIN"));

      expect(response.status).toBe(200);
      expect(response.body.data.documents).toHaveLength(2);
      expect(response.body.data.vehicles).toHaveLength(1);
      expect(response.body.data.documentSummary).toMatchObject({ pending: 1, verified: 1 });
    });
  });

  describe("owner decisions on unknown owners", () => {
    it("answers 404 for ids that are not vehicle owners", async () => {
      const customer = await createUser("not-owner", "CUSTOMER");
      const calls = [
        request(app).get(`${BASE}/owners/${customer.id}`),
        request(app).post(`${BASE}/owners/${customer.id}/approve`).send({ note: "ok" }),
        request(app).post(`${BASE}/owners/${customer.id}/reject`).send({ reason: "Fake documents" }),
        request(app)
          .post(`${BASE}/owners/${customer.id}/request-resubmission`)
          .send({ reason: "Fake documents" }),
      ];

      const responses = await Promise.all(calls.map((call) => call.set("Authorization", as("SUPER_ADMIN"))));

      expect(responses.map((r) => r.status)).toEqual([404, 404, 404, 404]);
      expect(await auditFor(customer.id)).toHaveLength(0);
    });
  });

  it("rejects an owner: deactivates, rejects pending documents only, notifies and audits", async () => {
    const owner = await createUser("reject-me", "VEHICLE_OWNER", { status: "PENDING_VERIFICATION" });
    const pending = await ownerDoc(owner.id, "PENDING");
    const verified = await ownerDoc(owner.id, "VERIFIED", "DRIVING_LICENSE");

    const tooShort = await request(app)
      .post(`${BASE}/owners/${owner.id}/reject`)
      .set("Authorization", as("SUPER_ADMIN"))
      .send({ reason: "no" });
    const response = await request(app)
      .post(`${BASE}/owners/${owner.id}/reject`)
      .set("Authorization", as("SUPER_ADMIN"))
      .send({ reason: "NIC does not match name" });

    expect(tooShort.status).toBe(422);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: "INACTIVE",
      isVerified: false,
      rejectionReason: "NIC does not match name",
    });
    const [pendingAfter, verifiedAfter] = await Promise.all([
      prisma.ownerDocument.findUnique({ where: { id: pending.id } }),
      prisma.ownerDocument.findUnique({ where: { id: verified.id } }),
    ]);
    expect(pendingAfter).toMatchObject({ status: "REJECTED", rejectionReason: "NIC does not match name" });
    expect(verifiedAfter?.status).toBe("VERIFIED");
    expect((await notificationsFor(owner.id))[0].type).toBe("owner_verification_rejected");
    const [log] = await auditFor(owner.id);
    expect(log).toMatchObject({ adminId: superId, action: "UPDATE", entityType: "OWNER_VERIFICATION" });
    expect(log.changes).toMatchObject({
      previousStatus: "PENDING_VERIFICATION",
      newStatus: "INACTIVE",
      reason: "NIC does not match name",
    });
  });

  it("requests a resubmission and records it in the verification history", async () => {
    const owner = await createUser("resubmit", "VEHICLE_OWNER", { status: "ACTIVE" });
    const pending = await ownerDoc(owner.id, "PENDING");

    const response = await request(app)
      .post(`${BASE}/owners/${owner.id}/request-resubmission`)
      .set("Authorization", as("SUPER_ADMIN"))
      .send({ reason: "Upload a clearer NIC scan" });
    await request(app)
      .post(`${BASE}/owners/${owner.id}/approve`)
      .set("Authorization", as("SUPER_ADMIN"))
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: "PENDING_VERIFICATION",
      isVerified: false,
      rejectionReason: "Upload a clearer NIC scan",
    });
    expect((await prisma.ownerDocument.findUnique({ where: { id: pending.id } }))?.status).toBe("VERIFIED");
    const types = (await notificationsFor(owner.id)).map((n) => n.type);
    expect(types).toEqual(
      expect.arrayContaining(["owner_verification_resubmission_requested", "owner_verification_approved"]),
    );

    const history = await request(app)
      .get(`${BASE}/history/${owner.id}?limit=1&page=2`)
      .set("Authorization", as("MODERATOR"));
    expect(history.status).toBe(200);
    expect(history.body.data).toMatchObject({ total: 2, page: 2, limit: 1, totalPages: 2 });
    expect(history.body.data.logs[0]).toMatchObject({
      entityType: "OWNER_RESUBMISSION",
      admin: { id: superId, adminRole: "SUPER_ADMIN" },
    });
  });

  describe("vehicle queue", () => {
    const ids = { pending: "", missing: "", activation: "", verified: "" };

    beforeAll(async () => {
      const owner = await createUser("fleet", "VEHICLE_OWNER");
      const pending = await createVehicle(owner.id, "vq-pending");
      await vehicleDoc(pending.id, "PENDING");
      await vehicleDoc(pending.id, "REJECTED", "REGISTRATION_CERTIFICATE");
      const missing = await createVehicle(owner.id, "vq-missing");
      const activation = await createVehicle(owner.id, "vq-activation", { isActive: false, isAvailable: true });
      await vehicleDoc(activation.id, "VERIFIED");
      const verified = await createVehicle(owner.id, "vq-verified");
      await vehicleDoc(verified.id, "VERIFIED");
      Object.assign(ids, {
        pending: pending.id,
        missing: missing.id,
        activation: activation.id,
        verified: verified.id,
      });
    });

    const list = (query: string) =>
      request(app).get(`${BASE}/vehicles?${query}`).set("Authorization", as("MODERATOR"));
    const states = (body: { data: { items: Array<{ id: string; verificationState: string }> } }) =>
      Object.fromEntries(body.data.items.map((v) => [v.id, v.verificationState]));

    it("lists only vehicles needing attention with a derived state", async () => {
      const response = await list(`search=${encodeURIComponent(`${TAG} vq-`)}`);

      expect(response.status).toBe(200);
      expect(states(response.body)).toEqual({
        [ids.pending]: "PENDING",
        [ids.missing]: "MISSING_DOCUMENTS",
        [ids.activation]: "ACTIVATION_REQUEST",
      });
      const pending = response.body.data.items.find((v: { id: string }) => v.id === ids.pending);
      expect(pending.documentSummary).toMatchObject({ pending: 1, rejected: 1, verified: 0 });
    });

    it("narrows to a single verification state", async () => {
      const [pending, missing, activation] = await Promise.all([
        list(`search=${encodeURIComponent(`${TAG} vq-`)}&verificationState=PENDING`),
        list(`search=${encodeURIComponent(`${TAG} vq-`)}&verificationState=MISSING_DOCUMENTS`),
        list(`search=${encodeURIComponent(`${TAG} vq-`)}&verificationState=ACTIVATION_REQUEST`),
      ]);

      expect(Object.keys(states(pending.body))).toEqual([ids.pending]);
      expect(Object.keys(states(missing.body))).toEqual([ids.missing]);
      expect(Object.keys(states(activation.body))).toEqual([ids.activation]);
    });

    it("matches the search against plate and owner details", async () => {
      const plate = (await prisma.vehicle.findUnique({ where: { id: ids.missing } }))!.licensePlate;
      const byPlate = await list(`search=${plate}&page=1&limit=5`);
      const byOwnerEmail = await list(`search=${PREFIX}.fleet.${TAG}`);

      expect(Object.keys(states(byPlate.body))).toEqual([ids.missing]);
      expect(Object.keys(states(byOwnerEmail.body)).sort()).toEqual(
        [ids.pending, ids.missing, ids.activation].sort(),
      );
    });

    it("rejects an unknown verification state", async () => {
      const response = await list("verificationState=DONE");
      expect(response.status).toBe(422);
    });

    it("returns vehicle details and 404 for an unknown vehicle", async () => {
      const found = await request(app)
        .get(`${BASE}/vehicles/${ids.pending}`)
        .set("Authorization", as("SUPER_ADMIN"));
      const missing = await request(app)
        .get(`${BASE}/vehicles/${TAG}-nope`)
        .set("Authorization", as("SUPER_ADMIN"));

      expect(found.status).toBe(200);
      expect(found.body.data.documentSummary).toMatchObject({ pending: 1, rejected: 1 });
      expect(found.body.data._count).toEqual({ bookings: 0, reviews: 0 });
      expect(missing.status).toBe(404);
    });
  });

  describe("vehicle decisions", () => {
    it("approves a vehicle: activates it, verifies open documents, notifies and audits", async () => {
      const owner = await createUser("approve-fleet", "VEHICLE_OWNER");
      const vehicle = await createVehicle(owner.id, "approve-me", { isActive: false, isAvailable: false });
      await vehicleDoc(vehicle.id, "PENDING");
      await vehicleDoc(vehicle.id, "REJECTED", "REGISTRATION_CERTIFICATE");

      const response = await request(app)
        .post(`${BASE}/vehicles/${vehicle.id}/approve`)
        .set("Authorization", as("SUPER_ADMIN"))
        .send({ note: "All good" });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ isActive: true, isAvailable: true });
      const docs = await prisma.vehicleDocument.findMany({ where: { vehicleId: vehicle.id } });
      expect(docs.every((d) => d.status === "VERIFIED" && d.verifiedBy === superId)).toBe(true);
      const [notification] = await notificationsFor(owner.id);
      expect(notification.type).toBe("vehicle_verification_approved");
      expect(notification.data).toMatchObject({ vehicleId: vehicle.id, note: "All good" });
      const [log] = await auditFor(vehicle.id);
      expect(log.changes).toMatchObject({ previousIsActive: false, newIsActive: true, note: "All good" });
    });

    it("answers 404 when approving or rejecting an unknown vehicle", async () => {
      const approve = await request(app)
        .post(`${BASE}/vehicles/${TAG}-ghost/approve`)
        .set("Authorization", as("SUPER_ADMIN"))
        .send({});
      const reject = await request(app)
        .post(`${BASE}/vehicles/${TAG}-ghost/reject`)
        .set("Authorization", as("SUPER_ADMIN"))
        .send({ reason: "Not roadworthy" });

      expect([approve.status, reject.status]).toEqual([404, 404]);
    });
  });

  describe("vehicle documents", () => {
    it("activates the vehicle only once its last document is verified", async () => {
      const owner = await createUser("doc-fleet", "VEHICLE_OWNER");
      const vehicle = await createVehicle(owner.id, "docs", { isActive: false, isAvailable: false });
      const first = await vehicleDoc(vehicle.id, "PENDING");
      const second = await vehicleDoc(vehicle.id, "PENDING", "REGISTRATION_CERTIFICATE");
      const approve = (documentId: string) =>
        request(app)
          .post(`${BASE}/vehicles/${vehicle.id}/documents/${documentId}/approve`)
          .set("Authorization", as("SUPER_ADMIN"))
          .send({});

      const firstResponse = await approve(first.id);
      const midway = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });
      const notificationsMidway = await notificationsFor(owner.id);
      const secondResponse = await approve(second.id);
      const done = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });

      expect([firstResponse.status, secondResponse.status]).toEqual([200, 200]);
      expect(midway?.isActive).toBe(false);
      expect(notificationsMidway).toHaveLength(0);
      expect(done).toMatchObject({ isActive: true, isAvailable: true });
      expect((await notificationsFor(owner.id))[0].title).toBe("Vehicle verification complete");
      const logs = await auditFor(vehicle.id);
      expect(logs).toHaveLength(2);
      expect(logs[0].changes).toMatchObject({ action: "document_approved", documentType: "REGISTRATION_CERTIFICATE" });
    });

    it("rejects a document and takes the vehicle offline", async () => {
      const owner = await createUser("doc-reject", "VEHICLE_OWNER");
      const vehicle = await createVehicle(owner.id, "doc-reject");
      const document = await vehicleDoc(vehicle.id, "VERIFIED");

      const response = await request(app)
        .post(`${BASE}/vehicles/${vehicle.id}/documents/${document.id}/reject`)
        .set("Authorization", as("SUPER_ADMIN"))
        .send({ reason: "Insurance expired" });

      expect(response.status).toBe(200);
      expect(await prisma.vehicleDocument.findUnique({ where: { id: document.id } })).toMatchObject({
        status: "REJECTED",
        rejectionReason: "Insurance expired",
        verifiedAt: null,
        verifiedBy: null,
      });
      expect((await prisma.vehicle.findUnique({ where: { id: vehicle.id } }))?.isActive).toBe(false);
      expect((await notificationsFor(owner.id))[0].data).toMatchObject({
        documentId: document.id,
        reason: "Insurance expired",
      });
      expect((await auditFor(vehicle.id))[0].changes).toMatchObject({ action: "document_rejected" });
    });

    it("answers 404 for a document of another vehicle or a removed vehicle", async () => {
      const owner = await createUser("doc-404", "VEHICLE_OWNER");
      const vehicle = await createVehicle(owner.id, "doc-404-a");
      const other = await createVehicle(owner.id, "doc-404-b");
      const document = await vehicleDoc(vehicle.id, "PENDING");
      const post = (vehicleId: string, action: "approve" | "reject") =>
        request(app)
          .post(`${BASE}/vehicles/${vehicleId}/documents/${document.id}/${action}`)
          .set("Authorization", as("SUPER_ADMIN"))
          .send(action === "reject" ? { reason: "Wrong file" } : {});

      const wrongVehicle = [await post(other.id, "approve"), await post(other.id, "reject")];
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { isRemoved: true, removedAt: new Date() },
      });
      const removedVehicle = [await post(vehicle.id, "approve"), await post(vehicle.id, "reject")];

      expect(wrongVehicle.map((r) => r.status)).toEqual([404, 404]);
      expect(removedVehicle.map((r) => r.status)).toEqual([404, 404]);
      expect(removedVehicle[0].body.error.message).toBe("Vehicle not found");
      expect((await prisma.vehicleDocument.findUnique({ where: { id: document.id } }))?.status).toBe("PENDING");
    });
  });

  describe("owner documents", () => {
    it("activates the owner only once every document is verified", async () => {
      const owner = await createUser("odoc", "VEHICLE_OWNER", { status: "PENDING_VERIFICATION" });
      const nic = await ownerDoc(owner.id, "PENDING");
      const licence = await ownerDoc(owner.id, "REJECTED", "DRIVING_LICENSE");
      const approve = (documentId: string) =>
        request(app)
          .post(`${BASE}/owners/${owner.id}/documents/${documentId}/approve`)
          .set("Authorization", as("SUPER_ADMIN"))
          .send({});

      await approve(nic.id);
      const midway = await prisma.user.findUnique({ where: { id: owner.id } });
      const response = await approve(licence.id);
      const done = await prisma.user.findUnique({ where: { id: owner.id } });

      expect(response.status).toBe(200);
      expect(midway).toMatchObject({ status: "PENDING_VERIFICATION", isVerified: false });
      expect(done).toMatchObject({ status: "ACTIVE", isVerified: true, verifiedBy: superId });
      const notifications = await notificationsFor(owner.id);
      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe("Owner verification complete");
      expect(await auditFor(owner.id)).toHaveLength(2);
    });

    it("rejects an owner document with a reason", async () => {
      const owner = await createUser("odoc-reject", "VEHICLE_OWNER");
      const nic = await ownerDoc(owner.id, "VERIFIED");

      const response = await request(app)
        .post(`${BASE}/owners/${owner.id}/documents/${nic.id}/reject`)
        .set("Authorization", as("SUPER_ADMIN"))
        .send({ reason: "Photo is cropped" });

      expect(response.status).toBe(200);
      expect(await prisma.ownerDocument.findUnique({ where: { id: nic.id } })).toMatchObject({
        status: "REJECTED",
        rejectionReason: "Photo is cropped",
        verifiedBy: null,
      });
      expect((await notificationsFor(owner.id))[0].type).toBe("owner_verification_rejected");
      expect((await auditFor(owner.id))[0].changes).toMatchObject({
        action: "document_rejected",
        reason: "Photo is cropped",
      });
    });

    it("answers 404 for a mismatched document or a non-owner account", async () => {
      const owner = await createUser("odoc-404", "VEHICLE_OWNER");
      const stranger = await createUser("odoc-404-other", "VEHICLE_OWNER");
      const ownDoc = await ownerDoc(owner.id, "PENDING");
      const customer = await createUser("odoc-404-customer", "CUSTOMER");
      const customerDoc = await ownerDoc(customer.id, "PENDING");
      const post = (ownerId: string, documentId: string, action: "approve" | "reject") =>
        request(app)
          .post(`${BASE}/owners/${ownerId}/documents/${documentId}/${action}`)
          .set("Authorization", as("SUPER_ADMIN"))
          .send(action === "reject" ? { reason: "Wrong file" } : {});

      const responses = [
        await post(stranger.id, ownDoc.id, "approve"),
        await post(stranger.id, ownDoc.id, "reject"),
        await post(customer.id, customerDoc.id, "approve"),
        await post(customer.id, customerDoc.id, "reject"),
      ];

      expect(responses.map((r) => r.status)).toEqual([404, 404, 404, 404]);
      expect(responses[0].body.error.message).toBe("Owner document not found");
      expect(responses[2].body.error.message).toBe("Owner not found");
      expect((await prisma.ownerDocument.findUnique({ where: { id: customerDoc.id } }))?.status).toBe("PENDING");
    });

    it("validates the rejection reason", async () => {
      const owner = await createUser("odoc-422", "VEHICLE_OWNER");
      const nic = await ownerDoc(owner.id, "PENDING");

      const response = await request(app)
        .post(`${BASE}/owners/${owner.id}/documents/${nic.id}/reject`)
        .set("Authorization", as("SUPER_ADMIN"))
        .send({});

      expect(response.status).toBe(422);
    });
  });
});
