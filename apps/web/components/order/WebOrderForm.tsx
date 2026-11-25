"use client";

import type { CatalogueResponse, WebOrderInput } from "@bakery/core/contracts";
import { useRef, useState } from "react";
import { ProductGrid } from "../home/ProductGrid";
import { dayLabel, deadline, money } from "../home/format";
import { Icon } from "../home/Icon";
import { OrderError, placeOrder, previewOrder } from "./api";
import { confirmFailed, isLocked, type Step } from "./checkout";
import { Summary } from "./Summary";
import { MobileBasket } from "./MobileBasket";
import { changeQuantity, selectedProducts, type Quantities } from "./selection";

/** One selection for photo cards, checkout and server-priced preview (FR-046, T093). */
export function WebOrderForm({ catalogue }: { catalogue: CatalogueResponse }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [day, setDay] = useState(catalogue.days[0]?.date ?? "");
  const [qty, setQty] = useState<Quantities>({});
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const checkout = useRef<HTMLDivElement>(null);
  const selected = selectedProducts(catalogue.products, qty);
  const pieces = selected.reduce((sum, p) => sum + p.quantity, 0);
  const total = selected.reduce((sum, p) => sum + p.quantity * p.priceCzk, 0);
  const noDays = catalogue.days.length === 0;
  const locked = isLocked(step, busy);
  const input = (): WebOrderInput => ({
    customerName: name,
    customerPhone: phone,
    pickupDate: day,
    items: selected.map((p) => ({ productId: p.id, quantity: p.quantity })),
  });
  const focusCheckout = () => {
    checkout.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    checkout.current?.focus({ preventScroll: true });
  };
  const edit = () => {
    setStep({ kind: "form" });
    setError(null);
  };
  const change = (id: string, delta: number) => {
    if (locked) return;
    setQty((q) => changeQuantity(q, id, delta));
    edit();
  };
  async function review() {
    if (pending.current) return;
    if (!name.trim() || !phone.trim() || !day || !selected.length) {
      setError("Vyberte pečivo, den vyzvednutí a vyplňte jméno a telefon.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const data = input();
      const preview = await previewOrder(data);
      setStep({ kind: "preview", preview, uncertain: false });
      focusCheckout();
    } catch (e) {
      setError(e instanceof OrderError ? e.message : "Objednávku se nepodařilo zkontrolovat. Zkuste to znovu.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function send() {
    // a retry after an unknown result is safe: the same review is confirmed at most once (FR-065)
    if (pending.current || step.kind !== "preview") return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const placed = await placeOrder({ draftId: step.preview.draftId, token: step.preview.token });
      setStep({ kind: "placed", placed });
      focusCheckout();
    } catch (e) {
      // A lost response may follow a successful save. Confirming the same review again is safe: the
      // server returns the order it already saved (FR-065). Editing stays locked, because a changed
      // order would be a new one.
      const unknown = !(e instanceof OrderError) || e.uncertain;
      setStep((s) => confirmFailed(s, unknown));
      setError(
        unknown
          ? "Nepodařilo se ověřit, zda se objednávka uložila. Zkuste ji prosím potvrdit znovu — uloží se nejvýš jednou."
          : e.message,
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section id="pecivo" className="catalogue-section shell" aria-labelledby="catalogue-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Z naší nabídky</p>
          <h2 id="catalogue-title">Na co máte chuť?</h2>
          <p>Vyberte si své oblíbené. My si poznamenáme, co pro vás připravit.</p>
        </div>
        <p className="catalogue-note">Ceny za kus · Platba při vyzvednutí</p>
      </div>
      <div className="catalogue-toolbar">
        <label htmlFor="pickup-day">Kdy si pečivo vyzvednete?</label>
        <select
          id="pickup-day"
          value={day}
          disabled={noDays || locked}
          onChange={(e) => {
            setDay(e.target.value);
            edit();
          }}
        >
          {catalogue.days.map((d) => (
            <option key={d.date} value={d.date}>
              {dayLabel(d)}
            </option>
          ))}
        </select>
        <p>{deadline(catalogue.cutoffDaysBefore, catalogue.cutoffTime)}</p>
      </div>
      {noDays && (
        <p role="status" className="notice">
          Momentálně nejsou otevřené žádné termíny pro rezervaci. Zkuste to prosím později.
        </p>
      )}
      {catalogue.products.length ? (
        <ProductGrid products={catalogue.products} quantities={qty} onChange={change} disabled={noDays || locked} />
      ) : (
        <p className="notice" role="status">
          Nabídku právě připravujeme. Zkuste to prosím později.
        </p>
      )}
      <div id="formular" className="checkout-layout">
        <aside className="basket" aria-label="Vybrané pečivo">
          <Icon kind="bag" />
          <h3>Vaše taška</h3>
          {selected.length ? (
            <>
              <ul>
                {selected.map((p) => (
                  <li key={p.id}>
                    <span>
                      {p.quantity}× {p.name}
                    </span>
                    <strong>{money(p.quantity * p.priceCzk)}</strong>
                  </li>
                ))}
              </ul>
              <div className="basket-total">
                <span>Orientačně celkem</span>
                <strong>{money(total)}</strong>
              </div>
              <p>Cenu a dostupnost ověříme v dalším kroku.</p>
            </>
          ) : (
            <p>Vaše oblíbené pečivo zatím čeká nahoře. Přidejte něco dobrého.</p>
          )}
        </aside>
        <div className="checkout" ref={checkout} tabIndex={-1} aria-label="Dokončení rezervace">
          {step.kind === "form" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void review();
              }}
            >
              <p className="eyebrow">Už jen pár údajů</p>
              <h3>Pro koho pečivo odložíme?</h3>
              <p className="checkout-intro">Bez registrace. Zaplatíte až při vyzvednutí.</p>
              <div className="customer-fields">
                <label htmlFor="customer-name">
                  Jméno
                  <input
                    id="customer-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    maxLength={80}
                    required
                    disabled={busy}
                    placeholder="Vaše jméno"
                  />
                </label>
                <label htmlFor="customer-phone">
                  Telefon
                  <input
                    id="customer-phone"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    required
                    disabled={busy}
                    placeholder="+420 777 123 456"
                  />
                </label>
              </div>
              <button className="button primary checkout-submit" disabled={busy || noDays || !pieces}>
                {busy ? "Ověřujeme objednávku…" : "Zkontrolovat objednávku"}
              </button>
              <p className="fine-print">Tímto krokem ještě objednávku neodesíláte.</p>
            </form>
          )}
          {step.kind === "preview" && (
            <>
              <p className="eyebrow">Všechno sedí?</p>
              <h3>Zkontrolujte objednávku</h3>
              <p className="checkout-intro">
                Toto je aktuální cena ověřená pekárnou. Potvrďte prosím produkty i den vyzvednutí.
              </p>
              <Summary order={step.preview} />
              <div className="checkout-actions">
                <button type="button" className="button primary" onClick={() => void send()} disabled={busy}>
                  {busy ? "Odesíláme…" : "Potvrdit objednávku"}
                </button>
                <button type="button" className="button secondary" onClick={edit} disabled={locked}>
                  Upravit
                </button>
              </div>
            </>
          )}
          {step.kind === "placed" && (
            <div role="status">
              <Icon kind="check" />
              <p className="eyebrow">Máte rezervováno</p>
              <h3>Děkujeme za objednávku.</h3>
              <p className="order-number">
                Číslo objednávky <strong>#{step.placed.orderNumber}</strong>
              </p>
              <Summary order={step.placed} />
              <p className="checkout-intro">
                Zaplatíte při vyzvednutí v pekárně. Číslo objednávky si prosím poznamenejte.
              </p>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setQty({});
                  setName("");
                  setPhone("");
                  edit();
                }}
              >
                Nová objednávka
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="error-notice">
              {error}
            </p>
          )}
        </div>
      </div>
      {pieces > 0 && step.kind === "form" && (
        <MobileBasket pieces={pieces} total={total} checkout={checkout} onContinue={focusCheckout} />
      )}
    </section>
  );
}
