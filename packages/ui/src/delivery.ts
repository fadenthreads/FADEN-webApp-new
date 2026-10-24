export const fadenContact = {
  name: "Meghana Jhadi",
  phone: "+91 80744 62952",
  phoneHref: "tel:+918074462952",
  email: "fadenthreads@gmail.com",
};

export const deliveryLabels: Record<string, string> = {
  awaiting_arrangement: "Arranging your delivery",
  booked: "Courier booked",
  picked_up: "Collected by courier",
  in_transit: "On the way",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  exception: "Delivery needs attention",
  cancelled: "Shipment cancelled",
};

export function deliveryStatusLabel(status: string) {
  return deliveryLabels[status] ?? status.replaceAll("_", " ");
}
