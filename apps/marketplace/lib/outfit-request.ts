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
export const BUDGETS = {
  under_10k: "Under ₹10k",
  "10k_25k": "₹10k–25k",
  "25k_50k": "₹25k–50k",
  "50k_100k": "₹50k–100k",
  "100k_plus": "₹100k+",
  custom: "Let’s discuss",
};
export type Measurements = {
  unit: "cm" | "in";
  chest: string;
  waist: string;
  hips: string;
  height: string;
};
export type Inspiration = { key: string; note: string };
export type OutfitDraft = {
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
  const measurements = {
    unit: m.unit as "cm" | "in",
    chest: "",
    waist: "",
    hips: "",
    height: "",
  };
  for (const key of ["chest", "waist", "hips", "height"] as const) {
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
    occasion: choice("occasion", OCCASIONS),
    garment: choice("garment", GARMENTS),
    notes: str("notes", 3000),
    inspirations,
    links,
    expert: flag("expert"),
    colors: list("colors", 3),
    silhouette: choice("silhouette", SILHOUETTES),
    neckline: choice("neckline", [
      "V-Neck",
      "High Collar",
      "Asymmetric",
      "Boatneck",
    ]),
    sleeves: choice("sleeves", [
      "Sleeveless",
      "Fitted Long",
      "Voluminous",
      "Cap Sleeve",
    ]),
    fabrics: list("fabrics", 3),
    measurementMethod: choice("measurementMethod", [
      "manual",
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
    if (!d.expert && !d.silhouette)
      throw new Error("Choose a silhouette or Expert Curation.");
    if (!d.measurementMethod)
      throw new Error("Choose a measurement method, including decide later.");
    if (
      ["manual", "saved"].includes(d.measurementMethod) &&
      (!d.measurements.chest || !d.measurements.waist || !d.measurements.hips)
    )
      throw new Error(
        "Enter chest, waist and hips, or choose an assisted fitting.",
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
