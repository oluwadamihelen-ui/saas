export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * Shared layout every template renders through — email clients need
 * inline styles (no external stylesheet, no Tailwind), so this is kept
 * deliberately plain rather than trying to reproduce the app's own design
 * system.
 */
function layout(preheader: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <span style="display:none;font-size:1px;color:#f4f4f6;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#131318;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <span style="font-size:20px;font-weight:700;color:#f4f4f6;">Film<span style="color:#f97316;">Doe</span></span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px 32px;color:#f4f4f6;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
          </table>
          <p style="max-width:480px;margin:16px auto 0;color:#9a9aa8;font-size:12px;">FilmDoe — AI-powered filmmaking.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:20px;padding:12px 24px;background-color:#f97316;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;">${label}</a>`;
}

export function welcomeEmail(name: string, createProjectUrl: string): EmailContent {
  const preheader = "Your FilmDoe account is ready — start creating.";
  const html = layout(
    preheader,
    `<p>Hi ${name || "there"},</p>
     <p>Welcome to FilmDoe. Your account is set up and ready — turn an idea or a screenplay into a finished movie, start to finish.</p>
     ${button(createProjectUrl, "Create your first movie")}`,
  );
  const text = `Hi ${name || "there"},\n\nWelcome to FilmDoe. Your account is set up and ready — turn an idea or a screenplay into a finished movie, start to finish.\n\nCreate your first movie: ${createProjectUrl}`;
  return { subject: "Welcome to FilmDoe", html, text };
}

export function passwordResetEmail(resetUrl: string): EmailContent {
  const preheader = "Reset your FilmDoe password.";
  const html = layout(
    preheader,
    `<p>We got a request to reset your FilmDoe password.</p>
     ${button(resetUrl, "Reset password")}
     <p style="margin-top:20px;color:#9a9aa8;font-size:13px;">This link expires in 1 hour. If you didn&rsquo;t request this, you can safely ignore this email — your password won&rsquo;t change.</p>`,
  );
  const text = `We got a request to reset your FilmDoe password.\n\nReset it here (expires in 1 hour): ${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`;
  return { subject: "Reset your FilmDoe password", html, text };
}

export function exportReadyEmail(params: { projectTitle: string; episodeTitle: string; projectUrl: string }): EmailContent {
  const preheader = `${params.episodeTitle} is ready to watch.`;
  const html = layout(
    preheader,
    `<p>Good news — <strong>${params.episodeTitle}</strong> from <strong>${params.projectTitle}</strong> has finished exporting and is ready to watch.</p>
     ${button(params.projectUrl, "Watch it now")}`,
  );
  const text = `Good news — ${params.episodeTitle} from ${params.projectTitle} has finished exporting and is ready to watch.\n\n${params.projectUrl}`;
  return { subject: `${params.episodeTitle} is ready`, html, text };
}

export function exportFailedEmail(params: { projectTitle: string; episodeTitle: string; errorMessage: string; projectUrl: string }): EmailContent {
  const preheader = `${params.episodeTitle} couldn't be exported.`;
  const html = layout(
    preheader,
    `<p>We couldn&rsquo;t finish exporting <strong>${params.episodeTitle}</strong> from <strong>${params.projectTitle}</strong>.</p>
     <p style="color:#9a9aa8;font-size:13px;">${params.errorMessage}</p>
     ${button(params.projectUrl, "View project")}`,
  );
  const text = `We couldn't finish exporting ${params.episodeTitle} from ${params.projectTitle}.\n\n${params.errorMessage}\n\n${params.projectUrl}`;
  return { subject: `${params.episodeTitle} export failed`, html, text };
}

export function organizationInviteEmail(params: { organizationName: string; inviterName: string; acceptUrl: string }): EmailContent {
  const preheader = `${params.inviterName} invited you to join ${params.organizationName} on FilmDoe.`;
  const html = layout(
    preheader,
    `<p><strong>${params.inviterName}</strong> invited you to join <strong>${params.organizationName}</strong>&rsquo;s studio team on FilmDoe.</p>
     ${button(params.acceptUrl, "Accept invite")}
     <p style="margin-top:20px;color:#9a9aa8;font-size:13px;">This invite expires in 7 days. If you weren&rsquo;t expecting this, you can safely ignore this email.</p>`,
  );
  const text = `${params.inviterName} invited you to join ${params.organizationName}'s studio team on FilmDoe.\n\nAccept the invite (expires in 7 days): ${params.acceptUrl}\n\nIf you weren't expecting this, you can safely ignore this email.`;
  return { subject: `${params.inviterName} invited you to join ${params.organizationName} on FilmDoe`, html, text };
}
