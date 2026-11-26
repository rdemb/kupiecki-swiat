import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { CommodityId } from './economy/economyEngine';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export interface CloudPlayerProfileData {
  uid: string;
  displayName: string;
  title: string;
  raceId: string;
  guildId: string;
  gold: number;
  bondsGold: number;
  netWorth: number;
  tradesExecutedCount: number;
  profitableTradesCount: number;
  inventory: Record<CommodityId, number>;
  unlockedTechIds: string[];
}

function sanitizeId(raw: string, maxLen = 128): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : 'player_1';
}

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(1_000_000_000, Number(n.toFixed(2)));
}

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebaseUser(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged };
export type { User };

export async function loadPlayerProfileFromFirestore(
  uid: string,
): Promise<CloudPlayerProfileData | null> {
  const safeUid = sanitizeId(uid, 128);
  const path = `players/${safeUid}`;
  try {
    const snap = await getDoc(doc(db, 'players', safeUid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid: d.uid,
      displayName: d.displayName || 'Kupiec',
      title: d.title || 'Day Trader',
      raceId: d.raceId || 'ludzie',
      guildId: d.guildId || 'g_zloto',
      gold: Number(d.gold ?? 15000),
      bondsGold: Number(d.bondsGold ?? 0),
      netWorth: Number(d.netWorth ?? 15000),
      tradesExecutedCount: Number(d.tradesExecutedCount ?? 0),
      profitableTradesCount: Number(d.profitableTradesCount ?? 0),
      inventory: {
        zboze: Number(d.inv_zboze ?? 35),
        zelazo: Number(d.inv_zelazo ?? 20),
        drewno_elfickie: Number(d.inv_drewno_elfickie ?? 12),
        przyprawy: Number(d.inv_przyprawy ?? 10),
        runiczny_pergamin: Number(d.inv_runiczny_pergamin ?? 6),
        krysztaly_many: Number(d.inv_krysztaly_many ?? 5),
        mithril: Number(d.inv_mithril ?? 4),
        smocza_luska: Number(d.inv_smocza_luska ?? 1),
      },
      unlockedTechIds: d.unlockedTechCsv
        ? String(d.unlockedTechCsv)
            .split(',')
            .filter(Boolean)
        : ['handel_1'],
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function savePlayerProfileToFirestore(
  profile: CloudPlayerProfileData,
  isExistingDoc: boolean,
): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const safeUid = sanitizeId(auth.currentUser.uid, 128);
  const path = `players/${safeUid}`;
  const validRaces = ['ludzie', 'krasnoludy', 'elfy', 'gobliny', 'orkowie'];
  const safeRace = validRaces.includes(profile.raceId) ? profile.raceId : 'ludzie';

  const baseFields = {
    displayName: (profile.displayName || 'Kupiec').trim().slice(0, 60).padEnd(2, '_'),
    title: (profile.title || 'Day Trader').trim().slice(0, 60).padEnd(2, '_'),
    raceId: safeRace,
    guildId: sanitizeId(profile.guildId || 'g_zloto', 64),
    gold: clampNonNegative(profile.gold),
    bondsGold: clampNonNegative(profile.bondsGold),
    netWorth: clampNonNegative(profile.netWorth),
    tradesExecutedCount: Math.round(clampNonNegative(profile.tradesExecutedCount)),
    profitableTradesCount: Math.round(clampNonNegative(profile.profitableTradesCount)),
    inv_zboze: Math.round(clampNonNegative(profile.inventory.zboze ?? 0)),
    inv_zelazo: Math.round(clampNonNegative(profile.inventory.zelazo ?? 0)),
    inv_drewno_elfickie: Math.round(clampNonNegative(profile.inventory.drewno_elfickie ?? 0)),
    inv_przyprawy: Math.round(clampNonNegative(profile.inventory.przyprawy ?? 0)),
    inv_runiczny_pergamin: Math.round(clampNonNegative(profile.inventory.runiczny_pergamin ?? 0)),
    inv_krysztaly_many: Math.round(clampNonNegative(profile.inventory.krysztaly_many ?? 0)),
    inv_mithril: Math.round(clampNonNegative(profile.inventory.mithril ?? 0)),
    inv_smocza_luska: Math.round(clampNonNegative(profile.inventory.smocza_luska ?? 0)),
    unlockedTechCsv: profile.unlockedTechIds.join(',').slice(0, 300),
    updatedAt: serverTimestamp(),
  };

  try {
    if (isExistingDoc) {
      await updateDoc(doc(db, 'players', safeUid), baseFields);
    } else {
      await setDoc(doc(db, 'players', safeUid), {
        uid: safeUid,
        ...baseFields,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isExistingDoc ? OperationType.UPDATE : OperationType.CREATE,
      path,
    );
  }
}

export async function logTradeToFirestore(params: {
  commodityId: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  cityId: string;
}): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const safeUid = sanitizeId(auth.currentUser.uid, 128);
  const tradeId = sanitizeId(`tr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, 128);
  const path = `players/${safeUid}/trades/${tradeId}`;

  try {
    await setDoc(doc(db, 'players', safeUid, 'trades', tradeId), {
      tradeId,
      playerId: safeUid,
      commodityId: params.commodityId.slice(0, 40),
      side: params.side === 'buy' ? 'buy' : 'sell',
      quantity: Math.max(1, Math.round(clampNonNegative(params.quantity))),
      price: clampNonNegative(params.price),
      cityId: params.cityId.slice(0, 64),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function loadPlayerTradesFromFirestore(): Promise<
  Array<{
    tradeId: string;
    commodityId: string;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    cityId: string;
  }>
> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return [];
  const safeUid = sanitizeId(auth.currentUser.uid, 128);
  const path = `players/${safeUid}/trades`;
  try {
    const q = query(
      collection(db, 'players', safeUid, 'trades'),
      where('playerId', '==', safeUid),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        tradeId: data.tradeId,
        commodityId: data.commodityId,
        side: data.side,
        quantity: data.quantity,
        price: data.price,
        cityId: data.cityId,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
