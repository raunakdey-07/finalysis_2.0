import { describe, expect, it } from 'vitest';
import {
  MIN_ARTICLES_FOR_TONE,
  matchesCompany,
  parseRssFeed,
  scoreHeadline,
  summariseTone,
} from '@/lib/sentiment';
import { buildResearchLinks } from '@/lib/research-links';

const RSS = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Reliance posts record profit, board approves buyback - The Hindu BusinessLine</title>
    <link>https://news.google.com/rss/articles/AAA</link>
    <pubDate>Mon, 28 Sep 2026 09:00:00 GMT</pubDate>
    <source url="https://www.thehindubusinessline.com">The Hindu BusinessLine</source>
  </item>
  <item>
    <title>Regulator opens probe into disclosure filings</title>
    <link>https://news.google.com/rss/articles/BBB</link>
    <pubDate>Mon, 28 Sep 2026 08:00:00 GMT</pubDate>
    <source url="https://economictimes.indiatimes.com">Economic Times</source>
  </item>
  <item>
    <title>Undated headline with no publication time</title>
    <link>https://news.google.com/rss/articles/CCC</link>
    <source url="https://example.com">Example</source>
  </item>
  <item>
    <title>Old story from three years ago</title>
    <link>https://news.google.com/rss/articles/DDD</link>
    <pubDate>Tue, 01 Jan 2019 08:00:00 GMT</pubDate>
    <source url="https://example.com">Example</source>
  </item>
  <item>
    <title>Reliance posts record profit, board approves buyback - The Hindu BusinessLine</title>
    <link>https://news.google.com/rss/articles/EEE</link>
    <pubDate>Mon, 28 Sep 2026 09:30:00 GMT</pubDate>
    <source url="https://www.moneycontrol.com">Moneycontrol</source>
  </item>
