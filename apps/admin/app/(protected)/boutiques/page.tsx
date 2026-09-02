import { Suspense } from "react";

import { requireAdminSession } from "../../../lib/admin-session";
import { parseBoutiqueListParams } from "../../../lib/boutique-management-core.mjs";
import { BoutiqueListView } from "./boutique-list-view";

type PageProps = {
  searchParams: Promise<{
    search?: string;
    status?: string;
    sort?: string;
    cursor?: string;
  }>;
};

async function BoutiqueListLoader({
  searchParams,
}: {
  searchParams: Awaited<PageProps["searchParams"]>;
}) {
  const { supabase } = await requireAdminSession();

  const {
    search,
    status,
    sort: sortBy,
    cursor,
  } = parseBoutiqueListParams(searchParams);

  const { data, error } = await supabase.rpc("admin_list_boutiques", {
    p_search: search,
    p_status: status,
    p_sort_by: sortBy,
    p_cursor: cursor,
    p_limit: 20,
  });

  if (error) {
    console.error("Failed to load boutiques:", error);
    return (
      <div className="admin-overview-error">
        <span className="material-symbols-outlined admin-icon">error</span>
        <div className="admin-overview-error__message">
          <p>
            <strong>Unable to load boutiques</strong>
          </p>
          <p>
            The boutique directory could not be retrieved. Check your
            permissions and try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  // Type assertion for the JSON response
  const response = data as {
    boutiques: Array<{
      id: string;
      name: string;
      slug: string;
      status: string;
      is_published: boolean;
      city: string | null;
      owner_display_name: string | null;
      owner_email: string;
      created_at: string;
      updated_at: string;
      has_restrictions: boolean;
    }>;
    has_more: boolean;
    next_cursor: string | null;
  };

  return (
    <BoutiqueListView
      boutiques={response.boutiques || []}
      hasMore={response.has_more || false}
      nextCursor={response.next_cursor || null}
      currentSearch={search ?? null}
      currentStatus={status ?? null}
      currentSort={sortBy}
    />
  );
}

function BoutiqueListLoading() {
  return (
    <div className="admin-overview-loading">
      <span className="material-symbols-outlined admin-icon">
        progress_activity
      </span>
      <span>Loading boutiques...</span>
    </div>
  );
}

export default async function BoutiquesPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;

  return (
    <div className="boutique-admin-page">
      <div className="admin-page-header">
        <h1>Boutique Directory</h1>
        <p>
          Manage and monitor all active, pending, and suspended boutiques within
          the FADEN marketplace ecosystem.
        </p>
      </div>

      <Suspense fallback={<BoutiqueListLoading />}>
        <BoutiqueListLoader searchParams={resolvedParams} />
      </Suspense>
    </div>
  );
}
