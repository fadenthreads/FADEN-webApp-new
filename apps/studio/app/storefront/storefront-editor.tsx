"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Boutique = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  status: string;
  is_published: boolean;
};
type Profile = {
  hero_image_url: string | null;
  story: string | null;
  specialties: string[];
  services: string[];
  years_experience: number | null;
  response_time_hours: number | null;
  next_available_date: string | null;
  minimum_price_paise: number | null;
  lead_time_min_weeks: number | null;
  lead_time_max_weeks: number | null;
  updated_at: string;
};

export function StorefrontEditor({
  boutique,
  profile,
  covers,
  currentCover,
}: {
  boutique: Boutique;
  profile: Profile;
  covers: { key: string; title: string; url: string }[];
  currentCover: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(profile.updated_at);
  const [hero, setHero] = useState(profile.hero_image_url ?? "");
  const [preview, setPreview] = useState({
    name: boutique.name,
    city: boutique.city ?? "",
    description: boutique.description ?? "",
  });
  const coverUrl =
    covers.find((c) => c.key === hero)?.url ||
    (hero === profile.hero_image_url ? currentCover : "");
  async function submit(formData: FormData) {
    setBusy(true);
    setMessage("");
    const value = (key: string) => String(formData.get(key) || "").trim();
    try {
      const response = await fetch("/api/storefront", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boutiqueId: boutique.id,
          version,
          heroImage: hero,
          name: value("name"),
          description: value("description"),
          city: value("city"),
          story: value("story"),
          specialties: value("specialties")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          services: value("services")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          yearsExperience: Number(value("yearsExperience")),
          responseHours: Number(value("responseHours")),
          nextAvailableDate: value("nextAvailableDate") || null,
          minimumPricePaise: Math.round(Number(value("minimumPrice")) * 100),
          leadTimeMinWeeks: Number(value("leadTimeMinWeeks")),
          leadTimeMaxWeeks: Number(value("leadTimeMaxWeeks")),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not save profile.");
      setVersion(data.version);
      setMessage(
        data.live
          ? "Storefront saved. These updates are live on your customer page."
          : "Storefront saved privately. Your boutique is not currently public.",
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save profile.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      action={submit}
      className="storefront-form"
      onChange={(event) => {
        const target = event.target;
        if (
          (target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement) &&
          ["name", "city", "description"].includes(target.name)
        )
          setPreview((current) => ({
            ...current,
            [target.name]: target.value,
          }));
      }}
    >
      <p className="offer-notice">
        Boutique verification controls whether this profile is public. Your
        portfolio controls which individual designs customers can see.
      </p>
      <section
        className="offer-panel studio-storefront-preview"
        aria-label="Storefront preview"
      >
        <p className="offer-kicker">Preview your edits · save to apply</p>
        {coverUrl && (
          <Image
            src={coverUrl}
            alt={`${preview.name} cover preview`}
            width={900}
            height={360}
            unoptimized
          />
        )}
        <h2>{preview.name}</h2>
        <p>{preview.city}</p>
        <p>{preview.description}</p>
        <label>
          Customer-page cover image
          <select
            disabled={busy}
            value={hero}
            onChange={(event) => setHero(event.target.value)}
          >
            {profile.hero_image_url &&
              !covers.some((c) => c.key === profile.hero_image_url) && (
                <option value={profile.hero_image_url}>
                  Keep current cover
                </option>
              )}
            <option value="">No cover selected</option>
            {covers.map((cover, i) => (
              <option key={`${cover.key}-${i}`} value={cover.key}>
                {cover.title}
              </option>
            ))}
          </select>
        </label>
        <p>
          Choose a published portfolio image. Before approval, save portfolio
          images as drafts; after approval, publish a design and select its
          image here. No private verification documents can be used as a cover.
        </p>
      </section>
      <fieldset disabled={busy} className="studio-storefront-editable">
        <section className="offer-panel">
          <h2>Identity and introduction</h2>
          <div className="storefront-fields">
            <label>
              Boutique name
              <input
                name="name"
                defaultValue={boutique.name}
                maxLength={120}
                required
              />
            </label>
            <label>
              City
              <input
                name="city"
                defaultValue={boutique.city || ""}
                maxLength={120}
                required
              />
            </label>
            <label className="wide">
              Short introduction
              <textarea
                name="description"
                defaultValue={boutique.description || ""}
                maxLength={1000}
                minLength={10}
                rows={3}
                required
              />
            </label>
            <label className="wide">
              Atelier story
              <textarea
                name="story"
                defaultValue={profile.story || ""}
                minLength={40}
                maxLength={5000}
                rows={8}
                required
              />
            </label>
          </div>
        </section>
        <section className="offer-panel">
          <h2>What customers can expect</h2>
          <div className="storefront-fields">
            <label className="wide">
              Specialties, separated by commas
              <input
                name="specialties"
                defaultValue={profile.specialties.join(", ")}
                required
              />
            </label>
            <label className="wide">
              Services, separated by commas
              <input
                name="services"
                defaultValue={profile.services.join(", ")}
                required
              />
            </label>
            <label>
              Years of experience
              <input
                name="yearsExperience"
                type="number"
                min={0}
                max={100}
                defaultValue={profile.years_experience ?? 0}
                required
              />
            </label>
            <label>
              Response time (hours)
              <input
                name="responseHours"
                type="number"
                min={1}
                max={720}
                defaultValue={profile.response_time_hours ?? 24}
                required
              />
            </label>
            <label>
              Next available date
              <input
                name="nextAvailableDate"
                type="date"
                defaultValue={profile.next_available_date || ""}
              />
            </label>
            <label>
              Starting price (₹)
              <input
                name="minimumPrice"
                type="number"
                min={0}
                max={10000000}
                step=".01"
                defaultValue={(profile.minimum_price_paise ?? 0) / 100}
                required
              />
            </label>
            <label>
              Minimum lead time (weeks)
              <input
                name="leadTimeMinWeeks"
                type="number"
                min={1}
                max={104}
                defaultValue={profile.lead_time_min_weeks ?? 4}
                required
              />
            </label>
            <label>
              Maximum lead time (weeks)
              <input
                name="leadTimeMaxWeeks"
                type="number"
                min={1}
                max={104}
                defaultValue={profile.lead_time_max_weeks ?? 8}
                required
              />
            </label>
          </div>
        </section>
      </fieldset>
      <section className="storefront-publishing">
        <div>
          <h2>Choose visible designs</h2>
          <p>
            Use Portfolio to publish customer-visible items. Draft and archived
            designs stay private.
          </p>
        </div>
        <a className="offer-btn secondary" href="/portfolio">
          Manage portfolio →
        </a>
      </section>
      {message && (
        <p role="status" className="offer-notice">
          {message}
        </p>
      )}
      <button className="offer-btn" disabled={busy} type="submit">
        {busy ? "Saving…" : "Save public storefront"}
      </button>
    </form>
  );
}
