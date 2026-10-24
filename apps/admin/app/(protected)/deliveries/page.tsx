import AdminOrdersPage from "../orders/page";

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  return (
    <AdminOrdersPage
      searchParams={Promise.resolve({ ...params, queue: "shipping" })}
    />
  );
}
