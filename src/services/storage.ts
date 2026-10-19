import { DailyStudyRecord, StudySession, UserPreferences } from '../types';

const DB_NAME = 'study_os_db';
const DB_VERSION = 1;

class StorageService {
  private dbPromise: Promise<IDBDatabase | null>;

  constructor() {
    this.dbPromise = this.initDB();
  }

  private initDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('sessions')) {
            const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
            sessionStore.createIndex('date', 'date', { unique: false });
          }
          if (!db.objectStoreNames.contains('daily_records')) {
            db.createObjectStore('daily_records', { keyPath: 'date' });
          }
          if (!db.objectStoreNames.contains('preferences')) {
            db.createObjectStore('preferences', { keyPath: 'key' });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn('IndexedDB failed to open, falling back to localStorage');
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB init error, falling back to localStorage', err);
        resolve(null);
      }
    });
  }

  // Get Today's Date String YYYY-MM-DD
  public getTodayString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Study Sessions
  public async saveSession(session: StudySession): Promise<void> {
    const db = await this.dbPromise;
    if (db) {
      try {
        const tx = db.transaction('sessions', 'readwrite');
        const store = tx.objectStore('sessions');
        store.put(session);
        await new Promise((res, rej) => {
          tx.oncomplete = () => res(undefined);
          tx.onerror = () => rej(tx.error);
        });
        return;
      } catch (e) {
        console.warn('IndexedDB saveSession error', e);
      }
    }

    // LocalStorage fallback
    try {
      const existing = this.getLocalStorageItem<StudySession[]>('study_sessions', []);
      const index = existing.findIndex((s) => s.id === session.id);
      if (index >= 0) {
        existing[index] = session;
      } else {
        existing.push(session);
      }
      localStorage.setItem('study_sessions', JSON.stringify(existing));
    } catch (e) {
      console.warn('LocalStorage saveSession error', e);
    }
  }

  public async getSessionsForDate(dateStr: string): Promise<StudySession[]> {
    const db = await this.dbPromise;
    if (db) {
      try {
        const tx = db.transaction('sessions', 'readonly');
        const store = tx.objectStore('sessions');
        const index = store.index('date');
        const request = index.getAll(IDBKeyRange.only(dateStr));
        return new Promise((resolve) => {
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => resolve([]);
        });
      } catch (e) {
        console.warn('IndexedDB getSessions error', e);
      }
    }

    const all = this.getLocalStorageItem<StudySession[]>('study_sessions', []);
    return all.filter((s) => s.date === dateStr);
  }

  // Daily Study Records
  public async getDailyRecord(dateStr: string): Promise<DailyStudyRecord> {
    const db = await this.dbPromise;
    if (db) {
      try {
        const tx = db.transaction('daily_records', 'readonly');
        const store = tx.objectStore('daily_records');
        const request = store.get(dateStr);
        const record = await new Promise<DailyStudyRecord | undefined>((resolve) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(undefined);
        });
        if (record) return record;
      } catch (e) {
        console.warn('IndexedDB getDailyRecord error', e);
      }
    }

    const records = this.getLocalStorageItem<Record<string, DailyStudyRecord>>('daily_records', {});
    return (
      records[dateStr] || {
        date: dateStr,
        totalSeconds: 0,
        targetSeconds: 4 * 3600, // 4 hours default
        sessionsCount: 0,
        lastUpdated: Date.now(),
      }
    );
  }

  public async saveDailyRecord(record: DailyStudyRecord): Promise<void> {
    const db = await this.dbPromise;
    if (db) {
      try {
        const tx = db.transaction('daily_records', 'readwrite');
        const store = tx.objectStore('daily_records');
        store.put(record);
        await new Promise((res, rej) => {
          tx.oncomplete = () => res(undefined);
          tx.onerror = () => rej(tx.error);
        });
        return;
      } catch (e) {
        console.warn('IndexedDB saveDailyRecord error', e);
      }
    }

    const records = this.getLocalStorageItem<Record<string, DailyStudyRecord>>('daily_records', {});
    records[record.date] = record;
    localStorage.setItem('daily_records', JSON.stringify(records));
  }

  // Preferences
  public getPreferences(): UserPreferences {
    return this.getLocalStorageItem<UserPreferences>('user_preferences', {
      dailyGoalMinutes: 240, // 4 hours
      soundEnabled: true,
      theme: 'dark',
    });
  }

  public savePreferences(prefs: UserPreferences): void {
    try {
      localStorage.setItem('user_preferences', JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save preferences', e);
    }
  }

  private getLocalStorageItem<T>(key: string, fallback: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  }
}

export const storageService = new StorageService();
