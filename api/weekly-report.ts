import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import OpenAI from 'openai';

function getDb() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) });
  }
  return getFirestore();
}

const STATUS_LABEL: Record<string, string> = {
  nouveau: 'Nouveau', contacté: 'Contacté', devis: 'Devis', signé: 'Signé', perdu: 'Perdu',
};

const STATUS_COLOR: Record<string, string> = {
  nouveau: '#a78bfa', contacté: '#3b82f6', devis: '#f59e0b', signé: '#22c55e', perdu: '#ef4444',
};

function tsToDate(ts: Timestamp | { seconds: number }): Date {
  if (ts instanceof Timestamp) return ts.toDate();
  return new Date(ts.seconds * 1000);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function startOfWeek(d: Date): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
}

interface Prospect {
  id: string; name: string; status: string; amount: number;
  lastContact: Timestamp; reminderDate?: Timestamp; createdAt?: Timestamp;
}

interface PipelineStats {
  total: number; byStatus: Record<string, number>;
  ca: number; caByStatus: Record<string, number>;
  overdueReminders: Prospect[]; newThisWeek: number;
  needsFollowUp: Prospect[]; hotProspects: Prospect[];
  conversionRate: number; forecastCA: number;
}

function computeStats(prospects: Prospect[]): PipelineStats {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const byStatus: Record<string, number> = {};
  const caByStatus: Record<string, number> = {};
  let ca = 0; let forecastCA = 0;
  const overdueReminders: Prospect[] = [];
  const needsFollowUp: Prospect[] = [];
  let newThisWeek = 0;

  const PIPELINE_WEIGHTS: Record<string, number> = {
    nouveau: 0.1, contacté: 0.25, devis: 0.6, signé: 1, perdu: 0,
  };

  for (const p of prospects) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    caByStatus[p.status] = (caByStatus[p.status] ?? 0) + p.amount;
    if (p.status === 'signé') ca += p.amount;
    forecastCA += p.amount * (PIPELINE_WEIGHTS[p.status] ?? 0);

    if (p.reminderDate) {
      const rd = new Date(tsToDate(p.reminderDate)); rd.setHours(0, 0, 0, 0);
      if (rd < today) overdueReminders.push(p);
    }

    if (p.createdAt) {
      const cd = tsToDate(p.createdAt);
      if (cd >= weekStart) newThisWeek++;
    }

    if (p.status !== 'signé' && p.status !== 'perdu') {
      const lc = tsToDate(p.lastContact);
      const days = Math.floor((now.getTime() - lc.getTime()) / 86400000);
      if (days >= 7) needsFollowUp.push(p);
    }
  }

  const signed = byStatus['signé'] ?? 0;
  const total = prospects.filter(p => p.status !== 'perdu').length;
  const conversionRate = total > 0 ? Math.round((signed / total) * 100) : 0;

  const hotProspects = prospects
    .filter(p => p.status === 'devis' || p.status === 'contacté')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  return {
    total: prospects.length, byStatus, ca, caByStatus,
    overdueReminders, newThisWeek, needsFollowUp, hotProspects,
    conversionRate, forecastCA,
  };
}

function pipelineScore(stats: PipelineStats): number {
  let score = 10;
  if (stats.overdueReminders.length > 0) score -= Math.min(3, stats.overdueReminders.length);
  if (stats.needsFollowUp.length > 3) score -= 2;
  else if (stats.needsFollowUp.length > 0) score -= 1;
  if (stats.conversionRate < 20) score -= 1;
  if (stats.newThisWeek === 0) score -= 1;
  if ((stats.byStatus['devis'] ?? 0) > 0) score += 1;
  return Math.max(1, Math.min(10, score));
}

