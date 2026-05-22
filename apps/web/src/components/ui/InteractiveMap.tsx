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
import axios from "axios";
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
}: InteractiveMapProps) {
  const [locations, setLocations] = useState<Coordinate[]>(initialWaypoints);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>(initialRouteGeometry);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMinutes: number } | null>(null);

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
      const response = await axios.get("https://nominatim.openstreetmap.org/search", {
        params: {
          q: searchQuery + ", Sri Lanka",
          format: "json",
          limit: 1,
        },
      });

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
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

  const calculateRoute = async () => {
    if (locations.length < 2) {
      alert("Please add at least 2 locations to calculate a route.");
      return;
    }

    setIsLoading(true);
    try {
      // Using axios as explicitly requested to call the local API
      // In a real scenario, we might use the api client to attach JWT automatically,
      // but assuming standard axios usage per instructions or proxy handles it.
      
      // Note: fetching auth token for axios from localStorage if needed:
      let token = "";
      try {
        const stored = localStorage.getItem("travenest-auth");
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed.state?.token || "";
        }
      } catch (e) {}

      // Get CSRF token
      let csrfToken = "";
      if (typeof document !== "undefined") {
        const cookies = document.cookie.split(";");
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split("=");
          if (name === "csrf-token") {
            csrfToken = decodeURIComponent(value);
          }
        }
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (csrfToken) headers["x-csrf-token"] = csrfToken;

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
      
      const response = await axios.post(
        `${API_URL}/routing/calculate`,
        {
          waypoints: locations.map((loc) => ({ lat: loc.lat, lng: loc.lng, name: loc.name })),
          ...(quotationId ? { quotationId } : {}),
        },
        { headers }
      );

      const { data } = response.data;
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

      // Update locations array to match the optimized order returned by OSRM
      if (route.optimizedWaypoints) {
        setLocations(
          route.optimizedWaypoints.map((wp: any) => ({
            lat: wp.lat,
            lng: wp.lng,
            name: wp.originalName || wp.name || `Waypoint`,
          }))
        );
      }

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

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Top control panel for non-readonly mode */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Search a place in Sri Lanka..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              icon={<Search size={18} />}
            />
            <Button
              variant="secondary"
              onClick={handleSearch}
              isLoading={isSearching}
            >
              Search
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={calculateRoute}
              isLoading={isLoading}
              disabled={locations.length < 2}
            >
              <Route size={18} />
              Calculate Route
            </Button>
            <Button variant="outline" onClick={handleClear} disabled={locations.length === 0}>
              <Trash2 size={18} />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Info panel */}
      {routeInfo && (
        <div className="bg-success-bg border border-success-border text-success-text px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="font-medium">Optimised Route Ready</div>
          <div className="flex gap-4 text-sm font-semibold">
            <span>Distance: {routeInfo.distanceKm} km</span>
            <span>Duration: {(routeInfo.durationMinutes / 60).toFixed(1)} hrs</span>
          </div>
        </div>
      )}

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
            <Marker key={idx} position={[loc.lat, loc.lng]}>
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

      {/* Waypoints list */}
      {!readOnly && locations.length > 0 && (
        <div className="bg-background rounded-xl border border-border p-4">
          <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
            <MapPin size={18} className="text-primary" />
            Selected Waypoints ({locations.length})
          </h4>
          <ul className="flex flex-col gap-2">
            {locations.map((loc, idx) => (
              <li key={idx} className="flex justify-between items-center text-sm text-foreground bg-muted px-3 py-2 rounded-lg">
                <span className="truncate flex-1 font-medium">{idx + 1}. {loc.name}</span>
                <span className="text-muted-foreground text-xs ml-4">
                  {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                </span>
                <button 
                  onClick={() => setLocations(locations.filter((_, i) => i !== idx))}
                  className="ml-3 text-error hover:text-error-foreground p-1 rounded-md hover:bg-error-bg transition-colors"
                  aria-label="Remove waypoint"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default InteractiveMap;
