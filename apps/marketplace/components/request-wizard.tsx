"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  STEPS,
  OCCASIONS,
  GARMENTS,
  SILHOUETTES,
  BUDGETS,
  validateDraft,
  type OutfitDraft,
  type RequestStep,
  type Measurements,
} from "../lib/outfit-request";
import { MarketIcon } from "./market-icon";
import { MediaUploader, sendWithProgress } from "@faden/ui";

const colorOptions = [
  ["Midnight Charcoal", "#1a1a1a"],
  ["Alabaster Ivory", "#f3f0ef"],
  ["Terracotta Earth", "#94452e"],
  ["Burnished Olive", "#775a19"],
  ["Muted Rose", "#b75760"],
  ["Pale Ochre", "#fed488"],
];
const occasionAssets = ["020", "075", "078", "023"];
const silhouetteAssets = ["066", "043", "074"];
const fabricOptions = [
  ["Fluid & Silky", "Satin, Charmeuse, Silk", "030"],
  ["Crisp & Structured", "Linen, Poplin, Twill", "015"],
  ["Sheer & Weightless", "Organza, Tulle, Chiffon", "077"],
];
const methods = [
  ["manual", "I know my measurements", "Enter them securely below."],
  [
    "saved",
    "Use my saved measurements",
    "Load your private measurement profile.",
  ],
  [
    "boutique",
    "Visit the boutique",
    "Request an in-person measurement session.",
  ],
  ["video", "Video fitting", "Request guided online fitting."],
  [
    "home",
    "Have someone visit me",
    "Request a home fitting, subject to availability.",
  ],
  [
    "later",
    "I’ll decide later",
    "Choose with your boutique when you’re ready.",
  ],
];

