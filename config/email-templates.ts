import { brand } from './brand.ts';

/**
 * Auth email templates (verification + password reset), built from config/brand.ts.
 *
 *  - `npm run brand:sync` writes them to supabase/templates/*.html for the real backend,
 *    passing Supabase's placeholder {{ .ConfirmationURL }} as the link.
 *  - The web preview's fake inbox renders the same templates with a fake link.
 *
 * Emails are bilingual (EN + RO) because the auth email is sent before we know
 * the user's language for sure. The slogan stays in English (brand rule).
 */
export type EmailKind = 'confirmation' | 'recovery';

export const emailSubjects: Record<EmailKind, string> = {
  confirmation: `Confirm your ${brand.name} account · Confirmă contul ${brand.name}`,
  recovery: `Reset your ${brand.name} password · Resetează parola ${brand.name}`,
};

const copy: Record<EmailKind, { en: [string, string, string]; ro: [string, string, string] }> = {
  confirmation: {
    en: ['Welcome to the grid!', 'Confirm your email address to activate your account.', 'Confirm email'],
    ro: ['Bine ai venit pe grilă!', 'Confirmă adresa de email pentru a-ți activa contul.', 'Confirmă emailul'],
  },
  recovery: {
    en: ['Reset your password', 'Someone (hopefully you) asked to reset your password. The link is valid for 1 hour.', 'Choose a new password'],
    ro: ['Resetează-ți parola', 'Cineva (sperăm că tu) a cerut resetarea parolei. Linkul este valabil 1 oră.', 'Alege o parolă nouă'],
  },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderEmail(kind: EmailKind, actionUrl: string): { subject: string; html: string } {
  const c = copy[kind];
  const checkers = Array.from({ length: 12 }, (_, i) =>
    `<td style="width:8px;height:8px;background:${i % 2 ? 'transparent' : '#ffffff'}"></td>`,
  ).join('');
  const block = ([title, body, cta]: [string, string, string]) => `
      <h2 style="margin:24px 0 8px;font-size:22px;color:#ffffff;text-transform:uppercase;letter-spacing:.5px">${escapeHtml(title)}</h2>
      <p style="margin:0 0 20px;font-size:15px;line-height:22px;color:#c9c9d1">${escapeHtml(body)}</p>
      <a href="${actionUrl}" style="display:inline-block;background:${brand.colors.accent};color:#ffffff;text-decoration:none;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:14px 24px;border-radius:10px">${escapeHtml(cta)}</a>`;

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(emailSubjects[kind])}</title></head>
<body style="margin:0;background:#0b0b0d;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0d;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#16161a;border-radius:16px;padding:32px">
        <tr><td>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>${checkers}</tr></table>
          <div style="margin-top:12px;font-size:40px;font-weight:900;font-style:italic;letter-spacing:.5px;color:#ffffff">${escapeHtml(brand.wordmark.lead)}<span style="color:${brand.colors.accent}">${escapeHtml(brand.wordmark.accent)}</span></div>
          <div style="font-size:14px;color:#a3a3ad">${escapeHtml(brand.slogan)}</div>
          ${block(c.en)}
          <hr style="border:none;border-top:1px solid #2c2c34;margin:28px 0 4px">
          ${block(c.ro)}
          <p style="margin:28px 0 0;font-size:12px;line-height:18px;color:#71717c">
            If you didn't request this, you can ignore this email. · Dacă nu ai cerut acest email, îl poți ignora.<br>
            ${escapeHtml(brand.name)} · ${escapeHtml(brand.legalEntity)} · <a href="mailto:${brand.supportEmail}" style="color:#a3a3ad">${escapeHtml(brand.supportEmail)}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;
  return { subject: emailSubjects[kind], html };
}
