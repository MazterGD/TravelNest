/**
 * API service layer: every service method maps to the expected HTTP verb and
 * endpoint, query strings drop empty values, and file helpers (uploads, CSV
 * downloads) build the right payloads.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
  authHeaders: vi.fn(),
}));

vi.mock("@/lib/api/client", async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  return { ...actual, api: apiMock };
});

import * as services from "@/lib/api/services";
import { ApiError } from "@/lib/api";

const VERBS = ["get", "post", "put", "patch", "delete", "upload"] as const;

const lastCall = () => {
  for (const verb of VERBS) {
    const calls = apiMock[verb].mock.calls;
    if (calls.length) return { verb, args: calls[calls.length - 1] };
  }
  return null;
};

// Helpers that orchestrate several calls (uploads, CSV downloads) are covered
// by dedicated tests below.
const SPECIAL = new Set([
  "vehicleService.uploadPhotos",
  "vehicleService.uploadDocuments",
  "vehicleService.uploadImages",
  "searchService.searchVehicles",
  "adminService.exportUsersCsv",
  "adminService.exportBookingsCsv",
  "adminService.exportAnalyticsCsv",
  "adminService.exportAuditLogsCsv",
  "adminService.exportAdminReport",
]);

const serviceEntries = Object.entries(services).filter(
  ([name, value]) => name.endsWith("Service") && typeof value === "object",
) as Array<[string, Record<string, (...args: unknown[]) => unknown>]>;

beforeEach(() => {
  vi.clearAllMocks();
  for (const verb of VERBS) apiMock[verb].mockResolvedValue({ ok: verb });
  apiMock.authHeaders.mockResolvedValue({ Authorization: "Bearer t" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("service sweep", () => {
  it("exposes every expected service", () => {
    expect(serviceEntries.map(([n]) => n).sort()).toEqual(
      [
        "adminService",
        "authService",
        "bookingService",
        "disputeService",
        "driverService",
        "landingContentService",
        "messageService",
        "notificationService",
        "ownerRegistrationService",
        "ownerService",
        "paymentService",
        "publicContentService",
        "quotationService",
        "reviewService",
        "searchService",
        "storageService",
        "tripPackageService",
        "tripService",
        "userService",
        "vehicleService",
      ].sort(),
    );
  });

  it.each(serviceEntries)(
    "%s: each method issues exactly one API call to a relative endpoint",
    async (name: string, service: Record<string, (...args: unknown[]) => unknown>) => {
      for (const [method, fn] of Object.entries(service)) {
        if (SPECIAL.has(`${name}.${method}`)) continue;
        vi.clearAllMocks();
        for (const args of [[], ["id-1", { page: 2, empty: "", nil: null }, "x"]]) {
          await fn(...args);
          const call = lastCall();
          expect(call, `${name}.${method}`).not.toBeNull();
          expect(String(call!.args[0])).toMatch(/^\//);
          expect(String(call!.args[0])).not.toContain("empty=");
          expect(String(call!.args[0])).not.toContain("nil=");
          vi.clearAllMocks();
        }
      }
    },
  );
});

describe("endpoint contracts", () => {
  it("auth endpoints skip the bearer token where required", async () => {
    await services.authService.login({ email: "a@b.lk", password: "p" } as any);
    expect(apiMock.post).toHaveBeenCalledWith(
      "/auth/login",
      { email: "a@b.lk", password: "p" },
      { skipAuth: true },
    );
    await services.authService.resetPassword("tok", "pw");
    expect(apiMock.post).toHaveBeenLastCalledWith(
      "/auth/reset-password",
      { token: "tok", password: "pw" },
      { skipAuth: true },
    );
    await services.authService.changePassword("a", "b");
    expect(apiMock.put).toHaveBeenCalledWith("/auth/change-password", {
      currentPassword: "a",
      newPassword: "b",
    });
    await services.publicContentService.getPage("terms");
    expect(apiMock.get).toHaveBeenLastCalledWith("/content/terms", { skipAuth: true });
  });

  it("builds vehicle search query strings without empty values", async () => {
    await services.vehicleService.getAll({
      type: "LUXURY_AC",
      lat: 6.9,
      location: "",
      district: undefined,
    });
    expect(apiMock.get).toHaveBeenLastCalledWith("/vehicles?type=LUXURY_AC&lat=6.9");
    await services.vehicleService.getAll();
    expect(apiMock.get).toHaveBeenLastCalledWith("/vehicles");
    await services.vehicleService.getAvailability("v1", "2026-06");
    expect(apiMock.get).toHaveBeenLastCalledWith("/vehicles/v1/availability?month=2026-06");
    await services.vehicleService.getSimilarVehicles("v1");
    expect(apiMock.get).toHaveBeenLastCalledWith("/vehicles/v1/similar?limit=4");
    await services.searchService.searchVehicles({ from: "Colombo", to: "" } as any);
    expect(apiMock.get).toHaveBeenLastCalledWith("/search/vehicles?from=Colombo");
    await services.searchService.getSuggestions("Nuwara Eliya");
    expect(apiMock.get).toHaveBeenLastCalledWith("/search/suggestions?q=Nuwara%20Eliya");
  });

  it("uses the documented booking, quotation and payment endpoints", async () => {
    await services.bookingService.cancel("b1", "plans changed");
    expect(apiMock.patch).toHaveBeenLastCalledWith("/bookings/b1/cancel", {
      reason: "plans changed",
    });
    await services.quotationService.respondToQuotation("q1", { status: "ACCEPTED" });
    expect(apiMock.patch).toHaveBeenLastCalledWith("/quotations/q1/respond", {
      status: "ACCEPTED",
    });
    await services.paymentService.createPaymentIntent("b1", "CARD");
    expect(apiMock.post).toHaveBeenLastCalledWith("/payments/create-intent", {
      bookingId: "b1",
      method: "CARD",
    });
    await services.landingContentService.submitContactForm({ name: "n" } as any);
    expect(apiMock.post).toHaveBeenLastCalledWith(
      "/landing/contact",
      { name: "n" },
      { skipAuth: true },
    );
  });

  it("attaches files to FormData for avatar, receipt and registration uploads", async () => {
    const file = new File(["x"], "a.png", { type: "image/png" });
    await services.userService.uploadAvatar(file);
    let [endpoint, fd] = apiMock.upload.mock.calls[0] as [string, FormData];
    expect(endpoint).toBe("/users/avatar");
    expect((fd.get("avatar") as File).name).toBe("a.png");

    await services.paymentService.uploadReceipt("p1", file);
    [endpoint, fd] = apiMock.upload.mock.calls[1] as [string, FormData];
    expect(endpoint).toBe("/payments/p1/receipt");
    expect(fd.get("receipt")).toBeTruthy();

    await services.storageService.uploadRegistrationFile(file, "owner-documents", "NIC");
    fd = apiMock.upload.mock.calls[2][1] as FormData;
    expect(fd.get("category")).toBe("owner-documents");
    expect(fd.get("subfolder")).toBe("NIC");

    await services.storageService.uploadRegistrationFile(file, "vehicle-photos");
    fd = apiMock.upload.mock.calls[3][1] as FormData;
    expect(fd.get("subfolder")).toBeNull();

    await services.vehicleService.uploadImages("v1", [file, file]);
    fd = apiMock.upload.mock.calls[4][1] as FormData;
    expect(fd.getAll("images").length).toBe(2);
  });

  it("uploads vehicle photos then posts their metadata", async () => {
    apiMock.upload
      .mockResolvedValueOnce({ url: "u1" })
      .mockResolvedValueOnce({ url: "u2" });
    const f1 = new File(["a"], "1.jpg", { type: "image/jpeg" });
    const f2 = new File(["bb"], "2.jpg", { type: "image/jpeg" });

    await services.vehicleService.uploadPhotos("v1", [
      { file: f1 },
      { file: f2, isPrimary: true, tag: "INTERIOR" },
    ]);

    expect(apiMock.post).toHaveBeenCalledWith("/vehicles/v1/photos/metadata", {
      photos: [
        { url: "u1", fileName: "1.jpg", fileSize: 1, mimeType: "image/jpeg", isPrimary: true, tag: "EXTERIOR" },
        { url: "u2", fileName: "2.jpg", fileSize: 2, mimeType: "image/jpeg", isPrimary: true, tag: "INTERIOR" },
      ],
    });
  });

  it("uploads vehicle documents into their typed subfolder", async () => {
    apiMock.upload.mockResolvedValueOnce({ url: "storage://private/doc" });
    const f = new File(["pdf"], "rev.pdf", { type: "application/pdf" });

    await services.vehicleService.uploadDocuments("v1", [{ file: f, type: "REVENUE_LICENSE" }]);

    expect((apiMock.upload.mock.calls[0][1] as FormData).get("subfolder")).toBe("REVENUE_LICENSE");
    expect(apiMock.post).toHaveBeenCalledWith("/vehicles/v1/documents/metadata", {
      documents: [
        { type: "REVENUE_LICENSE", url: "storage://private/doc", fileName: "rev.pdf", fileSize: 3, mimeType: "application/pdf" },
      ],
    });
  });

  it("passes optional flags through for drivers and commissions", async () => {
    await services.driverService.getAvailable("2026-06-01", "2026-06-02", "b9");
    expect(apiMock.get).toHaveBeenLastCalledWith(
      "/drivers/available?startDate=2026-06-01&endDate=2026-06-02&excludeBookingId=b9",
    );
    await services.driverService.getAvailable("2026-06-01", "2026-06-02");
    expect(apiMock.get).toHaveBeenLastCalledWith(
      "/drivers/available?startDate=2026-06-01&endDate=2026-06-02",
    );
    await services.adminService.getCommissionRules(true);
    expect(apiMock.get).toHaveBeenLastCalledWith("/admin/commissions?includeInactive=true");
    await services.adminService.getRevenueChart();
    expect(apiMock.get).toHaveBeenLastCalledWith("/admin/dashboard/charts/revenue?months=6");
    await services.adminService.getUsersAnalytics({ startDate: "2026-01-01" } as any);
    expect(apiMock.get).toHaveBeenLastCalledWith("/admin/analytics/users?startDate=2026-01-01");
    await services.adminService.addDisputeMessage("d1", "hi");
    expect(apiMock.post).toHaveBeenLastCalledWith("/admin/disputes/d1/message", {
      message: "hi",
      isInternalNote: true,
    });
  });
});

describe("admin CSV downloads", () => {
  const stubDownload = () => {
    const createObjectURL = vi.fn(() => "blob:x");
    const revokeObjectURL = vi.fn();
    (window.URL as any).createObjectURL = createObjectURL;
    (window.URL as any).revokeObjectURL = revokeObjectURL;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    return { createObjectURL, revokeObjectURL, click };
  };

  it("downloads a GET export with auth headers and saves the file", async () => {
    const { revokeObjectURL, click } = stubDownload();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("a,b", { status: 200 }));

    await services.adminService.exportUsersCsv({ role: "CUSTOMER" } as any);

    const [url, init] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toBe("http://localhost:5000/api/v1/admin/users/export?role=CUSTOMER");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer t");
    expect(init.body).toBeUndefined();
    expect(apiMock.authHeaders).toHaveBeenCalledWith("GET");
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:x");

    for (const fn of [
      services.adminService.exportBookingsCsv,
      services.adminService.exportAnalyticsCsv,
      services.adminService.exportAuditLogsCsv,
    ]) {
      fetchMock.mockResolvedValueOnce(new Response("x"));
      await fn();
      fetchMock.mockResolvedValueOnce(new Response("x"));
      await fn({} as any);
    }
    expect(fetchMock.mock.calls.map((c: any[]) => c[0])).toContain(
      "http://localhost:5000/api/v1/admin/audit-logs/export",
    );
  });

  it("POSTs report exports as JSON with CSRF-capable headers", async () => {
    stubDownload();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response("x"));

    await services.adminService.exportAdminReport({ name: "r.csv", type: "BOOKINGS" } as any);
    const init = fetchMock.mock.calls[0][1] as any;
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ name: "r.csv", type: "BOOKINGS" });
    expect(apiMock.authHeaders).toHaveBeenCalledWith("POST");

    await services.adminService.exportAdminReport({ type: "X" } as any);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("raises an ApiError when the export fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 403 }));
    const err = await services.adminService.exportUsersCsv().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("CSV_EXPORT_FAILED");
    expect(err.status).toBe(403);
  });
});
