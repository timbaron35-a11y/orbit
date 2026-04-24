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

  const appUrl = 'https://orbit-six-indol.vercel.app';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;padding:40px 36px;background:#111;border:1px solid #222;border-radius:16px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px;">
      <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#7c5cfc,#a78bfa);display:flex;align-items:center;justify-content:center;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
          <circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity=".5"/>
        </svg>
      </div>
      <span style="font-size:16px;font-weight:700;color:white;">${appName || 'Orbit'}</span>
    </div>

    <h1 style="font-size:22px;font-weight:700;color:white;margin:0 0 12px;letter-spacing:-0.5px;">
      Vous avez été invité
    </h1>
    <p style="font-size:15px;color:rgba(255,255,255,0.5);line-height:1.7;margin:0 0 28px;">
      <strong style="color:rgba(255,255,255,0.85);">${ownerName}</strong> (${ownerEmail}) vous invite à collaborer sur son espace ${appName || 'Orbit'}.
    </p>

    <a href="${appUrl}" style="display:inline-block;padding:13px 28px;border-radius:10px;background:linear-gradient(135deg,#7c5cfc,#6d4df0);color:white;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:-0.2px;">
      Accéder à ${appName || 'Orbit'} →
    </a>

    <p style="font-size:13px;color:rgba(255,255,255,0.25);margin-top:32px;line-height:1.6;">
      Connectez-vous avec l'adresse <strong style="color:rgba(255,255,255,0.4);">${toEmail}</strong> pour accepter l'invitation dans les paramètres.
    </p>
  </div>
</body>
</html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Orbit <noreply@app-orbit.fr>',
      to: [toEmail],
      subject: `${ownerName} vous invite sur ${appName || 'Orbit'}`,
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return res.status(500).json({ error: err });
  }

  return res.status(200).json({ ok: true });
}
