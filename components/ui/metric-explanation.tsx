"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
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

function useExclusiveOpen(groupKey: string): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  /**
   * Two controls can share a group, for example the "Recent signals" card and
   * the news-tone row. Keying only on the group made both report themselves as
   * the open one, so they opened together and each closed the other. The
   * instance id is part of the key, so exactly one of a group is ever open.
   */
  const instanceId = useId();
  const key = `${groupKey}#${instanceId}`;

  useEffect(() => {
    const sync = () => setOpen(openKey === key);
    sync();
    subscribers.add(sync);
    return () => {
      subscribers.delete(sync);
    };
  }, [key]);

  const toggle = useCallback(
    (next: boolean) => {
      if (next) {
        setOpenKey(key);
      } else {
        setOpenKey(null);
      }
    },
    [key]
  );

  return [open, toggle];
}

type PopoverProps = {
  localKey: string;
  title: string;
  body: React.ReactNode;
  label: string;
  /** Company-specific lines shown under the generic explanation. */
  lines?: string[];
  variant?: "inline" | "score";
  className?: string;
};

const VIEWPORT_MARGIN = 8;

function ExplanationPopover({
  localKey,
  title,
  body,
  label,
  lines,
  variant = "inline",
  className,
}: PopoverProps) {
  const [open, setOpen] = useExclusiveOpen(localKey);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const instanceId = useId();
  const panelId = `${instanceId}-panel`;

  /**
   * The panel is wider than a phone is. Centring it on a trigger near the left
   * edge pushed a third of the explanation off screen where it was clipped and
   * unreachable.
   *
   * The offset is written straight to the element rather than held in state.
   * This is a measurement of the rendered layout, not application state, and
   * routing it through state would re-render on every open for a value the DOM
   * can carry itself.
   */
  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const wrapper = wrapperRef.current;
    if (!panel || !wrapper) return;

    const panelWidth = panel.offsetWidth;
    const wrapperLeft = wrapper.getBoundingClientRect().left;
    const viewportWidth = document.documentElement.clientWidth;

    const minLeft = VIEWPORT_MARGIN - wrapperLeft;
    const maxLeft = viewportWidth - VIEWPORT_MARGIN - panelWidth - wrapperLeft;

    panel.style.transform = 'none';
    panel.style.left = `${Math.max(minLeft, Math.min(0, maxLeft))}px`;
  }, [open, localKey, instanceId]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
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

  // Hover is deliberately not a trigger.
  //
  // The panel is wider than the rows below it and is click-through, so a
  // hover-opened panel is a thing you can see but cannot reach: moving the
  // pointer towards it lands on whatever is underneath, which closes it. That
  // also makes it fail WCAG 2.1.1's content-on-hover expectations, since the
  // content is not hoverable. Click only behaves identically on mouse and
  // touch, and lets a click on the next row's "?" land on that control.
  const close = useCallback(() => setOpen(false), [setOpen]);

  return (
    <span className={cn("relative inline-flex items-start", className)} ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        onBlur={(event) => {
          if (!wrapperRef.current?.contains(event.relatedTarget as Node)) close();
        }}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full text-stone-600",
          "outline-none transition hover:text-stone-900",
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
            // Click-through on purpose. The panel is wider and taller than the
            // rows beneath it, so making it opaque to the pointer meant the next
            // metric's "?" could not be clicked while this one was open. A click
            // that lands on it now reaches the control underneath, and the
            // outside-pointerdown handler swaps the panel.
            "pointer-events-none absolute left-0 top-full z-30 mt-1",
            "w-[min(20rem,calc(100vw-1.5rem))] select-none",
            "rounded-md border border-stone-300 bg-white p-3 text-xs leading-relaxed",
            "text-stone-700 shadow-md outline-none"
          )}
        >
          <span className="mb-1.5 block font-semibold text-stone-900">{title}</span>
          {body}
          {lines && lines.length > 0 ? (
            <span className="mt-2 block border-t border-stone-200 pt-2">
              <span className="mb-1 block font-medium text-stone-800">For this company</span>
              <ul className="list-disc space-y-1 pl-4">
                {lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

type MetricExplanationProps = {
  metric: EducationKey;
  label?: string;
  className?: string;
  /** Extra lines shown under the generic explanation, for this particular case. */
  lines?: string[];
};

export function MetricExplanation({ metric, label, className, lines }: MetricExplanationProps) {
  const definition = getMetricDefinition(metric);
  if (!definition) return null;

  return (
    <ExplanationPopover
      localKey={`metric-${metric}`}
      label={label ?? `What ${definition.name} means`}
      title={definition.name}
      lines={lines}
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
  /** Why this particular score came out where it did. */
  lines?: string[];
  label?: string;
  className?: string;
};

export function ScoreExplanation({ metric, lines, label, className }: ScoreExplanationProps) {
  const definition = getMetricDefinition(metric);
  if (!definition) return null;

  return (
    <ExplanationPopover
      localKey={`score-${metric}`}
      label={label ?? `How the ${definition.name} score works`}
      title={definition.name}
      lines={lines}
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
