/**
 * Firebase implementation of BannerStore (client SDK).
 *
 * Collections (all names overridable):
 *   featured           — one doc per banner
 *   featuredCarousels  — one doc per named carousel
 *   buttonStyles       — one doc per saved CTA style
 * Storage:
 *   featured-backdrops/{bannerId}/backdrop.{ext}
 *
 * Writes go straight from the browser and are gated by the security rules in
 * ../../rules/. If your app is not on Firebase, delete this file and implement
 * BannerStore against your own backend — nothing else imports it.
 */

import type { FirebaseApp } from "firebase/app";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes } from "firebase/storage";

import type {
  BannerInput,
  BannerPatch,
  BannerRecord,
  BannerStore,
  ButtonStyleInput,
  ButtonStyleRecord,
  CarouselInput,
  CarouselPatch,
  CarouselRecord,
} from "../types";

export interface FirebaseStoreOptions {
  /** The initialised Firebase app. */
  app: FirebaseApp;
  /** Collection name overrides. */
  collections?: {
    banners?: string;
    carousels?: string;
    buttonStyles?: string;
  };
  /** Storage prefix for uploaded backdrops. */
  backdropPath?: string;
}

function publicStorageUrl(bucket: string, path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

/** Drop undefined keys — Firestore rejects them. */
function clean<T extends object>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export function createFirebaseBannerStore(
  options: FirebaseStoreOptions,
): BannerStore {
  const db = getFirestore(options.app);
  const storage = getStorage(options.app);
  const BANNERS = options.collections?.banners ?? "featured";
  const CAROUSELS = options.collections?.carousels ?? "featuredCarousels";
  const STYLES = options.collections?.buttonStyles ?? "buttonStyles";
  const BACKDROPS = options.backdropPath ?? "featured-backdrops";

  return {
    async listCarousels(): Promise<CarouselRecord[]> {
      const snap = await getDocs(collection(db, CAROUSELS));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as CarouselRecord)
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async createCarousel(input: CarouselInput): Promise<CarouselRecord> {
      const docRef = await addDoc(collection(db, CAROUSELS), {
        ...clean(input),
        name: input.name.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { ...input, id: docRef.id };
    },

    async updateCarousel(id: string, patch: CarouselPatch): Promise<void> {
      await updateDoc(doc(db, CAROUSELS, id), {
        ...clean(patch),
        updatedAt: serverTimestamp(),
      });
    },

    async deleteCarousel(id: string): Promise<void> {
      // Banners survive; they simply stop matching any carousel.
      await deleteDoc(doc(db, CAROUSELS, id));
    },

    async listBanners(carouselId: string): Promise<BannerRecord[]> {
      const snap = await getDocs(
        query(collection(db, BANNERS), orderBy("order", "asc")),
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as BannerRecord)
        .filter((b) => (b.carouselId ?? "") === carouselId);
    },

    async createBanner(input: BannerInput): Promise<string> {
      const docRef = await addDoc(collection(db, BANNERS), {
        ...clean(input),
        isActive: input.isActive ?? true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    },

    async updateBanner(id: string, patch: BannerPatch): Promise<void> {
      await updateDoc(doc(db, BANNERS, id), {
        ...clean(patch),
        updatedAt: serverTimestamp(),
      });
    },

    async deleteBanner(id: string): Promise<void> {
      await deleteDoc(doc(db, BANNERS, id));
    },

    async reorderBanners(orderedIds: string[]): Promise<void> {
      const batch = writeBatch(db);
      orderedIds.forEach((id, index) => {
        batch.update(doc(db, BANNERS, id), {
          order: index,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    },

    async uploadBackdrop(file: File, bannerId: string): Promise<string> {
      const ext = file.type.split("/")[1] ?? "jpg";
      const path = `${BACKDROPS}/${bannerId}/backdrop.${ext}`;
      await uploadBytes(ref(storage, path), file, {
        contentType: file.type,
        cacheControl: "public, max-age=31536000",
      });
      const bucket = storage.app.options.storageBucket;
      if (!bucket) throw new Error("Storage bucket not configured");
      // Cache-buster: the path is stable, so a re-upload needs a new URL.
      return `${publicStorageUrl(bucket, path)}&t=${Date.now()}`;
    },

    async listButtonStyles(): Promise<ButtonStyleRecord[]> {
      const snap = await getDocs(collection(db, STYLES));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as ButtonStyleRecord)
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async createButtonStyle(
      input: ButtonStyleInput,
    ): Promise<ButtonStyleRecord> {
      const docRef = await addDoc(collection(db, STYLES), {
        ...clean(input),
        name: input.name.trim(),
        angle: input.angle ?? 135,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { ...input, id: docRef.id };
    },

    async deleteButtonStyle(id: string): Promise<void> {
      await deleteDoc(doc(db, STYLES, id));
    },
  };
}
