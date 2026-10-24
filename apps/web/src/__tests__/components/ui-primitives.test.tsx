/**
 * Component tests for the basic UI primitives: Button, CTAButton, Input,
 * TextArea, Accordion, PageHeader, LoadingSpinner, Card family, StatCard,
 * Avatar/AvatarGroup and Badge/StatusBadge.
 */
import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : href?.pathname} {...rest}>
      {children}
    </a>
  ),
}));

import { Button } from "@/components/ui/Button";
import { CTAButton } from "@/components/ui/CTAButton";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Avatar, AvatarGroup } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";

describe("Button", () => {
  it("renders children with primary/md defaults and forwards ref + click", () => {
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn();
    render(
      <Button ref={ref} onClick={onClick}>
        Save
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Save" });
    expect(ref.current).toBe(btn);
    expect(btn.className).toContain("bg-primary");
    expect(btn.className).toContain("h-11");
    expect(btn.className).toContain("focus-visible:ring-2");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["secondary", "sm", "h-10"],
    ["outline", "lg", "h-[52px]"],
    ["ghost", "md", "hover:bg-muted"],
    ["link", "md", "underline-offset-4"],
  ] as const)("applies %s variant with %s size", (variant: any, size: any, cls: any) => {
    render(
      <Button variant={variant} size={size} className="extra">
        X
      </Button>,
    );
    const btn = screen.getByRole("button");
    expect(btn.className).toContain(cls);
    expect(btn.className).toContain("extra");
  });

  it("shows a loading label and disables while loading", () => {
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick}>
        Submit
      </Button>,
    );
    const btn = screen.getByRole("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain("Loading...");
    expect(btn.textContent).not.toContain("Submit");
  });

  it("respects the disabled prop", () => {
    render(<Button disabled>Off</Button>);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("CTAButton", () => {
  it("renders as plain styled text inside cards that are already links", () => {
    const { container } = render(<CTAButton asSpan size="sm">View</CTAButton>);

    expect(screen.queryByRole("button")).toBeNull();
    expect(container.firstElementChild!.tagName).toBe("SPAN");
    expect(screen.getByText("View")).toBeTruthy();
  });

  it("renders a native type=button by default with icons", () => {
    const onClick = vi.fn();
    render(
      <CTAButton
        onClick={onClick}
        leftIcon={<i data-testid="left" />}
        rightIcon={<i data-testid="right" />}
      >
        Go
      </CTAButton>,
    );
    const btn = screen.getByRole("button", { name: "Go" });
    expect(btn.getAttribute("type")).toBe("button");
    expect(screen.getByTestId("left")).toBeTruthy();
    expect(screen.getByTestId("right").parentElement?.className).toContain(
      "group-hover:translate-x-1",
    );
    expect(btn.className).toContain("focus-visible:ring-offset-background");
    expect(btn.className).not.toContain("w-full");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it("renders a link when href is given and supports secondary/lg/fullWidth", () => {
    render(
      <CTAButton
        href="/search"
        variant="secondary"
        size="lg"
        fullWidth
        ringOffsetClassName="ring-off-x"
      >
        Search
      </CTAButton>,
    );
    const link = screen.getByRole("link", { name: "Search" });
    expect(link.getAttribute("href")).toBe("/search");
    expect(link.className).toContain("w-full");
    expect(link.className).toContain("min-h-[52px]");
    expect(link.className).toContain("bg-white");
    expect(link.className).toContain("ring-off-x");
  });

  it("supports sm size and submit type without a right icon", () => {
    render(
      <CTAButton size="sm" type="submit">
        Send
      </CTAButton>,
    );
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("type")).toBe("submit");
    expect(btn.className).toContain("px-4");
    expect(btn.querySelectorAll("span").length).toBe(1);
  });
});

describe("Input", () => {
  it("links each label to its own input and shows helper text", () => {
    render(
      <>
        <Input label="Address" helperText="As on NIC" />
        <Input label="Address" />
      </>,
    );
    const [first, second] = screen.getAllByLabelText("Address");
    expect(first.id).not.toBe(second.id);
    expect(screen.getByText("As on NIC")).toBeTruthy();
  });

  it("shows error instead of helper text and styles the border", () => {
    render(
      <Input id="em" label="Email" error="Required" helperText="hidden" />,
    );
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("id")).toBe("em");
    expect(input.className).toContain("border-error");
    expect(screen.getByText("Required")).toBeTruthy();
    expect(screen.queryByText("hidden")).toBeNull();
  });

  it("places a left icon with left padding", () => {
    render(<Input icon={<i data-testid="ic" />} placeholder="p" />);
    expect(screen.getByPlaceholderText("p").className).toContain("pl-10");
    expect(screen.getByTestId("ic")).toBeTruthy();
  });

  it("places a right icon with right padding and forwards ref/onChange", () => {
    const ref = createRef<HTMLInputElement>();
    const onChange = vi.fn();
    render(
      <Input
        ref={ref}
        icon={<i data-testid="ic" />}
        iconPosition="right"
        placeholder="p"
        onChange={onChange}
      />,
    );
    const input = screen.getByPlaceholderText("p");
    expect(input.className).toContain("pr-10");
    expect(ref.current).toBe(input);
    fireEvent.change(input, { target: { value: "x" } });
    expect(onChange).toHaveBeenCalled();
  });
});

describe("TextArea", () => {
  it("links label and shows helper text", () => {
    render(<TextArea label="Special Notes" helperText="Optional" />);
    expect(screen.getByLabelText("Special Notes").getAttribute("id")).toBe(
      "special-notes",
    );
    expect(screen.getByText("Optional")).toBeTruthy();
  });

  it("shows errors and hides helper text", () => {
    render(<TextArea id="t" error="Too long" helperText="help" />);
    expect(screen.getByRole("textbox").className).toContain("border-error");
    expect(screen.getByText("Too long")).toBeTruthy();
    expect(screen.queryByText("help")).toBeNull();
  });
});

describe("Accordion", () => {
  it("toggles aria-expanded and content visibility class", () => {
    render(
      <Accordion className="acc">
        <AccordionItem title="Q1">Answer 1</AccordionItem>
      </Accordion>,
    );
    const btn = screen.getByRole("button", { name: "Q1" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    const panel = screen.getByText("Answer 1").parentElement!;
    expect(panel.className).toContain("max-h-0");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(panel.className).toContain("max-h-96");
    expect(btn.parentElement?.parentElement?.className).toContain("acc");
  });

  it("can start open", () => {
    render(
      <AccordionItem title="Q2" defaultOpen>
        A2
      </AccordionItem>,
    );
    expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe("true");
  });
});

describe("PageHeader", () => {
  it("renders title, subtitle and action", () => {
    render(
      <PageHeader title="Bookings" subtitle="All trips" action={<button>Add</button>} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Bookings" })).toBeTruthy();
    expect(screen.getByText("All trips")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
  });

  it("falls back to description and omits empty sections", () => {
    const { container, rerender } = render(
      <PageHeader title="T" description="Desc" />,
    );
    expect(screen.getByText("Desc")).toBeTruthy();
    rerender(<PageHeader title="T" />);
    expect(container.querySelector("p")).toBeNull();
  });
});

describe("LoadingSpinner", () => {
  it.each([
    [undefined, "h-6"],
    ["sm", "h-4"],
    ["lg", "h-10"],
    ["xl", "h-16"],
  ] as const)("size %s renders %s", (size: any, cls: any) => {
    const { container } = render(
      <LoadingSpinner size={size as any} className="wrap" />,
    );
    expect(container.firstElementChild?.className).toContain("wrap");
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(cls);
  });
});

describe("Card", () => {
  it("renders a div without onClick and a button with onClick", () => {
    const onClick = vi.fn();
    const { container, rerender } = render(<Card hover>Body</Card>);
    expect(container.firstElementChild?.tagName).toBe("DIV");
    expect(container.firstElementChild?.className).toContain("hover:-translate-y-1");
    rerender(<Card onClick={onClick}>Body</Card>);
    const btn = screen.getByRole("button", { name: "Body" });
    expect(btn.className).toContain("cursor-pointer");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it("renders the subcomponents", () => {
    render(
      <Card>
        <CardHeader className="h">
          <CardTitle>Default Title</CardTitle>
          <CardTitle as="h2">H2 Title</CardTitle>
          <CardDescription>Desc</CardDescription>
        </CardHeader>
        <CardContent className="c">Content</CardContent>
        <CardFooter className="f">Footer</CardFooter>
      </Card>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Default Title" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "H2 Title" })).toBeTruthy();
    expect(screen.getByText("Desc").tagName).toBe("P");
    expect(screen.getByText("Content").className).toBe("c");
    expect(screen.getByText("Footer").className).toContain("border-t");
  });
});

describe("StatCard", () => {
  it("renders value/label/subStat and a positive trend", () => {
    render(
      <StatCard
        value={42}
        label="Trips"
        icon={<i data-testid="icon" />}
        variant="success"
        subStat="this month"
        trend={{ value: 12, isPositive: true }}
      />,
    );
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("Trips")).toBeTruthy();
    expect(screen.getByText("this month")).toBeTruthy();
    expect(screen.getByText(/↑\s*12%/)).toBeTruthy();
    expect(screen.getByTestId("icon").parentElement?.parentElement?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders negative trend as absolute and is clickable", () => {
    const onClick = vi.fn();
    render(
      <StatCard
        value="LKR 5"
        label="Revenue"
        icon={null}
        variant="error"
        trend={{ value: -7, isPositive: false }}
        onClick={onClick}
      />,
    );
    expect(screen.getByText(/↓\s*7%/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
  });

  it.each(["primary", "warning", "info"] as const)("supports %s variant", (v: any) => {
    render(<StatCard value={1} label="L" icon={<b>i</b>} variant={v} />);
    expect(screen.getByText("L")).toBeTruthy();
  });
});

describe("Avatar", () => {
  it("renders an image when src is set", () => {
    render(<Avatar src="/a.png" alt="Nimal" size="xl" />);
    expect(screen.getByRole("img", { name: "Nimal" }).getAttribute("src")).toBe("/a.png");
  });

  it("renders two-letter initials from a name", () => {
    render(<Avatar name="nimal perera silva" size="xs" />);
    expect(screen.getByText("NP")).toBeTruthy();
  });

  it("renders ? when no name or src", () => {
    render(<Avatar src={null} />);
    expect(screen.getByText("?").className).toContain("bg-muted");
  });

  it("groups avatars and shows overflow count", () => {
    render(
      <AvatarGroup
        max={2}
        size="sm"
        avatars={[{ name: "A B" }, { src: "/x.png" }, { name: "C D" }, { name: "E" }]}
      />,
    );
    expect(screen.getByText("AB")).toBeTruthy();
    expect(screen.getByRole("img")).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("omits the overflow when within the max", () => {
    render(<AvatarGroup avatars={[{ name: "Kamal" }]} />);
    expect(screen.queryByText(/^\+/)).toBeNull();
    expect(screen.getByText("K")).toBeTruthy();
  });
});

describe("Badge", () => {
  it("renders default variant without dot", () => {
    const { container } = render(<Badge>New</Badge>);
    expect(container.firstElementChild?.className).toContain("bg-primary");
    expect(container.querySelectorAll("span").length).toBe(1);
  });

  it("renders a dot and size/variant classes", () => {
    const { container } = render(
      <Badge variant="danger" size="lg" dot className="x">
        Bad
      </Badge>,
    );
    expect(container.firstElementChild?.className).toContain("px-3");
    expect(container.querySelector("span span")?.className).toContain("bg-error");
  });

  it.each([
    ["PENDING", "Pending"],
    ["in_progress", "In Progress"],
    ["refunded", "Refunded"],
    ["verified", "Verified"],
    ["inactive", "Inactive"],
  ])("StatusBadge maps %s to %s", (status: any, label: any) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("StatusBadge falls back to the raw status", () => {
    render(<StatusBadge status="WEIRD" className="sb" />);
    const el = screen.getByText("WEIRD");
    expect(el.className).toContain("sb");
    expect(el.className).toContain("bg-muted");
  });
});
