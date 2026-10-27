import { useState } from "react";
import { resolveProductImage } from "../api.js";

function ProductImage({ src, name, className = "", style = {} }) {
  const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const candidates = [...new Set([src, `/drinks/${slug}.svg`, `/drinks/${slug}.jpg`].filter(Boolean).map(resolveProductImage))];
  const sourceKey = `${src || ""}:${name}`;
  const [attempt, setAttempt] = useState({ sourceKey: "", index: 0, loaded: false });
  const isCurrentSource = attempt.sourceKey === sourceKey;
  const candidateIndex = isCurrentSource ? attempt.index : 0;
  const loaded = isCurrentSource && attempt.loaded;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();

  return (
    <div role="img" aria-label={name} className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-noir-800 via-noir-850 to-noir-900 font-semibold text-noir-300 ${className}`} style={style}>
      <span aria-hidden="true" className={`select-none text-2xl font-bold tracking-normal transition-opacity ${loaded ? "opacity-0" : "opacity-100"}`}>{initials || "?"}</span>
      {candidateIndex < candidates.length && <img
        key={`${sourceKey}:${candidateIndex}`}
        src={candidates[candidateIndex]}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        onLoad={() => setAttempt({ sourceKey, index: candidateIndex, loaded: true })}
        onError={() => setAttempt({ sourceKey, index: candidateIndex + 1, loaded: false })}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${loaded ? "opacity-100" : "opacity-0"}`}
      />}
    </div>
  );
}

export default ProductImage;