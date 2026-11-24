"use client";

import { useState } from "react";

/**
 * A product photo from `public/images/products/<id>.jpg`, supplied by the owner (research R29).
 * Until the file exists the tile shows the product's initial on a warm background, never a broken image.
 */
export function ProductPhoto({ id, name }: { id: string; name: string }) {
  const [missing, setMissing] = useState(false);
  if (missing)
    return (
      <div
        aria-hidden
        className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-amber-100 to-amber-200 text-4xl font-semibold text-amber-800/70"
      >
        {name.charAt(0)}
      </div>
    );
  return (
    // a plain img: the placeholder needs its onError, and the photos are already sized by the owner
    <img
      src={`/images/products/${id}.jpg`}
      alt={name}
      loading="lazy"
      onError={() => setMissing(true)}
      className="aspect-[4/3] w-full object-cover"
    />
  );
}
