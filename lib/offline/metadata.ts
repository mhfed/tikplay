export interface OfflineTrackMeta {
  trackId: number; // Primary key
  audioKey: string;
  title: string;
  author: string;
  cover: string;
  duration: number;
  fileSize: number;
  downloadedAt: number;
  lastPlayedAt: number | null;
}

const DB_NAME = 'tikplay-offline-v1';
const STORE_NAME = 'tracks';

export class OfflineMetadataStore {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB not supported'));
      }

      const request = window.indexedDB.open(DB_NAME, 1);

      request.onerror = (event) => {
        reject(new Error('IndexedDB error: ' + (event.target as any).error));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as any).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as any).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'trackId',
          });
          store.createIndex('audioKey', 'audioKey', { unique: true });
          store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private async getDb(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  async addTrack(meta: OfflineTrackMeta): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(meta);

      request.onsuccess = () => resolve();
      request.onerror = (e) => reject((e.target as any).error);
    });
  }

  async removeTrack(trackId: number): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(trackId);

      request.onsuccess = () => resolve();
      request.onerror = (e) => reject((e.target as any).error);
    });
  }

  async getTrack(trackId: number): Promise<OfflineTrackMeta | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(trackId);

      request.onsuccess = (event) =>
        resolve((event.target as any).result || null);
      request.onerror = (e) => reject((e.target as any).error);
    });
  }

  async getAllTracks(): Promise<OfflineTrackMeta[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = (event) =>
        resolve((event.target as any).result || []);
      request.onerror = (e) => reject((e.target as any).error);
    });
  }

  async isDownloaded(trackId: number): Promise<boolean> {
    const track = await this.getTrack(trackId);
    return track !== null;
  }

  async clearAll(): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = (e) => reject((e.target as any).error);
    });
  }
}

export const offlineMetadataStore = new OfflineMetadataStore();
