import { notFound } from "next/navigation";
import { OrderCompletion } from "../../../components/order-completion";
export default function CompletionPreview() {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") notFound();
  return (
    <OrderCompletion
      demo
      imageUrl="/stitch-assets/asset-084.jpg"
      backHref="/preview/delivery"
      aftercareHref="/preview/aftercare"
      messagesHref="/preview/messages"
    />
  );
}
