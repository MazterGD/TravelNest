-- Add a direct foreign key from bookings to the quotation they were created from.
-- Nullable + ON DELETE SET NULL keeps legacy bookings (QUO- code stored in notes)
-- and package bookings (no quotation) valid.
ALTER TABLE "bookings" ADD COLUMN "quotationId" TEXT;

CREATE INDEX "bookings_quotationId_idx" ON "bookings"("quotationId");

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_quotationId_fkey"
  FOREIGN KEY ("quotationId") REFERENCES "quotations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
