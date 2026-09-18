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

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

/**
 * The shared shell: header, body slot, and the unsubscribe footer every email
 * must carry.
 */
export function renderLayout({ heading, bodyHtml, unsubscribeUrl, footerNote }) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;border:1px solid #e7e5e4;">
      <tr><td style="padding:24px 24px 8px 24px;font-family:${FONT};">
        <h1 style="margin:0;font-size:20px;line-height:1.3;color:#1c1917;">${esc(heading)}</h1>
      </td></tr>
      <tr><td style="padding:8px 24px 24px 24px;font-family:${FONT};font-size:14px;line-height:1.5;color:#292524;">
${bodyHtml}
      </td></tr>
      <tr><td style="padding:16px 24px;border-top:1px solid #e7e5e4;font-family:${FONT};font-size:12px;line-height:1.5;color:#78716c;">
        ${footerNote ? `<p style="margin:0 0 8px 0;">${esc(footerNote)}</p>` : ''}
        <p style="margin:0;"><a href="${unsubscribeUrl}" style="color:#78716c;">Unsubscribe from these emails</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
