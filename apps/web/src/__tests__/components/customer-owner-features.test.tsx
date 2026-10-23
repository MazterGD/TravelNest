/**
 * Component tests for customer/owner feature components: TripPackageCard,
 * QuotationCard / QuotationComparison, QuotationRequestCard, BookingCard,
 * QuotationRequestForm, ReviewForm / ReviewDisplay and owner TripPackageForm.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => "en",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("next/image", () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import {
  BookingCard,
  QuotationCard,
  QuotationComparison,
  QuotationRequestCard,
  QuotationRequestForm,
  ReviewDisplay,
  ReviewForm,
  TripPackageCard,
} from "@/components/features/customer";
import { TripPackageForm } from "@/components/features/owner/TripPackageForm";

beforeEach(() => h.push.mockReset());

const pickListOption = (trigger: HTMLElement, name: string) => {
  fireEvent.click(trigger);
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name }));
};

describe("TripPackageCard", () => {
  const pkg = (over: any = {}): any => ({
    id: "p1",
    title: "Hill Country Tour",
    isActive: true,
    vehicle: { name: "Lanka Coach", seats: 45, images: ["/v.png"] },
    owner: { firstName: "Sunil", lastName: "Silva" },
    startLocation: "Colombo",
    endLocation: "Ella",
    durationDays: 3,
    minPassengers: 10,
    maxPassengers: 40,
    price: 150000,
    ...over,
  });

  it("renders details, toggles compare and books", () => {
    const onToggleCompare = vi.fn();
    const onBook = vi.fn();
    const p = pkg();
    render(<TripPackageCard tripPackage={p} isSelected={false} onToggleCompare={onToggleCompare} onBook={onBook} />);
    expect(screen.getByRole("heading", { name: "Hill Country Tour" })).toBeTruthy();
    expect(screen.getByAltText("Lanka Coach").getAttribute("src")).toBe("/v.png");
    expect(screen.getByText("status.active")).toBeTruthy();
    expect(screen.getByText(/maxSeats:\{"count":45\}/)).toBeTruthy();
    expect(screen.getByText('ownerLabel:{"name":"Sunil Silva"}')).toBeTruthy();
    expect(screen.getByText(`LKR ${(150000).toLocaleString()}`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "compare.label" }));
    expect(onToggleCompare).toHaveBeenCalledWith("p1");
    fireEvent.click(screen.getByRole("button", { name: "bookPackage" }));
    expect(onBook).toHaveBeenCalledWith(p);
  });

  it("handles inactive packages without vehicle/owner data", () => {
    const { container } = render(
      <TripPackageCard tripPackage={pkg({ isActive: false, vehicle: undefined, owner: null })} isSelected onToggleCompare={vi.fn()} onBook={vi.fn()} />,
    );
    expect(screen.getByText("status.inactive")).toBeTruthy();
    expect(screen.getByText("vehicleFallback")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("button", { name: "compare.selected" }).className).toContain("text-primary");
    expect(screen.queryByText(/ownerLabel/)).toBeNull();
    expect(screen.queryByText(/maxSeats/)).toBeNull();
  });
});

describe("QuotationCard", () => {
  const quote = (over: any = {}): any => ({
    id: "q1",
    ownerName: "Nimal Perera",
    rating: 4.5,
    totalTrips: 12,
    status: "pending",
    vehicleName: "Lanka Coach",
    vehicleImage: "/v.png",
    message: "Includes driver allowance",
    price: 50000,
    totalAmount: 1,
    validUntil: "2026-11-01T00:00:00Z",
    ...over,
  });

  it("renders a pending quotation and accepts/declines without opening details", () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    render(<QuotationCard quotation={quote()} onAccept={onAccept} onDecline={onDecline} />);
    expect(screen.getByRole("heading", { name: "Nimal Perera" })).toBeTruthy();
    expect(screen.getByText("4.5")).toBeTruthy();
    expect(screen.getByText(/12 trips/)).toBeTruthy();
    expect(screen.getByText("Includes driver allowance")).toBeTruthy();
    expect(screen.getByText(/50,000/)).toBeTruthy();
    expect(screen.getByText("validUntil")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    fireEvent.click(screen.getByRole("button", { name: "decline" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it("falls back to totalAmount/expiryDate and hides actions when not pending", () => {
    const onViewDetails = vi.fn();
    const { container } = render(
      <QuotationCard
        quotation={quote({ price: undefined, totalAmount: 42000, validUntil: undefined, expiryDate: undefined, rating: null, totalTrips: undefined, vehicleImage: null, message: null, status: "accepted" })}
        onViewDetails={onViewDetails}
        isSelected
        isCompact
      />,
    );
    expect(screen.getByText("comparison.ratingUnavailable")).toBeTruthy();
    expect(screen.getByText(/42,000/)).toBeTruthy();
    expect(screen.queryByText("validUntil")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("button", { name: "accept" })).toBeNull();
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("ring-2");
    fireEvent.click(card);
    expect(onViewDetails).toHaveBeenCalled();
  });

  it("tolerates missing handlers and zero trips", () => {
    render(<QuotationCard quotation={quote({ totalTrips: undefined })} />);
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    fireEvent.click(screen.getByRole("button", { name: "decline" }));
    expect(screen.getByText(/0 trips/)).toBeTruthy();
  });

  it.todo("a clickable QuotationCard (onViewDetails) with pending actions does not nest Accept/Decline buttons inside the card <button> (QuotationCard.tsx:51,127,137 + Card.tsx:16)");

  it("QuotationComparison sorts by price, flags the lowest and selects", () => {
    const onSelect = vi.fn();
    const quotes = [quote({ id: "a", ownerName: "Expensive", price: 90000 }), quote({ id: "b", ownerName: "Cheap", price: 30000 }), quote({ id: "c", ownerName: "Also cheap", price: undefined, totalAmount: 30000 })];
    render(<QuotationComparison quotations={quotes} selectedId="a" onSelect={onSelect} onAccept={vi.fn()} />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((el) => el.textContent);
    expect(headings).toEqual(["receivedQuotations (3)", "Cheap", "Also cheap", "Expensive"]);
    expect(screen.getAllByText("lowestPrice").length).toBe(2);
    expect(screen.queryByRole("button", { name: "accept" })).toBeNull();
    fireEvent.click(screen.getByRole("heading", { name: "Expensive" }).closest("button")!);
    expect(onSelect).toHaveBeenCalledWith(quotes[0]);
  });

  it("QuotationComparison shows an empty message", () => {
    render(<QuotationComparison quotations={[]} onSelect={vi.fn()} onAccept={vi.fn()} />);
    expect(screen.getByText("noQuotationsReceived")).toBeTruthy();
  });
});

describe("QuotationRequestCard", () => {
  const req = (over: any = {}): any => ({
    id: "r1",
    status: "pending",
    isRoundTrip: true,
    createdAt: "2026-10-01T00:00:00Z",
    quotationsCount: 0,
    pickupLocation: { address: "1 Galle Rd", city: "Colombo", district: "Colombo" },
    dropoffLocation: { address: "Temple St", city: "", district: "Kandy" },
    pickupDate: "2026-11-01T00:00:00Z",
    pickupTime: "08:00",
    passengerCount: 30,
    needsAC: true,
    ...over,
  });

  it("shows a pending request waiting for quotes and cancels", () => {
    const onCancel = vi.fn();
    render(<QuotationRequestCard request={req()} onCancel={onCancel} locale="en" />);
    expect(screen.getByText("pending").className).toContain("border");
    expect(screen.getByText("roundTrip")).toBeTruthy();
    expect(screen.getByText("Colombo, Colombo")).toBeTruthy();
    expect(screen.getByText("Kandy")).toBeTruthy();
    expect(screen.getByText("withAC")).toBeTruthy();
    expect(screen.getByText("waitingForQuotations")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "cancelRequest" }));
    expect(onCancel).toHaveBeenCalled();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links to quotations and comparison when several quotes arrived", () => {
    render(<QuotationRequestCard request={req({ status: "quoted", quotationsCount: 3, isRoundTrip: false, needsAC: false })} locale="si" />);
    expect(screen.getByText("quoted").className).toContain("text-primary");
    expect(screen.getByText("3")).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links[0].getAttribute("href")).toBe("/si/dashboard/quotations/r1");
    expect(links[1].getAttribute("href")).toBe("/si/dashboard/quotations/compare?requestId=r1");
    expect(screen.queryByText("roundTrip")).toBeNull();
    expect(screen.queryByText("withAC")).toBeNull();
    expect(screen.queryByRole("button", { name: "cancelRequest" })).toBeNull();
  });

  it.each(["expired", "cancelled", "other"])("styles %s status", (status: any) => {
    render(<QuotationRequestCard request={req({ status, quotationsCount: 1 })} locale="en" />);
    expect(screen.getByText(status)).toBeTruthy();
    expect(screen.getAllByRole("link").length).toBe(1);
  });

  it.todo("view/compare actions are not <button>s nested inside <a> links (QuotationRequestCard.tsx:200-220)");
});

describe("BookingCard", () => {
  const future = new Date(Date.now() + 7 * 86400000).toISOString();
  const past = new Date(Date.now() - 7 * 86400000).toISOString();
  const booking = (over: any = {}): any => ({
    id: "bk1",
    status: "confirmed",
    paymentStatus: "paid",
    startDate: future,
    endDate: future,
    vehicleName: "Lanka Coach",
    vehicleImage: "/v.png",
    ownerName: "Sunil Silva",
    totalAmount: 75000,
    pickupLocation: { address: "Colombo Fort" },
    dropoffLocation: { address: "Kandy" },
    driverName: "Ravi",
    hasReview: false,
    ...over,
  });

  it("renders the compact variant and opens details", () => {
    const onViewDetails = vi.fn();
    const { rerender, container } = render(<BookingCard booking={booking()} variant="compact" onViewDetails={onViewDetails} />);
    expect(screen.getByAltText("Lanka Coach")).toBeTruthy();
    expect(screen.getByText("Confirmed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(onViewDetails).toHaveBeenCalled();
    rerender(<BookingCard booking={booking({ vehicleImage: null })} variant="compact" />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders the default variant with upcoming actions", () => {
    const onCancel = vi.fn();
    const onContact = vi.fn();
    const onViewDetails = vi.fn();
    render(<BookingCard booking={booking()} onCancel={onCancel} onContact={onContact} onReview={vi.fn()} onViewDetails={onViewDetails} />);
    expect(screen.getByText("Ravi")).toBeTruthy();
    expect(screen.getByText("Colombo Fort")).toBeTruthy();
    expect(screen.getByText("Paid")).toBeTruthy();
    expect(screen.getByText(/75,000/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "messageOwner" }));
    expect(h.push).toHaveBeenCalledWith("/en/dashboard/messages?booking=bk1");
    fireEvent.click(screen.getByRole("button", { name: "contact" }));
    expect(onContact).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onViewDetails).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "leaveReview" })).toBeNull();
  });

  it("offers a review for completed bookings and flags removed owner/vehicle", () => {
    const onReview = vi.fn();
    render(
      <BookingCard
        booking={booking({ status: "completed", startDate: past, endDate: past, vehicleImage: null, driverName: null, ownerRemoved: true, vehicleRemoved: true, pickupLocation: null })}
        onReview={onReview}
        onContact={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("operatorRemoved")).toBeTruthy();
    expect(screen.getByText("vehicleNoLongerListed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "messageOwner" })).toBeNull();
    expect(screen.queryByRole("button", { name: "contact" })).toBeNull();
    expect(screen.queryByRole("button", { name: "cancel" })).toBeNull();
    expect(screen.queryByText("driver")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "leaveReview" }));
    expect(onReview).toHaveBeenCalled();
  });

  it("hides actions when requested and for past/reviewed bookings", () => {
    const { rerender } = render(<BookingCard booking={booking()} showActions={false} onCancel={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<BookingCard booking={booking({ status: "pending", startDate: past, ownerRemoved: true })} onCancel={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "cancel" })).toBeNull();
    rerender(<BookingCard booking={booking({ status: "completed", hasReview: true, vehicleRemoved: true })} onReview={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "leaveReview" })).toBeNull();
    expect(screen.getByText("vehicleNoLongerListed")).toBeTruthy();
  });
});

describe("QuotationRequestForm", () => {
  it("validates required fields including the return date for round trips", async () => {
    const onSubmit = vi.fn();
    const { container } = render(<QuotationRequestForm onSubmit={onSubmit} />);
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(screen.getAllByText("required").length).toBe(8);
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getAllByPlaceholderText("addressPlaceholder")[0], { target: { value: "x" } });
    expect(screen.getAllByText("required").length).toBe(7);
  });

  it("submits a one-way request with all fields and logs a failed submission", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onSubmit = vi.fn().mockResolvedValueOnce({ success: false, error: "Server busy" }).mockResolvedValueOnce({ success: false });
    const onCancel = vi.fn();
    const { container } = render(<QuotationRequestForm onSubmit={onSubmit} onCancel={onCancel} isLoading={false} />);
    const oneWay = screen.getByRole("button", { name: /oneWay/ });
    fireEvent.click(oneWay);
    expect(oneWay.className).toContain("border-primary");
    expect(screen.queryByLabelText("returnDate")).toBeNull();
    const [pickupAddr, dropAddr] = screen.getAllByPlaceholderText("addressPlaceholder");
    const [pickupCity, dropCity] = screen.getAllByPlaceholderText("cityPlaceholder");
    fireEvent.change(pickupAddr, { target: { value: "1 Galle Rd" } });
    fireEvent.change(pickupCity, { target: { value: "Colombo" } });
    fireEvent.change(dropAddr, { target: { value: "Temple St" } });
    fireEvent.change(dropCity, { target: { value: "Kandy" } });
    const districtTriggers = screen.getAllByRole("button", { name: /selectDistrict/ });
    pickListOption(districtTriggers[0], "Colombo");
    pickListOption(screen.getAllByRole("button", { name: /selectDistrict/ })[0], "Kandy");
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: "2026-12-01" } });
    fireEvent.change(container.querySelector('input[type="time"]')!, { target: { value: "08:30" } });
    pickListOption(screen.getByRole("button", { name: /selectVehicleType/ }), "Mini Bus (10-15 seats)");
    const numbers = container.querySelectorAll('input[type="number"]');
    fireEvent.change(numbers[0], { target: { value: "25" } });
    fireEvent.change(numbers[1], { target: { value: "5" } });
    fireEvent.click(container.querySelector('input[type="checkbox"]')!);
    fireEvent.change(screen.getByPlaceholderText("specialRequestsPlaceholder"), { target: { value: "Child seats" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "submitRequest" }));
    });
    expect(onSubmit).toHaveBeenCalledWith({
      isRoundTrip: false,
      passengerCount: 25,
      luggageCount: 5,
      needsAC: false,
      pickupAddress: "1 Galle Rd",
      pickupCity: "Colombo",
      dropoffAddress: "Temple St",
      dropoffCity: "Kandy",
      pickupDistrict: "Colombo",
      dropoffDistrict: "Kandy",
      pickupDate: "2026-12-01",
      pickupTime: "08:30",
      vehicleType: "mini_bus",
      specialRequests: "Child seats",
    });
    expect(errSpy).toHaveBeenCalledWith("Form submission error:", "Server busy");
    fireEvent.change(numbers[0], { target: { value: "" } });
    fireEvent.change(numbers[1], { target: { value: "" } });
    expect((numbers[0] as HTMLInputElement).value).toBe("1");
    expect((numbers[1] as HTMLInputElement).value).toBe("0");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "submitRequest" }));
    });
    expect(errSpy.mock.calls.filter((c: any[]) => c[0] === "Form submission error:").length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(onCancel).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("submits a round trip from initial data with return fields", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    const initial = {
      isRoundTrip: false,
      pickupDistrict: "Colombo",
      pickupAddress: "A",
      dropoffDistrict: "Galle",
      dropoffAddress: "B",
      pickupDate: "2026-12-01",
      pickupTime: "07:00",
      vehicleType: "luxury_bus",
      needsAC: undefined as any,
    };
    const { container } = render(<QuotationRequestForm onSubmit={onSubmit} initialData={initial} isLoading />);
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("Loading...")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /roundTripDesc/ }));
    const dates = container.querySelectorAll('input[type="date"]');
    expect(dates.length).toBe(2);
    expect(dates[1].getAttribute("min")).toBe("2026-12-01");
    fireEvent.change(dates[1], { target: { value: "2026-12-03" } });
    fireEvent.change(container.querySelectorAll('input[type="time"]')[1], { target: { value: "18:00" } });
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ isRoundTrip: true, returnDate: "2026-12-03", returnTime: "18:00" });
  });

  it.todo("date/time pickers stay controlled from first render (QuotationRequestForm.tsx:244-269 pass value={undefined}, React warns 'changing an uncontrolled input to be controlled')");

  it.todo("pickup and dropoff address/city inputs get unique ids so each label targets its own field (QuotationRequestForm.tsx:181-221 derive the same id from identical labels)");
});

describe("ReviewForm", () => {
  const props = () => ({
    bookingId: "bk1",
    vehicleId: "v1",
    vehicleName: "Lanka Coach",
    ownerName: "Sunil",
    onSubmit: vi.fn().mockResolvedValue({ success: true }),
  });

  it("requires all five dimensions before submitting", async () => {
    const p = props();
    const { container } = render(<ReviewForm {...p} />);
    expect(screen.getByText("notRatedYet")).toBeTruthy();
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(screen.getByRole("alert").textContent).toBe("allCategoriesRequired");
    expect(p.onSubmit).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("group", { name: "dimPunctuality" })).getByRole("button", { name: "3 star" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("derives the overall rating, supports hover and submits trimmed fields", async () => {
    const p = props();
    const onSkip = vi.fn();
    const onCancel = vi.fn();
    render(<ReviewForm {...p} onSkip={onSkip} onCancel={onCancel} />);
    const values: Record<string, number> = {
      dimVehicleCondition: 5,
      dimDriverBehavior: 4,
      dimPunctuality: 4,
      dimCleanliness: 5,
      dimValueForMoney: 4,
    };
    for (const [label, v] of Object.entries(values)) {
      const group = screen.getByRole("group", { name: label });
      const star = within(group).getByRole("button", { name: `${v} star` });
      fireEvent.mouseEnter(star);
      expect(star.querySelector("svg")!.getAttribute("class")).toContain("fill-[var(--color-action-primary)]");
      fireEvent.mouseLeave(star);
      fireEvent.click(star);
    }
    expect(screen.getByText("ratingGood")).toBeTruthy();
    expect(screen.getByText("overallRatingHint")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("reviewTitle"), { target: { value: "  Great trip  " } });
    fireEvent.change(screen.getByLabelText("yourComment"), { target: { value: "x".repeat(1200) } });
    expect(screen.getByText("1000/1000").className).toContain("error-text");
    const yes = screen.getByRole("button", { name: "yes" });
    fireEvent.click(screen.getByRole("button", { name: "no" }));
    expect(screen.getByRole("button", { name: "no" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(yes);
    expect(yes.getAttribute("aria-pressed")).toBe("true");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "submitReview" }));
    });
    expect(p.onSubmit).toHaveBeenCalledWith({
      bookingId: "bk1",
      vehicleId: "v1",
      rating: 4,
      title: "Great trip",
      comment: "x".repeat(1000),
      isRecommended: true,
      dimensions: {
        ratingVehicleCondition: 5,
        ratingDriverBehavior: 4,
        ratingPunctuality: 4,
        ratingCleanliness: 5,
        ratingValueForMoney: 4,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "skipReview" }));
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(onSkip).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it("omits blank optional fields and shows server errors", async () => {
    const p = props();
    p.onSubmit.mockResolvedValueOnce({ success: false, error: "Already reviewed" }).mockResolvedValueOnce({ success: false });
    render(<ReviewForm {...p} isLoading />);
    for (const label of ["dimVehicleCondition", "dimDriverBehavior", "dimPunctuality", "dimCleanliness", "dimValueForMoney"]) {
      fireEvent.click(within(screen.getByRole("group", { name: label })).getByRole("button", { name: "1 star" }));
    }
    expect(screen.getByText("ratingTerrible")).toBeTruthy();
    const submit = screen.getByRole("button", { name: "submitting" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    await act(async () => {
      fireEvent.submit(submit.closest("form")!);
    });
    expect(p.onSubmit.mock.calls[0][0]).toMatchObject({ rating: 1, title: undefined, comment: undefined, isRecommended: undefined });
    expect(screen.getByRole("alert").textContent).toBe("Already reviewed");
    await act(async () => {
      fireEvent.submit(submit.closest("form")!);
    });
    expect(screen.getByRole("alert").textContent).toBe("Already reviewed");
  });
});

describe("ReviewDisplay", () => {
  it("renders rating, recommendation, dimensions and owner response", () => {
    const { container } = render(
      <ReviewDisplay
        review={{
          id: "r1",
          rating: 4,
          customerName: "kamal",
          createdAt: "2026-10-01T00:00:00Z",
          title: "Lovely",
          comment: "Clean bus",
          isRecommended: true,
          dimensions: { vehicleCondition: 5, driverBehavior: 4, punctuality: null, cleanliness: undefined, valueForMoney: 3 },
          ownerResponse: "Thank you!",
          ownerResponseDate: "2026-10-02T00:00:00Z",
        }}
      />,
    );
    expect(screen.getByText("K")).toBeTruthy();
    expect(screen.getByLabelText("4 out of 5")).toBeTruthy();
    expect(screen.getByText("recommends")).toBeTruthy();
    expect(screen.getByText("Lovely")).toBeTruthy();
    expect(screen.getByText("Clean bus")).toBeTruthy();
    expect(screen.getByText("dimensionsTitle")).toBeTruthy();
    expect(screen.getByText("5.0")).toBeTruthy();
    expect(screen.queryByText("dimPunctuality")).toBeNull();
    expect((container.querySelector('[style*="width: 60%"]') as HTMLElement)).toBeTruthy();
    expect(screen.getByText("Thank you!")).toBeTruthy();
    expect(screen.getByText(/·/)).toBeTruthy();
  });

  it("hides optional sections", () => {
    const base = { id: "r", rating: 2, customerName: "Ama", createdAt: "2026-10-01T00:00:00Z" };
    const { rerender } = render(
      <ReviewDisplay review={{ ...base, isRecommended: false, dimensions: { punctuality: null }, ownerResponse: "Sorry" }} showOwnerResponse={false} />,
    );
    expect(screen.getByText("notRecommends")).toBeTruthy();
    expect(screen.queryByText("dimensionsTitle")).toBeNull();
    expect(screen.queryByText("Sorry")).toBeNull();
    rerender(<ReviewDisplay review={{ ...base, isRecommended: null, dimensions: null, ownerResponse: "Sorry", ownerResponseDate: null }} />);
    expect(screen.queryByText("recommends")).toBeNull();
    expect(screen.getByText("Sorry")).toBeTruthy();
    expect(screen.queryByText(/·/)).toBeNull();
  });
});

describe("TripPackageForm", () => {
  const vehicles: any[] = [{ id: "v1", name: "Lanka Coach", seats: 45 }];

  it("validates every field", async () => {
    const onSubmit = vi.fn();
    const { container } = render(<TripPackageForm vehicles={vehicles} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Duration (days)"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Minimum Passengers"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Maximum Passengers"), { target: { value: "-1" } });
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    for (const msg of [
      "Title is required",
      "Start location is required",
      "End location is required",
      "Duration must be at least 1 day",
      "Price must be positive",
      "Minimum passengers required",
      "Max passengers must be >= min passengers",
    ]) {
      expect(screen.getByText(msg)).toBeTruthy();
    }
    expect(screen.getAllByText("Select a vehicle").length).toBeGreaterThan(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a valid package with numeric coercion", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<TripPackageForm vehicles={vehicles} onSubmit={onSubmit} />);
    pickListOption(screen.getByRole("button", { name: /Select a vehicle/ }), "Lanka Coach (45 seats)");
    fireEvent.change(screen.getByLabelText("Package Title"), { target: { value: "Hill Tour" } });
    fireEvent.change(screen.getByLabelText("Start Location"), { target: { value: "Colombo" } });
    fireEvent.change(screen.getByLabelText("End Location"), { target: { value: "Ella" } });
    fireEvent.change(screen.getByLabelText("Duration (days)"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Package Price (LKR)"), { target: { value: "150000" } });
    fireEvent.change(screen.getByLabelText("Minimum Passengers"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Maximum Passengers"), { target: { value: "40" } });
    fireEvent.click(container.querySelector('input[type="checkbox"]')!);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save Package" }));
    });
    expect(onSubmit).toHaveBeenCalledWith({
      vehicleId: "v1",
      title: "Hill Tour",
      description: undefined,
      startLocation: "Colombo",
      endLocation: "Ella",
      durationDays: 3,
      price: 150000,
      minPassengers: 10,
      maxPassengers: 40,
      isActive: false,
    });
  });

  it("prefills from initial data and keeps the description", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <TripPackageForm
        vehicles={vehicles}
        isLoading
        onSubmit={onSubmit}
        initialData={{ vehicleId: "v1", title: "T", description: "Itinerary", startLocation: "A", endLocation: "B", durationDays: 2, price: 500, minPassengers: 2, maxPassengers: 5, isActive: false } as any}
      />,
    );
    expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe("Itinerary");
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Updated" } });
    expect(screen.getByText("Loading...")).toBeTruthy();
    await act(async () => {
      fireEvent.submit(screen.getByText("Loading...").closest("form")!);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ description: "Updated", isActive: false, price: 500 });
  });

  it.todo("TripPackageForm user-facing strings are translated via next-intl (TripPackageForm.tsx hardcodes English labels and validation messages)");
});
