import { describe, expect, it } from "vitest";
import {
  explainScore,
  getConfidenceMessage,
  getMetricDefinition,
  getNewsSentimentMessage,
  type EducationKey,
} from "@/lib/education";

describe("investor education definitions", () => {
  const displayedKeys: EducationKey[] = [
    "roe",
    "roce",
    "dividendYield",
    "peRatio",
    "pbRatio",
    "bookValue",
    "debtToEquity",
    "eps",
    "marketCap",
    "priceChange",
    "momentum",
    "newsSentiment",
    "businessQuality",
    "valuation",
    "screeningScore",
    "favorableSetup",
    "confidence",
    "provenance",
    "sectorContext",
  ];

  it("returns definitions for all displayed financial concepts", () => {
    for (const key of displayedKeys) {
      const def = getMetricDefinition(key);
      expect(def).not.toBeNull();
      expect(def?.name).toBeTruthy();
      expect(def?.shortDescription).toBeTruthy();
      expect(def?.whyItMatters).toBeTruthy();
      expect(def?.interpretation).toBeTruthy();
    }
  });

  it("returns null for an unavailable definition", () => {
    expect(getMetricDefinition("not-a-real-key" as never)).toBeNull();
  });

  it("explains scores as heuristics rather than probabilities", () => {
    expect(explainScore(82, "businessQuality")).toContain("82 / 100");
    expect(explainScore(82, "businessQuality")).toContain("not a probability");
    expect(explainScore(Number.NaN, "valuation")).toBe("Score context is unavailable.");
  });

  it("handles confidence and news availability states", () => {
    expect(getConfidenceMessage("high")).toContain("No major fallback warnings");
    expect(getConfidenceMessage("derived")).toContain("verify it independently");
    expect(getNewsSentimentMessage("positive", 1)).toContain("1 available article");
    expect(getNewsSentimentMessage("neutral", 0)).toContain("No articles were available");
  });

  it("avoids implying price movement or sentiment equals business improvement", () => {
    expect(getMetricDefinition("priceChange")?.interpretation).toContain("not evidence");
    expect(getMetricDefinition("newsSentiment")?.caveat).toContain("one article");
  });
});
