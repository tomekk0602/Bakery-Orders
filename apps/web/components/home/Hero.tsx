/**
 * The bakery first (FR-046). The photo is `public/images/hero.jpg`, supplied by the owner; without it
 * the warm gradient underneath stays, so the header never looks broken.
 */
export function Hero({ name, deadline }: { name: string; deadline: string }) {
  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-amber-800 to-stone-900 text-white">
      <div className="absolute inset-0 bg-[url('/images/hero.jpg')] bg-cover bg-center opacity-60" aria-hidden />
      <div
        className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-900/30 to-transparent"
        aria-hidden
      />
      <div className="relative mx-auto max-w-5xl px-4 pb-14 pt-24 sm:pt-32">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{name}</h1>
        <p className="mt-3 max-w-xl text-lg text-stone-100">
          Čerstvý chléb a pečivo každé ráno. Rezervujte si je předem a vyzvedněte bez čekání.
        </p>
        <p className="mt-2 text-sm text-amber-200">{deadline}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="#objednat"
            className="rounded-xl bg-amber-600 px-5 py-3 font-semibold text-white shadow hover:bg-amber-500"
          >
            Objednat
          </a>
          <a
            href="#pecivo"
            className="rounded-xl bg-white/15 px-5 py-3 font-semibold text-white backdrop-blur hover:bg-white/25"
          >
            Naše pečivo
          </a>
        </div>
      </div>
    </header>
  );
}
