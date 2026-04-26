import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function getDb() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) });
  }
  return getFirestore();
}

const APP_URL = 'https://app-orbit.fr';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { uid } = req.body as { uid: string };
  if (!uid) return res.status(400).json({ error: 'uid manquant' });

  const db = getDb();
  const billingSnap = await db.doc(`users/${uid}/meta/billing`).get();
  const customerId = billingSnap.data()?.stripeCustomerId;
  if (!customerId) return res.status(404).json({ error: 'Aucun abonnement trouvé' });

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/settings`,
  });

  return res.status(200).json({ url: session.url });
}
