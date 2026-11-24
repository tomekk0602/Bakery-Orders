import { CallPanel } from "@/components/call/CallPanel";
import { Hero } from "@/components/home/Hero";
import { HowToOrder } from "@/components/home/HowToOrder";
import { Icon } from "@/components/home/Icon";
import { deadline } from "@/components/home/format";
import { WebOrderForm } from "@/components/order/WebOrderForm";
import { catalogue } from "@/server/customer/orders";

export const dynamic = "force-dynamic";

export default async function Home() {
  const c = await catalogue();
  return (
    <>
      <Hero name={c.bakeryName} deadline={deadline(c.cutoffDaysBefore, c.cutoffTime)} />
      <main>
        <HowToOrder />
        <section id="telefon" className="voice-section shell" aria-label="Objednat hovorem">
          <div className="voice-copy">
            <p className="eyebrow">Raději si popovídáte?</p>
            <h2>
              Řekněte nám,
              <br />
              <em>na co máte chuť.</em>
            </h2>
            <p>
              Náš hlasový asistent si zapíše vaši objednávku a přečte vám ji ke kontrole. Stačí mikrofon v prohlížeči.
            </p>
            <blockquote>„Dva kmínové chleby a šest rohlíků na zítra, prosím.“</blockquote>
            <p className="fine-print">Chcete mluvit s člověkem? Požádejte asistenta o zpětné zavolání.</p>
          </div>
          <CallPanel />
        </section>
        <WebOrderForm catalogue={c} />
      </main>
      <footer className="site-footer">
        <div className="shell footer-content">
          <div className="brand">
            <Icon kind="wheat" />
            {c.bakeryName}
          </div>
          <p>Ukázková pekárna · Fotografie jsou ilustrativní a vytvořené pomocí AI.</p>
          <p>Hovory vyřizuje AI asistent. Přepisy uchováváme 30 dní, poté je mažeme.</p>
          <a href="/staff">Vstup pro obsluhu</a>
        </div>
      </footer>
    </>
  );
}
