export interface IntegrationReadiness {
  configured: boolean;
  enabled: boolean;
  live: boolean;
  missing: string[];
}

export interface ProviderReadiness extends IntegrationReadiness {
  provider: string;
}

export interface DailyReadiness extends ProviderReadiness {
  provider: "daily";
}

export interface ShippingReadiness extends ProviderReadiness {
  provider: "shiprocket";
}

export interface PaymentsReadiness extends ProviderReadiness {
  provider: "razorpay";
}

export interface MapsReadiness extends ProviderReadiness {
  provider: "geoapify";
}

export interface EmailReadiness extends ProviderReadiness {
  provider: "smtp";
}

export interface PublicReadiness {
  provider: string;
  configured: boolean;
  enabled: boolean;
  live: boolean;
}

export interface DailyConfiguration {
  apiKey: string;
  baseUrl: string;
}

export interface DailyRoomInput {
  appointmentId: string;
  startsAt: string;
  endsAt: string;
}

export interface DailyTokenInput extends DailyRoomInput {
  userId: string;
  userName: string;
  isOwner?: boolean;
}

export function getLiveWorkflowsReadiness(
  env?: NodeJS.ProcessEnv,
): IntegrationReadiness;
export function isPreviewMutationAllowed(env?: NodeJS.ProcessEnv): boolean;
export function getPaymentsReadiness(
  env?: NodeJS.ProcessEnv,
): PaymentsReadiness;
export function getShippingReadiness(
  env?: NodeJS.ProcessEnv,
): ShippingReadiness;
export function getDailyReadiness(env?: NodeJS.ProcessEnv): DailyReadiness;
export function getMapsReadiness(env?: NodeJS.ProcessEnv): MapsReadiness;
export function getEmailReadiness(env?: NodeJS.ProcessEnv): EmailReadiness;
export function toPublicReadiness(
  readiness: ProviderReadiness,
): PublicReadiness;
export function dailyConfiguration(env?: NodeJS.ProcessEnv): DailyConfiguration;
export function normalizeRoomName(appointmentId: unknown): string;
export function sessionWindow(
  startsAt: string,
  endsAt: string,
): { nbf: number; exp: number };
export function createDailyClient(
  config: DailyConfiguration,
  fetcher?: typeof fetch,
): {
  getRoom(appointmentId: string): Promise<Record<string, unknown> | null>;
  createPrivateRoom(input: DailyRoomInput): Promise<Record<string, unknown>>;
  ensurePrivateRoom(input: DailyRoomInput): Promise<Record<string, unknown>>;
  createMeetingToken(input: DailyTokenInput): Promise<Record<string, unknown>>;
  deleteRoom(appointmentId: string): Promise<Record<string, unknown>>;
};
