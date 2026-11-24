const WAYS = [
  {
    icon: "📞",
    title: "Zavolejte",
    text: "Asistent vezme hovor hned, zopakuje objednávku s cenou a dá vám číslo objednávky.",
    href: "#telefon",
  },
  {
    icon: "📝",
    title: "Vyplňte formulář",
    text: "Vyberte pečivo a den vyzvednutí, za minutu je hotovo.",
    href: "#formular",
  },
  { icon: "🥖", title: "V prodejně", text: "Řekněte nám u pultu — zapíšeme vás do stejného seznamu.", href: null },
] as const;

/** The three ways to order, in the customer's words (FR-046). */
export function HowToOrder() {
  return (
    <section aria-labelledby="jak-title">
      <h2 id="jak-title" className="text-2xl font-bold">
        Jak objednat
      </h2>
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {WAYS.map((w) => {
          const body = (
            <>
              <span className="text-3xl" aria-hidden>
                {w.icon}
              </span>
              <span className="mt-3 block text-lg font-semibold">{w.title}</span>
              <span className="mt-1 block text-stone-600">{w.text}</span>
            </>
          );
          return (
            <li key={w.title} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              {w.href ? (
                <a href={w.href} className="block hover:opacity-80">
                  {body}
                </a>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
