import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY manquante' });

  const { userEmail, description } = req.body as { userEmail: string; description: string };
  if (!description?.trim()) return res.status(400).json({ error: 'Description manquante' });

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#f4f4f5;padding:40px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
    <div style="padding:24px 32px;border-bottom:1px solid #f0f0f0;background:#fafafa;">
      <p style="margin:0;font-size:12px;font-weight:600;color:#7c5cfc;text-transform:uppercase;letter-spacing:0.05em;">Nouvelle demande d'automation</p>
      <h1 style="margin:8px 0 0;font-size:20px;font-weight:700;color:#18181b;">Orbit — Plan Premium</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;">Client</p>
      <p style="margin:0 0 24px;font-size:15px;color:#18181b;">${userEmail}</p>
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;">Automation demandée</p>
      <div style="background:#f4f4f5;border-radius:8px;padding:16px;font-size:14px;color:#18181b;line-height:1.7;white-space:pre-wrap;">${description.trim()}</div>
      <p style="margin:24px 0 0;font-size:13px;color:#71717a;">À livrer dans les 3 jours ouvrés.</p>
    </div>
  </div>
</body>
</html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Orbit <noreply@app-orbit.fr>',
      to: ['tim.baron.35@gmail.com'],
      reply_to: userEmail,
      subject: `[Orbit Premium] Demande d'automation — ${userEmail}`,
      html,
      text: `Nouvelle demande d'automation\n\nClient : ${userEmail}\n\nDescription :\n${description.trim()}\n\nÀ livrer dans les 3 jours ouvrés.`,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return res.status(500).json({ error: err });
  }

  return res.status(200).json({ ok: true });
}
