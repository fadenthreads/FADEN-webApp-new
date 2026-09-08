"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
type Row = {
  id: string;
  boutique_name: string;
  customer_email: string;
  order_status: string;
  payment_status: string;
  shipment_status: string | null;
  total_paise: number;
  accepted_at: string;
  captured: boolean;
};
export function OrderListView({
  orders,
  hasMore,
  nextCursor,
  nextCursorId,
  current,
}: {
  orders: Row[];
  hasMore: boolean;
  nextCursor: string | null;
  nextCursorId: string | null;
  current: Record<string, unknown>;
}) {
  const router = useRouter(),
    params = useSearchParams(),
    [search, setSearch] = useState((current.search as string) ?? "");
  function set(values: Record<string, string | null>) {
    const q = new URLSearchParams(params);
    Object.entries(values).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k)));
    q.delete("cursor");
    q.delete("cursor_id");
    router.push(`/orders?${q}`);
  }
  return (
    <div className="admin-orders">
      <div className="admin-page-header">
        <div>
          <h1>Order Operations</h1>
          <p>
            Review commerce activity and arrange courier fulfilment manually.
          </p>
        </div>
        <Link
          className="button button--secondary"
          href="/orders?queue=shipping"
        >
          Manual shipping queue
        </Link>
      </div>
      <div className="admin-orders__filters">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            set({ search: search || null });
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order ID, customer email, boutique"
            aria-label="Search orders"
          />
          <button className="button" type="submit">
            Search
          </button>
        </form>
        <select
          aria-label="Payment status"
          value={(current.paymentStatus as string) ?? ""}
          onChange={(e) => set({ payment_status: e.target.value || null })}
        >
          <option value="">All payments</option>
          <option value="captured">Captured</option>
          <option value="unpaid">Unpaid</option>
          <option value="ready">Ready</option>
        </select>
        <select
          aria-label="Shipment status"
          value={(current.shipmentStatus as string) ?? ""}
          onChange={(e) => set({ shipment_status: e.target.value || null })}
        >
          <option value="">All shipping</option>
          <option value="awaiting_arrangement">Awaiting arrangement</option>
          <option value="in_transit">In transit</option>
          <option value="delivered">Delivered</option>
          <option value="exception">Exception</option>
        </select>
      </div>
      {orders.length === 0 ? (
        <div className="admin-orders__empty">
          No orders match these filters.
        </div>
      ) : (
        <div className="admin-orders__table">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Boutique</th>
                <th>Payment</th>
                <th>Shipping</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <code>{o.id.slice(0, 8)}</code>
                    <small>
                      {new Date(o.accepted_at).toLocaleDateString("en-IN")}
                    </small>
                  </td>
                  <td>{o.customer_email}</td>
                  <td>{o.boutique_name}</td>
                  <td>
                    <span className={`admin-pill is-${o.payment_status}`}>
                      {o.payment_status}
                    </span>
                  </td>
                  <td>
                    {o.captured
                      ? (o.shipment_status ?? "awaiting arrangement")
                      : "Not eligible"}
                  </td>
                  <td>₹{(o.total_paise / 100).toLocaleString("en-IN")}</td>
                  <td>
                    <Link href={`/orders/${o.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasMore && nextCursor && (
        <button
          className="button button--secondary"
          onClick={() =>
            router.push(
              `/orders?${new URLSearchParams({ ...Object.fromEntries(params), cursor: nextCursor, cursor_id: nextCursorId ?? "" })}`,
            )
          }
        >
          Load more
        </button>
      )}
    </div>
  );
}
