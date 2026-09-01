export function orderStatusLabel(status: string) {
  return status === "cancelled"
    ? "Cancelled"
    : status === "test_advance_paid"
      ? "Test advance verified · no real payment"
      : "Awaiting payment · test mode";
}
