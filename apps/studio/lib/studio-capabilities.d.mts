export const studioApprovalRules: {
  change: string;
  approval: string;
  effect: string;
}[];
export function studioVisibility(
  status: string,
  published: boolean,
): { label: string; live: boolean };
