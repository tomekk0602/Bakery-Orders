import type { WebOrderPreview } from "@bakery/core/contracts";

const czk = (n: number) => `${n.toLocaleString("cs-CZ")} Kč`;
const dayLabel = (date: string, weekday: string) => `${weekday} ${new Date(`${date}T12:00:00Z`).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", timeZone: "UTC" })}`;

/** The order as the server priced it: what the customer confirms, and what the counter sees. */
export function Summary({ order }: { order: WebOrderPreview }) {
  return (
    <div className="rounded-lg bg-stone-50 p-4">
      <p className="font-semibold">
        {order.customerName}, {order.customerPhone}
      </p>
      <p className="text-stone-600">Vyzvednutí: {dayLabel(order.pickupDate, order.pickupWeekdayName)}</p>
      <ul className="mt-3 space-y-1">
        {order.lines.map((l) => (
          <li key={l.productId} className="flex justify-between">
            <span>
              {l.quantity}× {l.name}
            </span>
            <span>{czk(l.subtotalCzk)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-right text-lg font-bold">Celkem {czk(order.totalCzk)}</p>
    </div>
  );
}
