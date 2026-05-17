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
import { MapPin, Users, Clock, Bus } from 'lucide-react';
import { useTranslations } from "next-intl";

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
  const t = useTranslations("packages");
  const imageUrl = tripPackage.vehicle?.images?.[0];
  const vehicleName = tripPackage.vehicle?.name || t("vehicleFallback");
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
          {tripPackage.isActive ? t("status.active") : t("status.inactive")}
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
            <Bus className="h-8 w-8" />
          </div>
        )}

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>
              {tripPackage.startLocation} → {tripPackage.endLocation}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>
              {t("durationDays", { count: tripPackage.durationDays })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>
              {tripPackage.minPassengers} - {tripPackage.maxPassengers}{" "}
              {t("passengers")}
              {seats ? ` (${t("maxSeats", { count: seats })})` : ""}
            </span>
          </div>
          {ownerName && (
            <p className="text-xs">{t("ownerLabel", { name: ownerName })}</p>
          )}
        </div>
      </CardContent>

      <CardFooter className="mt-auto flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{t("priceLabel")}</p>
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
            {isSelected ? t("compare.selected") : t("compare.label")}
          </button>
          <Button size="sm" onClick={() => onBook(tripPackage)}>
            {t("bookPackage")}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
