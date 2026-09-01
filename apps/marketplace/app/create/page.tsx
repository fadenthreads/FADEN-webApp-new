import { RequestPage, type RequestQuery } from "../../components/request-page";
export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<RequestQuery>;
}) {
  return <RequestPage step="occasion" query={await searchParams} />;
}
