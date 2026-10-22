-- Radius search support for vehicles.
-- Adds a geography(Point) column derived from latitude/longitude so PostGIS
-- ST_DWithin can answer "buses within N km of a point" using a GIST index.
--
-- The column is maintained by a trigger (not a GENERATED column) so it stays
-- invisible to Prisma — matching how the itinerary_* PostGIS columns are
-- managed via raw SQL. Prisma sees a plain nullable Unsupported column.

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "geom" geography(Point, 4326);

-- Keep geom in sync with latitude/longitude on every write.
CREATE OR REPLACE FUNCTION vehicles_sync_geom() RETURNS trigger AS $$
BEGIN
  IF NEW."latitude" IS NOT NULL AND NEW."longitude" IS NOT NULL THEN
    NEW."geom" := ST_SetSRID(ST_MakePoint(NEW."longitude", NEW."latitude"), 4326)::geography;
  ELSE
    NEW."geom" := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_vehicles_sync_geom" ON "vehicles";
CREATE TRIGGER "trg_vehicles_sync_geom"
  BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "vehicles"
  FOR EACH ROW EXECUTE FUNCTION vehicles_sync_geom();

-- Backfill existing rows that already carry coordinates.
UPDATE "vehicles"
  SET "geom" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
  WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;

-- GIST spatial index for fast ST_DWithin radius lookups.
CREATE INDEX IF NOT EXISTS "idx_vehicles_geom" ON "vehicles" USING GIST ("geom");
