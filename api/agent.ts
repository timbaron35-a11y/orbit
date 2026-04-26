import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY manquante' });

  const { transcript, prospects, stats } = req.body as {
    transcript: string;
    prospects: Array<{
      id: string;
      name: string;
      status: string;
      amount: number;
      email?: string;
      company?: string;
      daysSinceContact: number;
    }>;
    stats: {
      totalCA: number;
      signedCount: number;
      prospectCount: number;
    };
  };

  const openai = new OpenAI({ apiKey });

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'update_prospect_status',
        description: "Change le statut d'un prospect",
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: "L'ID du prospect" },
            name: { type: 'string', description: 'Le nom du prospect (pour confirmation)' },
            status: { type: 'string', enum: ['nouveau', 'contacté', 'devis', 'signé', 'perdu'] },
          },
          required: ['id', 'name', 'status'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'create_prospect',
        description: 'Crée un nouveau prospect',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            company: { type: 'string' },
            amount: { type: 'number' },
            status: { type: 'string', enum: ['nouveau', 'contacté', 'devis', 'signé', 'perdu'] },
          },
          required: ['name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_prospects',
        description: 'Liste les prospects selon un filtre',
        parameters: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              enum: ['all', 'inactive', 'hot', 'signed', 'lost', 'in_progress'],
              description: 'inactive = sans contact depuis +7j, hot = devis en cours, in_progress = nouveau ou contacté',
            },
          },
          required: ['filter'],
        },
      },
    },
  ];

  const systemPrompt = `Tu es un assistant commercial vocal intégré dans un CRM pour freelances.
Tu réponds en français, de manière très concise (1-2 phrases max).
Tu as accès aux données du CRM de l'utilisateur.

Données actuelles :
- ${stats.prospectCount} prospects au total
- ${stats.signedCount} signés
- CA signé : ${stats.totalCA.toLocaleString('fr-FR')}€

Prospects :
${prospects.map(p => `• ${p.name}${p.company ? ` (${p.company})` : ''} — ${p.status} — ${p.amount > 0 ? p.amount + '€' : 'montant non défini'} — dernier contact il y a ${p.daysSinceContact}j`).join('\n')}

Quand tu effectues une action, confirme-la brièvement. Si tu ne comprends pas, demande de reformuler.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript },
      ],
      tools,
      tool_choice: 'auto',
      max_tokens: 150,
      temperature: 0.2,
    });

    const msg = response.choices[0].message;

    if (msg.tool_calls?.length) {
      const call = msg.tool_calls[0] as any;
      const args = JSON.parse(call.function.arguments);

      // Confirmation générée localement — évite un 2ème appel GPT
      const confirmation = buildConfirmation(call.function.name as string, args);

      return res.json({
        message: confirmation,
        action: { type: call.function.name as string, args },
      });
    }

    return res.json({ message: msg.content, action: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return res.status(500).json({ error: message });
  }
}

function buildConfirmation(tool: string, args: Record<string, unknown>): string {
  const STATUS_FR: Record<string, string> = {
    nouveau: 'Nouveau', contacté: 'Contacté', devis: 'Devis', signé: 'Signé', perdu: 'Perdu',
  };
  if (tool === 'update_prospect_status') {
    const status = STATUS_FR[args.status as string] ?? args.status;
    return `C'est fait ! ${args.name} est maintenant en statut ${status}.`;
  }
  if (tool === 'update_prospect_amount') {
    return `Montant de ${args.name} mis à jour : ${(args.amount as number).toLocaleString('fr-FR')} €.`;
  }
  if (tool === 'add_note') {
    return `Note ajoutée pour ${args.name}.`;
  }
  if (tool === 'create_prospect') {
    return `Prospect ${args.name} créé avec succès.`;
  }
  if (tool === 'delete_prospect') {
    return `Le prospect a été supprimé.`;
  }
  return 'Action effectuée.';
}
