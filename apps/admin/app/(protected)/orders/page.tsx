import { requireAdminSession } from "../../../lib/admin-session";
import { parseOrderListParams } from "../../../lib/admin-orders-core.mjs";
import { OrderListView } from "./order-list-view";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = parseOrderListParams(await searchParams);
  const { supabase } = await requireAdminSession();
  const { data, error } = await supabase.rpc("admin_list_orders", {
    p_search: params.search ?? undefined,
    p_queue: params.queue ?? undefined,
    p_order_status: params.orderStatus ?? undefined,
    p_payment_status: params.paymentStatus ?? undefined,
    p_shipment_status: params.shipmentStatus ?? undefined,
    p_cursor: params.cursor ?? undefined,
    p_cursor_id: params.cursorId ?? undefined,
    p_limit: 20,
  });
  if (error)
    return (
      <div className="admin-overview-error">
        Unable to load orders. Refresh and try again.
      </div>
    );
  const result = (data ?? { orders: [], has_more: false }) as {
    orders: unknown[];
    has_more: boolean;
    next_cursor: string | null;
    next_cursor_id: string | null;
  };
  return (
    <OrderListView
      orders={result.orders as never[]}
      hasMore={result.has_more}
      nextCursor={result.next_cursor}
      nextCursorId={result.next_cursor_id}
      current={params}
    />
  );
}
