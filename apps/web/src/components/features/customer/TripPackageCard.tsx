"use client";

import Image from "next/image";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Badge,
  Button,
} from "@/components/ui";
import type { TripPackage } from "@/types";
import { FaMapMarkerAlt, FaUsers, FaClock, FaBus } from "react-icons/fa";

interface TripPackageCardProps {
  tripPackage: TripPackage;
  isSelected: boolean;
  onToggleCompare: (id: string) => void;
  onBook: (tripPackage: TripPackage) => void;
}

export function TripPackageCard({
  tripPackage,
  isSelected,
  onToggleCompare,
  onBook,
}: TripPackageCardProps) {
  const imageUrl = tripPackage.vehicle?.images?.[0];
  const vehicleName = tripPackage.vehicle?.name || "Vehicle";
  const seats = tripPackage.vehicle?.seats;
  const ownerName = tripPackage.owner
    ? `${tripPackage.owner.firstName || ""} ${tripPackage.owner.lastName || ""}`.trim()
    : "";

  return (
    <Card className="h-full flex flex-col" hover>
      <CardHeader className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-base">{tripPackage.title}</CardTitle>
          <p className="text-xs text-muted-foreground">{vehicleName}</p>
        </div>
        <Badge variant={tripPackage.isActive ? "success" : "secondary"}>
          {tripPackage.isActive ? "Active" : "Inactive"}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {imageUrl ? (
          <div className="relative h-36 w-full overflow-hidden rounded-lg bg-muted">
            <Image
              src={imageUrl}
              alt={vehicleName}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-36 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <FaBus className="h-8 w-8" />
          </div>
        )}

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FaMapMarkerAlt className="h-4 w-4" />
            <span>
              {tripPackage.startLocation} → {tripPackage.endLocation}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FaClock className="h-4 w-4" />
            <span>{tripPackage.durationDays} day(s)</span>
          </div>
          <div className="flex items-center gap-2">
            <FaUsers className="h-4 w-4" />
            <span>
              {tripPackage.minPassengers} - {tripPackage.maxPassengers}{" "}
              passengers
              {seats ? ` (max ${seats})` : ""}
            </span>
          </div>
          {ownerName && <p className="text-xs">Owner: {ownerName}</p>}
        </div>
      </CardContent>

      <CardFooter className="mt-auto flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Package Price</p>
          <p className="text-lg font-semibold text-foreground">
            LKR {tripPackage.price.toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onToggleCompare(tripPackage.id)}
            className={`text-xs font-medium transition-colors ${
              isSelected
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isSelected ? "Selected" : "Compare"}
          </button>
          <Button size="sm" onClick={() => onBook(tripPackage)}>
            Book Package
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