async function generateNarrative(stats: PipelineStats, score: number, userName: string): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  const prompt = `Tu es l'assistant IA du CRM Orbit pour freelances. Tu génères un rapport hebdo personnalisé, direct et actionnable pour ${userName}.

Données de la semaine :
- ${stats.total} prospects au total
- Nouveaux cette semaine : ${stats.newThisWeek}
- Par statut : ${Object.entries(stats.byStatus).map(([s, n]) => `${STATUS_LABEL[s] ?? s}: ${n}`).join(', ')}
- CA signé : ${formatCurrency(stats.ca)}
- Prévision pipeline : ${formatCurrency(stats.forecastCA)}
- Taux de conversion : ${stats.conversionRate}%
- Score santé pipeline : ${score}/10
- Rappels en retard : ${stats.overdueReminders.length} (${stats.overdueReminders.map(p => p.name).join(', ') || 'aucun'})
- Prospects sans contact depuis +7j : ${stats.needsFollowUp.length} (${stats.needsFollowUp.map(p => p.name).join(', ') || 'aucun'})
- Prospects chauds (devis/contacté) : ${stats.hotProspects.map(p => `${p.name} (${formatCurrency(p.amount)})`).join(', ') || 'aucun'}

Génère un texte de 3 paragraphes courts (max 3 phrases chacun) :
1. Bilan de la semaine — ce qui s'est passé, ton ton est direct et bienveillant
2. Points d'attention — les choses urgentes à traiter
3. Focus de la semaine — 1 conseil concret et actionnable pour la semaine qui vient

Réponds uniquement avec les 3 paragraphes, sans titre ni numérotation. Tutoie l'utilisateur.`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 400,
    temperature: 0.7,
  });

  return res.choices[0].message.content ?? '';
}

