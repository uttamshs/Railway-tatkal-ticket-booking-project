"use client";

type Props = { steps: string[]; current: number; onSelect?: (step: number) => void };

export function Stepper({ steps, current, onSelect }: Props) {
  return (
    <nav className="stepper" aria-label="Booking progress">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <button key={step} type="button" className={`step ${active ? "active" : ""} ${done ? "done" : ""}`} onClick={() => onSelect?.(index)} disabled={index > current} aria-current={active ? "step" : undefined}>
            <span className="step-number">{done ? "✓" : index + 1}</span>
            <span>{step}</span>
          </button>
        );
      })}
    </nav>
  );
}
