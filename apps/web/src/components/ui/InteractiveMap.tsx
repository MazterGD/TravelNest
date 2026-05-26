"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMapEvents,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import L from "leaflet";
import { api } from "@/lib/api";
import { Button } from "./Button";
import { Input } from "./Input";
import { Search, MapPin, Route, Trash2 } from "lucide-react";

export interface Coordinate {
  lat: number;
  lng: number;
  name?: string;
}

export interface InteractiveMapProps {
  initialWaypoints?: Coordinate[];
  initialRouteGeometry?: [number, number][]; // [lat, lng] format for Leaflet
  readOnly?: boolean;
  onRouteCalculated?: (data: any) => void;
  quotationId?: string;
  className?: string;
  autoCalculate?: boolean;
}

/**
 * Handles map click interactions to add waypoints.
 */
function MapInteractionHandler({
  onLocationClick,
  readOnly,
}: {
  onLocationClick: (coord: Coordinate) => void;
  readOnly: boolean;
}) {
  useMapEvents({
    click(e) {
      if (readOnly) return;
      onLocationClick({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        name: `Waypoint (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`,
      });
    },
  });
  return null;
}

/**
 * Helper to update map view bounds when route changes
 */
function MapBoundsFitter({
  locations,
  routeCoordinates,
}: {
  locations: Coordinate[];
  routeCoordinates: [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    if (routeCoordinates.length > 0) {
      map.fitBounds(routeCoordinates, { padding: [50, 50] });
    } else if (locations.length > 0) {
      const bounds = locations.map((loc) => [loc.lat, loc.lng] as [number, number]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [locations, routeCoordinates, map]);

  return null;
}

export function InteractiveMap({
  initialWaypoints = [],
  initialRouteGeometry = [],
  readOnly = false,
  onRouteCalculated,
  quotationId,
  className = "",
  autoCalculate = false,
}: InteractiveMapProps) {
  const [locations, setLocations] = useState<Coordinate[]>(initialWaypoints);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>(initialRouteGeometry);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMinutes: number } | null>(null);

  useEffect(() => {
    setLocations(initialWaypoints);
    if (autoCalculate && initialWaypoints.length >= 2) {
      // Small timeout to let state settle
      const t = setTimeout(() => {
        calculateRoute(initialWaypoints);
      }, 100);
      return () => clearTimeout(t);
    }
  }, [initialWaypoints, autoCalculate]);

  // Sri Lanka center coordinates
  const mapCenter: [number, number] = [7.8731, 80.7718];

  const handleLocationClick = (coord: Coordinate) => {
    if (locations.length >= 25) {
      alert("Maximum of 25 waypoints supported.");
      return;
    }
    setLocations((prev) => [...prev, coord]);
  };

  const handleClear = () => {
    setLocations([]);
    setRouteCoordinates([]);
    setRouteInfo(null);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const params = new URLSearchParams({ q: searchQuery + ", Sri Lanka", format: "json", limit: "1" });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        const newLocation: Coordinate = {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          name: result.name || searchQuery,
        };
        handleLocationClick(newLocation);
        setSearchQuery("");
      } else {
        alert("Location not found in Sri Lanka.");
      }
    } catch (error) {
      console.error("Search error:", error);
      alert("Failed to search location.");
    } finally {
      setIsSearching(false);
    }
  };

  const calculateRoute = async (waypointsToUse = locations) => {
    if (waypointsToUse.length < 2) {
      alert("Please add at least 2 locations to calculate a route.");
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        waypoints: waypointsToUse.map((loc) => ({ lat: loc.lat, lng: loc.lng, name: loc.name })),
        ...(quotationId ? { quotationId } : {}),
      };

      const data = await api.post<any>("/routing/calculate", payload);
      const { route } = data;

      // Crucial step: Invert GeoJSON [lng, lat] to Leaflet [lat, lng]
      const leafletCoords: [number, number][] = route.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng]
      );

      setRouteCoordinates(leafletCoords);
      setRouteInfo({
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
      });

      if (onRouteCalculated) {
        onRouteCalculated(data);
      }
    } catch (error: any) {
      console.error("Route calculation error:", error);
      alert(error.response?.data?.error?.message || "Failed to calculate route.");
    } finally {
      setIsLoading(false);
    }
  };

  const getMarkerIcon = (index: number, total: number) => {
    if (index === 0) {
      return L.divIcon({
        className: "custom-marker-icon",
        html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22S28 24.5 28 14C28 6.268 21.732 0 14 0z" fill="#22c55e"/><circle cx="14" cy="14" r="5" fill="white"/></svg>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      });
    } else if (index === total - 1) {
      return L.divIcon({
        className: "custom-marker-icon",
        html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22S28 24.5 28 14C28 6.268 21.732 0 14 0z" fill="#ef4444"/><circle cx="14" cy="14" r="5" fill="white"/></svg>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      });
    } else {
      return L.divIcon({
        className: "custom-marker-icon",
        html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22S28 24.5 28 14C28 6.268 21.732 0 14 0z" fill="#20B0E9"/><text x="14" y="17" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="11" font-weight="bold" font-family="Inter,sans-serif">${index}</text></svg>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      });
    }
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Map container */}
      <div className="h-[500px] w-full rounded-[20px] overflow-hidden border border-border shadow-sm relative z-0">
        <MapContainer
          center={mapCenter}
          zoom={7}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapInteractionHandler onLocationClick={handleLocationClick} readOnly={readOnly} />
          <MapBoundsFitter locations={locations} routeCoordinates={routeCoordinates} />

          {locations.map((loc, idx) => (
            <Marker key={idx} position={[loc.lat, loc.lng]} icon={getMarkerIcon(idx, locations.length)}>
              {/* Optional Popup can go here */}
            </Marker>
          ))}

          {routeCoordinates.length > 0 && (
            <Polyline
              positions={routeCoordinates}
              color="var(--color-action-primary)"
              weight={5}
              opacity={0.8}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}

export default InteractiveMap;
