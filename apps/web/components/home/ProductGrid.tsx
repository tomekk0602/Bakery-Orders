import type { CatalogueResponse } from "@bakery/core/contracts";
import { ProductPhoto } from "./ProductPhoto";

/** The offer with photo, name and price — the same catalogue the phone agent works from (FR-046). */
export function ProductGrid({ products }: { products: CatalogueResponse["products"] }) {
  return (
    <section id="pecivo" aria-labelledby="pecivo-title" className="scroll-mt-6">
      <h2 id="pecivo-title" className="text-2xl font-bold">
        Naše pečivo
      </h2>
      <p className="mt-1 text-stone-600">Vše, co si u nás můžete rezervovat. Ceny jsou za kus.</p>
      <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <ProductPhoto id={p.id} name={p.name} />
            <div className="flex items-baseline justify-between gap-2 px-4 py-3">
              <span className="font-medium">{p.name}</span>
              <span className="whitespace-nowrap font-semibold text-amber-800">{p.priceCzk} Kč</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
