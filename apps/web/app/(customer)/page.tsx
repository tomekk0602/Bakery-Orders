import { CallPanel } from "@/components/call/CallPanel";
import { WebOrderForm } from "@/components/order/WebOrderForm";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl font-bold">Pekárna U Lípy</h1>
      <p className="mt-2 text-stone-600">
        Rezervujte si chleba a pečivo na vyzvednutí. Objednávky do 14:00 den předem.
      </p>
      <div className="mt-8 space-y-8">
        <CallPanel />
        <WebOrderForm />
      </div>
    </main>
  );
}
