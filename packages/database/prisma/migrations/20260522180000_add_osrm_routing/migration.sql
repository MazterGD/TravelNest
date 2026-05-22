-- CreateExtension
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateTable
CREATE TABLE "itinerary_stops" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "stopOrder" INTEGER NOT NULL,
    "locationName" TEXT,
    "coordinates" geometry(Point, 4326) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itinerary_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_routes" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "waypoints" geometry(LineString, 4326) NOT NULL,
    "routeGeometry" geometry(LineString, 4326) NOT NULL,
    "distanceMeters" DOUBLE PRECISION,
    "durationSeconds" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itinerary_routes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "itinerary_stops_quotationId_idx" ON "itinerary_stops"("quotationId");

-- CreateIndex
CREATE INDEX "itinerary_stops_stopOrder_idx" ON "itinerary_stops"("stopOrder");

-- CreateIndex
CREATE UNIQUE INDEX "itinerary_routes_quotationId_key" ON "itinerary_routes"("quotationId");

-- CreateIndex
CREATE INDEX "itinerary_routes_quotationId_idx" ON "itinerary_routes"("quotationId");

-- AddForeignKey
ALTER TABLE "itinerary_stops" ADD CONSTRAINT "itinerary_stops_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_routes" ADD CONSTRAINT "itinerary_routes_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add GIST Spatial Indexes
CREATE INDEX "idx_itinerary_stops_geom" ON "itinerary_stops" USING GIST ("coordinates");
CREATE INDEX "idx_itinerary_routes_waypoints" ON "itinerary_routes" USING GIST ("waypoints");
CREATE INDEX "idx_itinerary_routes_route" ON "itinerary_routes" USING GIST ("routeGeometry");
