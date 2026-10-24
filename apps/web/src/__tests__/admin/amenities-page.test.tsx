/**
 * Admin amenities catalogue: scope/search/pagination, create with code
 * normalisation, edit selection and archive.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/lib/api", () => ({
  adminService: {
    getAmenities: vi.fn(),
    createAmenity: vi.fn(),
    updateAmenity: vi.fn(),
    deleteAmenity: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import AdminAmenitiesPage from "@/app/[locale]/admin/amenities/page";

const svc = adminService as any;

// Stable object references: the hook re-fetches whenever the selected
// amenity object changes identity (see the it.todo below).
const wifi = { id: "a1", code: "WIFI", name: "Wi-Fi", description: "On-board internet", icon: "wifi", sortOrder: 1, isActive: true };
const tv = { id: "a2", code: "TV", name: "Television", description: null, icon: null, sortOrder: 2, isActive: false };
const listResponse = { items: [wifi, tv], total: 2, page: 1, limit: 20, totalPages: 1 };

const lastQuery = () => svc.getAmenities.mock.calls.at(-1)[0];

const renderPage = async () => {
  render(<AdminAmenitiesPage />);
  await screen.findAllByText(/item\(s\)|No amenities found|Could not load/);
};

describe("AdminAmenitiesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.getAmenities.mockResolvedValue(listResponse);
    svc.createAmenity.mockResolvedValue({});
    svc.updateAmenity.mockResolvedValue({});
    svc.deleteAmenity.mockResolvedValue({});
  });

  it("lists amenities with status, description fallback and disabled archive for inactive", async () => {
    await renderPage();
    expect(screen.getByText("2 item(s)")).toBeTruthy();
    expect(screen.getByText("No description")).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();
    expect((screen.getByLabelText("Archive Television") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Select an amenity from the table to edit it.")).toBeTruthy();
  });

  it("shows empty and error states", async () => {
    svc.getAmenities.mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 20, totalPages: 1 });
    await renderPage();
    expect(screen.getByText("No amenities found")).toBeTruthy();
    svc.getAmenities.mockRejectedValueOnce("x");
    fireEvent.click(screen.getByLabelText("Refresh amenities"));
    expect(await screen.findByText(/Failed to load amenities/)).toBeTruthy();
  });

  it("changes scope, search, page size and pages", async () => {
    svc.getAmenities.mockResolvedValue({ ...listResponse, page: 2, totalPages: 3 });
    await renderPage();
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => expect(lastQuery().page).toBe(3));
    fireEvent.click(screen.getByText("Previous"));
    await waitFor(() => expect(lastQuery().page).toBe(1));
    fireEvent.click(screen.getByText("Include inactive"));
    await waitFor(() => expect(lastQuery().includeInactive).toBe(true));
    expect(screen.getByText("Include inactive").getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(screen.getByLabelText("Search amenities"), { target: { value: "  wifi " } });
    await waitFor(() => expect(lastQuery().search).toBe("wifi"));
    fireEvent.change(document.querySelector("select") as HTMLSelectElement, { target: { value: "50" } });
    await waitFor(() => expect(lastQuery().limit).toBe(50));
  });

  it("creates an amenity with a normalised code", async () => {
    await renderPage();
    const add = screen.getByText("Add amenity").closest("button") as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("WIFI"), { target: { value: " usb charger " } });
    fireEvent.change(screen.getByPlaceholderText("Wi-Fi"), { target: { value: " USB " } });
    expect(add.disabled).toBe(false);
    await act(async () => fireEvent.click(add));
    expect(svc.createAmenity).toHaveBeenCalledWith({
      code: "USB_CHARGER",
      name: "USB",
      description: undefined,
      sortOrder: 0,
      isActive: true,
    });
    expect((screen.getByPlaceholderText("WIFI") as HTMLInputElement).value).toBe("");

    fireEvent.change(screen.getByPlaceholderText("WIFI"), { target: { value: "AC" } });
    fireEvent.change(screen.getByPlaceholderText("Wi-Fi"), { target: { value: "Air con" } });
    fireEvent.change(screen.getByPlaceholderText("Internet access available on board"), {
      target: { value: " Cool " },
    });
    await act(async () => fireEvent.click(add));
    expect(svc.createAmenity).toHaveBeenLastCalledWith(expect.objectContaining({ code: "AC", description: "Cool" }));
  });

  it("edits, clears and archives amenities", async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText("Edit Wi-Fi"));
    expect(await screen.findByDisplayValue("On-board internet")).toBeTruthy();
    expect(screen.getByDisplayValue("wifi")).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue("Wi-Fi"), { target: { value: " Wi-Fi 6 " } });
    fireEvent.change(screen.getByDisplayValue("On-board internet"), { target: { value: "  " } });
    fireEvent.change(screen.getByDisplayValue("wifi"), { target: { value: " " } });
    fireEvent.change(screen.getByDisplayValue("1"), { target: { value: "abc" } });
    fireEvent.click(screen.getByLabelText("Active amenity"));
    expect(screen.getByText("Inactive amenities are hidden from listings and filters.")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("Save changes")));
    expect(svc.updateAmenity).toHaveBeenCalledWith("a1", {
      name: "Wi-Fi 6",
      description: undefined,
      icon: undefined,
      sortOrder: 0,
      isActive: false,
    });

    fireEvent.click(screen.getByText("Clear"));
    expect(await screen.findByText("Select an amenity from the table to edit it.")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Edit Television"));
    expect(await screen.findByDisplayValue("TV")).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("Television"), { target: { value: "T" } });
    expect((screen.getByText("Save changes").closest("button") as HTMLButtonElement).disabled).toBe(true);

    await act(async () => fireEvent.click(screen.getByLabelText("Archive Wi-Fi")));
    expect(svc.deleteAmenity).toHaveBeenCalledWith("a1");
  });

  it("surfaces mutation errors", async () => {
    svc.deleteAmenity.mockRejectedValueOnce(new Error("In use by vehicles"));
    await renderPage();
    await act(async () => fireEvent.click(screen.getByLabelText("Archive Wi-Fi")));
    expect(await screen.findByText(/In use by vehicles/)).toBeTruthy();
    svc.deleteAmenity.mockRejectedValueOnce("x");
    await act(async () => fireEvent.click(screen.getByLabelText("Archive Wi-Fi")));
    expect(await screen.findByText(/Amenity action failed/)).toBeTruthy();
  });

  it.todo(
    "does not refetch in a loop after selecting an amenity when the API returns fresh objects (fetchAmenities depends on selectedAmenity and re-selects a new object each fetch)",
  );
});
