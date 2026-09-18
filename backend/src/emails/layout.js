// Email HTML is not web HTML. Clients strip <style> blocks, block remote images
// by default, and many still lay out with tables. So: inline styles only, table
// layout, 600px max width, no external assets. These are requirements, not
// preferences.

/**
 * Escape user-supplied text. Group names and display names are user input and
 * land in an HTML document.
 */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The site's own faces (frontend/index.html loads both from Google Fonts, and
// designsystem/tokens/typography.json maps heading -> Nunito, body -> Nunito
// Sans). The webfont <link> below is honoured by Apple Mail and iOS Mail;
// Gmail and Outlook strip it, which is exactly why the full fallback stack
// matters — it is the same stack the site degrades to, so an email that cannot
// load Nunito still matches a browser that cannot.
const HEADING_FONT =
  "'Nunito', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const BODY_FONT =
  "'Nunito Sans', 'Nunito', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const FONT_LINK =
  '<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400..800&family=Nunito+Sans:wght@400..700&display=swap" rel="stylesheet">';

// The purple the site's brand mark uses.
const BRAND = '#7c3aed';

/**
 * The shared shell: a Confidence Picks masthead, the body slot, and the
 * unsubscribe footer every email must carry.
 *
 * The masthead is not decoration. A recipient scanning an inbox should be able
 * to tell what this is from the message itself rather than having to trust the
 * From line — display names are the first thing a forwarded or clipped message
 * loses.
 */
export function renderLayout({ heading, bodyHtml, unsubscribeUrl, footerNote }) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${FONT_LINK}
</head>
<body style="margin:0;padding:0;background:#f5f5f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;border:1px solid #e7e5e4;">
      <tr><td style="padding:20px 24px 0 24px;font-family:${HEADING_FONT};">
        <span style="font-size:15px;font-weight:800;letter-spacing:-0.01em;color:${BRAND};">Confidence Picks</span>
      </td></tr>
      <tr><td style="padding:12px 24px 8px 24px;font-family:${HEADING_FONT};">
        <h1 style="margin:0;font-size:20px;line-height:1.3;font-weight:800;color:#1c1917;">${esc(heading)}</h1>
      </td></tr>
      <tr><td style="padding:8px 24px 24px 24px;font-family:${BODY_FONT};font-size:14px;line-height:1.5;color:#292524;">
${bodyHtml}
      </td></tr>
      <tr><td style="padding:16px 24px;border-top:1px solid #e7e5e4;font-family:${BODY_FONT};font-size:12px;line-height:1.5;color:#78716c;">
        <p style="margin:0 0 8px 0;">Confidence Picks — weekly NFL confidence pools with your friends.</p>
        ${footerNote ? `<p style="margin:0 0 8px 0;">${esc(footerNote)}</p>` : ''}
        <p style="margin:0;"><a href="${unsubscribeUrl}" style="color:#78716c;">Unsubscribe from these emails</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export { HEADING_FONT, BODY_FONT };
