"use client";
import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import {
  STEPS,
  OCCASIONS,
  GARMENTS,
  SILHOUETTES,
  BUDGETS,
  NECKLINES,
  SLEEVES,
  MEASUREMENT_LABELS,
  measurementFields,
  requiredMeasurements,
  type MeasurementKey,
  validateDraft,
  type OutfitDraft,
  type RequestStep,
  type Measurements,
} from "../lib/outfit-request";
import { MarketIcon } from "./market-icon";
import { MeasurementReference } from "./measurement-reference";
import {
  mergeRequestDraft,
  createRequestQueue,
} from "../lib/request-merge.mjs";
import { MediaUploader, sendWithProgress } from "@faden/ui";

const colorOptions = [
  ["Midnight Charcoal", "#1a1a1a"],
  ["Alabaster Ivory", "#f3f0ef"],
  ["Terracotta Earth", "#94452e"],
  ["Burnished Olive", "#775a19"],
  ["Muted Rose", "#b75760"],
  ["Pale Ochre", "#fed488"],
  ["Blush Pink", "#e8b4b8"],
  ["Rose Gold", "#b76e79"],
  ["Champagne", "#e8d5b7"],
  ["Ruby Red", "#9b111e"],
  ["Burgundy", "#650f30"],
  ["Emerald", "#176b4d"],
  ["Sage", "#a8b5a0"],
  ["Royal Blue", "#334d9c"],
  ["Navy", "#172944"],
  ["Lavender", "#b7a0d4"],
  ["Plum", "#6e385a"],
  ["Peach", "#efb497"],
  ["Silver", "#c1c4c7"],
  ["Gold", "#c3a34a"],
];
const occasionAssets = ["020", "075", "078", "023"];
const silhouetteAssets = ["066", "043", "074"];
const fabricOptions = [
  ["Fluid & Silky", "Satin, Charmeuse, Silk", "030"],
  ["Crisp & Structured", "Linen, Poplin, Twill", "015"],
  ["Sheer & Weightless", "Organza, Tulle, Chiffon", "077"],
  ["Velvety & Plush", "Silk velvet, velour", "030"],
  ["Rich & Lustrous", "Duchess satin, silk satin", "030"],
  ["Regal & Woven", "Banarasi silk, brocade, jacquard", "015"],
  ["Airy & Delicate", "Silk georgette, fine chiffon", "077"],
  ["Soft & Draped", "Crepe, modal silk", "030"],
  ["Textured & Artisanal", "Raw silk, tussar, handloom", "015"],
  ["Romantic & Lacy", "Chantilly lace, embroidered tulle", "077"],
  ["Luminous & Embellished", "Sequins, zari, beadwork", "015"],
  ["Warm & Tailored", "Fine wool, cashmere blends", "015"],
];
const methods = [
  [
    "reference",
    "Upload my measurement chart",
    "Send a photo or screenshot of your existing measurements.",
  ],
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
  const [draft, setDraftState] = useState(initial);
  const draftRef = useRef(initial);
  const baseline = useRef(initial);
  function setDraft(value: SetStateAction<OutfitDraft>) {
    const next = typeof value === "function" ? value(draftRef.current) : value;
    draftRef.current = next;
    setDraftState(next);
  }
  const [id, setIdState] = useState(requestId);
  const idRef = useRef(requestId);
  function setId(value: string) {
    idRef.current = value;
    setIdState(value);
  }
  const revision = useRef(version);
  function setRevision(value: number) {
    revision.current = value;
  }
  const [urls, setUrls] = useState(initialUrls);
  const [savedProfile, setSavedProfile] = useState(savedMeasurements);
  const [working, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(requestId));
  const [pending, setPending] = useState(0);
  const [navigating, startNavigation] = useTransition();
  const busy = working || loading || pending > 0 || navigating;
  const queue = useRef(createRequestQueue());
  const action = useRef(false);
  const [conflict, setConflict] = useState<{
    draft: unknown;
    version: number;
  } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const fields = measurementFields(draft.garment, draft.sleeves);
  const required = requiredMeasurements(draft.garment);
  const [customColor, setCustomColor] = useState("#d8a0af");
  const [customColorName, setCustomColorName] = useState("");
  const [customFabric, setCustomFabric] = useState("");
  useEffect(() => {
    if (!requestId) return;
    const controller = new AbortController();
    fetch(`/api/requests/${requestId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Unable to load your saved request. Please refresh.");
        return response.json();
      })
      .then((row) => {
        if (controller.signal.aborted) return;
        if (row.status === "submitted") {
          router.replace(`/requests/${row.id}`);
          return;
        }
        const fresh = validateDraft(row.draft);
        setDraft(fresh);
        baseline.current = fresh;
        setRevision(row.version);
        setLoading(false);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(error.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
    // A cached previous step must fetch the latest row before editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, step]);
  function exclusive<T>(task: () => Promise<T>): Promise<T> {
    setPending((count) => count + 1);
    const result = queue.current(task);
    return result.finally(() => setPending((count) => count - 1));
  }
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
  async function call(
    path: string,
    body: unknown,
    method = "POST",
    attempt = 0,
  ): Promise<{ id: string; version: number; draft: unknown }> {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) {
      if (result.code === "review_updated") {
        const fresh = validateDraft(result.current.draft);
        baseline.current = fresh;
        setRevision(result.current.version);
        setDraft({ ...fresh, consent: false });
        setDirty(true);
      }
      if (result.code === "retry_save" && attempt < 2)
        return call(path, body, method, attempt + 1);
      if (result.code === "already_submitted") {
        router.replace(`/requests/${result.id}`);
        throw new Error("Opening your submitted request…");
      }
      if (result.code === "draft_conflict") setConflict(result.current);
      throw new Error(result.error ?? "Unable to save. Please try again.");
    }
    return result;
  }
  async function saveUnlocked(complete = false, nextDraft = draftRef.current) {
    const cleaned = validateDraft(nextDraft, complete);
    let key = idRef.current,
      rev = revision.current;
    if (!key) {
      const row = await call("/api/requests", sources);
      key = row.id;
      rev = row.version;
      setId(row.id);
      setRevision(rev);
    }
    const row = await call(
      `/api/requests/${key}`,
      { draft: cleaned, version: rev, baseDraft: baseline.current },
      "PATCH",
    );
    setRevision(row.version);
    const saved = validateDraft(row.draft);
    setDraft(saved);
    baseline.current = saved;
    setDirty(false);
    setMessage("Draft saved");
    window.history.replaceState(null, "", `/create/${step}?id=${row.id}`);
    return row;
  }
  function save(complete = false, nextDraft?: OutfitDraft) {
    return exclusive(() =>
      saveUnlocked(complete, nextDraft ?? draftRef.current),
    );
  }
  async function run(task: () => Promise<void>) {
    if (action.current || loading || navigating) return;
    action.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      action.current = false;
      setBusy(false);
    }
  }
  async function navigate(target: number) {
    await run(async () => {
      if (target > index) {
        if (step === "occasion" && (!draft.occasion || !draft.garment))
          throw new Error("Choose an occasion and garment to continue.");
        if (
          step === "occasion" &&
          draft.occasion === "Other" &&
          !draft.otherOccasion.trim()
        )
          throw new Error("Tell us your occasion to continue.");
        if (step === "style" && !draft.expert && !draft.silhouette)
          throw new Error("Choose a silhouette or Expert Curation.");
        if (
          step === "style" &&
          !draft.expert &&
          draft.silhouette === "Custom Form" &&
          !draft.customSilhouette.trim()
        )
          throw new Error("Describe your custom silhouette to continue.");
        if (
          step === "style" &&
          draft.neckline === "Custom / Other" &&
          !draft.necklineNotes.trim()
        )
          throw new Error("Describe your neckline to continue.");
        if (
          step === "style" &&
          draft.sleeves === "Custom / Other" &&
          !draft.sleeveNotes.trim()
        )
          throw new Error("Describe your sleeves to continue.");
        if (step === "measurements" && !draft.measurementMethod)
          throw new Error("Choose how you would like to handle measurements.");
        if (
          step === "measurements" &&
          draft.measurementMethod === "reference" &&
          !draft.measurements.reference
        )
          throw new Error(
            "Upload your chart or choose another measurement option.",
          );
        if (
          step === "measurements" &&
          ["manual", "saved"].includes(draft.measurementMethod) &&
          required.some((key) => !draft.measurements[key])
        )
          throw new Error(
            `Enter ${required.map((key) => MEASUREMENT_LABELS[key]).join(", ")}, or choose an assisted fitting.`,
          );
        if (
          step === "budget" &&
          (!draft.budget || !draft.deliveryDate || !draft.eventDate)
        )
          throw new Error(
            "Choose your budget, event date, and requested delivery date.",
          );
      }
      const row =
        !dirty && idRef.current ? { id: idRef.current } : await save();
      startNavigation(() =>
        router.push(`/create/${STEPS[target]}?id=${row.id}`),
      );
    });
  }
  async function submit() {
    await run(async () => {
      const row = await save(true);
      await call(`/api/requests/${row.id}/submit`, { version: row.version });
      startNavigation(() => router.push(`/requests/${row.id}`));
    });
  }
  async function uploadInspiration(
    file: File,
    context: { onProgress: (percent: number) => void; signal: AbortSignal },
  ) {
    return exclusive(async () => {
      const row = await saveUnlocked();
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
      baseline.current = validateDraft(data.row.draft);
      setRevision(data.row.version);
      if (data.url) {
        setUrls((current) => ({ ...current, [data.key]: data.url as string }));
      }
      setDirty(false);
      setMessage("Image saved privately.");
      return { key: data.key, displayUrl: data.url ?? "" };
    });
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
  async function uploadMeasurementReference(
    file: File,
    context: { onProgress: (percent: number) => void; signal: AbortSignal },
  ) {
    return exclusive(async () => {
      const row = await saveUnlocked();
      const form = new FormData();
      form.set("file", file);
      form.set("version", String(row.version));
      const result = await sendWithProgress({
        url: `/api/requests/${row.id}/measurement-reference`,
        method: "POST",
        body: form,
        onProgress: context.onProgress,
        signal: context.signal,
      });
      if (result.status >= 400)
        throw new Error(
          typeof result.json.error === "string"
            ? result.json.error
            : "Upload failed.",
        );
      const data = result.json as {
        row: { draft: unknown; version: number };
        key: string;
        url?: string;
      };
      setDraft(validateDraft(data.row.draft));
      baseline.current = validateDraft(data.row.draft);
      setRevision(data.row.version);
      setDirty(false);
      if (data.url)
        setUrls((current) => ({ ...current, [data.key]: data.url! }));
      setMessage("Measurement reference saved privately.");
      return { key: data.key, displayUrl: data.url ?? "" };
    });
  }
  async function removeMeasurementReference() {
    if (confirmRemove !== "measurement") {
      setConfirmRemove("measurement");
      return;
    }
    await run(async () => {
      const row = await save();
      const form = new FormData();
      form.set("action", "remove");
      form.set("version", String(row.version));
      const response = await fetch(
        `/api/requests/${row.id}/measurement-reference`,
        { method: "POST", body: form },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not remove reference.");
      setDraft(validateDraft(data.row.draft));
      baseline.current = validateDraft(data.row.draft);
      setRevision(data.row.version);
      setDirty(false);
      setConfirmRemove(null);
      setMessage("Measurement reference removed.");
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
      setDraft((d) => ({
        ...d,
        measurements: { ...savedProfile, reference: d.measurements.reference },
      }));
    }
    if (["manual", "saved", "reference"].includes(value))
      requestAnimationFrame(() =>
        document
          .getElementById(
            value === "reference" ? "measurement-upload" : "measurement-manual",
          )
          ?.scrollIntoView({
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
            block: "start",
          }),
      );
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
              startNavigation(() => router.push("/requests"));
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
                      src={`/stitch-assets/asset-${occasionAssets[i % occasionAssets.length]}.jpg`}
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
              <div
                className="request-chips occasion-more"
                aria-label="More occasions"
              >
                {OCCASIONS.slice(4)
                  .filter((option) => option !== "Other")
                  .map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={draft.occasion === option}
                      onClick={() => update("occasion", option)}
                    >
                      {option}
                    </button>
                  ))}
              </div>
              <button
                className="other-occasion"
                aria-pressed={draft.occasion === "Other"}
                onClick={() => update("occasion", "Other")}
              >
                Another occasion
              </button>
              {draft.occasion === "Other" && (
                <label className="request-section">
                  Your occasion
                  <input
                    type="text"
                    maxLength={120}
                    value={draft.otherOccasion}
                    onChange={(event) =>
                      update("otherOccasion", event.target.value)
                    }
                    placeholder="For example, housewarming or a family celebration"
                    required
                  />
                </label>
              )}
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
                <div className="custom-color-picker">
                  <label>
                    Choose any colour
                    <input
                      type="color"
                      value={customColor}
                      onChange={(event) => setCustomColor(event.target.value)}
                    />
                  </label>
                  <label>
                    Colour name (optional)
                    <input
                      type="text"
                      maxLength={80}
                      value={customColorName}
                      onChange={(event) =>
                        setCustomColorName(event.target.value)
                      }
                      placeholder="For example, dusty rose"
                    />
                  </label>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() =>
                      toggle(
                        "colors",
                        `${customColorName.trim() || "Custom colour"} (${customColor})`,
                        3,
                      )
                    }
                  >
                    Add colour
                  </button>
                </div>
                {draft.colors.length > 0 && (
                  <div className="request-chips" aria-label="Selected colours">
                    {draft.colors.map((color) => (
                      <button
                        type="button"
                        key={color}
                        onClick={() => toggle("colors", color, 3)}
                        aria-label={`Remove ${color}`}
                      >
                        {color} ×
                      </button>
                    ))}
                  </div>
                )}
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
                      onClick={() => {
                        update("silhouette", name);
                        if (name === "Custom Form")
                          requestAnimationFrame(() =>
                            document
                              .getElementById("custom-silhouette-entry")
                              ?.scrollIntoView({
                                behavior: matchMedia(
                                  "(prefers-reduced-motion: reduce)",
                                ).matches
                                  ? "instant"
                                  : "smooth",
                                block: "center",
                              }),
                          );
                      }}
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
                {draft.silhouette === "Custom Form" && (
                  <label
                    className="request-section"
                    id="custom-silhouette-entry"
                  >
                    Describe your custom silhouette
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={draft.customSilhouette}
                      onChange={(event) =>
                        update("customSilhouette", event.target.value)
                      }
                      placeholder="Tell us about the shape, cut, fit, layers, or details you want."
                    />
                  </label>
                )}
              </fieldset>
              <div className="style-details">
                {(
                  [
                    ["neckline", "Neckline", NECKLINES],
                    ["sleeves", "Sleeves", SLEEVES],
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
                    {draft[key] === "Custom / Other" && (
                      <label>
                        Describe your {label.toLowerCase()}
                        <textarea
                          maxLength={500}
                          rows={2}
                          value={
                            key === "neckline"
                              ? draft.necklineNotes
                              : draft.sleeveNotes
                          }
                          onChange={(event) =>
                            update(
                              key === "neckline"
                                ? "necklineNotes"
                                : "sleeveNotes",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    )}
                  </fieldset>
                ))}
              </div>
              <fieldset className="request-section">
                <legend>
                  Fabric Feeling <small>Optional · choose up to 3</small>
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
                <div className="custom-color-picker">
                  <label>
                    Another fabric feeling
                    <input
                      type="text"
                      value={customFabric}
                      maxLength={120}
                      placeholder="For example, matte silk or pearl-embellished tulle"
                      onChange={(event) => setCustomFabric(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="button button--ghost"
                    disabled={!customFabric.trim()}
                    onClick={() => {
                      toggle("fabrics", customFabric.trim(), 3);
                      setCustomFabric("");
                    }}
                  >
                    Add preference
                  </button>
                </div>
                {draft.fabrics.length > 0 && (
                  <div
                    className="request-chips"
                    aria-label="Selected fabric feelings"
                  >
                    {draft.fabrics.map((fabric) => (
                      <button
                        key={fabric}
                        type="button"
                        onClick={() => toggle("fabrics", fabric, 3)}
                        aria-label={`Remove ${fabric}`}
                      >
                        {fabric} ×
                      </button>
                    ))}
                  </div>
                )}
              </fieldset>
            </>
          )}
          {step === "measurements" && (
            <>
              <h1 className="measurement-title">
                How would you like to handle measurements?
              </h1>
              <p className="measurement-privacy">
                Your measurements stay private until you choose to share them.
              </p>
              <MeasurementReference />
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
              <div className="request-section measurement-send-options">
                <h2>Send your measurements</h2>
                <div className="request-chips">
                  <button
                    type="button"
                    aria-pressed={["manual", "saved"].includes(
                      draft.measurementMethod,
                    )}
                    onClick={() => measurementMethod("manual")}
                  >
                    Enter measurements
                  </button>
                  <button
                    type="button"
                    aria-pressed={draft.measurementMethod === "reference"}
                    onClick={() => measurementMethod("reference")}
                  >
                    Upload a picture / chart
                  </button>
                </div>
              </div>
              {draft.measurementMethod === "reference" && (
                <section
                  id="measurement-upload"
                  className="measurement-entry"
                  aria-label="Measurement chart upload"
                >
                  <h2>Send a measurement chart / reference</h2>
                  <p>
                    Upload a photo or screenshot of a tailor’s chart or your
                    existing measurements. Include the units and clear labels.
                    This is separate from your inspiration board and shared only
                    when you choose to include measurements.
                  </p>
                  <MediaUploader
                    label="Upload measurement chart"
                    hint="JPG, PNG or WebP · up to 10 MB · one chart"
                    maxFiles={1}
                    takenCount={draft.measurements.reference ? 1 : 0}
                    disabled={busy}
                    retainReady={false}
                    uploadFile={uploadMeasurementReference}
                  />
                  {draft.measurements.reference && (
                    <div className="measurement-reference-preview">
                      {urls[draft.measurements.reference] ? (
                        <a
                          href={urls[draft.measurements.reference]}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Image
                            src={urls[draft.measurements.reference]}
                            alt="Your private measurement chart"
                            width={480}
                            height={560}
                            unoptimized
                          />
                          Open full-size chart
                        </a>
                      ) : (
                        <p>
                          Chart attached. Reopen this draft to refresh its
                          preview.
                        </p>
                      )}
                      <button
                        type="button"
                        className="button button--ghost"
                        disabled={busy}
                        onClick={() => void removeMeasurementReference()}
                      >
                        {confirmRemove === "measurement"
                          ? "Confirm remove chart"
                          : "Remove chart"}
                      </button>
                      {confirmRemove === "measurement" && (
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(null)}
                        >
                          Keep chart
                        </button>
                      )}
                    </div>
                  )}
                </section>
              )}
              {["manual", "saved"].includes(draft.measurementMethod) && (
                <section className="measurement-entry" id="measurement-manual">
                  <h2>
                    Your {draft.garment.toLowerCase() || "outfit"} measurements
                  </h2>
                  <p>
                    Only measurements relevant to your selected garment are
                    shown. Optional fit details can be confirmed by your
                    boutique. Measure with a soft tape.
                  </p>
                  <label>
                    Unit
                    <select
                      value={draft.measurements.unit}
                      onChange={(e) => {
                        const unit = e.target.value as "cm" | "in";
                        const ratio = unit === "cm" ? 2.54 : 1 / 2.54;
                        const m = { ...draft.measurements, unit };
                        for (const k of Object.keys(
                          MEASUREMENT_LABELS,
                        ) as MeasurementKey[])
                          if (m[k]) m[k] = (Number(m[k]) * ratio).toFixed(1);
                        update("measurements", m);
                      }}
                    >
                      <option value="cm">Centimetres</option>
                      <option value="in">Inches</option>
                    </select>
                  </label>
                  <div className="measurement-fields">
                    {fields.map((key) => (
                      <label key={key}>
                        {MEASUREMENT_LABELS[key]}
                        {!required.includes(key) ? " (optional)" : " *"}
                        <input
                          aria-label={MEASUREMENT_LABELS[key]}
                          type="number"
                          min=".1"
                          max={draft.measurements.unit === "cm" ? 300 : 120}
                          step=".1"
                          value={draft.measurements[key] ?? ""}
                          onChange={(e) =>
                            update("measurements", {
                              ...draft.measurements,
                              [key]: e.target.value,
                            })
                          }
                        />
                      </label>
                    ))}
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
                      When would you like to get your outfit?
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
                    {(draft.occasion === "Other"
                      ? draft.otherOccasion
                      : draft.occasion) || "Not selected"}{" "}
                    · {draft.garment || "Not selected"}
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
                      <br />
                      {draft.customSilhouette &&
                        `Custom shape: ${draft.customSilhouette}`}
                      <br />
                      {draft.necklineNotes} {draft.sleeveNotes}
                    </p>
                  </dd>
                  <button onClick={() => navigate(2)}>Edit</button>
                </div>
                <div>
                  <dt>Measurements</dt>
                  <dd>
                    {draft.measurements.reference && (
                      <p>
                        Measurement chart attached (private until you share
                        measurements).
                      </p>
                    )}
                    {methods.find(
                      ([v]) => v === draft.measurementMethod,
                    )?.[1] ?? "Not selected"}
                    {["manual", "saved"].includes(draft.measurementMethod) && (
                      <p>
                        {fields
                          .filter((key) => draft.measurements[key])
                          .map(
                            (key) =>
                              `${MEASUREMENT_LABELS[key]}: ${draft.measurements[key]}`,
                          )
                          .join(" · ")}{" "}
                        ({draft.measurements.unit})
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
        {conflict && (
          <section className="request-notice" role="alert">
            <h2>Your changes are still here</h2>
            <p>
              Another version was saved while this page was open. Keep your
              edits or use the saved version.
            </p>
            <button
              type="button"
              className="button button--primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const remote = validateDraft(conflict.draft);
                  const result = mergeRequestDraft(
                    baseline.current,
                    draftRef.current,
                    remote,
                  );
                  const resolved = { ...result.merged };
                  for (const key of result.conflicts as (keyof OutfitDraft)[])
                    Object.assign(resolved, { [key]: draftRef.current[key] });
                  baseline.current = remote;
                  setRevision(conflict.version);
                  setConflict(null);
                  await save(false, resolved);
                })
              }
            >
              Keep my edits
            </button>
            <button
              type="button"
              className="button button--ghost"
              disabled={busy}
              onClick={() => {
                const remote = validateDraft(conflict.draft);
                setDraft(remote);
                baseline.current = remote;
                setRevision(conflict.version);
                setConflict(null);
                setDirty(false);
                setError("");
              }}
            >
              Use saved version
            </button>
          </section>
        )}
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
          {loading
            ? "Loading saved request…"
            : busy
              ? "Saving…"
              : dirty
                ? "Unsaved changes"
                : id
                  ? "Saved privately"
                  : "New request"}
        </span>
        <button
          type="button"
          className="button button--ghost"
          disabled={busy || Boolean(conflict)}
          onClick={() =>
            void run(async () => {
              await save();
            })
          }
        >
          Save draft
        </button>
        <button
          className="button button--primary"
          disabled={busy || Boolean(conflict)}
          onClick={() => (step === "review" ? submit() : navigate(index + 1))}
        >
          {busy
            ? "Please wait…"
            : step === "review"
              ? "Submit request"
              : "Save and continue"}
          <MarketIcon name="arrow" />
        </button>
      </footer>
    </div>
  );
}
