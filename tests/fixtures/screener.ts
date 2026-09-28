/**
 * Provider markup captured from live responses, trimmed to the parts the
 * parsers read. Keeping the real shape here, including the empty-value rows,
 * is what makes these fixtures able to catch a parser regression.
 */

/** Vodafone Idea: loss-making, so P/E and ROE are rendered as empty spans. */
export const SCREENER_LOSSMAKING = `
<html><body>
  <ul id="top-ratios">
    <li class="flex flex-space-between" data-source="default">
      <span class="name">

          Market Cap

      </span>
      <span class="nowrap value">
        ₹
        <span class="number">1,46,040</span>

          Cr.
      </span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">

          Current Price

      </span>
      <span class="nowrap value">₹ <span class="number">13.5</span></span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">

          High / Low

      </span>
      <span class="nowrap value">₹ <span class="number">15.8</span> / <span class="number">8.02</span></span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">

          Stock P/E

      </span>
      <span class="nowrap value">

        <span class="number"></span>

      </span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">

          Book Value

      </span>
      <span class="nowrap value">₹ <span class="number">-3.26</span></span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">

          Dividend Yield

      </span>
      <span class="nowrap value">
        <span class="number">0.00</span>
          %
      </span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">

          ROCE

      </span>
      <span class="nowrap value">
        <span class="number">-1.92</span>
          %
      </span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">

          ROE

      </span>
      <span class="nowrap value">
        <span class="number"></span>
          %
      </span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">

          Face Value

      </span>
      <span class="nowrap value">₹ <span class="number">10.0</span></span>
    </li>
  </ul>

  <h1 class="h2 flex flex-align-center gap-12 min-width-0 u-max-full-width" style="margin: 0.5em 0">
    <span class="square bg-white border-radius-6" style="width: 36px; height: 36px">
      <img src="https://cdn-media.screener.in/logo.webp" alt="" width="30" height="30">
    </span>
    <span class="min-width-0 overflow-wrap-anywhere">Vodafone Idea Ltd</span>
  </h1>

  <p class="sub">
    <a href="/market/IN10/" target="_blank" title="Broad Sector">Telecommunication</a>
    <i class="icon-right"></i>
    <a href="/market/IN10/IN1001/" target="_blank" title="Sector">Telecommunication</a>
    <i class="icon-right"></i>
    <a href="/market/IN10/IN1001/IN100101/" target="_blank" title="Broad Industry">Telecom - Services</a>
    <i class="icon-right"></i>
    <a href="/market/IN10/IN1001/IN100101/IN100101001/" target="_blank" title="Industry">Telecom - Cellular &amp; Fixed line services</a>
  </p>

  <section id="profit-loss">
    <table class="data-table">
      <thead>
        <tr>
          <th class="text"></th>
          <th class="" data-date-key="2025-03-31"> Mar 2025 </th>
          <th class="" data-date-key="2026-03-31"> Mar 2026 </th>
        </tr>
      </thead>
      <tbody>
        <tr class="stripe">
          <td class="text"> EPS in Rs </td>
          <td class=""> 4.80 </td>
          <td class=""> -0.34 </td>
        </tr>
        <tr class="">
          <td class="text"> Book Value </td>
          <td class=""> 0.90 </td>
          <td class=""> -3.26 </td>
        </tr>
      </tbody>
    </table>
  </section>
</body></html>
`;

/** Reliance Industries: every published row is populated. */
export const SCREENER_PROFITABLE = `
<html><body>
  <ul id="top-ratios">
    <li class="flex flex-space-between" data-source="default">
      <span class="name">Market Cap</span>
      <span class="nowrap value">₹ <span class="number">16,20,656</span> Cr.</span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">Current Price</span>
      <span class="nowrap value">₹ <span class="number">1,198</span></span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">Stock P/E</span>
      <span class="nowrap value"><span class="number">41.3</span></span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">Book Value</span>
      <span class="nowrap value">₹ <span class="number">418</span></span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">Dividend Yield</span>
      <span class="nowrap value"><span class="number">0.50</span> %</span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">ROCE</span>
      <span class="nowrap value"><span class="number">7.78</span> %</span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">ROE</span>
      <span class="nowrap value"><span class="number">7.71</span> %</span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">Face Value</span>
      <span class="nowrap value">₹ <span class="number">10.0</span></span>
    </li>
  </ul>

  <h1 class="h2 flex">
    <span class="square"><img src="x.webp" alt=""></span>
    <span class="min-width-0">Reliance Industries Ltd</span>
  </h1>

  <p class="sub">
    <a href="/market/IN03/" title="Broad Sector">Energy</a>
    <a href="/market/IN03/IN0301/" title="Sector">Oil, Gas &amp; Consumable Fuels</a>
  </p>

  <section id="profit-loss">
    <table class="data-table">
      <thead>
        <tr>
          <th class="text"></th>
          <th class="" data-date-key="2025-03-31"> Mar 2025 </th>
          <th class="" data-date-key="2026-03-31"> Mar 2026 </th>
        </tr>
      </thead>
      <tbody>
        <tr class="stripe">
          <td class="text"> EPS in Rs </td>
          <td class=""> 6.75 </td>
          <td class=""> 9.81 </td>
        </tr>
      </tbody>
    </table>
  </section>
</body></html>
`;

/** HDFC Bank: the About prose contains the word "Sector" before the real link. */
export const SCREENER_WITH_PROSE = `
<html><body>
  <p class="about">As of April 2024, HDFC Bank has a market capitalization of $145 billion,
  making it the third-largest company on the Indian stock exchanges.</p>
  <ul id="top-ratios">
    <li class="flex flex-space-between" data-source="default">
      <span class="name">Stock P/E</span>
      <span class="nowrap value"><span class="number">14.7</span></span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">Book Value</span>
      <span class="nowrap value">₹ <span class="number">375</span></span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">ROE</span>
      <span class="nowrap value"><span class="number">14.0</span> %</span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">ROCE</span>
      <span class="nowrap value"><span class="number">6.92</span> %</span>
    </li>
    <li class="flex flex-space-between" data-source="default">
      <span class="name">Dividend Yield</span>
      <span class="nowrap value"><span class="number">1.81</span> %</span>
    </li>
  </ul>
  <h1 class="h2"><span class="square"><img alt=""></span><span>HDFC Bank Limited</span></h1>
  <p class="sub">
    <a href="/market/IN15/" title="Broad Sector">Financial Services</a>
    <a href="/market/IN15/IN1510/" title="Sector">Financial Services</a>
    <a href="/market/IN15/IN1510/IN151010/" title="Industry">Bank</a>
  </p>
</body></html>
`;

export const SCREENER_NOT_A_COMPANY = `<html><body><h1>Page not found</h1></body></html>`;
