/** @typedef {typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS]} AuditAction */

export const AUDIT_ACTIONS = Object.freeze({
  // Implemented platform operations
  PROFILE_ROLE_CHANGED: "profile.role.changed",
  BOUTIQUE_APPLICATION_CREATED: "boutique.application.created",

  // Future Admin integrations (A03–A09). Do not wire until those tickets land.
  BOUTIQUE_STATUS_CHANGED: "boutique.status.changed",
  BOUTIQUE_VERIFICATION_DECISION: "boutique.verification.decision",
  REFUND_INITIATED: "refund.initiated",
  REFUND_COMPLETED: "refund.completed",
  DISPUTE_OPENED: "dispute.opened",
  DISPUTE_UPDATED: "dispute.updated",
  DISPUTE_RESOLVED: "dispute.resolved",
  PLATFORM_CONFIG_CHANGED: "platform.config.changed",
  PAYOUT_MARKED: "payout.marked",
  SETTLEMENT_CREATED: "settlement.created",
  MEMBERSHIP_CHANGED: "membership.changed",
  AUDIT_EXPORTED: "audit.exported",
});

/** Platform actions that require an AAL2 admin session. */
export const PLATFORM_ADMIN_AUDIT_ACTIONS = Object.freeze([
  AUDIT_ACTIONS.PROFILE_ROLE_CHANGED,
  AUDIT_ACTIONS.BOUTIQUE_STATUS_CHANGED,
  AUDIT_ACTIONS.BOUTIQUE_VERIFICATION_DECISION,
  AUDIT_ACTIONS.REFUND_INITIATED,
  AUDIT_ACTIONS.REFUND_COMPLETED,
  AUDIT_ACTIONS.DISPUTE_OPENED,
  AUDIT_ACTIONS.DISPUTE_UPDATED,
  AUDIT_ACTIONS.DISPUTE_RESOLVED,
  AUDIT_ACTIONS.PLATFORM_CONFIG_CHANGED,
  AUDIT_ACTIONS.PAYOUT_MARKED,
  AUDIT_ACTIONS.SETTLEMENT_CREATED,
  AUDIT_ACTIONS.MEMBERSHIP_CHANGED,
  AUDIT_ACTIONS.AUDIT_EXPORTED,
]);

/** Existing workflow actions recorded by database RPCs (reference only). */
export const WORKFLOW_AUDIT_ACTIONS = Object.freeze([
  "design.published",
  "design.approved",
  "design.revision_requested",
  "production.rehearsal_updated",
  "appointment.reserved",
  "appointment.cancelled",
  "appointment.completed",
  "appointment.no_show",
  "delivery.address_confirmed",
  "shipment.rehearsed",
  "delivery.rehearsal_confirmed",
  "aftercare.rehearsal_submitted",
  "aftercare.rehearsal_updated",
  "order.message_sent",
]);
