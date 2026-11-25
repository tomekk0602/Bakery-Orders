/** "25. 11. 10:42" in the bakery's time zone, for request times and their history. */
export const TIME = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});
