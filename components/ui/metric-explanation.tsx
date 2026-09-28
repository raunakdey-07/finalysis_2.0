"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { EducationKey } from "@/lib/education";
import { getMetricDefinition } from "@/lib/education";

/**
 * Only one explanation is open at a time, so opening a second closes the
 * first. A module-level key plus a subscriber set is the smallest thing that
 * does this without threading state through the card components.
 */
let openKey: string | null = null;
const subscribers = new Set<() => void>();

function setOpenKey(next: string | null): void {
  openKey = next;
  subscribers.forEach((notify) => notify());
}

function useExclusiveOpen(localKey: string): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setOpen(openKey === localKey);
    sync();
    subscribers.add(sync);
    return () => {
      subscribers.delete(sync);
    };
  }, [localKey]);

  const toggle = useCallback(
    (next: boolean) => {
      if (next) {
        setOpenKey(localKey);
      } else {
        setOpenKey(null);
      }
    },
    [localKey]
  );

  return [open, toggle];
}

type PopoverProps = {
  localKey: string;
  title: string;
  body: React.ReactNode;
  label: string;
  variant?: "inline" | "score";
  className?: string;
};

function ExplanationPopover({
  localKey,
  title,
  body,
  label,
  variant = "inline",
  className,
}: PopoverProps) {
  const [open, setOpen] = useExclusiveOpen(localKey);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Send focus back to the control that opened it.
      triggerRef.current?.focus();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);

  // The panel only exists while open, so focus has to move into it for a
  // keyboard or screen-reader user to reach the explanation at all.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // Hover is a convenience on precise pointers only; touch and keyboard rely on
  // the click, which keeps the target a dependable 24px.
  const supportsHover = () =>
    typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

  const close = useCallback(() => setOpen(false), [setOpen]);

  return (
    <span className={cn("relative inline-flex items-start", className)} ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={() => supportsHover() && setOpen(true)}
        onMouseLeave={() => supportsHover() && close()}
        onClick={() => setOpen(!open)}
        onBlur={(event) => {
          if (!wrapperRef.current?.contains(event.relatedTarget as Node)) close();
        }}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full text-stone-500",
          "outline-none transition hover:text-stone-800",
          "focus-visible:ring-2 focus-visible:ring-stone-700 focus-visible:ring-offset-2",
          variant === "score" ? "h-6 w-6 text-xs" : "-ml-1 h-6 w-6 text-[11px]"
        )}
      >
        <span aria-hidden="true">?</span>
      </button>

      {open ? (
        <span
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={title}
          tabIndex={-1}
          className={cn(
            "absolute left-1/2 top-full z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2",
            "rounded-md border border-stone-300 bg-white p-3 text-xs leading-relaxed",
            "text-stone-700 shadow-md outline-none"
          )}
          onMouseEnter={() => supportsHover() && setOpen(true)}
          onMouseLeave={() => supportsHover() && close()}
        >
          <span className="mb-1.5 block font-semibold text-stone-900">{title}</span>
          {body}
        </span>
      ) : null}
    </span>
  );
}

type MetricExplanationProps = {
  metric: EducationKey;
  label?: string;
  className?: string;
};

export function MetricExplanation({ metric, label, className }: MetricExplanationProps) {
  const definition = getMetricDefinition(metric);
  if (!definition) return null;

  return (
    <ExplanationPopover
      localKey={`metric-${metric}`}
      label={label ?? `What ${definition.name} means`}
      title={definition.name}
      className={className}
      body={
        <>
          <span className="block">{definition.shortDescription}</span>
          <span className="mt-1.5 block">
            <span className="font-medium text-stone-800">Why look at it: </span>
            {definition.whyItMatters}
          </span>
          <span className="mt-1.5 block">
            <span className="font-medium text-stone-800">How to read it: </span>
            {definition.interpretation}
          </span>
          {definition.caveat ? (
            <span className="mt-1.5 block">
              <span className="font-medium text-stone-800">What it does not tell you: </span>
              {definition.caveat}
            </span>
          ) : null}
        </>
      }
    />
  );
}

type ScoreExplanationProps = {
  metric: EducationKey;
  label?: string;
  className?: string;
};

export function ScoreExplanation({ metric, label, className }: ScoreExplanationProps) {
  const definition = getMetricDefinition(metric);
  if (!definition) return null;

  return (
    <ExplanationPopover
      localKey={`score-${metric}`}
      label={label ?? `How the ${definition.name} score works`}
      title={definition.name}
      variant="score"
      className={className}
      body={
        <>
          <span className="block">{definition.shortDescription}</span>
          <span className="mt-1.5 block">{definition.interpretation}</span>
          {definition.caveat ? (
            <span className="mt-1.5 block">
              <span className="font-medium text-stone-800">What it does not tell you: </span>
              {definition.caveat}
            </span>
          ) : null}
        </>
      }
    />
  );
}
