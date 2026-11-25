"use client";

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { Icon } from "../home/Icon";
import { CallSession, timeLeft } from "./call-session";
import { LiveCall } from "./live-call";

const OpenCall = createContext<() => void>(() => undefined);

/** Any "Zavolat" on the page opens the call window (spec 001 FR-067). */
export function CallButton({ className, children }: { className?: string; children: ReactNode }) {
  const open = useContext(OpenCall);
  return (
    <button type="button" className={className} onClick={open} aria-haspopup="dialog">
      {children}
    </button>
  );
}

/**
 * The call window: number → calling → in the call → ended, like a phone's call screen — full screen
 * on a phone, a dialog in the middle on a computer (spec 001 FR-067–FR-071, research R39). Built on
 * the browser's `<dialog>`: focus stays inside, Esc closes it, and closing it ends the call.
 */
export function CallDialogProvider({ bakeryName, children }: { bakeryName: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [, redraw] = useState(0);
  const [session] = useState(
    () => new CallSession({ createCall: (events) => new LiveCall(events), onChange: () => redraw((n) => n + 1) }),
  );
  // the number lives only while the page is open; it is never stored (FR-071)
  const [phone, setPhone] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const view = session.view;

  useEffect(() => {
    if (view.step !== "live") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [view.step]);
  // leaving the page ends a call in progress (FR-058)
  useEffect(() => () => session.close(), [session]);

  const open = () => dialog.current?.showModal();
  const close = () => dialog.current?.close();
  const toForm = () => {
    close();
    document.getElementById("pecivo")?.scrollIntoView({ behavior: "smooth" });
  };
  const inCall = view.step === "calling" || view.step === "live";

  return (
    <OpenCall.Provider value={open}>
      {children}
      <dialog
        ref={dialog}
        className="call-dialog"
        aria-labelledby="call-title"
        // Esc and the close button both end up here: the call ends with the window (FR-070)
        onClose={() => session.close()}
      >
        <div className="call-top">
          <p className="call-kind">{view.step === "live" ? "Hovor s pekárnou" : "Hlasový asistent"}</p>
          <button type="button" className="call-close" onClick={close} aria-label="Zavřít okno hovoru">
            ×
          </button>
        </div>

        <div className={`call-avatar${view.step === "calling" ? " ringing" : ""}`} aria-hidden="true">
          <Icon kind="wheat" />
        </div>
        <h2 id="call-title" className="call-name">
          {bakeryName}
        </h2>
        <p className="call-status" role="status" aria-live="polite">
          {view.step === "number" && "Zavolejte nám přímo z prohlížeče"}
          {view.step === "calling" && "Volám…"}
          {view.step === "live" && `Hovor probíhá · zbývá ${timeLeft(view, now)}`}
          {view.step === "ended" && "Hovor skončil"}
        </p>
        {view.step === "calling" && <p className="call-hint">Pokud se prohlížeč zeptá, povolte prosím mikrofon.</p>}

        {(view.step === "live" || view.step === "ended") && session.turns.length > 0 && (
          <ol className="call-transcript" aria-label="Přepis hovoru">
            {session.turns.map((t, i) => (
              <li key={i} className={t.role === "agent" ? "agent" : "customer"}>
                <span>{t.role === "agent" ? "Pekárna" : "Vy"}</span>
                {t.text}
              </li>
            ))}
          </ol>
        )}

        {view.step === "ended" &&
          (view.orderNumbers.length > 0 ? (
            <p className="call-result">
              Děkujeme. Číslo vaší objednávky: <strong>{view.orderNumbers.join(", ")}</strong>
            </p>
          ) : view.unknown ? (
            // the end report failed and no confirmation came back: say what is known, not "none" (FR-076)
            <p className="call-hint" role="alert">
              Nepodařilo se ověřit, zda se objednávka uložila. Pokud vám asistent přečetl číslo objednávky, objednávka
              platí.
            </p>
          ) : (
            <p className="call-hint">Žádná objednávka se neuložila.</p>
          ))}

        {view.step === "number" && (
          <form
            className="call-form"
            onSubmit={(e) => {
              e.preventDefault();
              void session.start(phone);
            }}
          >
            <label htmlFor="call-phone">Vaše telefonní číslo</label>
            <input
              id="call-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              // the dialog opens with the cursor in the number, not on the close button
              autoFocus
              placeholder="+420 777 123 456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            {view.error && (
              <p role="alert" className="call-error">
                {view.error}{" "}
                <button type="button" className="link" onClick={toForm}>
                  Objednat přes formulář
                </button>
              </p>
            )}
            <button className="call-action start" disabled={phone.replace(/\D/g, "").length < 9}>
              <Icon kind="phone" />
              <span>Zavolat</span>
            </button>
            <p className="call-notice">
              Hovor vyřizuje asistent s umělou inteligencí (Google Gemini). Přepis hovoru uchováváme 30 dní. Nejlépe se
              sluchátky.
            </p>
          </form>
        )}

        {inCall && (
          <button type="button" className="call-action hang-up" onClick={() => void session.hangUp()}>
            <Icon kind="phone" />
            <span>Zavěsit</span>
          </button>
        )}
        {view.step === "ended" && (
          <button type="button" className="call-done" onClick={close}>
            Zavřít
          </button>
        )}
      </dialog>
    </OpenCall.Provider>
  );
}
