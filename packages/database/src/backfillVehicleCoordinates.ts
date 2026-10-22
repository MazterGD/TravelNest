import { PrismaClient } from "@prisma/client";

/**
 * Backfill latitude/longitude for vehicles that were created before the app
 * persisted coordinates. Each vehicle's free-text `location` is matched against
 * a Sri Lankan town gazetteer; on a hit we set lat/lng (the DB trigger then
 * derives the PostGIS `geom` used by radius search).
 *
 * Run: pnpm --filter @travenest/database backfill:vehicle-coordinates
 */

const prisma = new PrismaClient();

// District capitals + major towns. Keys are matched case-insensitively as
// substrings of the vehicle's location (longest key wins).
const GAZETTEER: Record<string, { latitude: number; longitude: number }> = {
  Colombo: { latitude: 6.9271, longitude: 79.8612 },
  "Sri Jayawardenepura Kotte": { latitude: 6.8881, longitude: 79.9187 },
  Dehiwala: { latitude: 6.8511, longitude: 79.8654 },
  Moratuwa: { latitude: 6.7741, longitude: 79.8826 },
  Negombo: { latitude: 7.2008, longitude: 79.8737 },
  Gampaha: { latitude: 7.0917, longitude: 79.9999 },
  Kalutara: { latitude: 6.5854, longitude: 79.9607 },
  Panadura: { latitude: 6.7132, longitude: 79.9026 },
  Kandy: { latitude: 7.2906, longitude: 80.6337 },
  Matale: { latitude: 7.4675, longitude: 80.6234 },
  "Nuwara Eliya": { latitude: 6.9497, longitude: 80.7891 },
  Gampola: { latitude: 7.1647, longitude: 80.5742 },
  Galle: { latitude: 6.0535, longitude: 80.221 },
  Matara: { latitude: 5.9549, longitude: 80.555 },
  Hambantota: { latitude: 6.1246, longitude: 81.1185 },
  Tangalle: { latitude: 6.024, longitude: 80.7944 },
  Jaffna: { latitude: 9.6615, longitude: 80.0255 },
  Kilinochchi: { latitude: 9.3803, longitude: 80.3770 },
  Mannar: { latitude: 8.9810, longitude: 79.9044 },
  Vavuniya: { latitude: 8.7514, longitude: 80.4971 },
  Mullaitivu: { latitude: 9.2671, longitude: 80.8142 },
  Trincomalee: { latitude: 8.5874, longitude: 81.2152 },
  Batticaloa: { latitude: 7.7102, longitude: 81.6924 },
  Ampara: { latitude: 7.2917, longitude: 81.6726 },
  Kalmunai: { latitude: 7.4167, longitude: 81.8167 },
  Kurunegala: { latitude: 7.4863, longitude: 80.3647 },
  Puttalam: { latitude: 8.0362, longitude: 79.8283 },
  Chilaw: { latitude: 7.5758, longitude: 79.7953 },
  Anuradhapura: { latitude: 8.3114, longitude: 80.4037 },
  Polonnaruwa: { latitude: 7.9403, longitude: 81.0188 },
  Dambulla: { latitude: 7.8742, longitude: 80.6511 },
  Badulla: { latitude: 6.9934, longitude: 81.055 },
  Bandarawela: { latitude: 6.8294, longitude: 80.987 },
  Monaragala: { latitude: 6.8714, longitude: 81.351 },
  Ratnapura: { latitude: 6.6828, longitude: 80.3992 },
  Kegalle: { latitude: 7.2513, longitude: 80.3464 },
  Embilipitiya: { latitude: 6.3431, longitude: 80.8492 },
};

// Longest keys first so "Nuwara Eliya" wins over a stray "Nuwara" substring.
const GAZETTEER_KEYS = Object.keys(GAZETTEER).sort(
  (a, b) => b.length - a.length,
);

const resolveCoordinates = (location: string) => {
  const haystack = location.toLowerCase();
  const key = GAZETTEER_KEYS.find((name) =>
    haystack.includes(name.toLowerCase()),
  );
  return key ? GAZETTEER[key] : null;
};

const main = async () => {
  const vehicles = await prisma.vehicle.findMany({
    where: {
      OR: [{ latitude: null }, { longitude: null }],
    },
    select: { id: true, location: true, name: true },
  });

  console.log(`Found ${vehicles.length} vehicle(s) missing coordinates.`);

  let updated = 0;
  const unresolved: string[] = [];

  for (const vehicle of vehicles) {
    const coords = vehicle.location
      ? resolveCoordinates(vehicle.location)
      : null;

    if (!coords) {
      unresolved.push(`${vehicle.name} — "${vehicle.location}"`);
      continue;
    }

    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { latitude: coords.latitude, longitude: coords.longitude },
    });
    updated += 1;
  }

  console.log(`Updated ${updated} vehicle(s) with coordinates.`);
  if (unresolved.length > 0) {
    console.log(
      `\n${unresolved.length} vehicle(s) could not be matched to a known town ` +
        `and need manual review (re-save with the location autocomplete):`,
    );
    unresolved.forEach((entry) => console.log(`  • ${entry}`));
  }
};

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
