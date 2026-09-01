import { createRequire } from "node:module";
import { resolve } from "node:path";
import {
  testCredentials,
  razorpayRequest,
} from "../apps/marketplace/lib/razorpay-core.mjs";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(resolve("apps/marketplace"));
try {
  const credentials = testCredentials();
  await razorpayRequest("/orders?count=1", { credentials });
  console.log(
    "Razorpay test credentials authenticated successfully. No payment was initiated; no account data or secrets displayed.",
  );
  console.log(
    `Webhook secret ${process.env.RAZORPAY_WEBHOOK_SECRET ? "present (not delivery-verified)" : "not configured"}.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
