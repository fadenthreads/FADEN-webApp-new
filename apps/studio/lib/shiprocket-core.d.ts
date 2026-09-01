export interface ShiprocketReadiness {
  provider: "shiprocket";
  configured: boolean;
  apiEnabled: boolean;
  liveBookingEnabled: boolean;
  missing: string[];
}
export interface ShiprocketConfiguration {
  baseUrl: string;
  email: string;
  password: string;
  pickupLocation: string;
  pickupPostcode: string;
  webhookSecret: string;
}
export interface Parcel {
  weight: number;
  length: number;
  breadth: number;
  height: number;
}
export function getShiprocketReadiness(
  env?: NodeJS.ProcessEnv,
): ShiprocketReadiness;
export function shiprocketConfiguration(
  env?: NodeJS.ProcessEnv,
): ShiprocketConfiguration;
export function normalizePostcode(value: unknown): string;
export function normalizeParcel(value: unknown): Parcel;
export function shippingRequestKey(
  orderId: string,
  operation: string,
  revision: string | number,
): string;
export function mapShiprocketStatus(value: unknown): string;
export function verifyShiprocketWebhookToken(
  value: string | null,
  secret: string,
): boolean;
export function createShiprocketClient(
  config: ShiprocketConfiguration,
  fetcher?: typeof fetch,
): {
  serviceability(input: {
    deliveryPostcode: string;
    parcel: Parcel;
    cod?: boolean;
  }): Promise<Record<string, unknown>>;
  createOrder(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  assignAwb(
    shipmentId: number,
    courierId: number,
  ): Promise<Record<string, unknown>>;
  schedulePickup(shipmentId: number): Promise<Record<string, unknown>>;
  trackAwb(awb: string): Promise<Record<string, unknown>>;
  generateLabel(shipmentId: number): Promise<Record<string, unknown>>;
  generateManifest(shipmentId: number): Promise<Record<string, unknown>>;
};
