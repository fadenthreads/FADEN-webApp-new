"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { parseCursorHistory } from "../../../lib/boutique-management-core.mjs";
import { BoutiqueActionDialog } from "./boutique-action-dialog";

type Boutique = {
  id: string;
  name: string;
  slug: string;
  status: string;
  is_published: boolean;
  city: string | null;
  created_at: string;
  updated_at: string;
  owner_display_name: string | null;
  owner_email: string | null;
  has_restrictions: boolean;
};

type BoutiqueListViewProps = {
  boutiques: Boutique[];
  hasMore: boolean;
  nextCursor: string | null;
  currentSearch: string | null;
  currentStatus: string | null;
  currentSort: string;
};

export function BoutiqueListView({
  boutiques,
  hasMore,
  nextCursor,
  currentSearch,
  currentStatus,
  currentSort,
}: BoutiqueListViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(currentSearch || "");
  const [actionDialog, setActionDialog] = useState<{
    boutiqueId: string;
    boutiqueName: string;
    action: "suspend" | "restore";
  } | null>(null);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    // Reset cursor when filters change
    if ("search" in updates || "status" in updates || "sort" in updates) {
      params.delete("cursor");
      params.delete("history");
    }

    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ search: searchValue || null });
  }

  function handleStatusChange(status: string) {
    updateParams({ status: status === "all" ? null : status });
  }

  function handleSortChange(sort: string) {
    updateParams({ sort });
  }

  function handlePrevious() {
    const history = parseCursorHistory(searchParams.get("history"));
    const previousCursor = history.pop() || null;
    updateParams({
      cursor: previousCursor,
      history: history.length ? JSON.stringify(history) : null,
    });
  }

  function handleNext() {
    if (nextCursor) {
      const history = parseCursorHistory(searchParams.get("history"));
      history.push(searchParams.get("cursor") || "");
      updateParams({ cursor: nextCursor, history: JSON.stringify(history) });
    }
  }

  const isEmpty = boutiques.length === 0;
  const hasCursor = Boolean(searchParams.get("cursor"));

  return (
    <>
      <div className="boutique-list-container">
        {/* Filters */}
        <div className="boutique-filters">
          <form onSubmit={handleSearchSubmit} className="boutique-search">
            <span className="material-symbols-outlined boutique-search__icon">
              search
            </span>
            <input
              type="text"
              placeholder="Search by name, slug, or owner email..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="boutique-search__input"
              aria-label="Search boutiques"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => {
                  setSearchValue("");
                  updateParams({ search: null });
                }}
                className="boutique-search__clear"
                aria-label="Clear search"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </form>

          <div className="boutique-filter-bar">
            <label className="boutique-filter-label">Status:</label>
            <select
              value={currentStatus || "all"}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="boutique-filter-select"
              aria-label="Filter by status"
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="verified">Verified</option>
              <option value="suspended">Suspended</option>
              <option value="rejected">Rejected</option>
            </select>

            <label className="boutique-filter-label">Sort:</label>
            <select
              value={currentSort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="boutique-filter-select"
              aria-label="Sort results"
            >
              <option value="created_desc">Newest First</option>
              <option value="created_asc">Oldest First</option>
              <option value="updated_desc">Recently Updated</option>
              <option value="updated_asc">Least Recently Updated</option>
            </select>

            {(currentSearch ||
              currentStatus ||
              currentSort !== "created_desc") && (
              <button
                type="button"
                onClick={() => {
                  setSearchValue("");
                  router.push("/boutiques");
                }}
                className="boutique-filter-reset"
                aria-label="Clear all filters"
              >
                <span className="material-symbols-outlined">
                  filter_alt_off
                </span>
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {isEmpty ? (
          <div className="boutique-empty">
            <span className="material-symbols-outlined boutique-empty__icon">
              storefront
            </span>
            <p className="boutique-empty__title">No boutiques found</p>
            <p className="boutique-empty__description">
              {currentSearch || currentStatus
                ? "Try adjusting your filters or search query."
                : "There are no boutiques in the system yet."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="boutique-table-wrapper">
              <table className="boutique-table">
                <thead>
                  <tr>
                    <th>Boutique</th>
                    <th>Owner</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Updated</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {boutiques.map((boutique) => (
                    <tr key={boutique.id} className="boutique-table-row">
                      <td>
                        <div className="boutique-name-cell">
                          <strong>{boutique.name}</strong>
                          <span className="boutique-slug">
                            /{boutique.slug}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="boutique-owner-cell">
                          {boutique.owner_display_name || "—"}
                          {boutique.owner_email && (
                            <span className="boutique-owner-email">
                              {boutique.owner_email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{boutique.city || "—"}</td>
                      <td>
                        <BoutiqueStatusBadge
                          status={boutique.status}
                          isPublished={boutique.is_published}
                        />
                      </td>
                      <td>
                        <time
                          dateTime={boutique.created_at}
                          className="boutique-date"
                        >
                          {formatDateIST(boutique.created_at)}
                        </time>
                      </td>
                      <td>
                        <time
                          dateTime={boutique.updated_at}
                          className="boutique-date"
                        >
                          {formatDateIST(boutique.updated_at)}
                        </time>
                      </td>
                      <td>
                        <div className="boutique-actions">
                          {boutique.status === "suspended" ? (
                            <button
                              type="button"
                              onClick={() =>
                                setActionDialog({
                                  boutiqueId: boutique.id,
                                  boutiqueName: boutique.name,
                                  action: "restore",
                                })
                              }
                              className="boutique-action-button boutique-action-button--restore"
                              aria-label={`Restore ${boutique.name}`}
                            >
                              <span className="material-symbols-outlined">
                                restore
                              </span>
                              Restore
                            </button>
                          ) : boutique.status !== "rejected" ? (
                            <button
                              type="button"
                              onClick={() =>
                                setActionDialog({
                                  boutiqueId: boutique.id,
                                  boutiqueName: boutique.name,
                                  action: "suspend",
                                })
                              }
                              className="boutique-action-button boutique-action-button--suspend"
                              aria-label={`Suspend ${boutique.name}`}
                            >
                              <span className="material-symbols-outlined">
                                block
                              </span>
                              Suspend
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="boutique-cards">
              {boutiques.map((boutique) => (
                <div key={boutique.id} className="boutique-card">
                  <div className="boutique-card__header">
                    <div className="boutique-name-cell">
                      <strong>{boutique.name}</strong>
                      <span className="boutique-slug">/{boutique.slug}</span>
                    </div>
                    <BoutiqueStatusBadge
                      status={boutique.status}
                      isPublished={boutique.is_published}
                    />
                  </div>
                  <div className="boutique-card__body">
                    <div className="boutique-card__row">
                      <span className="boutique-card__label">Owner:</span>
                      <span>{boutique.owner_display_name || "—"}</span>
                    </div>
                    {boutique.owner_email && (
                      <div className="boutique-card__row">
                        <span className="boutique-card__label">Email:</span>
                        <span className="boutique-owner-email">
                          {boutique.owner_email}
                        </span>
                      </div>
                    )}
                    <div className="boutique-card__row">
                      <span className="boutique-card__label">Location:</span>
                      <span>{boutique.city || "—"}</span>
                    </div>
                    <div className="boutique-card__row">
                      <span className="boutique-card__label">Created:</span>
                      <time dateTime={boutique.created_at}>
                        {formatDateIST(boutique.created_at)}
                      </time>
                    </div>
                  </div>
                  <div className="boutique-card__footer">
                    {boutique.status === "suspended" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setActionDialog({
                            boutiqueId: boutique.id,
                            boutiqueName: boutique.name,
                            action: "restore",
                          })
                        }
                        className="boutique-action-button boutique-action-button--restore"
                      >
                        <span className="material-symbols-outlined">
                          restore
                        </span>
                        Restore
                      </button>
                    ) : boutique.status !== "rejected" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setActionDialog({
                            boutiqueId: boutique.id,
                            boutiqueName: boutique.name,
                            action: "suspend",
                          })
                        }
                        className="boutique-action-button boutique-action-button--suspend"
                      >
                        <span className="material-symbols-outlined">block</span>
                        Suspend
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="boutique-pagination">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={!hasCursor || isPending}
                className="boutique-pagination__button"
                aria-label="Previous page"
              >
                <span className="material-symbols-outlined">chevron_left</span>
                Previous
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!hasMore || isPending}
                className="boutique-pagination__button"
                aria-label="Next page"
              >
                Next
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </>
        )}
      </div>

      {actionDialog && (
        <BoutiqueActionDialog
          boutiqueId={actionDialog.boutiqueId}
          boutiqueName={actionDialog.boutiqueName}
          action={actionDialog.action}
          onClose={() => setActionDialog(null)}
          onSuccess={() => {
            setActionDialog(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function BoutiqueStatusBadge({
  status,
  isPublished,
}: {
  status: string;
  isPublished: boolean;
}) {
  const statusConfig: Record<
    string,
    { label: string; className: string; icon?: string }
  > = {
    draft: { label: "Draft", className: "boutique-status--draft" },
    pending_verification: {
      label: "Pending",
      className: "boutique-status--pending",
      icon: "schedule",
    },
    verified: {
      label: isPublished ? "Active" : "Verified",
      className: "boutique-status--verified",
      icon: "verified",
    },
    suspended: {
      label: "Suspended",
      className: "boutique-status--suspended",
      icon: "block",
    },
    rejected: {
      label: "Rejected",
      className: "boutique-status--rejected",
      icon: "cancel",
    },
  };

  const config = statusConfig[status] || {
    label: status,
    className: "boutique-status--default",
  };

  return (
    <span className={`boutique-status ${config.className}`}>
      {config.icon && (
        <span className="material-symbols-outlined boutique-status__icon">
          {config.icon}
        </span>
      )}
      {config.label}
    </span>
  );
}

function formatDateIST(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateString;
  }
}
