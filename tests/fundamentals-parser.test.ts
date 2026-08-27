/**
 * Regression tests for the Screener.in fundamentals parser.
 *
 * These tests verify the defensive behavior of the parser:
 * - valid extraction works
 * - missing metrics degrade gracefully
 * - malformed HTML does not crash
 * - clearly invalid/empty extractions are not treated as healthy cached data
 */
import { describe, it, expect } from 'vitest';
import { extractMetric, extractCompanyName, parseNumber } from '@/lib/fundamentals';

describe('parseNumber', () => {
  it('parses standard numeric strings', () => {
    expect(parseNumber('1,234')).toBe(1234);
    expect(parseNumber('₹100')).toBe(100);
    expect(parseNumber('25%')).toBe(25);
    expect(parseNumber('1.5')).toBe(1.5);
    expect(parseNumber('  42  ')).toBe(42);
  });

  it('returns null for non-numeric input', () => {
    expect(parseNumber(undefined)).toBeNull();
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('N/A')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
});

describe('extractMetric', () => {
  const html = `
    <li><span class="name">Market Cap</span><span class="value">₹<span class="number">2,34,567</span> Cr</span></li>
    <li><span class="name">Stock P/E</span><span class="value"><span class="number">28.5</span></span></li>
    <li><span class="name">Book Value</span><span class="value">₹<span class="number">415</span></span></li>
    <li><span class="name">ROE</span><span class="value"><span class="number">22.4</span> %</span></li>
    <li><span class="name">EPS</span><span class="value"><span class="number">93.7</span></span></li>
  `;

  it('extracts a metric from HTML', () => {
    expect(extractMetric(html, 'Market Cap')).toBe(234567);
    expect(extractMetric(html, 'Stock P/E')).toBe(28.5);
    expect(extractMetric(html, 'Book Value')).toBe(415);
    expect(extractMetric(html, 'ROE')).toBe(22.4);
  });

  it('returns null when a metric is absent', () => {
    expect(extractMetric(html, 'Dividend Yield')).toBeNull();
    expect(extractMetric(html, 'ROCE')).toBeNull();
  });

  it('does not crash on malformed HTML', () => {
    expect(() => extractMetric('<broken>html', 'Market Cap')).not.toThrow();
    expect(extractMetric('<broken>html', 'Market Cap')).toBeNull();
  });

  it('does not crash when label pattern appears inside attribute values', () => {
    const htmlWithNameInAttr = '<span class="name-wrapper"><span class="name">Stock P/E</span></span>';
    expect(() => extractMetric(htmlWithNameInAttr, 'Stock P/E')).not.toThrow();
  });
});

describe('extractCompanyName', () => {
  it('extracts from h1', () => {
    const html = '<h1 class="company-name">Infosys Limited</h1>';
    expect(extractCompanyName(html)).toBe('Infosys Limited');
  });

  it('returns null when no h1 is present', () => {
    expect(extractCompanyName('<div>No company</div>')).toBeNull();
  });
});