"use client";

import { DataBasis } from "../lib/types";
import { pill } from "./ui";

const COPY: Record<DataBasis, { text: string; color: string; title: string }> = {
  live: {
    text: "Live seats",
    color: "var(--viz-good)",
    title: "Seat count read from a live inventory provider.",
  },
  baseline: {
    text: "Baseline seats",
    color: "var(--viz-warn)",
    title: "Static corridor baseline from the API — not a live inventory read.",
  },
  estimate: {
    text: "Estimate only",
    color: "var(--viz-muted)",
    title: "No seat count yet — success % is a structural estimate.",
  },
};

/** Small provenance badge. Colour is never the only cue: each state has its own text. */
export function BasisBadge({ basis }: { basis: DataBasis }) {
  const c = COPY[basis];
  return (
    <span title={c.title} style={{ ...pill, color: c.color, borderColor: c.color }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: c.color }} />
      {c.text}
    </span>
  );
}
