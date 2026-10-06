"use client";

export function PrintInvoiceButton() {
  return (
    <button
      className="offer-btn invoice-print"
      type="button"
      onClick={() => window.print()}
    >
      Download or print PDF
    </button>
  );
}
