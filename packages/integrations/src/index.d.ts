export interface DailyReadiness {
  provider: "daily";
  configured: boolean;
  apiEnabled: boolean;
  liveRoomsEnabled: boolean;
  missing: string[];
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
export function getDailyReadiness(env?: NodeJS.ProcessEnv): DailyReadiness;
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
