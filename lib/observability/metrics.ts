/**
 * A very small metrics registry.
 *
 * Prometheus' own client libraries were the first thing reached for and are the
 * wrong size here: this process holds no timers, no histograms of unbounded
 * length, and no more than a handful of counters. A registry that only counts
 * things, keeps a fixed set of label combinations, and renders the text format
 * is about a hundred lines and has nothing to break at runtime.
 *
 * Two rules are enforced rather than documented, because breaking either would
 * make the metrics worse than no metrics:
 *
 * 1. Labels are declared up front. A metric has a fixed set of label names and
 *    a fixed set of allowed values per name, and an undeclared combination
 *    throws rather than quietly creating a new time series. That is what stops
 *    a ticker symbol or an error message from ever becoming a label, which is
 *    how a metrics endpoint takes a site down.
 * 2. Counters only go up and are process-local. Restarting the pod resets them,
 *    which is normal for this style of instrumentation and is why the dashboard
 *    uses rate() rather than a raw total.
 */

export type LabelSpec = Record<string, readonly string[]>;

type Series = { labels: Record<string, string>; value: number };

type Definition = {
  name: string;
  help: string;
  kind: 'counter' | 'gauge';
  labels: LabelSpec;
};

const definitions = new Map<string, Definition>();
const series = new Map<string, Series>();

function seriesKey(name: string, labels: Record<string, string>): string {
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`);
  return `${name}|${parts.join(',')}`;
}

/**
 * Declare a metric up front. Called at module load, never per request.
 *
 * Declaring the same name twice with a different label set is a programming
 * error and throws, because the second declaration would otherwise reuse the
 * first one's series keys and produce nonsense.
 */
export function defineMetric(definition: Definition): void {
  const existing = definitions.get(definition.name);
  if (existing) {
    const sameShape =
      JSON.stringify(Object.keys(existing.labels).sort()) ===
      JSON.stringify(Object.keys(definition.labels).sort());
    if (!sameShape) {
      throw new Error(`Metric ${definition.name} is declared twice with different label sets.`);
    }
    return;
  }
  definitions.set(definition.name, definition);
}

function validate(name: string, labels: Record<string, string>): void {
  const definition = definitions.get(name);
  if (!definition) throw new Error(`Metric ${name} was used before it was defined.`);

  for (const [label, value] of Object.entries(labels)) {
    const allowed = definition.labels[label];
    if (!allowed) throw new Error(`Metric ${name} has no label named ${label}.`);
    if (allowed.length === 0) continue;
    if (!allowed.includes(value)) {
      throw new Error(`Metric ${name} label ${label} does not allow the value ${value}.`);
    }
  }

  for (const label of Object.keys(definition.labels)) {
    if (!(label in labels)) throw new Error(`Metric ${name} is missing the label ${label}.`);
  }
}

export function increment(name: string, labels: Record<string, string> = {}, by = 1): void {
  const definition = definitions.get(name);
  if (!definition) throw new Error(`Metric ${name} was used before it was defined.`);
  if (definition.kind !== 'counter') {
    throw new Error(`Metric ${name} is a gauge and cannot be incremented.`);
  }
  validate(name, labels);
  const id = seriesKey(name, labels);
  const current = series.get(id);
  series.set(id, { labels, value: (current?.value ?? 0) + by });
}

export function setGauge(name: string, labels: Record<string, string>, value: number): void {
  const definition = definitions.get(name);
  if (!definition) throw new Error(`Metric ${name} was used before it was defined.`);
  if (definition.kind !== 'gauge') {
    throw new Error(`Metric ${name} is a counter and cannot be set.`);
  }
  validate(name, labels);
  series.set(seriesKey(name, labels), { labels, value });
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

/**
 * Render the registry in the Prometheus text exposition format.
 *
 * Series that have never been touched are not emitted: a counter at zero is
 * indistinguishable from one that does not exist, and the dashboard treats both
 * the same way, so emitting them would only add noise.
 */
export function render(): string {
  const lines: string[] = [];

  for (const definition of definitions.values()) {
    const prefix = `${definition.name}|`;
    const matching = [...series.entries()].filter(([id]) => id.startsWith(prefix));
    if (matching.length === 0) continue;

    lines.push(`# HELP ${definition.name} ${definition.help}`);
    lines.push(`# TYPE ${definition.name} ${definition.kind}`);

    for (const [, entry] of matching) {
      const labels = Object.entries(entry.labels)
        .map(([k, v]) => `${k}="${escapeLabelValue(v)}"`)
        .join(',');
      lines.push(`${definition.name}${labels ? `{${labels}}` : ''} ${entry.value}`);
    }
  }

  return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
}

/** Test seam. Counters are process state, so a test has to start from zero. */
export function resetForTesting(): void {
  series.clear();
}