</channel></rss>`;

describe('parseRssFeed', () => {
  const articles = parseRssFeed(RSS);

  it('keeps articles that carry a real publication date', () => {
    expect(articles.map((article) => article.title)).toContain(
      'Reliance posts record profit, board approves buyback'
    );
  });

  /** A missing date used to be filled in with the current time. */
  it('drops an article with no publication date instead of dating it now', () => {
    expect(articles.map((article) => article.title)).not.toContain(
      'Undated headline with no publication time'
    );
  });

  it('drops stories too old to describe a company now', () => {
    expect(articles.map((article) => article.title)).not.toContain(
      'Old story from three years ago'
    );
  });

  it('collapses the same headline syndicated under a different link', () => {
    const matches = articles.filter((article) => article.title.startsWith('Reliance posts record'));
    expect(matches).toHaveLength(1);
  });

  it('reads the publisher from the source element rather than guessing', () => {
    expect(articles[0].source).toBe('The Hindu BusinessLine');
  });

  /** Google News repeats the publisher at the end of the headline. */
  it('does not repeat the publisher inside its own headline', () => {
    expect(articles[0].title).not.toMatch(/-\s*The Hindu BusinessLine$/);
  });

  it('leaves a headline intact when the suffix is not the publisher', () => {
    const single = parseRssFeed(`<rss><channel><item>
      <title>Q2 results beat estimates - market rallies</title>
      <link>https://example.com/a</link>
      <pubDate>Mon, 28 Sep 2026 09:00:00 GMT</pubDate>
      <source url="https://example.com">Example Wire</source>
    </item></channel></rss>`);
    expect(single[0].title).toBe('Q2 results beat estimates - market rallies');
  });

  it('returns nothing rather than throwing on a malformed feed', () => {
    expect(parseRssFeed('not xml at all')).toEqual([]);
    expect(parseRssFeed('')).toEqual([]);
  });
});

describe('scoreHeadline', () => {
  it('scores a positive headline above a negative one', () => {
    expect(scoreHeadline('Company posts record profit and raises dividend')).toBeGreaterThan(0);
    expect(scoreHeadline('Company faces probe and posts a loss')).toBeLessThan(0);
  });

  /**
   * Matching was a plain substring test, so "surprise" scored as "rise" and
   * "not a loss" scored as a loss.
   */
  it('matches whole words only', () => {
    // "surprise" contains "rise", "fallacy" contains "fall" and "floss" contains
    // "loss". None of the three is the whole word, so none of the three is a
    // signal, and "order" is not in the list at all once it became a phrase.
    expect(scoreHeadline('A surprise order for the company')).toBe(0);
    expect(scoreHeadline('The fallacy of the argument')).toBe(0);
    expect(scoreHeadline('Floss is sold in supermarkets')).toBe(0);
  });

  it('reads a past-tense move, which used to be missing entirely', () => {
    // "falls" was in the list and "fell" was not, so a real headline reading
    // "fell 25% this year" scored exactly zero.
    expect(scoreHeadline('Reliance Industries fell 25% this year')).toBeLessThan(0);
  });

  /**
   * The bare words were read backwards on headlines where they occur. "record
   * low" is bad news and "cuts costs" is good, and scoring the word rather than
   * what it modifies got every one of these the wrong way round.
   */
  it('reads a word by what it modifies, not by the word alone', () => {
    for (const [headline, expected] of [
      ['Company posts record low profit of Rs 12 cr', -1],
      ['Falls to a record low', -1],
      ['Board announces a dividend cut', -1],
      ['Company loses three large orders in Q2', -1],
      ['Company cuts costs by 20% and lifts margin', 1],
      ['Company slashes debt and turns debt free', 1],
      ['Record highs in revenue', 1],
      ['Company raises dividend for the ninth year', 1],
    ] as const) {
      expect(Math.sign(scoreHeadline(headline)), headline).toBe(expected);
    }
  });

  it('does not count a word twice when a phrase around it already scored', () => {
    // "record low profit" is one negative phrase and one positive word. Counting
    // "record" again as a positive would land this above zero.
    expect(scoreHeadline('Profit falls to a record low')).toBeLessThan(0);
  });

  it('flips a negated term instead of discounting it', () => {
    // Halving it left "reports no loss" at -0.5, so a company reporting it had
    // lost nothing read as half-negative.
    expect(scoreHeadline('Company reports no loss for the third quarter')).toBeGreaterThan(0);
    expect(scoreHeadline('Company did not post a loss')).toBeGreaterThan(0);
    expect(scoreHeadline('Not a profit warning, company says')).toBeGreaterThan(0);
  });

  it('returns zero for a headline with no listed terms', () => {
    expect(scoreHeadline('Board meeting scheduled for Tuesday')).toBe(0);
  });
});

describe('summariseTone', () => {
  /** One article used to produce a confident positive label. */
  it('reports no tone at all from a single article', () => {
    const reading = summariseTone([0.7], 1);
    expect(reading.tone).toBe('unknown');
    expect(reading.note).toMatch(/too few/i);
  });

  it('reports no tone when nothing was retrieved, and says why', () => {
    const reading = summariseTone([], 0);
    expect(reading.tone).toBe('unknown');
    expect(reading.note).toMatch(/missing data/i);
  });

  it('reports a tone once enough articles agree', () => {
    const reading = summariseTone([0.6, 0.5, 0.7, 0.4, 0.6], 5);
    expect(reading.tone).toBe('positive');
    expect(reading.articleCount).toBe(5);
  });

  /**
   * The measured defect. On a real feed seven of eight headlines scored exactly
   * zero, because an appointment, a filing and a bond issue carry no
   * directional language. Averaging those in alongside one real headline pinned
   * the mean near zero and reported neutral, which read as "the coverage was
   * balanced" when nothing had been measured.
   */
  it('reads neutral, and says why, when too few headlines carry a direction', () => {
    const reading = summariseTone([0, 0, 0, 0, 0, 0, -1, 0], 8);
    expect(reading.tone).toBe('neutral');
    expect(reading.score).toBe(0);
    expect(reading.thin).toBe(true);
    expect(reading.directionalCount).toBe(1);
    expect(reading.note).toMatch(/1 of 8/);
    expect(reading.note).toMatch(/not a balanced news picture/i);
  });

  /**
   * The share is the wrong denominator, because a feed pads itself with
   * "Share Price Live Updates" and "Prediction for Tomorrow" columns that
   * carry no direction. Three negative headlines out of eight was 37% and read
   * as no signal at all, on a feed whose headlines were "shares hit a 6-year
   * low", "stock crash" and "shares fall 5% in 5 sessions".
   */
  it('calls a tone when three headlines point the same way, out of eight', () => {
    const sixYearLow = [0, -1, 0, 0, 0, -1, 0, -1];
    const reading = summariseTone(sixYearLow, 8);
    expect(reading.tone).toBe('negative');
    expect(reading.thin).toBe(false);
  });

  it('still refuses to call a tone on two', () => {
    const reading = summariseTone([0, -1, 0, 0, 0, 0, -1, 0], 8);
    expect(reading.tone).toBe('neutral');
    expect(reading.thin).toBe(true);
  });

  /**
   * "Neutral" has two causes and a reader cannot tell them apart from the word.
   * One is a balanced news picture; the other is that nothing was measured.
   */
  it('marks a genuinely balanced read as not thin', () => {
    expect(summariseTone([0.8, -0.8, 0.9, -0.9, 0.7, -0.7, 0.8, -0.8], 8).thin).toBe(false);
    expect(summariseTone([0.6, 0.5, 0.7, 0.4, 0.6], 5).thin).toBe(false);
    expect(summariseTone([], 0).thin).toBe(false);
    expect(summariseTone([0.6], 1).thin).toBe(false);
  });

  it('reads neutral rather than dividing by nothing when no headline scored', () => {
    const reading = summariseTone([0, 0, 0, 0, 0], 5);
    expect(reading.tone).toBe('neutral');
    expect(reading.score).toBe(0);
  });

  it('still calls a tone when the headlines do carry a direction', () => {
    const positive = summariseTone([0, 1, 0, 1, 1, 0, 1, 1], 8);
    expect(positive.tone).toBe('positive');

    const negative = summariseTone([-1, 0, -1, -1, 0, -1, 0, -1], 8);
    expect(negative.tone).toBe('negative');
  });

  it('reads a multi-period low or high, not just a record one', () => {
    for (const headline of [
      'Infosys shares hit 6-year low intraday',
      'Stock falls to a 52-week low on weak demand',
      'Shares touch a 3-month low as demand slows',
    ]) {
      expect(Math.sign(scoreHeadline(headline)), headline).toBe(-1);
    }
    expect(Math.sign(scoreHeadline('Stock climbs to a 52-week high'))).toBe(1);
  });

  it('reports how many headlines carried a direction on every reading', () => {
    expect(summariseTone([0, 0, 0, 0, 0, 0, -1, 0], 8).directionalCount).toBe(1);
    expect(summariseTone([0, 1, 0, 1, 1, 0, 1, 1], 8).directionalCount).toBe(5);
    expect(summariseTone([], 0).directionalCount).toBe(0);
    expect(summariseTone([0.6], 1).directionalCount).toBe(1);
  });

  it('shrinks the score toward zero when the sample is at the threshold', () => {
    const atThreshold = summariseTone([0.6, 0.6, 0.6, 0.6, 0.6], MIN_ARTICLES_FOR_TONE);
    const wellSampled = summariseTone(new Array(20).fill(0.6), 20);
    expect(Math.abs(atThreshold.score)).toBeLessThan(Math.abs(wellSampled.score));
  });
});

describe('matchesCompany', () => {
  const reliance = { symbol: 'RELIANCE', companyName: 'Reliance Industries Limited' };

  it('matches on the company name or the ticker as a whole word', () => {
    expect(matchesCompany('Reliance Industries raised its dividend', reliance)).toBe(true);
    expect(matchesCompany('RELIANCE shares fell today', reliance)).toBe(true);
    expect(matchesCompany('Reliance stock falls 2.32 percent as oil worries hit India', reliance)).toBe(
      true
    );
  });

  /**
   * "Reliance" is an ordinary English word, so matching it on its own pulled an
   * article about Korean pop acts into a Reliance Industries feed.
   */
  it('does not match a one-word name used as an ordinary English word', () => {
    expect(
      matchesCompany('HYBE, JYP Stocks Plunge on Heavy Reliance on Single Acts', reliance)
    ).toBe(false);
    expect(
      matchesCompany('Results show a heavy reliance on imports this quarter', reliance)
    ).toBe(false);
  });

  it('still matches that company when the name is written out', () => {
    expect(
      matchesCompany('Sonu Infratech wins work order from Reliance Industries', reliance)
    ).toBe(true);
  });

  /**
   * Substring matching meant the two-character ticker LT matched "result",
   * "default", "built" and "consult", and IDEA matched the English word "idea".
   */
  it('does not match a short ticker inside another word', () => {
    const lt = { symbol: 'LT', companyName: 'Larsen & Toubro Limited' };
    expect(matchesCompany('The result of the auction was unclear', lt)).toBe(false);
    expect(matchesCompany('They built a new default plant', lt)).toBe(false);

    const idea = { symbol: 'IDEA', companyName: 'Vodafone Idea Limited' };
    expect(matchesCompany('That is a good idea', idea)).toBe(false);
    expect(matchesCompany('Vodafone Idea tariff revision', idea)).toBe(true);
  });

  it('does not match an unrelated story that merely names a sector term', () => {
    expect(
      matchesCompany('Government policy announcement on fuel duty', {
        symbol: 'RELIANCE',
        companyName: 'Reliance Industries Limited',
      })
    ).toBe(false);
  });
});

describe('buildResearchLinks', () => {
  it('offers five primary sources for the company', () => {
    const links = buildResearchLinks('RELIANCE', 'Reliance Industries Limited');
    expect(links).toHaveLength(5);
    expect(links.map((link) => link.source)).toEqual([
      'Screener.in',
      'Yahoo Finance',
      'NSE India',
      'NSE India',
      'BSE India',
    ]);
  });

  it('builds every URL from the ticker, and never leaves a placeholder', () => {
    for (const link of buildResearchLinks('TCS', 'Tata Consultancy Services Ltd')) {
      expect(link.href).toMatch(/^https:\/\//);
      expect(link.href).not.toMatch(/undefined|null|\/company\/\/|\/\/;/);
    }
  });

  it('falls back to the ticker when no company name is available', () => {
    const links = buildResearchLinks('TCS', null);
    expect(links[0].label).toBe('TCS: company page');
  });

  it('escapes a ticker that contains an ampersand', () => {
    const [screener] = buildResearchLinks('M&M', 'Mahindra & Mahindra Limited');
    expect(screener.href).toBe('https://www.screener.in/company/M%26M/');
  });
});
