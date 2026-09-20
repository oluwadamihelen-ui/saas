import "server-only";

/// Renders a notification as a branded HTML email — table-based layout
/// with every style inline, since email clients (Outlook above all) don't
/// support external/`<style>` CSS reliably. Kept intentionally simple:
/// one header (logo or lettermark + school name), one message block, an
/// optional call-to-action button, and a footer with a preferences link
/// and a small "Powered by Schoolum" line.
///
/// The logo is referenced by a real https:// URL (the /api/branding/logo
/// route), never the data: URL stored on School.logoUrl directly — most
/// email clients (Gmail included) strip or refuse to render data: URIs in
/// message bodies, which is exactly why a school's logo would show up
/// broken in earlier emails even though it renders fine in the browser.
export function renderNotificationEmail(input: {
  schoolName: string;
  logoUrl: string | null;
  brandColor: string | null;
  title: string;
  body: string | undefined;
  actionLabel: string | undefined;
  actionUrl: string | null;
  preferencesUrl: string | null;
}): string {
  const accent = input.brandColor && /^#[0-9a-fA-F]{6}$/.test(input.brandColor) ? input.brandColor : "#2563eb";
  const schoolName = escapeHtml(input.schoolName);
  const title = escapeHtml(input.title);
  const bodyHtml = input.body ? escapeHtml(input.body).replace(/\n/g, "<br>") : "";

  const headerHtml = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${schoolName}" width="40" height="40" style="display:block;border:0;border-radius:8px;width:40px;height:40px;object-fit:contain;background:#ffffff;" />`
    : `<div style="width:40px;height:40px;border-radius:8px;background:${accent};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;line-height:40px;text-align:center;">${escapeHtml(schoolName.charAt(0).toUpperCase())}</div>`;

  const buttonHtml =
    input.actionLabel && input.actionUrl
      ? `
      <tr>
        <td style="padding:8px 32px 0 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="border-radius:6px;background:${accent};">
                <a href="${escapeHtml(input.actionUrl)}" target="_blank" style="display:inline-block;padding:11px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(input.actionLabel)}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
      : "";

  const preferencesHtml = input.preferencesUrl
    ? `<a href="${escapeHtml(input.preferencesUrl)}" style="color:#6b7280;text-decoration:underline;">Manage notification preferences</a> · `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:24px 32px;border-bottom:3px solid ${accent};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:12px;">${headerHtml}</td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#111827;">${schoolName}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#111827;">
            ${title}
          </td>
        </tr>
        ${bodyHtml ? `<tr><td style="padding:8px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">${bodyHtml}</td></tr>` : ""}
        ${buttonHtml}
        <tr>
          <td style="padding:32px;">
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px 0;" />
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280;">
              ${preferencesHtml}This is an automated message from ${schoolName}.
            </p>
            <p style="margin:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9ca3af;">
              Powered by Schoolum
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
