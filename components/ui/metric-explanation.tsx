"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils/cn";
import type { EducationKey } from "@/lib/education";
import { getMetricDefinition } from "@/lib/education";

// Single global open key so only one popover is open at a time.
let globalOpenKey: string | null = null;
const listeners = new Set<() => void>();

function setGlobalOpenKey(key: string | null) {
  globalOpenKey = key;
  listeners.forEach((fn) => fn());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function useOpenState(localKey: string): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(globalOpenKey === localKey);

  useEffect(() => {
    const update = () => setOpen(globalOpenKey === localKey);
    return subscribe(update);
  }, [localKey]);

  const set = useCallback(
    (next: boolean) => {
      setGlobalOpenKey(next ? localKey : globalOpenKey === localKey ? null : globalOpenKey);
    },
    [localKey]
  );

  return [open, set];
}

type PopoverProps = {
  localKey: string;
  title: string;
  content: React.ReactNode;
  label: string;
  variant?: "inline" | "score";
  className?: string;
};

function InlinePopover({ localKey, title, content, label, variant = "inline", className }: PopoverProps) {
  const [open, setOpen] = useOpenState(localKey);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, setOpen]);

  const handleEnter = () => {
    if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
      setOpen(true);
    }
  };
  const handleLeave = () => {
    if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
      setOpen(false);
    }
  };
  const handleClick = () => setOpen(!open);
  const handleBlur = (e: React.FocusEvent) => {
    if (!wrapperRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  };

  return (
    <span className={cn("relative inline-flex items-center align-top", className)} ref={wrapperRef} onBlur={handleBlur}>
      <button
        type="button"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={handleClick}
        aria-expanded={open}
        aria-label={label}
        className={`inline-flex items-center justify-center rounded-full leading-none text-stone-400 outline-none transition hover:text-stone-700 focus-visible:ring-2 focus-visible:ring-stone-500 ${
          variant === "score" ? "ml-1 h-5 w-5 text-xs" : "ml-1.5 h-4 w-4 text-[10px]"
        }`}
      >
        ?
      </button>
      {open && (
        <div
          role="region"
          aria-label={label}
          className={`absolute z-30 w-[min(18rem,calc(100vw-2rem))] max-w-[18rem] rounded-md border border-stone-200 bg-white p-3 text-xs leading-relaxed text-stone-600 shadow-md ${
            variant === "score" ? "right-0 top-full mt-2" : "right-0 top-full mt-1"
          }`}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          <p className="mb-1.5 font-medium text-stone-800">{title}</p>
          {content}
        </div>
      )}
    </span>
  );
}

type MetricExplanationProps = {
  metric: EducationKey;
  label?: string;
  className?: string;
};

export function MetricExplanation({ metric, label: labelProp, className }: MetricExplanationProps) {
  const definition = getMetricDefinition(metric);
  if (!definition) return null;

  const label = labelProp ?? `Explain ${definition.name}`;

  return (
    <InlinePopover
      localKey={`metric-${metric}`}
      label={label}
      title={definition.name}
      className={className}
      content={
        <div className="space-y-1.5">
          <p>{definition.shortDescription}</p>
          <p><span className="font-medium text-stone-700">Why it matters:</span> {definition.whyItMatters}</p>
          <p><span className="font-medium text-stone-700">How to read it:</span> {definition.interpretation}</p>
          {definition.caveat ? <p><span className="font-medium text-stone-700">Keep in mind:</span> {definition.caveat}</p> : null}
        </div>
      }
    />
  );
}

type ScoreExplanationProps = {
  score: number;
  metric: "businessQuality" | "valuation" | "screeningScore";
  label?: string;
  className?: string;
};

export function ScoreExplanation({ score, metric, label: labelProp, className }: ScoreExplanationProps) {
  const definition = getMetricDefinition(metric);
  if (!definition) return null;

  const label = labelProp ?? `Explain ${definition.name} score`;

  return (
    <InlinePopover
      localKey={`score-${metric}`}
      label={label}
      title={definition.name}
      variant="score"
      className={className}
      content={
        <div className="space-y-1.5">
          <p><span className="font-medium text-stone-800">{Math.round(score)} / 100.</span> {definition.interpretation}</p>
          {definition.caveat ? <p>{definition.caveat}</p> : null}
          <p className="text-stone-400">Algorithmic model output for educational comparison only.</p>
        </div>
      }
    />
  );
}
