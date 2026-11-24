"use client";

import type { CatalogueResponse, WebOrderInput, WebOrderPlaced, WebOrderPreview } from "@bakery/core/contracts";
import { useEffect, useState } from "react";
import { loadCatalogue, OrderError, placeOrder, previewOrder } from "./api";
import { Summary } from "./Summary";

type Step = { kind: "form" } | { kind: "preview"; preview: WebOrderPreview } | { kind: "placed"; placed: WebOrderPlaced };

const dayLabel = (d: CatalogueResponse["days"][number]) =>
  d.relative === "tomorrow" ? `Zítra (${d.weekdayName})` : d.relative === "day_after" ? `Pozítří (${d.weekdayName})` : `${d.weekdayName} ${new Date(`${d.date}T12:00:00Z`).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", timeZone: "UTC" })}`;

/** The customer's web form: the same rules as the phone agent, read back before it is saved (FR-014, FR-040). */
export function WebOrderForm() {
  const [catalogue, setCatalogue] = useState<CatalogueResponse | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [day, setDay] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadCatalogue()
      .then((c) => {
        setCatalogue(c);
        setDay(c.days[0]?.date ?? "");
      })
      .catch((e: unknown) => setError(e instanceof OrderError ? e.message : "Nabídku se nepodařilo načíst."));
  }, []);

  const input = (): WebOrderInput => ({
    customerName: name,
    customerPhone: phone,
    pickupDate: day,
    items: Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity })),
  });

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof OrderError ? e.message : "Objednávku se nepodařilo odeslat.");
    } finally {
      setBusy(false);
    }
  };

  const review = () => {
    if (!name.trim() || !phone.trim() || input().items.length === 0) return setError("Vyplňte jméno, telefon a alespoň jeden výrobek.");
    void run(async () => setStep({ kind: "preview", preview: await previewOrder(input()) }));
  };
  const send = () => void run(async () => setStep({ kind: "placed", placed: await placeOrder(input()) }));
  const restart = () => {
    setQty({});
    setStep({ kind: "form" });
  };

  return (
    <section id="formular" className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Objednat přes formulář</h2>
      {catalogue ? <p className="mt-1 text-stone-600">Objednávky přijímáme do {catalogue.cutoffTime} den předem.</p> : null}

      {step.kind === "form" && catalogue ? (
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium">
            Jméno
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-lg" />
          </label>
          <label className="block text-sm font-medium">
            Telefon
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+420 777 123 456" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-lg" />
          </label>
          <label className="block text-sm font-medium">
            Den vyzvednutí
            <select value={day} onChange={(e) => setDay(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-lg">
              {catalogue.days.map((d) => (
                <option key={d.date} value={d.date}>
                  {dayLabel(d)}
                </option>
              ))}
            </select>
          </label>
          <ul className="divide-y divide-stone-100">
            {catalogue.products.map((p) => {
              const q = qty[p.id] ?? 0;
              const set = (n: number) => setQty((cur) => ({ ...cur, [p.id]: Math.max(0, Math.min(200, (cur[p.id] ?? 0) + n)) }));
              return (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <span className="flex-1">
                    {p.name} <span className="text-stone-500">· {p.priceCzk} Kč</span>
                  </span>
                  <button type="button" aria-label={`Ubrat: ${p.name}`} onClick={() => set(-1)} disabled={q === 0} className="h-11 w-11 rounded-lg border border-stone-300 text-xl disabled:opacity-40">
                    −
                  </button>
                  <span className="w-8 text-center tabular-nums" aria-label={`${p.name}: ${q}`}>
                    {q}
                  </span>
                  <button type="button" aria-label={`Přidat: ${p.name}`} onClick={() => set(1)} className="h-11 w-11 rounded-lg border border-stone-300 text-xl">
                    +
                  </button>
                </li>
              );
            })}
          </ul>
          <button onClick={review} disabled={busy} className="w-full rounded-xl bg-amber-700 px-4 py-3 text-lg font-semibold text-white disabled:opacity-40">
            {busy ? "Počítám…" : "Zkontrolovat objednávku"}
          </button>
        </div>
      ) : null}

      {step.kind === "preview" ? (
        <div className="mt-5 space-y-3">
          <Summary order={step.preview} />
          <button onClick={send} disabled={busy} className="w-full rounded-xl bg-amber-700 px-4 py-3 text-lg font-semibold text-white disabled:opacity-40">
            {busy ? "Odesílám…" : "Odeslat objednávku"}
          </button>
          <button onClick={() => setStep({ kind: "form" })} disabled={busy} className="w-full rounded-xl border border-stone-300 px-4 py-3 text-lg">
            Upravit
          </button>
        </div>
      ) : null}

      {step.kind === "placed" ? (
        <div className="mt-5 space-y-3" role="status">
          <p className="rounded-lg bg-green-50 p-3 text-green-800">
            Děkujeme. Číslo vaší objednávky: <strong>{step.placed.orderNumber}</strong>. Zaplatíte při vyzvednutí.
          </p>
          <Summary order={step.placed} />
          <button onClick={restart} className="w-full rounded-xl border border-stone-300 px-4 py-3 text-lg">
            Nová objednávka
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">
          {error}
        </p>
      ) : null}
    </section>
  );
}
