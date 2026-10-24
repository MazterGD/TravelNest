/**
 * Owner driver roster: list stats, delete with browser confirmation, and the
 * add / edit driver forms (payload trimming, redirects, error handling).
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  guard: { isLoading: false, isAuthorized: true },
  push: vi.fn(),
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.push, replace: vi.fn() }),
  useParams: () => ({ locale: "en" }),
  usePathname: () => "/en/owner/drivers",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next-intl", () => ({ useTranslations: () => state.t, useLocale: () => "en" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks", () => ({ useOwnerGuard: () => state.guard }));
vi.mock("@/lib/api/services", () => ({
  driverService: { list: vi.fn(), delete: vi.fn(), create: vi.fn(), getOne: vi.fn(), update: vi.fn() },
}));

import { driverService } from "@/lib/api/services";
import DriversPage from "@/app/[locale]/owner/drivers/page";
import AddDriverPage from "@/app/[locale]/owner/drivers/add/page";
import EditDriverPage from "@/app/[locale]/owner/drivers/[id]/edit/page";

const drivers = driverService as any;

const renderWithParams = async (ui: (p: Promise<any>) => React.ReactElement, value: Record<string, string>) => {
  const params = Promise.resolve(value);
  await act(async () => {
    render(<Suspense fallback={<div>suspended</div>}>{ui(params)}</Suspense>);
    await params;
  });
};

describe("owner driver pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.guard = { isLoading: false, isAuthorized: true };
    drivers.list.mockResolvedValue({
      drivers: [
        { id: "d1", name: "sunil", phone: "0711111111", photoUrl: null, status: "ACTIVE", totalTrips: 10, activeTrips: 1 },
        { id: "d2", name: "Nimal", phone: "0722222222", photoUrl: "https://img/n.webp", status: "INACTIVE", totalTrips: 4, activeTrips: 0 },
      ],
    });
    drivers.delete.mockResolvedValue({});
    drivers.create.mockResolvedValue({});
    drivers.getOne.mockResolvedValue({ driver: { name: "Sunil", phone: "0711111111", status: "ACTIVE" } });
    drivers.update.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("DriversPage", () => {
    it("is gated by the guard", async () => {
      state.guard = { isLoading: true, isAuthorized: false };
      await renderWithParams((p) => <DriversPage params={p} />, { locale: "en" });
      expect(drivers.list).not.toHaveBeenCalled();
    });

    it("lists drivers with roster stats", async () => {
      await renderWithParams((p) => <DriversPage params={p} />, { locale: "en" });
      expect(await screen.findByText("sunil")).toBeTruthy();
      expect(screen.getByText("S")).toBeTruthy();
      expect(screen.getByAltText("Nimal").getAttribute("src")).toBe("https://img/n.webp");
      expect(screen.getByText("14")).toBeTruthy();
      expect(screen.getByText("statusInactive")).toBeTruthy();
      expect(screen.getByText("0711111111").closest("a")?.getAttribute("href")).toBe("tel:0711111111");
      expect(screen.getAllByText("edit")[1].closest("a")?.getAttribute("href")).toBe("/en/owner/drivers/d2/edit");
    });

    it("shows empty and error states", async () => {
      drivers.list.mockResolvedValueOnce({ drivers: [] });
      await renderWithParams((p) => <DriversPage params={p} />, { locale: "en" });
      expect(await screen.findByText("emptyTitle")).toBeTruthy();
    });

    it("shows load errors with a fallback message", async () => {
      drivers.list.mockRejectedValueOnce({});
      await renderWithParams((p) => <DriversPage params={p} />, { locale: "en" });
      expect(await screen.findByText("loadError")).toBeTruthy();
    });

    it("shows the API load error message", async () => {
      drivers.list.mockRejectedValueOnce(new Error("Roster down"));
      await renderWithParams((p) => <DriversPage params={p} />, { locale: "en" });
      expect(await screen.findByText("Roster down")).toBeTruthy();
    });

    it("deletes only after confirmation and reports failures", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
      drivers.delete.mockRejectedValueOnce(new Error("Driver on trip")).mockRejectedValueOnce({});
      await renderWithParams((p) => <DriversPage params={p} />, { locale: "en" });
      await screen.findByText("sunil");
      const del = () => screen.getByLabelText('deleteAriaLabel:{"name":"sunil"}');
      await act(async () => fireEvent.click(del()));
      expect(confirmSpy).toHaveBeenCalledWith('deleteConfirm:{"name":"sunil"}');
      expect(drivers.delete).not.toHaveBeenCalled();
      await act(async () => fireEvent.click(del()));
      expect(screen.getByText("Driver on trip")).toBeTruthy();
      await act(async () => fireEvent.click(del()));
      expect(screen.getByText("deleteError")).toBeTruthy();
      await act(async () => fireEvent.click(del()));
      expect(drivers.delete).toHaveBeenCalledWith("d1");
      expect(screen.queryByText("sunil")).toBeNull();
    });
  });

  describe("AddDriverPage", () => {
    it("is gated by the guard", async () => {
      state.guard = { isLoading: false, isAuthorized: false };
      await renderWithParams((p) => <AddDriverPage params={p} />, { locale: "en" });
      expect(screen.queryByText("addTitle")).toBeNull();
    });

    it("creates a driver with trimmed values and redirects", async () => {
      await renderWithParams((p) => <AddDriverPage params={p} />, { locale: "en" });
      const save = screen.getByText("saveDriver").closest("button") as HTMLButtonElement;
      expect(save.disabled).toBe(true);
      fireEvent.change(screen.getByLabelText(/fieldName/), { target: { value: "  Kasun  " } });
      fireEvent.change(screen.getByLabelText(/fieldPhone/), { target: { value: " 0770000000 " } });
      fireEvent.change(screen.getByLabelText("fieldStatus"), { target: { value: "INACTIVE" } });
      await act(async () => fireEvent.submit(save.closest("form") as HTMLFormElement));
      expect(drivers.create).toHaveBeenCalledWith({ name: "Kasun", phone: "0770000000", status: "INACTIVE" });
      expect(state.push).toHaveBeenCalledWith("/en/owner/drivers");
    });

    it("shows create errors", async () => {
      drivers.create.mockRejectedValueOnce(new Error("Phone taken")).mockRejectedValueOnce({});
      await renderWithParams((p) => <AddDriverPage params={p} />, { locale: "en" });
      const form = document.querySelector("form") as HTMLFormElement;
      await act(async () => fireEvent.submit(form));
      expect(screen.getByText("Phone taken")).toBeTruthy();
      await act(async () => fireEvent.submit(form));
      expect(screen.getByText("saveError")).toBeTruthy();
      expect(state.push).not.toHaveBeenCalled();
    });
  });

  describe("EditDriverPage", () => {
    it("loads the driver, edits and saves", async () => {
      await renderWithParams((p) => <EditDriverPage params={p} />, { locale: "en", id: "d1" });
      expect(await screen.findByDisplayValue("Sunil")).toBeTruthy();
      expect(drivers.getOne).toHaveBeenCalledWith("d1");
      fireEvent.change(screen.getByLabelText("fieldStatus"), { target: { value: "INACTIVE" } });
      expect(screen.getByText("inactiveHint")).toBeTruthy();
      fireEvent.change(screen.getByLabelText(/fieldName/), { target: { value: " Sunil P " } });
      fireEvent.change(screen.getByLabelText(/fieldPhone/), { target: { value: "0719999999" } });
      await act(async () => fireEvent.click(screen.getByText("saveChanges")));
      expect(drivers.update).toHaveBeenCalledWith("d1", { name: "Sunil P", phone: "0719999999", status: "INACTIVE" });
      expect(state.push).toHaveBeenCalledWith("/en/owner/drivers");
    });

    it("shows load and save errors", async () => {
      drivers.getOne.mockRejectedValueOnce({});
      drivers.update.mockRejectedValueOnce(new Error("Invalid phone")).mockRejectedValueOnce({});
      await renderWithParams((p) => <EditDriverPage params={p} />, { locale: "en", id: "d1" });
      expect(await screen.findByText("loadError")).toBeTruthy();
      const form = document.querySelector("form") as HTMLFormElement;
      await act(async () => fireEvent.submit(form));
      expect(screen.getByText("Invalid phone")).toBeTruthy();
      await act(async () => fireEvent.submit(form));
      expect(screen.getByText("saveError")).toBeTruthy();
    });

    it("shows the API load error message", async () => {
      drivers.getOne.mockRejectedValueOnce(new Error("Driver not found"));
      await renderWithParams((p) => <EditDriverPage params={p} />, { locale: "en", id: "zz" });
      expect(await screen.findByText("Driver not found")).toBeTruthy();
    });

    it("does not load until authorised", async () => {
      state.guard = { isLoading: true, isAuthorized: false };
      await renderWithParams((p) => <EditDriverPage params={p} />, { locale: "en", id: "d1" });
      await waitFor(() => expect(drivers.getOne).not.toHaveBeenCalled());
    });
  });
});
