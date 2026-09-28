import { MailMessage } from './mail.service';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(title: string, body: string, ctaLabel: string, link: string): string {
  return `<!doctype html>
<html><body style="font-family:Arial,sans-serif;background:#f5f6f8;padding:24px;color:#1f2937">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;padding:32px">
    <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
    ${body}
    <p style="margin:24px 0">
      <a href="${escapeHtml(link)}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">${ctaLabel}</a>
    </p>
    <p style="font-size:12px;color:#6b7280">If the button does not work, copy this link:<br>${escapeHtml(link)}</p>
  </div>
</body></html>`;
}

export function passwordResetEmail(to: string, link: string): MailMessage {
  return {
    to,
    subject: 'Reset your Support Helper password',
    html: layout(
      'Reset your password',
      '<p>We received a request to reset your password. This link is valid for 1 hour.</p>' +
        '<p>If you did not request it, you can safely ignore this email.</p>',
      'Choose a new password',
      link,
    ),
    text: `Reset your password (valid 1 hour): ${link}`,
  };
}

export function invitationEmail(
  to: string,
  link: string,
  organizationName: string,
  inviterName: string,
): MailMessage {
  const org = escapeHtml(organizationName);
  const inviter = escapeHtml(inviterName);
  return {
    to,
    subject: `${organizationName} invited you to Support Helper`,
    html: layout(
      `Join ${org} on Support Helper`,
      `<p>${inviter} invited you to join <strong>${org}</strong>.</p>` +
        '<p>Choose your password to activate your account. This invitation is valid for 7 days.</p>',
      'Accept the invitation',
      link,
    ),
    text: `${inviterName} invited you to join ${organizationName}. Accept (valid 7 days): ${link}`,
  };
}
