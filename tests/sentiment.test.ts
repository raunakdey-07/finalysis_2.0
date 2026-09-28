import { describe, expect, it } from 'vitest';
import {
  MIN_ARTICLES_FOR_TONE,
  buildResearchLinks,
  matchesCompany,
  parseRssFeed,
  scoreHeadline,
  summariseTone,
} from '@/lib/sentiment';

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
      'Reliance posts record profit, board approves buyback - The Hindu BusinessLine'
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
    // "surprise" contains "rise" and "advertising" contains "rise"; neither is
    // a gain under a plain substring test.
    expect(scoreHeadline('A surprise order for the company')).toBe(0);
    expect(scoreHeadline('The advertising line rose sharply')).toBe(0);
  });

  it('halves the weight of a negated term', () => {
    const negated = scoreHeadline('Company did not post a loss');
    expect(negated).toBeLessThanOrEqual(0);
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
  it('marks every placeholder as synthetic so it is never counted as evidence', () => {
    const links = buildResearchLinks({ symbol: 'RELIANCE', companyName: 'Reliance Industries Limited' }, 4);
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.synthetic === true)).toBe(true);
  });

  it('returns nothing when there is no company in context', () => {
    expect(buildResearchLinks(null, 4)).toEqual([]);
  });
});
