"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { deliveryLabels, deliveryStatusLabel } from "@faden/ui";
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
  const isDelivery = usePathname() === "/deliveries";
  const base = isDelivery ? "/deliveries" : "/orders";
  function set(values: Record<string, string | null>) {
    const q = new URLSearchParams(params);
    Object.entries(values).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k)));
    q.delete("cursor");
    q.delete("cursor_id");
    router.push(`${base}?${q}`);
  }
  return (
    <div className="admin-orders">
      <div className="admin-page-header">
        <div>
          <h1>{isDelivery ? "Delivery management" : "Order Operations"}</h1>
          <p>
            {isDelivery
              ? "Paid orders ready for your team to arrange delivery. Open an order, confirm its address, book a courier, and update the shipment as it moves."
              : "Review orders and arrange delivery with your preferred courier."}
          </p>
        </div>
        <Link
          className="button button--secondary"
          href={isDelivery ? "/orders" : "/deliveries"}
        >
          {isDelivery ? "All orders" : "Manage deliveries"}
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
          <option value="">All delivery statuses</option>
          {Object.entries(deliveryLabels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
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
                      ? deliveryStatusLabel(
                          o.shipment_status ?? "awaiting_arrangement",
                        )
                      : "Not eligible"}
                  </td>
                  <td>₹{(o.total_paise / 100).toLocaleString("en-IN")}</td>
                  <td>
                    <Link
                      href={`/orders/${o.id}${isDelivery ? "#delivery" : ""}`}
                    >
                      {isDelivery ? "Manage delivery" : "Open"}
                    </Link>
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
              `${base}?${new URLSearchParams({ ...Object.fromEntries(params), cursor: nextCursor, cursor_id: nextCursorId ?? "" })}`,
            )
          }
        >
          Load more
        </button>
      )}
    </div>
  );
}
