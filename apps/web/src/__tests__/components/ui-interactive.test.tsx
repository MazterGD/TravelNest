/**
 * Component tests for interactive UI building blocks: Modal, ConfirmDialog,
 * OtpVerificationModal, Select, Tabs/TabsList, StarRating, QuickActionCard,
 * date/time pickers, LocationAutocomplete, EmptyState,
 * Skeletons, FeatureCard, StepCard, InfoItem and the Icons set.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { OtpVerificationModal } from "@/components/ui/OtpVerificationModal";
import { Select } from "@/components/ui/Select";
import { Tabs, TabsList } from "@/components/ui/Tabs";
import { StarRating } from "@/components/ui/StarRating";
import { DatePicker, DateTimePicker, TimePicker } from "@/components/ui/DatePicker";
import { LocationAutocomplete } from "@/components/ui/LocationAutocomplete";
import {
  EmptyBoxIcon,
  EmptyCalendarIcon,
  EmptyDocumentIcon,
  EmptyNotificationIcon,
  EmptySearchIcon,
  EmptyState,
} from "@/components/ui/EmptyState";
import {
  Skeleton,
  SkeletonCard,
  SkeletonDashboard,
  SkeletonList,
  SkeletonProfile,
  SkeletonTable,
} from "@/components/ui/Skeleton";
import { Icons, StarIcon } from "@/components/ui/Icons";

const IconCmp = ({ className }: { className?: string }) => (
  <svg data-testid="icon-cmp" className={className} />
);

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()}>
        Hidden
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("unset");
  });

  it("renders a labelled dialog in a portal, focuses it and locks scroll", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Hello" size="xl" className="mc">
        Body
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("modal-title");
    expect(screen.getByRole("heading", { name: "Hello" }).id).toBe("modal-title");
    expect(document.activeElement?.className).toContain("max-w-xl");
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "closeModal" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and overlay click", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose}>
        Body
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    const overlay = screen.getByRole("dialog").querySelector('[aria-hidden="true"]')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("dialog").getAttribute("aria-labelledby")).toBeNull();
    expect(screen.getByRole("button", { name: "closeModal" }).className).toContain("ml-auto");
  });

  it("ignores overlay click when disabled and hides header without title/close", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} showCloseButton={false} closeOnOverlayClick={false}>
        Body
      </Modal>,
    );
    fireEvent.click(screen.getByRole("dialog").querySelector('[aria-hidden="true"]')!);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("restores body scroll on unmount", () => {
    const { unmount } = render(
      <Modal isOpen onClose={vi.fn()}>
        x
      </Modal>,
    );
    unmount();
    expect(document.body.style.overflow).toBe("unset");
  });
});

describe("ConfirmDialog", () => {
  it("uses translated defaults and confirms then closes", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <ConfirmDialog
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete?"
        message="This cannot be undone"
      />,
    );
    expect(screen.getByText("Delete?")).toBeTruthy();
    expect(screen.getByText("This cannot be undone")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    const confirm = screen.getByRole("button", { name: "confirm" });
    expect(confirm.className).toContain("bg-error");
    fireEvent.click(confirm);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("shows processing state, disables buttons and does not auto-close", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        isOpen
        isLoading
        variant="warning"
        onClose={onClose}
        onConfirm={onConfirm}
        title="T"
        message="M"
        confirmText="Yes"
        cancelText="No"
      />,
    );
    expect(screen.getByText("processing")).toBeTruthy();
    const buttons = screen.getAllByRole("button") as HTMLButtonElement[];
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(screen.getByText("No")).toBeTruthy();
    fireEvent.click(screen.getByRole("dialog").querySelector('[aria-hidden="true"]')!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders info variant with custom labels", () => {
    render(
      <ConfirmDialog
        isOpen
        variant="info"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="T"
        message="M"
        confirmText="OK"
      />,
    );
    expect(screen.getByRole("button", { name: "OK" }).className).toContain("bg-primary");
  });
});

describe("OtpVerificationModal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (over: Partial<Parameters<typeof OtpVerificationModal>[0]> = {}) => {
    const props = {
      isOpen: true,
      destination: "a@b.lk",
      onClose: vi.fn(),
      onVerify: vi.fn().mockResolvedValue(undefined),
      onResend: vi.fn().mockResolvedValue(undefined),
      ...over,
    };
    const utils = render(<OtpVerificationModal {...props} />);
    return { ...utils, props };
  };

  it("shows default copy, strips non-digits and validates length", async () => {
    const { props } = setup();
    expect(screen.getByText("Verify Your Account")).toBeTruthy();
    expect(screen.getByText("Enter the 6-digit code sent to a@b.lk.")).toBeTruthy();
    const input = screen.getByLabelText("OTP Code") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12a3" } });
    expect(input.value).toBe("123");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    });
    expect(screen.getByText("Please enter a valid 6-digit code.")).toBeTruthy();
    expect(props.onVerify).not.toHaveBeenCalled();
  });

  it("submits a full code and surfaces Error messages", async () => {
    const onVerify = vi.fn().mockRejectedValueOnce(new Error("Code expired"));
    setup({ onVerify });
    fireEvent.change(screen.getByLabelText("OTP Code"), {
      target: { value: "1234567" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    });
    expect(onVerify).toHaveBeenCalledWith("123456");
    expect(screen.getByText("Code expired")).toBeTruthy();
  });

  it("uses a fallback message for non-Error verify failures", async () => {
    setup({ onVerify: vi.fn().mockRejectedValue("nope"), subtitle: "Custom sub" });
    expect(screen.getByText("Custom sub")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("OTP Code"), { target: { value: "000000" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    });
    expect(screen.getByText("Invalid or expired code. Please try again.")).toBeTruthy();
  });

  it("counts down the resend cooldown and resends", async () => {
    const onResend = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Too many"))
      .mockRejectedValueOnce(42);
    setup({ onResend, title: "Check email" });
    expect(screen.getByText("Check email")).toBeTruthy();
    const resend = () => screen.getByRole("button", { name: /Resend/ }) as HTMLButtonElement;
    expect(resend().textContent).toBe("Resend in 60s");
    expect(resend().disabled).toBe(true);
    act(() => {
      vi.advanceTimersByTime(61000);
    });
    expect(resend().textContent).toBe("Resend code");
    await act(async () => {
      fireEvent.click(resend());
    });
    expect(onResend).toHaveBeenCalledTimes(1);
    expect(resend().textContent).toBe("Resend in 60s");
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    await act(async () => {
      fireEvent.click(resend());
    });
    expect(screen.getByText("Too many")).toBeTruthy();
    await act(async () => {
      fireEvent.click(resend());
    });
    expect(screen.getByText("Failed to resend code. Please try again.")).toBeTruthy();
  });

  it("disables resend while sending and resets state when closed", () => {
    const { rerender, props } = setup({ isSending: true });
    act(() => {
      vi.advanceTimersByTime(61000);
    });
    expect(
      (screen.getByRole("button", { name: "Resend code" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("OTP Code"), { target: { value: "12" } });
    rerender(<OtpVerificationModal {...props} isSending={false} isOpen={false} />);
    rerender(<OtpVerificationModal {...props} isSending={false} isOpen />);
    expect((screen.getByLabelText("OTP Code") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: /Resend in 60s/ })).toBeTruthy();
  });

  it("shows a loading verify button", () => {
    setup({ isVerifying: true });
    expect(screen.getByText("Loading...")).toBeTruthy();
  });
});

describe("Select", () => {
  const listOption = (name: string) =>
    screen.getAllByRole("option", { name }).find((el) => el.tagName === "BUTTON")!;
  const options = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
    { value: "c", label: "Gamma", disabled: true },
  ];

  it("opens, selects (uncontrolled) and fires onChange", () => {
    const onChange = vi.fn();
    render(<Select id="s" label="Pick" options={options} onChange={onChange} required />);
    const trigger = screen.getByRole("button", { name: /Select an option/ });
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(listOption("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger.textContent).toContain("Beta");
    expect((screen.getByLabelText("Pick") as HTMLSelectElement).required).toBe(false);
    fireEvent.click(trigger);
    expect(listOption("Beta").getAttribute("aria-selected")).toBe("true");
  });

  it("ignores disabled options and closes on outside click", () => {
    const onChange = vi.fn();
    render(<Select options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(listOption("Gamma"));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("supports controlled value, native change and error", () => {
    const onChange = vi.fn();
    const { container } = render(
      <Select options={options} value="a" onChange={onChange} error="Required" placeholder="Choose" />,
    );
    expect(screen.getByRole("button").textContent).toContain("Alpha");
    expect(screen.getByText("Required")).toBeTruthy();
    fireEvent.change(container.querySelector("select")!, { target: { value: "b" } });
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.getByRole("button").textContent).toContain("Alpha");
  });

  it("does not open when disabled", () => {
    render(<Select options={options} disabled />);
    const trigger = screen.getByRole("button") as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("shows its focus ring only for keyboard focus", () => {
    render(<Select options={options} error="Required" />);

    const trigger = screen.getByRole("button");
    expect(trigger.className).toContain("focus-visible:ring-2");
    expect(trigger.className).not.toMatch(/(^|\s)focus:/);
  });
});

describe("Tabs", () => {
  const tabs = [
    { id: "one", label: "One", content: <p>First</p>, badge: 3, icon: <i data-testid="ti" /> },
    { id: "two", label: "Two", content: <p>Second</p>, badge: "new" },
    { id: "three", label: "Three", content: <p>Third</p>, disabled: true },
  ];

  it("defaults to the first tab and switches on click", () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} onChange={onChange} className="c" tabsClassName="tc" contentClassName="cc" />);
    expect(screen.getByRole("tablist").className).toContain("tc");
    const [one, two, three] = screen.getAllByRole("tab");
    expect(one.getAttribute("aria-selected")).toBe("true");
    expect(one.getAttribute("aria-controls")).toBe("tabpanel-one");
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByTestId("ti")).toBeTruthy();
    fireEvent.click(two);
    expect(onChange).toHaveBeenCalledWith("two");
    expect(two.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").id).toBe("tabpanel-two");
    expect(screen.getByText("Second")).toBeTruthy();
    expect((three as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["pills", "underline"] as const)("renders the %s variant with defaultTab", (variant: any) => {
    render(<Tabs tabs={tabs} defaultTab="two" variant={variant} />);
    expect(screen.getByText("Second")).toBeTruthy();
    expect(screen.getByText("new").className).toContain("text-primary");
    expect(screen.getByText("3").className).toContain("bg-muted");
  });

  it("labels the panel with its tab", () => {
    render(<Tabs tabs={tabs} />);

    const panel = screen.getByRole("tabpanel");
    const tab = document.getElementById(panel.getAttribute("aria-labelledby")!);
    expect(tab?.getAttribute("role")).toBe("tab");
    expect(tab?.getAttribute("aria-selected")).toBe("true");
  });

  it.each(["default", "pills", "underline"] as const)("TabsList (%s) is controlled", (variant: any) => {
    const onTabChange = vi.fn();
    render(<TabsList activeTab="b" onTabChange={onTabChange} variant={variant} className="x" tabs={[
      { id: "a", label: "A", badge: 1 },
      { id: "b", label: "B", badge: 2 },
      { id: "c", label: "C", disabled: true },
    ]} />);
    const [a, b] = screen.getAllByRole("tab");
    expect(b.getAttribute("aria-selected")).toBe("true");
    expect(a.getAttribute("aria-selected")).toBe("false");
    expect(a.className).toContain("text-muted-foreground");
    fireEvent.click(a);
    expect(onTabChange).toHaveBeenCalledWith("a");
  });
});

describe("StarRating", () => {
  it("renders display stars, value and label", () => {
    const { container } = render(<StarRating rating={3.5} showValue label="(12)" size="xs" />);
    const stars = container.querySelectorAll("svg");
    expect(stars.length).toBe(5);
    const filled = Array.from(stars).filter((s) => s.getAttribute("class")?.includes("fill-yellow-400"));
    expect(filled.length).toBe(4);
    expect(screen.getByText("3.5")).toBeTruthy();
    expect(screen.getByText("(12)")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("handles interactive click and hover", () => {
    const onChange = vi.fn();
    const onHoverChange = vi.fn();
    const { container } = render(
      <StarRating rating={1} interactive hoverRating={4} onChange={onChange} onHoverChange={onHoverChange} maxRating={6} size="lg" />,
    );
    const star3 = screen.getByRole("button", { name: "Rate 3 out of 6" });
    fireEvent.click(star3);
    expect(onChange).toHaveBeenCalledWith(3);
    fireEvent.mouseEnter(star3);
    expect(onHoverChange).toHaveBeenCalledWith(3);
    fireEvent.mouseLeave(star3);
    expect(onHoverChange).toHaveBeenLastCalledWith(0);
    const filled = Array.from(container.querySelectorAll("svg")).filter((s) =>
      s.getAttribute("class")?.includes("fill-yellow-400"),
    );
    expect(filled.length).toBe(4);
  });

  it("does nothing without handlers and stays static when readOnly", () => {
    const { rerender } = render(<StarRating rating={2} interactive size="sm" />);
    const btn = screen.getAllByRole("button")[0];
    fireEvent.click(btn);
    fireEvent.mouseEnter(btn);
    fireEvent.mouseLeave(btn);
    rerender(<StarRating rating={2} interactive readOnly onChange={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("gives interactive stars a keyboard focus ring", () => {
    render(<StarRating rating={2} interactive onChange={vi.fn()} />);

    for (const star of screen.getAllByRole("button")) {
      expect(star.className).toContain("focus-visible:ring-2");
      expect(star.className).not.toMatch(/(^|\s)focus:/);
    }
  });
});

describe("DatePicker family", () => {
  it.each([
    [DatePicker, "date"],
    [TimePicker, "time"],
    [DateTimePicker, "datetime-local"],
  ] as const)("%o renders type %s with label, helper and error", (Cmp: any, type: any) => {
    const { rerender } = render(<Cmp id="d" label="When" helperText="Pick one" />);
    const input = screen.getByLabelText("When");
    expect(input.getAttribute("type")).toBe(type);
    expect(screen.getByText("Pick one")).toBeTruthy();
    rerender(<Cmp id="d" error="Bad date" helperText="Pick one" />);
    expect(screen.getByText("Bad date")).toBeTruthy();
    expect(screen.queryByText("Pick one")).toBeNull();
    expect(screen.queryByText("When")).toBeNull();
  });

  it.each([DatePicker, TimePicker, DateTimePicker])("%o uses a keyboard focus ring", (Cmp: any) => {
    render(<Cmp id="d" label="When" error="Bad" />);

    const input = screen.getByLabelText("When");
    expect(input.className).toContain("focus-visible:ring-2");
    expect(input.className).not.toMatch(/(^|\s)focus:/);
  });
});

describe("LocationAutocomplete", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("debounces a Nominatim lookup and selects a suggestion", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => [
        { lat: "6.9", lon: "79.8", display_name: "Colombo, Western", address: { city: "Colombo", state_district: "Colombo District" } },
        { lat: "7.2", lon: "80.6", display_name: "Kandy, Central", address: { village: "Kandy", county: "Kandy" } },
        { lat: "8", lon: "81", display_name: "Nowhere", address: undefined },
        { lat: "9", lon: "80", display_name: "Town X", address: { town: "TX", state: "North" } },
        { lat: "9", lon: "80", display_name: "Sub Y", address: { suburb: "SY" } },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();
    const onSelect = vi.fn();
    const { rerender } = render(
      <LocationAutocomplete value="" onChange={onChange} onSelectLocation={onSelect} />,
    );
    fireEvent.change(screen.getByPlaceholderText("Search location..."), { target: { value: "Col" } });
    expect(onChange).toHaveBeenCalledWith("Col");
    rerender(<LocationAutocomplete value="Colombo" onChange={onChange} onSelectLocation={onSelect} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(fetchMock.mock.calls[0][0]).toContain("q=Colombo");
    expect(fetchMock.mock.calls[0][0]).toContain("countrycodes=lk");
    fireEvent.click(screen.getByText("Colombo, Western").closest("button")!);
    expect(onSelect).toHaveBeenCalledWith({
      lat: 6.9,
      lng: 79.8,
      displayName: "Colombo, Western",
      city: "Colombo",
      district: "Colombo District",
    });
    expect(screen.queryByText("Kandy, Central")).toBeNull();
  });

  it("hides suggestions on outside click and logs fetch failures", async () => {
    vi.useFakeTimers();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => [{ lat: "1", lon: "2", display_name: "Galle, South", address: {} }] })
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(
      <LocationAutocomplete value="Galle" onChange={vi.fn()} onSelectLocation={vi.fn()} placeholder="Where" disabled={false} />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(screen.getByText("Galle, South")).toBeTruthy();
    fireEvent.mouseDown(screen.getByPlaceholderText("Where"));
    expect(screen.getByText("Galle, South")).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Galle, South")).toBeNull();
    rerender(<LocationAutocomplete value="Galle Fort" onChange={vi.fn()} onSelectLocation={vi.fn()} placeholder="Where" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(errSpy).toHaveBeenCalledWith("Geocoding failed", expect.any(Error));
    rerender(<LocationAutocomplete value="Ga" onChange={vi.fn()} onSelectLocation={vi.fn()} placeholder="Where" disabled />);
    expect((screen.getByPlaceholderText("Where") as HTMLInputElement).disabled).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    errSpy.mockRestore();
  });
});

describe("EmptyState and icons", () => {
  it("renders icon, title, description and action", () => {
    render(
      <EmptyState icon={<EmptyBoxIcon className="ic" />} title="Nothing yet" description="Start a trip" action={<button>Go</button>} className="e" />,
    );
    expect(screen.getByRole("heading", { name: "Nothing yet" })).toBeTruthy();
    expect(screen.getByText("Start a trip")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go" })).toBeTruthy();
  });

  it("renders minimal empty state and all icons", () => {
    const { container } = render(
      <>
        <EmptyState title="Only title" />
        <EmptyDocumentIcon />
        <EmptySearchIcon />
        <EmptyCalendarIcon />
        <EmptyNotificationIcon className="n" />
      </>,
    );
    expect(container.querySelectorAll("p").length).toBe(0);
    expect(container.querySelectorAll("svg").length).toBe(4);
  });
});

describe("Skeletons", () => {
  it("applies variant and animation classes", () => {
    const { container } = render(
      <>
        <Skeleton />
        <Skeleton variant="circular" animation="wave" />
        <Skeleton variant="rectangular" animation="none" />
      </>,
    );
    const [a, b, c] = Array.from(container.children);
    expect(a.className).toContain("animate-pulse");
    expect(a.className).toContain("h-4");
    expect(b.className).toContain("animate-shimmer");
    expect(b.className).toContain("rounded-full");
    expect(c.className).toContain("rounded-lg");
    expect(c.className).not.toContain("animate-pulse");
  });

  it("renders presets with requested counts", () => {
    const { container } = render(<SkeletonList count={2} />);
    expect(container.firstElementChild?.children.length).toBe(2);
    const t = render(<SkeletonTable rows={3} cols={2} />);
    expect(t.container.firstElementChild?.children.length).toBe(4);
    render(<SkeletonList />);
    render(<SkeletonTable />);
    const p = render(<SkeletonProfile className="p" />);
    expect(p.container.firstElementChild?.className).toContain("p");
    const d = render(<SkeletonDashboard />);
    expect(d.container.querySelectorAll(".rounded-xl").length).toBeGreaterThan(4);
    render(<SkeletonCard className="k" />);
  });
});

describe("Icons", () => {
  it("renders every icon at every size", () => {
    const sizes = ["xs", "sm", "md", "lg", "xl"] as const;
    for (const [name, Icon] of Object.entries(Icons)) {
      for (const size of sizes) {
        const { container, unmount } = render(<Icon size={size} className={`i-${name}`} strokeWidth={1} />);
        expect(container.querySelector("svg")?.getAttribute("class")).toContain(`i-${name}`);
        unmount();
      }
      const { unmount } = render(<Icon />);
      unmount();
    }
  });

  it("StarIcon can be filled", () => {
    const { container } = render(<StarIcon filled />);
    expect(container.querySelector("svg")?.getAttribute("fill")).toBe("currentColor");
  });
});