function scoreColor(score: number): string {
  if (score >= 8) return '#22c55e';
  if (score >= 5) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(score: number): string {
  if (score >= 8) return 'Excellent';
  if (score >= 6) return 'Bon';
  if (score >= 4) return 'Moyen';
  return 'À améliorer';
}

function buildEmail(params: {
  userName: string; appName: string; stats: PipelineStats;
  score: number; narrative: string; weekLabel: string;
}): string {
  const { userName, appName, stats, score, narrative, weekLabel } = params;
  const sColor = scoreColor(score);
  const narrativeParagraphs = narrative.split('\n\n').filter(Boolean);

  const statusRows = Object.entries(stats.byStatus)
    .filter(([s]) => s !== 'perdu')
    .map(([s, n]) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${STATUS_COLOR[s] ?? '#888'};margin-right:8px;vertical-align:middle;"></span>
          <span style="font-size:13px;color:#52525b;">${STATUS_LABEL[s] ?? s}</span>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;font-weight:600;color:#18181b;">${n}</td>
        <td style="padding:8px 0 8px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;color:#7c5cfc;">
          ${stats.caByStatus[s] ? formatCurrency(stats.caByStatus[s]) : '—'}
        </td>
      </tr>
    `).join('');

  const urgentItems: string[] = [];
  if (stats.overdueReminders.length > 0) {
    urgentItems.push(`<li style="margin-bottom:6px;font-size:13px;color:#52525b;">
      <strong style="color:#ef4444;">⏰ ${stats.overdueReminders.length} rappel${stats.overdueReminders.length > 1 ? 's' : ''} en retard</strong> —
      ${stats.overdueReminders.slice(0, 2).map(p => p.name).join(', ')}${stats.overdueReminders.length > 2 ? ` +${stats.overdueReminders.length - 2}` : ''}
    </li>`);
  }
  if (stats.needsFollowUp.length > 0) {
    urgentItems.push(`<li style="margin-bottom:6px;font-size:13px;color:#52525b;">
      <strong style="color:#f59e0b;">📬 ${stats.needsFollowUp.length} prospect${stats.needsFollowUp.length > 1 ? 's' : ''} sans contact depuis +7j</strong> —
      ${stats.needsFollowUp.slice(0, 2).map(p => p.name).join(', ')}${stats.needsFollowUp.length > 2 ? ` +${stats.needsFollowUp.length - 2}` : ''}
    </li>`);
  }
  if (stats.hotProspects.length > 0) {
    urgentItems.push(`<li style="margin-bottom:6px;font-size:13px;color:#52525b;">
      <strong style="color:#22c55e;">🔥 ${stats.hotProspects.length} prospect${stats.hotProspects.length > 1 ? 's' : ''} chaud${stats.hotProspects.length > 1 ? 's' : ''}</strong> —
      ${stats.hotProspects.map(p => `${p.name} (${formatCurrency(p.amount)})`).join(', ')}
    </li>`);
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Rapport hebdo ${appName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e4e4e7;overflow:hidden;">

        <!-- Top accent bar -->
        <tr><td style="height:3px;background:linear-gradient(90deg,#7c5cfc,#a78bfa,#7c5cfc00);"></td></tr>

        <!-- Header -->
        <tr>
          <td style="padding:28px 36px 24px;border-bottom:1px solid #f0f0f0;">
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:32px;height:32px;background:#7c5cfc;border-radius:8px;text-align:center;vertical-align:middle;">
                        <span style="color:white;font-size:15px;font-weight:700;line-height:32px;">O</span>
                      </td>
                      <td style="padding-left:10px;">
                        <span style="font-size:16px;font-weight:700;color:#18181b;">${appName}</span>
                        <span style="font-size:12px;color:#a1a1aa;margin-left:8px;">Rapport hebdo</span>
                      </td>
                    </tr>
                  </table>
                </td>
                <td align="right">
                  <span style="font-size:12px;color:#a1a1aa;">${weekLabel}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Greeting + score -->
        <tr>
          <td style="padding:32px 36px 24px;">
            <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#18181b;letter-spacing:-0.5px;">
              Bonjour ${userName} 👋
            </h1>
            <p style="margin:0 0 28px;font-size:14px;color:#71717a;">Voici le résumé de ton pipeline cette semaine.</p>

            <!-- Score card -->
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;padding:20px 24px;position:relative;overflow:hidden;">
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td>
                        <div style="font-size:11px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Score santé pipeline</div>
                        <div style="font-size:36px;font-weight:700;color:${sColor};line-height:1;letter-spacing:-1px;">${score}<span style="font-size:18px;color:#a1a1aa;">/10</span></div>
                        <div style="font-size:13px;font-weight:600;color:${sColor};margin-top:4px;">${scoreLabel(score)}</div>
                      </td>
                      <td align="right" style="vertical-align:top;">
                        <table cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="text-align:center;padding:0 12px;">
                              <div style="font-size:22px;font-weight:700;color:#18181b;">${stats.total}</div>
                              <div style="font-size:11px;color:#a1a1aa;margin-top:2px;">Prospects</div>
                            </td>
                            <td style="text-align:center;padding:0 12px;border-left:1px solid #e4e4e7;">
                              <div style="font-size:22px;font-weight:700;color:#7c5cfc;">${formatCurrency(stats.forecastCA)}</div>
                              <div style="font-size:11px;color:#a1a1aa;margin-top:2px;">Prévision CA</div>
                            </td>
                            <td style="text-align:center;padding:0 0 0 12px;border-left:1px solid #e4e4e7;">
                              <div style="font-size:22px;font-weight:700;color:#22c55e;">${stats.conversionRate}%</div>
                              <div style="font-size:11px;color:#a1a1aa;margin-top:2px;">Conversion</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- AI Narrative -->
        <tr>
          <td style="padding:0 36px 28px;">
            <div style="background:linear-gradient(135deg,#f5f3ff,#ede9fe);border:1px solid #ddd6fe;border-radius:12px;padding:20px 24px;">
              <div style="font-size:11px;font-weight:700;color:#7c5cfc;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">✦ Analyse IA</div>
              ${narrativeParagraphs.map(p => `<p style="margin:0 0 10px;font-size:14px;color:#3f3f46;line-height:1.7;last-child:margin-bottom:0;">${p}</p>`).join('')}
            </div>
          </td>
        </tr>

        <!-- Pipeline breakdown -->
        <tr>
          <td style="padding:0 36px 28px;">
            <div style="font-size:11px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Pipeline</div>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.05em;padding-bottom:8px;">Statut</td>
                <td style="font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.05em;padding-bottom:8px;text-align:right;">Nb</td>
                <td style="font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.05em;padding-bottom:8px;text-align:right;padding-left:16px;">Montant</td>
              </tr>
              ${statusRows}
            </table>
          </td>
        </tr>

        ${urgentItems.length > 0 ? `
        <!-- Action items -->
        <tr>
          <td style="padding:0 36px 28px;">
            <div style="background:#fffbeb;border:1px solid #fde68a;border-left:3px solid #f59e0b;border-radius:12px;padding:20px 24px;">
              <div style="font-size:11px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">⚡ Points d'attention</div>
              <ul style="margin:0;padding-left:18px;">
                ${urgentItems.join('')}
              </ul>
            </div>
          </td>
        </tr>
        ` : ''}

        <!-- CTA -->
        <tr>
          <td style="padding:0 36px 32px;text-align:center;">
            <a href="https://app-orbit.fr" style="display:inline-block;padding:13px 32px;background:#7c5cfc;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:9px;">
              Ouvrir ${appName} →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid #f0f0f0;background:#fafafa;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;text-align:center;">
              Tu reçois ce rapport car tu as activé le récap hebdo dans ${appName}.<br>
              <a href="https://app-orbit.fr/settings" style="color:#7c5cfc;text-decoration:none;">Désactiver</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendReportForUser(uid: string, forceEmail?: string) {
  const db = getDb();
  const userRef = db.collection('users').doc(uid);

  const settingsSnap = await userRef.collection('meta').doc('settings').get();
  const settings = settingsSnap.data() ?? {};

  let userEmail: string | undefined = forceEmail;
  if (!userEmail) {
    try {
      const authUser = await getAuth().getUser(uid);
      userEmail = authUser.email;
    } catch { return { ok: false, reason: 'auth_error' }; }
  }
  if (!userEmail) return { ok: false, reason: 'no_email' };

  const userName = userEmail.split('@')[0].replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase()).split(' ')[0];
  const appName = settings.appName || 'Orbit';

  const prospectsSnap = await userRef.collection('prospects').get();
  const prospects: Prospect[] = prospectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Prospect));
  if (prospects.length === 0) return { ok: false, reason: 'no_prospects' };

  const now = new Date();
  const weekLabel = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(startOfWeek(now))
    + ' – ' + new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(now);

  const stats = computeStats(prospects);
  const score = pipelineScore(stats);
  const narrative = await generateNarrative(stats, score, userName);
  const html = buildEmail({ userName, appName, stats, score, narrative, weekLabel });

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY!}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${appName} <noreply@app-orbit.fr>`,
      to: [userEmail],
      subject: `📊 Ton rapport hebdo — Score ${score}/10`,
      html,
    }),
  });

  if (!emailRes.ok) return { ok: false, reason: await emailRes.text() };
  return { ok: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'];
  if (secret && authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Test mode: POST with { uid, email }
  if (req.method === 'POST') {
    const { uid, email } = req.body as { uid?: string; email?: string };
    if (!uid) return res.status(400).json({ error: 'uid requis' });
    const result = await sendReportForUser(uid, email);
    return res.status(result.ok ? 200 : 500).json(result);
  }

  // Cron mode: GET — send to all users with weeklyReport enabled
  try {
    const db = getDb();
    const usersSnap = await db.collection('users').listDocuments();
    let sent = 0; let skipped = 0;

    for (const userRef of usersSnap) {
      const settingsSnap = await userRef.collection('meta').doc('settings').get();
      if (!settingsSnap.data()?.weeklyReport) { skipped++; continue; }
      const result = await sendReportForUser(userRef.id);
      if (result.ok) sent++; else skipped++;
    }

    return res.status(200).json({ sent, skipped });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Erreur inconnue' });
  }
}
