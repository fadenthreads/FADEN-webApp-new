/* eslint-disable @next/next/no-img-element -- Catalog media resolves to existing high-resolution Stitch assets or public Supabase images. */
"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  MediaUploader,
  isImageObjectKey,
  portfolioDisplayUrl,
  sendWithProgress,
} from "@faden/ui";
import {
  imageForPortfolio,
  portfolioCategories,
  type PortfolioDesign,
} from "../../lib/portfolio";
type Filters = { q: string; category: string; status: string; page: number };
export function PortfolioManager({
  boutiqueId,
  initialDesigns,
  boutiques,
  filters,
  count,
  marketplaceBase,
  demo = false,
  saved = false,
}: {
  boutiqueId: string;
  initialDesigns: PortfolioDesign[];
  boutiques: { id: string; name: string }[];
  filters: Filters;
  count: number;
  marketplaceBase: string;
  demo?: boolean;
  saved?: boolean;
}) {
  const [editing, setEditing] = useState<PortfolioDesign | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [imageKey, setImageKey] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [clearedImage, setClearedImage] = useState(false);
  const command = useRef<string | null>(null);
  const base = demo ? "/preview/portfolio" : "/portfolio";
  const href = (changes: Partial<Filters>) => {
    const f = { ...filters, ...changes };
    return (
      base +
      "?" +
      new URLSearchParams({
        boutique: boutiqueId,
        q: f.q,
        category: f.category,
        status: f.status,
        page: String(f.page),
      }).toString()
    );
  };
  function edit(d: PortfolioDesign | null) {
    setEditing(d);
    setError("");
    setConfirmed(false);
    command.current = null;
    setClearedImage(false);
    setImageKey(
      d && isImageObjectKey(d.primary_image_url) ? d.primary_image_url : "",
    );
    setImagePreview(
      d ? imageForPortfolio(d.primary_image_url, marketplaceBase) : "",
    );
    document
      .getElementById("design-editor")
      ?.scrollIntoView({ behavior: "smooth" });
  }
  function persistedImage() {
    if (imageKey) return imageKey;
    if (clearedImage) return "";
    if (editing && !isImageObjectKey(editing.primary_image_url)) {
      return editing.primary_image_url;
    }
    return "";
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || demo) return;
    setBusy(true);
    setError("");
    const f = new FormData(event.currentTarget);
    command.current ??= crypto.randomUUID();
    try {
      const r = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editing ? "update" : "create",
          id: editing?.id || command.current,
          boutiqueId,
          version: editing?.updated_at,
          title: f.get("title"),
          description: f.get("description"),
          price: f.get("price"),
          status: f.get("status"),
          image: persistedImage(),
          minWeeks: Number(f.get("minWeeks")),
          maxWeeks: Number(f.get("maxWeeks")),
          occasions: String(f.get("occasions") || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          confirmPublished: confirmed,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not save the design.");
      window.location.assign(
        base + "?" + new URLSearchParams({ boutique: boutiqueId, saved: "1" }),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please retry.",
      );
      setBusy(false);
    }
  }
  return (
    <>
      <header className="studio-page-heading">
        <div>
          <h1>Portfolio</h1>
          <p>Manage your high-editorial collections and bespoke designs.</p>
        </div>
        <div className="studio-actions">
          <button
            className="studio-button ghost"
            disabled
            title="Collection management is a later phase"
          >
            Create Collection · later
          </button>
          <button
            className="studio-button"
            disabled={demo || busy}
            onClick={() => edit(null)}
          >
            Add New Design
          </button>
        </div>
      </header>
      {saved && (
        <p role="status" className="studio-preview-note">
          Design saved. Published pieces are visible only when their boutique is
          verified and public.
        </p>
      )}
      <form className="studio-filters" action={base}>
        <label>
          Boutique
          <select name="boutique" defaultValue={boutiqueId}>
            {boutiques.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search portfolio
          <input
            name="q"
            defaultValue={filters.q}
            maxLength={100}
            placeholder="Search design titles…"
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={filters.status}>
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <input type="hidden" name="category" value={filters.category} />
        <button className="studio-button ghost">Apply filters</button>
        <div className="studio-filter-tabs">
          {portfolioCategories.map((c) => (
            <Link
              key={c}
              href={href({ category: c, page: 1 })}
              className={filters.category === c ? "studio-chip" : ""}
              aria-current={filters.category === c ? "page" : undefined}
            >
              {c}
            </Link>
          ))}
        </div>
      </form>
      <p className="studio-muted">
        {count} matching {count === 1 ? "design" : "designs"} · Prices in INR
      </p>
      <section className="studio-portfolio-grid" aria-label="Portfolio designs">
        {initialDesigns.map((d, i) => {
          const src = imageForPortfolio(d.primary_image_url, marketplaceBase);
          return (
            <article
              key={d.id}
              className={`studio-design-card ${i === 0 ? "featured" : ""}`}
            >
              {src ? (
                <img
                  src={src}
                  alt={d.title}
                  loading={i === 0 ? "eager" : "lazy"}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="studio-no-image">No editorial image yet</div>
              )}
              <div className="studio-design-copy">
                <span className="studio-chip">{d.status}</span>
                <h2>{d.title}</h2>
                <p>{d.occasions.join(" · ") || "Bespoke design"}</p>
                <div className="studio-design-bottom">
                  <span>
                    Starts ₹{(d.base_price_paise / 100).toLocaleString("en-IN")}
                  </span>
                  <button
                    disabled={demo || busy}
                    aria-label={`Edit ${d.title}`}
                    onClick={() => edit(d)}
                  >
                    Edit ↗
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
      {!initialDesigns.length && (
        <section className="studio-empty">
          <h2>No designs match this view.</h2>
          <p>
            Try a different search or status, or add your first portfolio piece
            below.
          </p>
          <Link href={base + "?boutique=" + encodeURIComponent(boutiqueId)}>
            Clear filters →
          </Link>
        </section>
      )}
      <nav className="studio-portfolio-pages" aria-label="Portfolio pages">
        {filters.page > 1 && (
          <Link href={href({ page: filters.page - 1 })}>← Previous</Link>
        )}
        {filters.page * 24 < count && (
          <Link href={href({ page: filters.page + 1 })}>Next →</Link>
        )}
      </nav>
      <section className="studio-editor" id="design-editor">
        <h2>{editing ? "Edit your design" : "New portfolio piece"}</h2>
        <p className="studio-muted">
          Drafts stay out of public discovery. Publishing makes this piece
          visible in the staging marketplace. Collections are not connected yet.
        </p>
        <form key={editing?.id || "new"} onSubmit={save}>
          <fieldset
            disabled={demo || busy}
            style={{ border: 0, padding: 0, margin: 0 }}
          >
            <div className="studio-editor-fields">
              <label>
                Design name
                <input
                  name="title"
                  required
                  minLength={2}
                  maxLength={160}
                  defaultValue={editing?.title || ""}
                />
              </label>
              <label>
                Starting price (₹)
                <input
                  name="price"
                  type="number"
                  min="0"
                  max="10000000"
                  step="0.01"
                  required
                  defaultValue={
                    editing ? editing.base_price_paise / 100 : "25000"
                  }
                />
              </label>
              <label className="wide">
                Description
                <textarea
                  name="description"
                  maxLength={3000}
                  defaultValue={editing?.description || ""}
                />
              </label>
              <div className="wide">
                <span>Editorial image</span>
                <MediaUploader
                  id="portfolio-image"
                  label="Drag & drop or browse"
                  hint="JPG, PNG or WebP · up to 10 MB · resized to 2400px on the longest edge"
                  maxFiles={1}
                  disabled={demo || busy}
                  value={
                    imageKey
                      ? [
                          {
                            key: imageKey,
                            displayUrl:
                              imagePreview ||
                              portfolioDisplayUrl(imageKey, 1200),
                          },
                        ]
                      : []
                  }
                  uploadFile={async (file, { onProgress, signal }) => {
                    const signed = await fetch("/api/storage", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "sign-upload",
                        bucket: "portfolio-images",
                        subjectId: boutiqueId,
                        mimeType: file.type,
                        byteSize: file.size,
                      }),
                      signal,
                    });
                    const grant = (await signed.json()) as {
                      error?: string;
                      path?: string;
                      signedUrl?: string;
                    };
                    if (!signed.ok || !grant.path || !grant.signedUrl) {
                      throw new Error(grant.error || "Upload failed.");
                    }
                    const put = await sendWithProgress({
                      url: grant.signedUrl,
                      method: "PUT",
                      body: file,
                      headers: { "Content-Type": file.type },
                      onProgress,
                      signal,
                    });
                    if (put.status >= 400) {
                      throw new Error("Upload failed. Please try again.");
                    }
                    const displayUrl = portfolioDisplayUrl(grant.path, 1200);
                    setImageKey(grant.path);
                    setImagePreview(displayUrl);
                    setClearedImage(false);
                    return { key: grant.path, displayUrl };
                  }}
                  onRemove={async (item) => {
                    if (item.key && item.key !== editing?.primary_image_url) {
                      await fetch("/api/storage", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "remove",
                          bucket: "portfolio-images",
                          path: item.key,
                        }),
                      });
                    }
                    setImageKey("");
                    setImagePreview("");
                    setClearedImage(true);
                  }}
                />
                {!imageKey && imagePreview && !clearedImage && (
                  <img
                    src={imagePreview}
                    alt=""
                    style={{
                      width: "120px",
                      height: "120px",
                      objectFit: "cover",
                      marginTop: "12px",
                    }}
                  />
                )}
                <small>
                  Uploads are stored as private object keys and shown with
                  on-demand display URLs. A draft may be saved without a photo.
                </small>
              </div>
              <label>
                Occasions (comma-separated)
                <input
                  name="occasions"
                  maxLength={400}
                  defaultValue={editing?.occasions.join(", ") || ""}
                  placeholder="Bridal, Festive"
                />
              </label>
              <label>
                Visibility
                <select name="status" defaultValue={editing?.status || "draft"}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label>
                Minimum lead time (weeks)
                <input
                  name="minWeeks"
                  type="number"
                  min="1"
                  max="104"
                  required
                  defaultValue={editing?.lead_time_min_weeks || 3}
                />
              </label>
              <label>
                Maximum lead time (weeks)
                <input
                  name="maxWeeks"
                  type="number"
                  min="1"
                  max="104"
                  required
                  defaultValue={editing?.lead_time_max_weeks || 6}
                />
              </label>
              <label className="wide">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                If Published is selected, I confirm this design and its price
                may appear publicly in the staging catalog.
              </label>
            </div>
            <div className="studio-actions">
              <button className="studio-button" type="submit">
                {busy
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Save new design"}
              </button>
              {editing && (
                <button
                  className="studio-button ghost"
                  type="button"
                  onClick={() => edit(null)}
                >
                  Cancel editing
                </button>
              )}
            </div>
          </fieldset>
          {error && (
            <p className="studio-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>
    </>
  );
}
