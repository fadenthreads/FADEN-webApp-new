export const STEPS = [
  "occasion",
  "inspiration",
  "style",
  "measurements",
  "budget",
  "review",
] as const;
export type RequestStep = (typeof STEPS)[number];
export const OCCASIONS = [
  "Wedding",
  "Reception",
  "Engagement",
  "Festival",
  "Sangeet",
  "Mehendi",
  "Haldi",
  "Cocktail",
  "Party",
  "Birthday",
  "Anniversary",
  "Baby Shower",
  "Graduation",
  "Formal Event",
  "Religious Ceremony",
  "Casual Outing",
  "Other",
];
export const GARMENTS = [
  "Lehenga",
  "Saree",
  "Dress",
  "Suit",
  "Sherwani",
  "Blouse",
  "Other",
];
export const SILHOUETTES = [
  "Flowing A-Line",
  "Structured Sheath",
  "Relaxed Drape",
  "Custom Form",
];
export const NECKLINES = [
  "Round",
  "V-Neck",
  "Deep V",
  "U-Neck",
  "Square",
  "Sweetheart",
  "Boatneck",
  "High Collar",
  "Mandarin Collar",
  "Halter",
  "Off-Shoulder",
  "One-Shoulder",
  "Asymmetric",
  "Scoop",
  "Keyhole",
  "Illusion",
  "Cowl",
  "Queen Anne",
  "Plunging",
  "Strapless",
  "Custom / Other",
  "Let the boutique suggest",
];
export const SLEEVES = [
  "Sleeveless",
  "Straps",
  "Spaghetti Straps",
  "Cap Sleeve",
  "Short",
  "Elbow Length",
  "Three-Quarter",
  "Fitted Long",
  "Full Length",
  "Puff",
  "Bell",
  "Bishop",
  "Balloon",
  "Flutter",
  "Butterfly",
  "Raglan",
  "Kimono",
  "Cape",
  "Cold Shoulder",
  "Juliet",
  "Voluminous",
  "Detachable",
  "Custom / Other",
  "Let the boutique suggest",
];
export const MEASUREMENT_LABELS = {
  chest: "Chest / bust",
  waist: "Waist",
  hips: "Hips",
  height: "Height",
  shoulder: "Shoulder width",
  sleeveLength: "Sleeve length",
  upperArm: "Upper arm / bicep",
  armhole: "Armhole circumference",
  garmentLength: "Garment length",
  skirtLength: "Skirt length",
  inseam: "Inside leg / inseam",
  neck: "Neck circumference",
} as const;
export type MeasurementKey = keyof typeof MEASUREMENT_LABELS;
export function measurementFields(
  garment: string,
  sleeves = "",
): MeasurementKey[] {
  const fields: Record<string, MeasurementKey[]> = {
    Blouse: [
      "chest",
      "waist",
      "shoulder",
      "sleeveLength",
      "upperArm",
      "armhole",
      "garmentLength",
    ],
    Saree: [
      "chest",
      "waist",
      "shoulder",
      "sleeveLength",
      "upperArm",
      "armhole",
      "garmentLength",
      "height",
    ],
    Lehenga: [
      "chest",
      "waist",
      "hips",
      "shoulder",
      "sleeveLength",
      "upperArm",
      "armhole",
      "skirtLength",
      "height",
    ],
    Dress: [
      "chest",
      "waist",
      "hips",
      "shoulder",
      "sleeveLength",
      "upperArm",
      "armhole",
      "garmentLength",
      "height",
    ],
    Suit: [
      "chest",
      "waist",
      "hips",
      "shoulder",
      "sleeveLength",
      "upperArm",
      "garmentLength",
      "inseam",
      "neck",
      "height",
    ],
    Sherwani: [
      "chest",
      "waist",
      "shoulder",
      "sleeveLength",
      "upperArm",
      "garmentLength",
      "neck",
      "height",
    ],
  };
  return (fields[garment] ?? ["chest", "waist", "hips", "height"]).filter(
    (key) =>
      !["Sleeveless", "Straps", "Spaghetti Straps"].includes(sleeves) ||
      !["sleeveLength", "upperArm"].includes(key),
  );
}
export function requiredMeasurements(garment: string): MeasurementKey[] {
  return garment === "Blouse"
    ? ["chest"]
    : ["Saree", "Sherwani"].includes(garment)
      ? ["chest", "waist"]
      : ["chest", "waist", "hips"];
}
export const BUDGETS = {
  under_10k: "Under ₹10k",
  "10k_25k": "₹10k–25k",
  "25k_50k": "₹25k–50k",
  "50k_100k": "₹50k–100k",
  "100k_plus": "₹100k+",
  custom: "Let’s discuss",
};
export type Measurements = {
  shoulder?: string;
  sleeveLength?: string;
  upperArm?: string;
  armhole?: string;
  garmentLength?: string;
  skirtLength?: string;
  inseam?: string;
  neck?: string;
  reference?: string;
  unit: "cm" | "in";
  chest: string;
  waist: string;
  hips: string;
  height: string;
};
export type Inspiration = { key: string; note: string };
export type OutfitDraft = {
  otherOccasion: string;
  customSilhouette: string;
  necklineNotes: string;
  sleeveNotes: string;
  occasion: string;
  garment: string;
  notes: string;
  inspirations: Inspiration[];
  links: string[];
  expert: boolean;
  colors: string[];
  silhouette: string;
  neckline: string;
  sleeves: string;
  fabrics: string[];
  measurementMethod: string;
  measurements: Measurements;
  eventDate: string;
  deliveryDate: string;
  budget: string;
  consent: boolean;
};
export const EMPTY_DRAFT: OutfitDraft = {
  otherOccasion: "",
  customSilhouette: "",
  necklineNotes: "",
  sleeveNotes: "",
  occasion: "",
  garment: "",
  notes: "",
  inspirations: [],
  links: [],
  expert: false,
  colors: [],
  silhouette: "",
  neckline: "",
  sleeves: "",
  fabrics: [],
  measurementMethod: "",
  measurements: { unit: "cm", chest: "", waist: "", hips: "", height: "" },
  eventDate: "",
  deliveryDate: "",
  budget: "",
  consent: false,
};
export function validateDraft(raw: unknown, submit = false): OutfitDraft {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Invalid draft.");
  const r = raw as Record<string, unknown>;
  function str(key: string, max = 200) {
    const v = r[key] ?? "";
    if (typeof v !== "string" || v.length > max)
      throw new Error(`Check ${key}.`);
    return v.trim();
  }
  function choice(key: string, options: string[]) {
    const v = str(key);
    if (v && !options.includes(v)) throw new Error(`Choose a valid ${key}.`);
    return v;
  }
  function list(key: string, max = 10) {
    const v = r[key] ?? [];
    if (
      !Array.isArray(v) ||
      v.length > max ||
      v.some((x) => typeof x !== "string" || x.length > 500)
    )
      throw new Error(`Check ${key}.`);
    return v as string[];
  }
  function flag(key: string) {
    if (r[key] !== undefined && typeof r[key] !== "boolean")
      throw new Error(`Check ${key}.`);
    return r[key] === true;
  }
  const m = (r.measurements ?? EMPTY_DRAFT.measurements) as Record<
    string,
    unknown
  >;
  if (!m || typeof m !== "object" || !["cm", "in"].includes(String(m.unit)))
    throw new Error("Choose centimetres or inches.");
  const measurements: Measurements = {
    reference: "",
    unit: m.unit as "cm" | "in",
    chest: "",
    waist: "",
    hips: "",
    height: "",
  };
  if (m.reference !== undefined) {
    if (
      typeof m.reference !== "string" ||
      (m.reference &&
        !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(
          m.reference,
        ))
    )
      throw new Error("Invalid measurement reference.");
    measurements.reference = m.reference as string;
  }
  for (const key of Object.keys(MEASUREMENT_LABELS) as MeasurementKey[]) {
    const v = m[key] ?? "";
    if (typeof v !== "string" || v.length > 10)
      throw new Error("Invalid measurement.");
    if (
      v &&
      (!Number.isFinite(Number(v)) ||
        Number(v) <= 0 ||
        Number(v) > (m.unit === "cm" ? 300 : 120))
    )
      throw new Error(
        "Measurements must be positive and within the selected unit’s range.",
      );
    measurements[key] = v;
  }
  const inspiration = r.inspirations ?? [];
  if (!Array.isArray(inspiration) || inspiration.length > 8)
    throw new Error("Use up to eight inspiration images.");
  const inspirations = inspiration.map((x: unknown) => {
    if (!x || typeof x !== "object") throw new Error("Invalid inspiration.");
    const i = x as Record<string, unknown>;
    if (
      typeof i.key !== "string" ||
      i.key.length > 250 ||
      i.key.includes("://") ||
      i.key.includes("?") ||
      i.key.includes("..") ||
      typeof i.note !== "string" ||
      i.note.length > 1000
    )
      throw new Error("Invalid inspiration.");
    return { key: i.key, note: i.note };
  });
  const links = list("links", 8);
  for (const link of links) {
    try {
      const u = new URL(link);
      if (u.protocol !== "https:" || u.username || u.password)
        throw new Error();
    } catch {
      throw new Error("Inspiration links must be valid HTTPS URLs.");
    }
  }
  const d: OutfitDraft = {
    otherOccasion: str("otherOccasion", 120),
    customSilhouette: str("customSilhouette", 1000),
    necklineNotes: str("necklineNotes", 500),
    sleeveNotes: str("sleeveNotes", 500),
    occasion: choice("occasion", OCCASIONS),
    garment: choice("garment", GARMENTS),
    notes: str("notes", 3000),
    inspirations,
    links,
    expert: flag("expert"),
    colors: list("colors", 3),
    silhouette: choice("silhouette", SILHOUETTES),
    neckline: choice("neckline", NECKLINES),
    sleeves: choice("sleeves", SLEEVES),
    fabrics: list("fabrics", 3),
    measurementMethod: choice("measurementMethod", [
      "manual",
      "reference",
      "saved",
      "boutique",
      "video",
      "home",
      "later",
    ]),
    measurements,
    eventDate: str("eventDate", 10),
    deliveryDate: str("deliveryDate", 10),
    budget: choice("budget", Object.keys(BUDGETS)),
    consent: flag("consent"),
  };
  if (d.garment) {
    const relevant = measurementFields(d.garment, d.sleeves);
    for (const key of Object.keys(MEASUREMENT_LABELS) as MeasurementKey[])
      if (!relevant.includes(key)) d.measurements[key] = "";
  }
  for (const date of [d.eventDate, d.deliveryDate])
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date)
    )
      throw new Error("Enter a valid date.");
  if (d.deliveryDate && d.eventDate && d.deliveryDate > d.eventDate)
    throw new Error("Delivery must be on or before the event.");
  if (submit) {
    if (!d.occasion || !d.garment)
      throw new Error("Choose an occasion and garment.");
    if (d.occasion === "Other" && !d.otherOccasion)
      throw new Error("Tell us your occasion.");
    if (d.silhouette === "Custom Form" && !d.customSilhouette && !d.expert)
      throw new Error("Describe your custom silhouette.");
    if (d.neckline === "Custom / Other" && !d.necklineNotes)
      throw new Error("Describe your neckline.");
    if (d.sleeves === "Custom / Other" && !d.sleeveNotes)
      throw new Error("Describe your sleeves.");
    if (!d.expert && !d.silhouette)
      throw new Error("Choose a silhouette or Expert Curation.");
    if (!d.measurementMethod)
      throw new Error("Choose a measurement method, including decide later.");
    if (d.measurementMethod === "reference" && !d.measurements.reference)
      throw new Error(
        "Upload your measurement chart or choose another measurement method.",
      );
    if (
      ["manual", "saved"].includes(d.measurementMethod) &&
      requiredMeasurements(d.garment).some((key) => !d.measurements[key])
    )
      throw new Error(
        `Enter ${requiredMeasurements(d.garment)
          .map((key) => MEASUREMENT_LABELS[key])
          .join(", ")}, or choose an assisted fitting.`,
      );
    if (!d.budget || !d.eventDate || !d.deliveryDate)
      throw new Error("Choose a budget, event date and delivery date.");
    if (d.deliveryDate < new Date().toISOString().slice(0, 10))
      throw new Error("Delivery cannot be in the past.");
    if (!d.consent)
      throw new Error("Confirm the request details before submitting.");
  }
  return d;
}
