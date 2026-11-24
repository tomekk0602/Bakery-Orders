import type { CatalogueResponse } from "@bakery/core/contracts";

export const money = (n: number) => `${n.toLocaleString("cs-CZ")} Kč`;
export const deadline = (days: number, time: string) =>
  `Objednávky do ${time} ${days === 0 ? "v den vyzvednutí" : days === 1 ? "den předem" : `${days} ${days < 5 ? "dny" : "dní"} předem`}.`;
export const dayLabel = (d: CatalogueResponse["days"][number]) => {
  const date = new Date(`${d.date}T12:00:00Z`).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
  });
  return `${d.relative === "tomorrow" ? "Zítra" : d.relative === "day_after" ? "Pozítří" : d.weekdayName} · ${date}`;
};
