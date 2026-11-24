"use client";

import { useRef, useState } from "react";
import { LiveCall, type Turn } from "./live-call";

type Status = "idle" | "connecting" | "live" | "ended";

export function CallPanel() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [orders, setOrders] = useState<number[]>([]);
  const call = useRef<LiveCall | null>(null);

  async function start() {
    setError(null);
    setTurns([]);
    setOrders([]);
    const c = new LiveCall({ onTranscript: setTurns, onStatus: (s) => setStatus(s) });
    call.current = c;
    try {
      await c.start(phone);
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Hovor se nepodařilo zahájit.");
    }
  }

  async function hangUp() {
    const numbers = (await call.current?.end("hangup")) ?? [];
    setOrders(numbers);
  }

  const inCall = status === "connecting" || status === "live";

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Objednat telefonem</h2>
      <p className="mt-1 text-stone-600">Zavolejte nám přímo z prohlížeče. Rezervace pečiva zabere chvilku.</p>

      <label className="mt-5 block text-sm font-medium" htmlFor="phone">
        Vaše telefonní číslo
      </label>
      <input
        id="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+420 777 123 456"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={inCall}
        className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-lg"
      />

      {!inCall ? (
        <button onClick={start} disabled={phone.trim().length < 9} className="mt-4 w-full rounded-xl bg-amber-700 px-4 py-3 text-lg font-semibold text-white disabled:opacity-40">
          Zavolat do pekárny
        </button>
      ) : (
        <button onClick={hangUp} className="mt-4 w-full rounded-xl bg-red-700 px-4 py-3 text-lg font-semibold text-white">
          {status === "connecting" ? "Spojuji…" : "Zavěsit"}
        </button>
      )}

      <p className="mt-3 text-sm text-stone-500">
        Hovor vyřizuje asistent s umělou inteligencí (Google Gemini). Přepis hovoru uchováváme 30 dní. Nejlépe se sluchátky.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">
          {error}{" "}
          <a href="#formular" className="font-semibold underline">
            Objednat přes formulář
          </a>
        </p>
      )}

      {orders.length > 0 && (
        <p className="mt-4 rounded-lg bg-green-50 p-3 text-green-800">
          Děkujeme. Číslo vaší objednávky: <strong>{orders.join(", ")}</strong>
        </p>
      )}

      {turns.length > 0 && (
        <ol className="mt-5 space-y-2" aria-live="polite">
          {turns.map((t, i) => (
            <li key={i} className={t.role === "agent" ? "rounded-lg bg-amber-50 p-2" : "rounded-lg bg-stone-100 p-2 text-right"}>
              <span className="text-xs uppercase text-stone-500">{t.role === "agent" ? "Pekárna" : "Vy"}</span>
              <div>{t.text}</div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
