const PLACE_KEY_MAP: Record<string, string> = {
  colombo: "colombo",
  kandy: "kandy",
  galle: "galle",
  ella: "ella",
  anuradhapura: "anuradhapura",
  negombo: "negombo",
  sigiriya: "sigiriya",
  batticaloa: "batticaloa",
  kurunegala: "kurunegala",
  badulla: "badulla",
  jaffna: "jaffna",
  matara: "matara",
  trincomalee: "trincomalee",
  "nuwara eliya": "nuwaraEliya",
  kalutara: "kalutara",
  ratnapura: "ratnapura",
  hambantota: "hambantota",
  puttalam: "puttalam",
};

const normalizePlaceName = (placeName: string) =>
  placeName.trim().toLowerCase().replace(/\s+/g, " ");

export const getPlaceTranslationKey = (placeName: string) =>
  PLACE_KEY_MAP[normalizePlaceName(placeName)] ?? null;

export const localizePlaceName = (
  placeName: string,
  translate: (key: string) => string,
) => {
  const translationKey = getPlaceTranslationKey(placeName);
  return translationKey ? translate(translationKey) : placeName;
};
