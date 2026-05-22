"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "./Skeleton";
import type { InteractiveMapProps } from "./InteractiveMap";

// Leaflet requires window, so we must dynamically import the map component with SSR disabled
const InteractiveMapBase = dynamic(
  () => import("./InteractiveMap").then((mod) => mod.InteractiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] w-full rounded-[20px] overflow-hidden border border-border">
        <Skeleton className="h-full w-full" />
      </div>
    ),
  }
);

export function InteractiveMap(props: InteractiveMapProps) {
  return <InteractiveMapBase {...props} />;
}
