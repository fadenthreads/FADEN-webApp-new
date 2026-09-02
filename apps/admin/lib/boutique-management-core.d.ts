export const BOUTIQUE_STATUSES: readonly string[];
export const BOUTIQUE_SORTS: readonly string[];
export function parseBoutiqueListParams(input?: Record<string, unknown>): {
  search: string | undefined;
  status: string | undefined;
  sort: string;
  cursor: string | undefined;
};
export function parseCursorHistory(value: unknown): string[];
export function validateBoutiqueAction(body: unknown): {
  action: "suspend" | "restore";
  boutiqueId: string;
  reason: string;
} | null;
