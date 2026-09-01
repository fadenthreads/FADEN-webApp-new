import { notFound } from "next/navigation";
import {
  RequestPage,
  type RequestQuery,
} from "../../../components/request-page";
import { STEPS, type RequestStep } from "../../../lib/outfit-request";
export default async function CreateStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<RequestQuery>;
}) {
  const { step } = await params;
  if (!STEPS.includes(step as RequestStep)) notFound();
  return <RequestPage step={step as RequestStep} query={await searchParams} />;
}
