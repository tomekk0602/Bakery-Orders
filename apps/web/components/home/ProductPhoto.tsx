"use client";
import { useState } from "react";
import { PRODUCT_IMAGES } from "./product-images";
import { Icon } from "./Icon";

export function ProductPhoto({ id, name }: { id: string; name: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const asset = PRODUCT_IMAGES[id];
  return (
    <div className="product-photo">
      {!asset || failed === id ? (
        <div className="photo-placeholder" role="img" aria-label={`${name} — fotografie není k dispozici`}>
          <Icon kind="wheat" />
          <span>Fotografii připravujeme</span>
        </div>
      ) : (
        <img
          src={`/images/products/${asset}.webp`}
          srcSet={`/images/products/${asset}-480.webp 480w, /images/products/${asset}.webp 960w`}
          sizes="(max-width: 600px) 46vw, (max-width: 1000px) 30vw, 23vw"
          alt={name}
          width={960}
          height={720}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(id)}
        />
      )}
    </div>
  );
}