export function RequestWizard({
  step,
  initial,
  requestId,
  version,
  sources,
  initialUrls,
  savedMeasurements,
  context,
}: {
  step: RequestStep;
  initial: OutfitDraft;
  requestId: string | null;
  version: number;
  sources: { boutique?: string; design?: string };
  initialUrls: Record<string, string>;
  savedMeasurements: Measurements | null;
  context: string;
}) {
  const router = useRouter();
  const index = STEPS.indexOf(step);
  const [draft, setDraft] = useState(initial);
  const [id, setId] = useState(requestId);
  const [revision, setRevision] = useState(version);
  const [urls, setUrls] = useState(initialUrls);
  const [savedProfile, setSavedProfile] = useState(savedMeasurements);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function update<K extends keyof OutfitDraft>(key: K, value: OutfitDraft[K]) {
    setDraft((d) => ({
      ...d,
      [key]: value,
      ...(key !== "consent" ? { consent: false } : {}),
    }));
    setDirty(true);
    setMessage("");
    setError("");
  }
  async function call(path: string, body: unknown, method = "POST") {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error ?? "Unable to save. Please try again.");
    return result;
  }
  async function save(complete = false, nextDraft = draft) {
    const cleaned = validateDraft(nextDraft, complete);
    let key = id,
      rev = revision;
    if (!key) {
      const row = await call("/api/requests", sources);
      key = row.id;
      rev = row.version;
      setId(key);
      setRevision(rev);
    }
    const row = await call(
      `/api/requests/${key}`,
      { draft: cleaned, version: rev },
      "PATCH",
    );
    setRevision(row.version);
    setDraft(cleaned);
    setDirty(false);
    setMessage("Draft saved");
    window.history.replaceState(null, "", `/create/${step}?id=${row.id}`);
    return row;
  }
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function navigate(target: number) {
    await run(async () => {
      if (target > index) {
        if (step === "occasion" && (!draft.occasion || !draft.garment))
          throw new Error("Choose an occasion and garment to continue.");
        if (step === "style" && !draft.expert && !draft.silhouette)
          throw new Error("Choose a silhouette or Expert Curation.");
        if (step === "measurements" && !draft.measurementMethod)
          throw new Error("Choose how you would like to handle measurements.");
      }
      const row = await save();
      router.push(`/create/${STEPS[target]}?id=${row.id}`);
    });
  }
  async function submit() {
    await run(async () => {
      const row = await save(true);
      await call(`/api/requests/${row.id}/submit`, { version: row.version });
      router.push(`/requests/${row.id}`);
    });
  }
  async function uploadInspiration(
    file: File,
    context: { onProgress: (percent: number) => void; signal: AbortSignal },
  ) {
    const row = await save();
    const form = new FormData();
    form.set("file", file);
    form.set("version", String(row.version));
    const result = await sendWithProgress({
      url: `/api/requests/${row.id}/inspiration`,
      method: "POST",
      body: form,
      onProgress: context.onProgress,
      signal: context.signal,
    });
    if (result.status >= 400) {
      throw new Error(
        typeof result.json.error === "string"
          ? result.json.error
          : "Upload failed.",
      );
    }
    const data = result.json as {
      row: { draft: unknown; version: number };
      key: string;
      url?: string;
    };
    setDraft(validateDraft(data.row.draft));
    setRevision(data.row.version);
    if (data.url) {
      setUrls((current) => ({ ...current, [data.key]: data.url as string }));
    }
    setDirty(false);
    setMessage("Image saved privately.");
    return { key: data.key, displayUrl: data.url ?? "" };
  }
  async function removeInspiration(key: string) {
    if (confirmRemove !== key) {
      setConfirmRemove(key);
      return;
    }
    await run(async () => {
      const next = {
        ...draft,
        inspirations: draft.inspirations.filter((item) => item.key !== key),
      };
      const row = await save(false, next);
      setDraft(validateDraft(row.draft));
      setUrls((current) => {
        const copy = { ...current };
        delete copy[key];
        return copy;
      });
      await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          bucket: "request-inspirations",
          path: key,
        }),
      });
      setConfirmRemove(null);
      setMessage("Image removed.");
    });
  }
  function toggle(key: "colors" | "fabrics", value: string, max: number) {
    const values = draft[key];
    if (!values.includes(value) && values.length >= max) {
      setError(`Choose up to ${max} ${key}.`);
      return;
    }
    update(
      key,
      values.includes(value)
        ? values.filter((x) => x !== value)
        : [...values, value],
    );
  }
  function measurementMethod(value: string) {
    update("measurementMethod", value);
    if (value === "saved" && savedProfile) {
      setDraft((d) => ({ ...d, measurements: savedProfile }));
    }
  }
  const dateMin = new Date().toISOString().slice(0, 10);
  return (
    <div className="market-page request-flow">
      <header className="request-topbar">
        <button
          aria-label="Save & Exit"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await save();
              router.push("/requests");
            })
          }
        >
          <MarketIcon name="close" />
          <span>Save & Exit</span>
        </button>
        <div>
          <span>Step {index + 1} of 6</span>
          <progress aria-label="Request progress" value={index + 1} max={6} />
        </div>
        <Link
          href="/requests"
          onClick={(e) => {
            if (dirty || busy) {
              e.preventDefault();
              setError("Use Save & Exit to keep your changes before leaving.");
            }
          }}
        >
          My Requests
        </Link>
      </header>
      <main className={`request-canvas request-canvas--${step}`}>
        <fieldset className="request-fields" disabled={busy}>
          {context && (
            <p className="request-context">Creating with: {context}</p>
          )}
          {step === "occasion" && (
            <>
              <h1 className="occasion-title">What are you dressing for?</h1>
              <fieldset className="occasion-options">
                <legend className="sr-only">Occasion</legend>
                {OCCASIONS.slice(0, 4).map((option, i) => (
                  <button
                    type="button"
                    aria-pressed={draft.occasion === option}
                    key={option}
                    onClick={() => update("occasion", option)}
                  >
                    <Image
                      src={`/stitch-assets/asset-${occasionAssets[i]}.jpg`}
                      alt=""
                      fill
                      sizes="(max-width:760px) 50vw, 25vw"
                      unoptimized
                    />
                    <span>{option}</span>
                    {draft.occasion === option && <b aria-hidden="true">✓</b>}
                  </button>
                ))}
              </fieldset>
              <button
                className="other-occasion"
                aria-pressed={draft.occasion === "Other"}
                onClick={() => update("occasion", "Other")}
              >
                Another occasion
              </button>
              <fieldset className="request-section">
                <legend>What would you like to create?</legend>
                <div className="request-chips">
                  {GARMENTS.map((g) => (
                    <button
                      type="button"
                      aria-pressed={draft.garment === g}
                      onClick={() => update("garment", g)}
                      key={g}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {step === "inspiration" && (
            <div className="inspiration-layout">
              <section>
                <h1>Show us what you love</h1>
                <p>
                  Photos, sketches, textures—build your digital mood board. Your
                  uploads are private.
                </p>
                <MediaUploader
                  className="inspiration-upload"
                  label="Drag & drop or browse"
                  hint="JPG, PNG, WebP · up to 10 MB · 8 images"
                  maxFiles={8}
                  takenCount={draft.inspirations.length}
                  disabled={busy}
                  retainReady={false}
                  uploadFile={uploadInspiration}
                />
                <div className="request-section">
                  <label htmlFor="inspiration-link">Link inspiration</label>
                  <div className="inspiration-link">
                    <input
                      id="inspiration-link"
                      type="url"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="Paste a Pinterest or Instagram URL…"
                    />
                    <button
                      onClick={() => {
                        try {
                          const next = validateDraft({
                            ...draft,
                            links: [...draft.links, link.trim()],
                          });
                          update("links", next.links);
                          setLink("");
                        } catch (e) {
                          setError(
                            e instanceof Error ? e.message : "Invalid link.",
                          );
                        }
                      }}
                      type="button"
                    >
                      Add
                    </button>
                  </div>
                  <small>
                    Links are saved as references, not fetched or embedded.
                  </small>
                </div>
                <label className="request-section">
                  Tell us what matters
                  <textarea
                    rows={4}
                    maxLength={3000}
                    value={draft.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    placeholder="Details you love, things to avoid, the feeling you’re looking for…"
                  />
                </label>
              </section>
              <section aria-label="Your mood board" className="mood-board">
                {!draft.inspirations.length && !draft.links.length && (
                  <div className="mood-empty">
                    <span>✧</span>
                    <h2>Your vision starts here.</h2>
                    <p>
                      Add an image or a link—or continue and let your boutique
                      guide you.
                    </p>
                  </div>
                )}
                {draft.inspirations.map((item, i) => (
                  <article key={item.key}>
                    {urls[item.key] ? (
                      <Image
                        src={urls[item.key]}
                        alt={`Private inspiration ${i + 1}`}
                        width={480}
                        height={560}
                        unoptimized
                      />
                    ) : (
                      <p>
                        Image preview unavailable. Save and reopen your draft to
                        refresh it.
                      </p>
                    )}
                    <label>
                      <span className="sr-only">Note for image {i + 1}</span>
                      <textarea
                        maxLength={1000}
                        rows={2}
                        value={item.note}
                        placeholder="What do you love about this?"
                        onChange={(e) =>
                          update(
                            "inspirations",
                            draft.inspirations.map((x, n) =>
                              n === i ? { ...x, note: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void removeInspiration(item.key)}
                    >
                      {confirmRemove === item.key
                        ? "Confirm remove"
                        : "Remove from board"}
                    </button>
                    {confirmRemove === item.key && (
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(null)}
                      >
                        Keep
                      </button>
                    )}
                  </article>
                ))}
                {draft.links.map((url, i) => (
                  <article className="link-pin" key={url + i}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {new URL(url).hostname} ↗
                    </a>
                    <p>{url}</p>
                    <button
                      onClick={() =>
                        update(
                          "links",
                          draft.links.filter((_, n) => n !== i),
                        )
                      }
                    >
                      Remove link
                    </button>
                  </article>
                ))}
              </section>
            </div>
          )}
          {step === "style" && (
            <>
              <h1>What do you have in mind?</h1>
              <p className="request-intro">
                Define the aesthetic foundation of your bespoke piece, or let
                your atelier guide the design.
              </p>
              <label className="expert-curation">
                <div>
                  <h2>✧ Expert Curation</h2>
                  <p>
                    I’m not sure—let my boutique suggest the silhouette, fabrics
                    and details.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={draft.expert}
                  onChange={(e) => update("expert", e.target.checked)}
                />
              </label>
              <fieldset className="request-section">
                <legend>
                  Color Story <small>Select up to 3</small>
                </legend>
                <div className="color-options">
                  {colorOptions.map(([name, color]) => (
                    <button
                      key={name}
                      style={{ background: color }}
                      aria-label={name}
                      title={name}
                      aria-pressed={draft.colors.includes(name)}
                      onClick={() => toggle("colors", name, 3)}
                    >
                      <span>{draft.colors.includes(name) ? "✓" : ""}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="request-section">
                <legend>
                  Silhouette{" "}
                  <small>
                    {draft.expert
                      ? "Optional with Expert Curation"
                      : "Required"}
                  </small>
                </legend>
                <div className="silhouette-options">
                  {SILHOUETTES.map((name, i) => (
                    <button
                      key={name}
                      aria-pressed={draft.silhouette === name}
                      onClick={() => update("silhouette", name)}
                    >
                      <div>
                        {i < 3 ? (
                          <Image
                            src={`/stitch-assets/asset-${silhouetteAssets[i]}.jpg`}
                            alt=""
                            fill
                            sizes="25vw"
                            unoptimized
                          />
                        ) : (
                          <span>✎</span>
                        )}
                      </div>
                      <span>{name}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="style-details">
                {(
                  [
                    [
                      "neckline",
                      "Neckline",
                      ["V-Neck", "High Collar", "Asymmetric", "Boatneck"],
                    ],
                    [
                      "sleeves",
                      "Sleeves",
                      ["Sleeveless", "Fitted Long", "Voluminous", "Cap Sleeve"],
                    ],
                  ] as const
                ).map(([key, label, options]) => (
                  <fieldset className="request-section" key={key}>
                    <legend>{label}</legend>
                    <div className="request-chips">
                      {options.map((x) => (
                        <button
                          key={x}
                          onClick={() => update(key, draft[key] === x ? "" : x)}
                          aria-pressed={draft[key] === x}
                        >
                          {x}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <fieldset className="request-section">
                <legend>
                  Fabric Feeling <small>Optional</small>
                </legend>
                <div className="fabric-options">
                  {fabricOptions.map(([name, description, asset]) => (
                    <button
                      key={name}
                      aria-pressed={draft.fabrics.includes(name)}
                      onClick={() => toggle("fabrics", name, 3)}
                    >
                      <Image
                        src={`/stitch-assets/asset-${asset}.jpg`}
                        alt=""
                        fill
                        sizes="33vw"
                        unoptimized
                      />
                      <div>
                        <h3>{name}</h3>
                        <small>{description}</small>
                      </div>
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {step === "measurements" && (
            <>
              <h1 className="measurement-title">
                How would you like to handle measurements?
              </h1>
              <p className="measurement-privacy">
                Your measurements stay private. This phase does not share them
                with boutiques.
              </p>
              <fieldset className="measurement-methods">
                <legend className="sr-only">Measurement method</legend>
                {methods.map(([value, title, description]) => (
                  <button
                    key={value}
                    disabled={value === "saved" && !savedProfile}
                    aria-pressed={draft.measurementMethod === value}
                    className={`measurement-method measurement-method--${value}`}
                    onClick={() => measurementMethod(value)}
                  >
                    <span aria-hidden="true">
                      {value === "later" ? "→" : "◇"}
                    </span>
                    <h2>{title}</h2>
                    <p>
                      {value === "saved" && !savedProfile
                        ? "No saved measurements yet. Enter them manually to create a profile."
                        : description}
                    </p>
                  </button>
                ))}
              </fieldset>
              {["manual", "saved"].includes(draft.measurementMethod) && (
                <section className="measurement-entry">
                  <h2>Your measurements</h2>
                  <p>
                    Measure with a soft tape. These are starting details; your
                    boutique will confirm the fit.
                  </p>
                  <label>
                    Unit
                    <select
                      value={draft.measurements.unit}
                      onChange={(e) => {
                        const unit = e.target.value as "cm" | "in";
                        const ratio = unit === "cm" ? 2.54 : 1 / 2.54;
                        const m = { ...draft.measurements, unit };
                        for (const k of [
                          "chest",
                          "waist",
                          "hips",
                          "height",
                        ] as const)
                          if (m[k]) m[k] = (Number(m[k]) * ratio).toFixed(1);
                        update("measurements", m);
                      }}
                    >
                      <option value="cm">Centimetres</option>
                      <option value="in">Inches</option>
                    </select>
                  </label>
                  <div className="measurement-fields">
                    {(["chest", "waist", "hips", "height"] as const).map(
                      (key) => (
                        <label key={key}>
                          {key}
                          {key === "height" ? " (optional)" : ""}
                          <input
                            aria-label={key}
                            type="number"
                            min=".1"
                            max={draft.measurements.unit === "cm" ? 300 : 120}
                            step=".1"
                            value={draft.measurements[key]}
                            onChange={(e) =>
                              update("measurements", {
                                ...draft.measurements,
                                [key]: e.target.value,
                              })
                            }
                          />
                        </label>
                      ),
                    )}
                  </div>
                  <button
                    className="button button--ghost"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await call("/api/measurements", {
                          measurements: draft.measurements,
                        });
                        setSavedProfile(draft.measurements);
                        setMessage("Private measurement profile saved.");
                      })
                    }
                  >
                    Save measurements to my profile
                  </button>
                </section>
              )}
              {["home", "video", "boutique"].includes(
                draft.measurementMethod,
              ) && (
                <p className="request-notice">
                  This records your preference only. No appointment is booked;
                  availability and any fitting fee must be confirmed later.
                </p>
              )}
            </>
          )}
          {step === "budget" && (
            <div className="budget-layout">
              <section>
                <h1>Let’s make sure it works for you.</h1>
                <div className="budget-editorial">
                  <Image
                    src="/stitch-assets/asset-069.jpg"
                    alt="Hands draping ivory silk in an atelier"
                    fill
                    sizes="40vw"
                    unoptimized
                  />
                </div>
              </section>
              <section>
                <fieldset className="request-section">
                  <legend>Timeline</legend>
                  <div className="request-dates">
                    <label>
                      When is your event?
                      <input
                        type="date"
                        min={dateMin}
                        value={draft.eventDate}
                        onChange={(e) => update("eventDate", e.target.value)}
                      />
                    </label>
                    <label>
                      When would you like your outfit?
                      <input
                        type="date"
                        min={dateMin}
                        max={draft.eventDate || undefined}
                        value={draft.deliveryDate}
                        onChange={(e) => update("deliveryDate", e.target.value)}
                      />
                    </label>
                  </div>
                </fieldset>
                <fieldset className="request-section">
                  <legend>Investment Level</legend>
                  <div className="budget-options">
                    {Object.entries(BUDGETS).map(([value, label]) => (
                      <button
                        key={value}
                        aria-pressed={draft.budget === value}
                        onClick={() => update("budget", value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <p className="request-notice">
                  Budget is guidance, not a quote. Final pricing, fitting and
                  delivery charges will be confirmed in an offer.
                </p>
                {draft.deliveryDate &&
                  Date.parse(draft.deliveryDate) - Date.now() <
                    14 * 86400000 && (
                    <p className="request-notice">
                      Your requested delivery is within two weeks. Rush
                      availability is not guaranteed.
                    </p>
                  )}
              </section>
            </div>
          )}
          {step === "review" && (
            <>
              <h1>Every detail, considered.</h1>
              <p className="request-intro">
                Review your brief before submitting. You can edit any step;
                submitting locks this version.
              </p>
              <dl className="request-review">
                <div>
                  <dt>Occasion & garment</dt>
                  <dd>
                    {draft.occasion || "Not selected"} ·{" "}
                    {draft.garment || "Not selected"}
                  </dd>
                  <button onClick={() => navigate(0)}>Edit</button>
                </div>
                <div>
                  <dt>Inspiration</dt>
                  <dd>
                    {draft.inspirations.length} images · {draft.links.length}{" "}
                    links<p>{draft.notes}</p>
                  </dd>
                  <button onClick={() => navigate(1)}>Edit</button>
                </div>
                <div>
                  <dt>Your style</dt>
                  <dd>
                    {draft.expert
                      ? "Expert Curation"
                      : draft.silhouette || "Not selected"}
                    <p>
                      {draft.colors.join(", ")}
                      <br />
                      {draft.neckline} {draft.sleeves}
                      <br />
                      {draft.fabrics.join(", ")}
                    </p>
                  </dd>
                  <button onClick={() => navigate(2)}>Edit</button>
                </div>
                <div>
                  <dt>Measurements</dt>
                  <dd>
                    {methods.find(
                      ([v]) => v === draft.measurementMethod,
                    )?.[1] ?? "Not selected"}
                    {["manual", "saved"].includes(draft.measurementMethod) && (
                      <p>
                        Chest {draft.measurements.chest} · Waist{" "}
                        {draft.measurements.waist} · Hips{" "}
                        {draft.measurements.hips} ({draft.measurements.unit})
                      </p>
                    )}
                  </dd>
                  <button onClick={() => navigate(3)}>Edit</button>
                </div>
                <div>
                  <dt>Budget & date</dt>
                  <dd>
                    {BUDGETS[draft.budget as keyof typeof BUDGETS] ??
                      "Not selected"}
                    <p>
                      Delivery {draft.deliveryDate || "—"}
                      <br />
                      Event {draft.eventDate || "—"}
                    </p>
                  </dd>
                  <button onClick={() => navigate(4)}>Edit</button>
                </div>
              </dl>
              <label className="request-consent">
                <input
                  type="checkbox"
                  checked={draft.consent}
                  onChange={(e) => update("consent", e.target.checked)}
                />
                <span>
                  I confirm this brief is correct. I understand this is a
                  request, not an order or payment, and my measurements remain
                  private until I explicitly approve sharing.
                </span>
              </label>
            </>
          )}
          <div className="request-feedback" aria-live="polite">
            {error && <p role="alert">{error}</p>}
            {message && <p>{message}</p>}
          </div>
        </fieldset>
      </main>
      <footer className="request-actions">
        <button
          disabled={busy || index === 0}
          onClick={() => navigate(index - 1)}
        >
          <MarketIcon name="back" />
          Back
        </button>
        <span role="status">
          {busy
            ? "Saving…"
            : dirty
              ? "Unsaved changes"
              : id
                ? "Saved privately"
                : "New request"}
        </span>
        <button
          className="button button--primary"
          disabled={busy}
          onClick={() => (step === "review" ? submit() : navigate(index + 1))}
        >
          {busy
            ? "Please wait…"
            : step === "review"
              ? "Submit request"
              : "Continue"}
          <MarketIcon name="arrow" />
        </button>
      </footer>
    </div>
  );
}
