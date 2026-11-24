import { CallPanel } from "@/components/call/CallPanel";
import { Hero } from "@/components/home/Hero";
import { HowToOrder } from "@/components/home/HowToOrder";
import { ProductGrid } from "@/components/home/ProductGrid";
import { WebOrderForm } from "@/components/order/WebOrderForm";
import { catalogue } from "@/server/customer/orders";

// The offer and prices are read on every visit: the owner can change them in the staff app.
export const dynamic = "force-dynamic";

const deadline = (daysBefore: number, time: string) =>
  `Objednávky přijímáme do ${time} ${daysBefore === 1 ? "den předem" : `${daysBefore} dny předem`}.`;

/** The customer page (FR-046): the bakery, how to order, the offer, then the call and the form. */
export default async function Home() {
  const c = await catalogue();
  return (
    <>
      <Hero name={c.bakeryName} deadline={deadline(c.cutoffDaysBefore, c.cutoffTime)} />
      <main className="mx-auto max-w-5xl space-y-16 px-4 py-12">
        <HowToOrder />
        <ProductGrid products={c.products} />
        <section id="objednat" aria-label="Objednávka" className="scroll-mt-6">
          <h2 className="text-2xl font-bold">Objednat</h2>
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
            <div id="telefon" className="scroll-mt-6">
              <CallPanel />
            </div>
            <WebOrderForm />
          </div>
        </section>
      </main>
      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-stone-500">
          {c.bakeryName} je ukázková pekárna. Hovory vyřizuje asistent s umělou inteligencí; přepis hovoru uchováváme 30
          dní, pak ho mažeme.
        </div>
      </footer>
    </>
  );
}
