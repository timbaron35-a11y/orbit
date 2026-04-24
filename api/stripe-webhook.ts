import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function getDb() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) });
  }
  return getFirestore();
}

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const PLAN_MAP: Record<string, 'solo' | 'agence'> = {
  [process.env.STRIPE_PRICE_SOLO!]: 'solo',
  [process.env.STRIPE_PRICE_AGENCE!]: 'agence',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'] as string;
  const rawBody = await getRawBody(req);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return res.status(400).json({ error: 'Webhook signature invalide' });
  }

  const db = getDb();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const uid = session.metadata?.uid;
    const plan = session.metadata?.plan as 'solo' | 'agence';
    if (!uid || !plan) return res.status(200).end();

    await db.doc(`users/${uid}/meta/billing`).set({
      stripeCustomerId: session.customer,
      subscriptionId: session.subscription,
      plan,
      status: 'trialing',
    }, { merge: true });

    await db.doc(`users/${uid}/meta/settings`).set({ plan }, { merge: true });
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription;
    const uid = sub.metadata?.uid;
    if (!uid) return res.status(200).end();

    const status = sub.status;
    const activeStatuses = ['active', 'trialing'];
    const priceId = sub.items.data[0]?.price.id;
    const plan = activeStatuses.includes(status) ? (PLAN_MAP[priceId] ?? 'solo') : 'solo';

    await db.doc(`users/${uid}/meta/billing`).set({ plan, status }, { merge: true });
    await db.doc(`users/${uid}/meta/settings`).set({ plan }, { merge: true });
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const uid = sub.metadata?.uid;
    if (!uid) return res.status(200).end();

    await db.doc(`users/${uid}/meta/billing`).set({ plan: 'solo', status: 'cancelled' }, { merge: true });
    await db.doc(`users/${uid}/meta/settings`).set({ plan: 'solo' }, { merge: true });
  }

  return res.status(200).json({ received: true });
}
