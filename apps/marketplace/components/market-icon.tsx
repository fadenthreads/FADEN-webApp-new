export function MarketIcon({
  name,
}: {
  name:
    | "bag"
    | "person"
    | "menu"
    | "search"
    | "pin"
    | "arrow"
    | "back"
    | "heart"
    | "share"
    | "close";
}) {
  const paths = {
    bag: "M6 8h12l1 12H5L6 8Zm3 0V6a3 3 0 0 1 6 0v2",
    person:
      "M15.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM5 20c0-4 2.5-6 7-6s7 2 7 6",
    menu: "M4 6h16M4 12h16M4 18h16",
    search: "M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6",
    pin: "M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0Zm-4 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    back: "M20 12H4m6-6-6 6 6 6",
    heart: "M12 20 3.5 11.5C-2 5 7 0 12 7c5-7 14-2 8.5 4.5L12 20Z",
    share: "M12 16V3m-5 5 5-5 5 5M5 13v8h14v-8",
    close: "m5 5 14 14M19 5 5 19",
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
