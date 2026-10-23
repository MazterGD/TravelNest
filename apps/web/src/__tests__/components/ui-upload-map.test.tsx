/**
 * Component tests for FileUpload / DocumentUploadGroup and the Leaflet-backed
 * InteractiveMap (react-leaflet stubbed) plus its SSR-less DynamicMap wrapper.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mapHandlers: {} as Record<string, (e: any) => void>,
  fitBounds: vi.fn(),
  apiPost: vi.fn(),
  dynamicLoader: null as null | (() => Promise<any>),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => "en",
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: any) => <div data-testid="map">{children}</div>,
  TileLayer: () => <div data-testid="tiles" />,
  Marker: ({ position, icon }: any) => (
    <div data-testid="marker" data-pos={position.join(",")} data-html={icon?.options?.html} />
  ),
  Polyline: ({ positions }: any) => (
    <div data-testid="polyline" data-count={positions.length} />
  ),
  useMapEvents: (handlers: any) => {
    Object.assign(h.mapHandlers, handlers);
    return null;
  },
  useMap: () => ({ fitBounds: h.fitBounds }),
}));
vi.mock("leaflet", () => ({
  default: { divIcon: (opts: any) => ({ options: opts }) },
}));
vi.mock("leaflet/dist/leaflet.css", () => ({}));
vi.mock("leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css", () => ({}));
vi.mock("leaflet-defaulticon-compatibility", () => ({}));
vi.mock("@/lib/api", () => ({ api: { post: h.apiPost } }));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<any>, opts: any) => {
    h.dynamicLoader = loader;
    return () => opts.loading();
  },
}));

import { DocumentUploadGroup, FileUpload } from "@/components/ui/FileUpload";
import { InteractiveMap } from "@/components/ui/InteractiveMap";
import { InteractiveMap as DynamicInteractiveMap } from "@/components/ui/DynamicMap";

const mkFile = (name: string, type: string, size = 1024) => {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

describe("FileUpload", () => {
  beforeEach(() => {
    (URL as any).createObjectURL = vi.fn(() => "blob:img");
    (URL as any).revokeObjectURL = vi.fn();
  });

  it("shows the empty prompt with a required native input", () => {
    const { container } = render(
      <FileUpload label="NIC" required onChange={vi.fn()} helpText="PDF or image" />,
    );
    expect(screen.getByText("NIC *")).toBeTruthy();
    expect(screen.getByText("prompt")).toBeTruthy();
    expect(screen.getByText("PDF or image")).toBeTruthy();
    expect((container.querySelector("input") as HTMLInputElement).required).toBe(true);
    expect(screen.queryByText("uploaded")).toBeNull();
  });

  it("accepts a valid image with a preview and a valid pdf without", () => {
    const onChange = vi.fn();
    const { container } = render(<FileUpload label="Doc" onChange={onChange} />);
    const input = container.querySelector("input")!;
    const img = mkFile("photo.PNG", "image/png");
    fireEvent.change(input, { target: { files: [img] } });
    expect(onChange).toHaveBeenLastCalledWith({ file: img, preview: "blob:img" });
    const pdf = mkFile("license.pdf", "application/pdf");
    fireEvent.change(input, { target: { files: [pdf] } });
    expect(onChange).toHaveBeenLastCalledWith({ file: pdf, preview: undefined });
    fireEvent.change(input, { target: { files: [] } });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("rejects oversize and wrong-type files with local errors", () => {
    const onChange = vi.fn();
    const { container } = render(
      <FileUpload label="Doc" onChange={onChange} maxSize={1} helpText="help" />,
    );
    const input = container.querySelector("input")!;
    fireEvent.change(input, { target: { files: [mkFile("a.pdf", "application/pdf", 2 * 1024 * 1024)] } });
    expect(screen.getByText('errors.maxSize:{"maxSize":1}')).toBeTruthy();
    expect(screen.queryByText("help")).toBeNull();
    fireEvent.change(input, { target: { files: [mkFile("a.exe", "application/x-msdownload")] } });
    expect(screen.getByText(/errors.invalidType/)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("matches MIME wildcards in accept", () => {
    const onChange = vi.fn();
    const { container } = render(<FileUpload label="Img" accept="image/*" onChange={onChange} />);
    const file = mkFile("noext", "image/webp");
    fireEvent.change(container.querySelector("input")!, { target: { files: [file] } });
    expect(onChange).toHaveBeenCalledWith({ file, preview: "blob:img" });
  });

  it("handles drag highlight and drop", () => {
    const onChange = vi.fn();
    const { container } = render(<FileUpload label="Doc" onChange={onChange} error="Server says no" />);
    const zone = container.querySelector(".border-dashed")!;
    expect(zone.className).toContain("border-error-border");
    expect(screen.getByText("Server says no")).toBeTruthy();
    fireEvent.dragEnter(zone);
    expect(zone.className).toContain("border-primary");
    fireEvent.dragLeave(zone);
    fireEvent.dragOver(zone);
    const file = mkFile("x.jpg", "image/jpeg");
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onChange).toHaveBeenCalledWith({ file, preview: "blob:img" });
    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("shows the selected image file and removes it (revoking preview)", () => {
    const onChange = vi.fn();
    const file = mkFile("p.png", "image/png", 2 * 1024 * 1024);
    render(<FileUpload label="Doc" value={{ file, preview: "blob:p" }} onChange={onChange} />);
    expect(screen.getByText("uploaded")).toBeTruthy();
    expect(screen.getByText("p.png")).toBeTruthy();
    expect(screen.getByText("2.00 MB")).toBeTruthy();
    expect(screen.getByAltText("Preview").getAttribute("src")).toBe("blob:p");
    fireEvent.click(screen.getByRole("button"));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:p");
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows a non-image selected file without preview and removes without revoke", () => {
    const onChange = vi.fn();
    render(<FileUpload label="Doc" value={{ file: mkFile("a.pdf", "application/pdf") }} onChange={onChange} />);
    expect(screen.queryByAltText("Preview")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it.each([
    ["VERIFIED", "verified"],
    ["rejected", "rejected"],
    ["PENDING", "pending"],
  ])("renders existing file with %s status", (status: any, label: any) => {
    render(
      <FileUpload
        label="Doc"
        onChange={vi.fn()}
        existingFile={{ url: "https://x/a.jpg", fileName: "a.jpg", fileSize: 1048576, status }}
      />,
    );
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByAltText("a.jpg").getAttribute("src")).toBe("https://x/a.jpg");
    expect(screen.getByText("1.00 MB")).toBeTruthy();
    expect(screen.getByText("replace")).toBeTruthy();
  });

  it("renders existing non-image file without size/status and allows replacing", () => {
    const onChange = vi.fn();
    const { container } = render(
      <FileUpload label="Doc" onChange={onChange} existingFile={{ url: "u", fileName: "" }} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText("pending")).toBeNull();
    const file = mkFile("b.pdf", "application/pdf");
    fireEvent.change(container.querySelector("input")!, { target: { files: [file] } });
    expect(onChange).toHaveBeenCalledWith({ file, preview: undefined });
  });

  it.todo("remove-file icon-only button has an aria-label (FileUpload.tsx:214)");

  it("DocumentUploadGroup wires keys, errors and default help text", () => {
    const onChange = vi.fn();
    const { container } = render(
      <DocumentUploadGroup
        documents={[
          { key: "nic", label: "NIC", required: true, helpText: "Front side" },
          { key: "lic", label: "License", required: false },
        ]}
        values={{ nic: null, lic: null }}
        errors={{ lic: "Missing" }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Front side")).toBeTruthy();
    expect(screen.getByText("Missing")).toBeTruthy();
    const file = mkFile("n.pdf", "application/pdf");
    fireEvent.change(container.querySelectorAll("input")[0], { target: { files: [file] } });
    expect(onChange).toHaveBeenCalledWith("nic", { file, preview: undefined });
    render(
      <DocumentUploadGroup documents={[{ key: "x", label: "X", required: false }]} values={{}} onChange={vi.fn()} />,
    );
    expect(screen.getByText("helpText")).toBeTruthy();
  });
});

describe("InteractiveMap", () => {
  beforeEach(() => {
    for (const k of Object.keys(h.mapHandlers)) delete h.mapHandlers[k];
    h.fitBounds.mockReset();
    h.apiPost.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("keeps clicked waypoints across re-renders when no initial waypoints are given", () => {
    const { rerender } = render(<InteractiveMap className="m" />);
    act(() => h.mapHandlers.click({ latlng: { lat: 6.9, lng: 79.8 } }));
    rerender(<InteractiveMap className="m" />);

    expect(h.fitBounds).toHaveBeenCalled();
  });

  it("adds waypoints on map click, colours start/mid/end markers and fits bounds", () => {
    render(<InteractiveMap className="m" />);
    expect(h.fitBounds).not.toHaveBeenCalled();
    act(() => h.mapHandlers.click({ latlng: { lat: 6.9, lng: 79.8 } }));
    act(() => h.mapHandlers.click({ latlng: { lat: 7.2, lng: 80.6 } }));
    act(() => h.mapHandlers.click({ latlng: { lat: 8, lng: 81 } }));
    const markers = screen.getAllByTestId("marker");
    expect(markers.length).toBe(3);
    expect(markers[0].getAttribute("data-html")).toContain("#22c55e");
    expect(markers[1].getAttribute("data-html")).toContain(">1</text>");
    expect(markers[2].getAttribute("data-html")).toContain("#ef4444");
    expect(h.fitBounds).toHaveBeenLastCalledWith(
      [[6.9, 79.8], [7.2, 80.6], [8, 81]],
      { padding: [50, 50], maxZoom: 12 },
    );
  });

  it("ignores clicks in read-only mode and draws initial geometry", () => {
    render(
      <InteractiveMap
        readOnly
        initialWaypoints={[{ lat: 1, lng: 2 }]}
        initialRouteGeometry={[[1, 2], [3, 4]]}
      />,
    );
    act(() => h.mapHandlers.click({ latlng: { lat: 5, lng: 6 } }));
    expect(screen.getAllByTestId("marker").length).toBe(1);
    expect(screen.getByTestId("polyline").getAttribute("data-count")).toBe("2");
    expect(h.fitBounds).toHaveBeenCalledWith([[1, 2], [3, 4]], { padding: [50, 50] });
  });

  it("caps waypoints at 25", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const many = Array.from({ length: 25 }, (_, i) => ({ lat: i, lng: i }));
    render(<InteractiveMap initialWaypoints={many} />);
    act(() => h.mapHandlers.click({ latlng: { lat: 1, lng: 1 } }));
    expect(alertSpy).toHaveBeenCalledWith("Maximum of 25 waypoints supported.");
    expect(screen.getAllByTestId("marker").length).toBe(25);
    alertSpy.mockRestore();
  });

  it("auto-calculates the route, inverts GeoJSON and reports it", async () => {
    vi.useFakeTimers();
    const data = {
      route: {
        geometry: { coordinates: [[79.8, 6.9], [80.6, 7.2]] },
        distanceKm: 115,
        durationMinutes: 180,
      },
    };
    h.apiPost.mockResolvedValue(data);
    const onRouteCalculated = vi.fn();
    const wps = [{ lat: 6.9, lng: 79.8, name: "Colombo" }, { lat: 7.2, lng: 80.6, name: "Kandy" }];
    render(
      <InteractiveMap initialWaypoints={wps} autoCalculate quotationId="q1" onRouteCalculated={onRouteCalculated} />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(h.apiPost).toHaveBeenCalledWith("/routing/calculate", {
      waypoints: [
        { lat: 6.9, lng: 79.8, name: "Colombo" },
        { lat: 7.2, lng: 80.6, name: "Kandy" },
      ],
      quotationId: "q1",
    });
    expect(onRouteCalculated).toHaveBeenCalledWith(data);
    expect(screen.getByTestId("polyline").getAttribute("data-count")).toBe("2");
    expect(h.fitBounds).toHaveBeenLastCalledWith([[6.9, 79.8], [7.2, 80.6]], { padding: [50, 50] });
  });

  it("alerts the API error message when routing fails, without a quotation id", async () => {
    vi.useFakeTimers();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.apiPost
      .mockRejectedValueOnce({ response: { data: { error: { message: "OSRM down" } } } })
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValueOnce({ route: { geometry: { coordinates: [] }, distanceKm: 0, durationMinutes: 0 } });
    const wps = [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }];
    const { rerender } = render(<InteractiveMap initialWaypoints={wps} autoCalculate />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(h.apiPost.mock.calls[0][1]).toEqual({ waypoints: [{ lat: 1, lng: 1, name: undefined }, { lat: 2, lng: 2, name: undefined }] });
    expect(alertSpy).toHaveBeenCalledWith("OSRM down");
    rerender(<InteractiveMap initialWaypoints={[...wps]} autoCalculate />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(alertSpy).toHaveBeenCalledWith("Failed to calculate route.");
    rerender(<InteractiveMap initialWaypoints={[...wps]} autoCalculate />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(h.apiPost).toHaveBeenCalledTimes(3);
    alertSpy.mockRestore();
    errSpy.mockRestore();
  });

  it("does not auto-calculate with fewer than two waypoints", async () => {
    vi.useFakeTimers();
    render(<InteractiveMap initialWaypoints={[{ lat: 1, lng: 1 }]} autoCalculate />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(h.apiPost).not.toHaveBeenCalled();
  });
});

describe("DynamicMap", () => {
  it("renders a skeleton placeholder and lazily resolves the real map", async () => {
    const { container } = render(<DynamicInteractiveMap readOnly initialWaypoints={[]} />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
    const resolved = await h.dynamicLoader!();
    expect(resolved).toBe(InteractiveMap);
  });
});
