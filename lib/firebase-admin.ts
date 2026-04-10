import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!rawKey) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY environment variable.");
}

const serviceAccount = JSON.parse(rawKey) as {
  project_id: string;
  client_email: string;
  private_key: string;
};

const adminApp =
  getApps()[0] ||
  initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
  });

export const adminDb = getFirestore(adminApp);