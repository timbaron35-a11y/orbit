import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY manquante' });

  const { toEmail, ownerName, ownerEmail, appName } = req.body as {
    toEmail: string;
    ownerName: string;
    ownerEmail: string;
    appName: string;
  };

  if (!toEmail || !ownerName) return res.status(400).json({ error: 'Paramètres manquants' });

  const appUrl = 'https://app-orbit.fr';
  const name = appName || 'Orbit';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Invitation ${name}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="padding:28px 36px 24px;border-bottom:1px solid #f0f0f0;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:32px;height:32px;background:#7c5cfc;border-radius:8px;text-align:center;vertical-align:middle;">
                  <span style="color:white;font-size:16px;font-weight:700;line-height:32px;">O</span>
                </td>
                <td style="padding-left:10px;font-size:16px;font-weight:700;color:#18181b;">${name}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#7c5cfc;text-transform:uppercase;letter-spacing:0.05em;">Invitation à collaborer</p>
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#18181b;line-height:1.3;">
              ${ownerName} vous invite sur ${name}
            </h1>
            <p style="margin:0 0 28px;font-size:15px;color:#52525b;line-height:1.7;">
              Vous avez été invité(e) à rejoindre l'espace de travail de <strong style="color:#18181b;">${ownerName}</strong>${ownerEmail ? ` (${ownerEmail})` : ''} sur ${name}, un CRM pour freelances.
            </p>

            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:8px;background:#7c5cfc;">
                  <a href="${appUrl}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                    Accéder à ${name} →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:13px;color:#71717a;line-height:1.6;">
              Connectez-vous avec <strong>${toEmail}</strong>, puis acceptez l'invitation dans les paramètres.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid #f0f0f0;background:#fafafa;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
              Vous recevez cet email car ${ownerName} vous a invité(e) sur ${name}.<br>
              Si vous ne souhaitez pas rejoindre cet espace, ignorez simplement ce message.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${ownerName} vous invite sur ${name}

Vous avez été invité(e) à rejoindre l'espace de travail de ${ownerName}${ownerEmail ? ` (${ownerEmail})` : ''} sur ${name}.

Accédez à ${name} : ${appUrl}

Connectez-vous avec ${toEmail}, puis acceptez l'invitation dans les paramètres.

---
Vous recevez cet email car ${ownerName} vous a invité(e) sur ${name}.
Si vous ne souhaitez pas rejoindre cet espace, ignorez simplement ce message.`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${name} <noreply@app-orbit.fr>`,
      to: [toEmail],
      subject: `${ownerName} vous invite à collaborer sur ${name}`,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return res.status(500).json({ error: err });
  }

  return res.status(200).json({ ok: true });
}
