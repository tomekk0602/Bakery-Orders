import type { CatalogueResponse } from "@bakery/core/contracts";
import { ProductPhoto } from "./ProductPhoto";
import { money } from "./format";

export function ProductGrid({
  products,
  quantities,
  onChange,
  disabled = false,
}: {
  products: CatalogueResponse["products"];
  quantities: Record<string, number>;
  onChange: (id: string, delta: number) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="product-grid">
      {products.map((p) => {
        const quantity = quantities[p.id] ?? 0;
        return (
          <li key={p.id} className={`product-card ${quantity ? "is-selected" : ""}`}>
            <ProductPhoto id={p.id} name={p.name} />
            <div className="product-info">
              <h3>{p.name}</h3>
              <p className="product-price">
                {money(p.priceCzk)} <span>/ ks</span>
              </p>
              {quantity ? (
                <div className="quantity-control">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(p.id, -1)}
                    aria-label={`Ubrat: ${p.name}`}
                  >
                    −
                  </button>
                  <output aria-label={`${p.name}: počet kusů`}>{quantity}</output>
                  <button
                    type="button"
                    disabled={disabled || quantity >= 200}
                    onClick={() => onChange(p.id, 1)}
                    aria-label={`Přidat: ${p.name}`}
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="product-add"
                  disabled={disabled}
                  onClick={() => onChange(p.id, 1)}
                  aria-label={`Přidat: ${p.name}`}
                >
                  <span aria-hidden="true">+</span> Přidat
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
