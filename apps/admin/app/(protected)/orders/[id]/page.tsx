import Link from "next/link";
import { requireAdminSession } from "../../../../lib/admin-session";
import { OrderOperations } from "./order-operations";
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdminSession();
  const { data, error } = await supabase.rpc("admin_read_order_detail", {
    p_order_id: id,
  });
  if (error || !data)
    return (
      <div className="admin-overview-error">This order is unavailable.</div>
    );
  const d = data as Record<string, unknown>;
  const { data: supportCases } = await supabase.rpc(
    "admin_read_order_support_cases",
    { p_order_id: id },
  );
  const order = d.order as Record<string, unknown>;
  return (
    <div className="admin-order-detail">
      <Link href="/orders" className="admin-back">
        ← Orders
      </Link>
      <div className="admin-page-header">
        <div>
          <h1>Order {String(order.id).slice(0, 8)}</h1>
          <p>
            {String((d.customer as Record<string, string>).email)} ·{" "}
            {String(order.boutique_name)}
          </p>
        </div>
        <p className="admin-order-detail__amount">
          ₹{(Number(order.total_paise) / 100).toLocaleString("en-IN")}
        </p>
      </div>
      <OrderOperations
        orderId={id}
        detail={{ ...d, supportCases: supportCases ?? [] }}
      />
    </div>
  );
}
