/** Wraps a small HTML body fragment in a minimal, inline-styled shell that renders consistently across email clients. */
export function renderNotificationEmail({ title, message, appUrl }: { title: string; message: string; appUrl: string }): string {
  const logoUrl = `${appUrl}/brand/otelum-logo.png`;
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f8fa;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:10px;border:1px solid #e4e6eb;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <img src="${logoUrl}" alt="Otelum" height="28" style="height:28px;width:auto;display:block;" />
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px 32px;">
                <h1 style="margin:0;font-size:18px;font-weight:600;color:#0f1115;">${title}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px 32px;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#667085;">${message}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #e4e6eb;">
                <p style="margin:0;font-size:12px;color:#98a2b3;">This is an automated notification from your Otelum account.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
