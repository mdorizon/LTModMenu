// Fishing seat IDs for the fishing map
// Extracted 2026-03-11 via app.seats inspection (filter: seat.isFishingSeat === true)
// Format: "x{worldX}y{worldY}" — matches the WS sit message format
export const FISHING_SEAT_IDS: readonly string[] = [
  // Pontoon area (center-south)
  "x376y728", "x416y728", "x456y728",
  "x496y728", "x536y728", "x576y728", "x616y728",
  "x496y658", "x536y658", "x616y698",

  // Pier / dock area (center)
  "x504y535",
  "x541y497", "x560y497", "x600y504", "x648y504",
  "x678y497", "x697y497",

  // Upper dock / harbor area
  "x532y425", "x567y425", "x712y425",

  // Harbor north
  "x509y59", "x528y59", "x563y59", "x595y59",
  "x632y103", "x632y135",
  "x791y111",

  // East dock
  "x584y208", "x584y223",
  "x587y262", "x606y262", "x649y262", "x668y262",

  // Northeast area
  "x775y275", "x775y290", "x775y326", "x775y341", "x776y375",

  // Southeast
  "x869y568", "x888y568", "x1064y576",

  // Fishing shop entrance area
  "x440y336", "x440y351",

  // Misc
  "x216y599",
];
