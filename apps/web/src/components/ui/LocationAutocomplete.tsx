"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, MapPin, X } from "lucide-react";
import { Input } from "./Input";

export interface LocationSuggestion {
  lat: number;
  lng: number;
  displayName: string;
  city: string;
  district: string;
}

interface LocationAutocompleteProps {
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  onSelectLocation: (loc: LocationSuggestion) => void;
  disabled?: boolean;
}

export function LocationAutocomplete({
  placeholder = "Search location...",
  value,
  onChange,
  onSelectLocation,
  disabled = false,
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!value || value.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        // Use Nominatim to geocode, restrict to Sri Lanka
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            value
          )}&countrycodes=lk&addressdetails=1&limit=5`
        );
        const data = await res.json();
        
        const mapped: LocationSuggestion[] = data.map((item: any) => {
          const addr = item.address || {};
          const city = addr.city || addr.town || addr.village || addr.suburb || "";
          const district = addr.state_district || addr.county || addr.state || "";
          return {
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            displayName: item.display_name,
            city,
            district,
          };
        });
        setSuggestions(mapped);
        setShowSuggestions(true);
      } catch (e) {
        console.error("Geocoding failed", e);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        disabled={disabled}
        icon={isLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-action-primary)] border-t-transparent" /> : <Search size={18} />}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-1 shadow-lg">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--color-bg-surface)]"
              onClick={() => {
                onSelectLocation(s);
                setShowSuggestions(false);
              }}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
              <div>
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  {s.displayName.split(",")[0]}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)] line-clamp-1">
                  {s.displayName}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
