'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  ReactNode,
} from 'react';
import { Track } from '@/lib/types';
import {
  offlineFileStore,
  offlineMetadataStore,
  OfflineTrackMeta,
  getStorageInfo,
  StorageInfo,
  requestPersistentStorage,
} from '@/lib/offline';

export interface DownloadState {
  meta: OfflineTrackMeta;
  isDownloading: boolean;
  progress: number;
  error: string | null;
}

interface OfflineContextType {
  downloadedTracks: Map<number, DownloadState>;
  storageInfo: StorageInfo | null;
  isOnline: boolean;
  isInitialized: boolean;
  isSupported: boolean;
  downloadTrack: (track: Track) => Promise<void>;
  removeTrack: (trackId: number) => Promise<void>;
  removeAll: () => Promise<void>;
  isDownloaded: (trackId: number) => boolean;
  getAudioUrl: (trackId: number) => Promise<string | null>;
  refreshStorageInfo: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [downloadedTracks, setDownloadedTracks] = useState<
    Map<number, DownloadState>
  >(new Map());
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const loadMetadata = useCallback(async () => {
    try {
      const tracks = await offlineMetadataStore.getAllTracks();
      const map = new Map<number, DownloadState>();
      for (const track of tracks) {
        map.set(track.trackId, {
          meta: track,
          isDownloading: false,
          progress: 1,
          error: null,
        });
      }
      setDownloadedTracks(map);
    } catch (e) {
      console.error('Error loading offline metadata:', e);
    }
  }, []);

  const refreshStorageInfo = useCallback(async () => {
    const info = await getStorageInfo();
    setStorageInfo(info);
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initialize
    async function init() {
      if (!offlineFileStore.isSupported()) {
        setIsSupported(false);
        setIsInitialized(true);
        return;
      }

      try {
        await offlineFileStore.init();
        await requestPersistentStorage();
        await loadMetadata();
        await refreshStorageInfo();
      } catch (e) {
        console.error('Error initializing offline storage:', e);
        setIsSupported(false);
      } finally {
        setIsInitialized(true);
      }
    }

    init();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadMetadata, refreshStorageInfo]);

  const downloadTrack = useCallback(
    async (track: Track) => {
      if (!isSupported) {
        throw new Error('Offline storage is not supported');
      }

      const audioKey = track.audioUrl.split('/').pop() || String(track.id);

      setDownloadedTracks((prev) => {
        const next = new Map(prev);
        next.set(track.id, {
          meta: {
            trackId: track.id,
            audioKey,
            title: track.title,
            author: track.author,
            cover: track.cover,
            duration: track.duration,
            fileSize: 0,
            downloadedAt: Date.now(),
            lastPlayedAt: null,
          },
          isDownloading: true,
          progress: 0,
          error: null,
        });
        return next;
      });

      try {
        const response = await fetch(track.audioUrl);
        if (!response.ok) {
          throw new Error(
            `Không tìm thấy tệp âm thanh (Lỗi HTTP ${response.status})`,
          );
        }
        if (!response.body) {
          throw new Error('Đường truyền âm thanh không hợp lệ (Trống dữ liệu)');
        }

        const contentLength = Number(
          response.headers.get('Content-Length') || 0,
        );
        const reader = response.body.getReader();

        const { fileSize } = await offlineFileStore.saveAudioFromStream(
          audioKey,
          reader,
          contentLength,
          (percent) => {
            setDownloadedTracks((prev) => {
              const current = prev.get(track.id);
              if (!current) return prev;
              const next = new Map(prev);
              next.set(track.id, { ...current, progress: percent });
              return next;
            });
          },
        );

        const meta: OfflineTrackMeta = {
          trackId: track.id,
          audioKey,
          title: track.title,
          author: track.author,
          cover: track.cover,
          duration: track.duration,
          fileSize,
          downloadedAt: Date.now(),
          lastPlayedAt: null,
        };

        await offlineMetadataStore.addTrack(meta);
        await refreshStorageInfo();

        setDownloadedTracks((prev) => {
          const next = new Map(prev);
          next.set(track.id, {
            meta,
            isDownloading: false,
            progress: 1,
            error: null,
          });
          return next;
        });
      } catch (e: any) {
        console.error('Download error:', e);
        setDownloadedTracks((prev) => {
          const current = prev.get(track.id);
          if (!current) return prev;
          const next = new Map(prev);
          next.set(track.id, {
            ...current,
            isDownloading: false,
            error: e.message || 'Lỗi tải xuống',
          });
          return next;
        });
      }
    },
    [isSupported, refreshStorageInfo],
  );

  const removeTrack = useCallback(
    async (trackId: number) => {
      if (!isSupported) return;

      const trackEntry = downloadedTracks.get(trackId);
      if (!trackEntry) return;

      try {
        await offlineFileStore.deleteAudio(trackEntry.meta.audioKey);
        await offlineMetadataStore.removeTrack(trackId);
        await refreshStorageInfo();

        setDownloadedTracks((prev) => {
          const next = new Map(prev);
          next.delete(trackId);
          return next;
        });
      } catch (e) {
        console.error('Error removing track offline data:', e);
      }
    },
    [isSupported, downloadedTracks, refreshStorageInfo],
  );

  const removeAll = useCallback(async () => {
    if (!isSupported) return;
    try {
      await offlineFileStore.clearAll();
      await offlineMetadataStore.clearAll();
      await refreshStorageInfo();
      setDownloadedTracks(new Map());
    } catch (e) {
      console.error('Error clearing offline data:', e);
    }
  }, [isSupported, refreshStorageInfo]);

  const isDownloaded = useCallback(
    (trackId: number) => {
      const entry = downloadedTracks.get(trackId);
      return !!entry && !entry.isDownloading && !entry.error;
    },
    [downloadedTracks],
  );

  const getAudioUrl = useCallback(
    async (trackId: number): Promise<string | null> => {
      if (!isSupported) return null;

      try {
        const meta = await offlineMetadataStore.getTrack(trackId);
        if (!meta) return null;

        const file = await offlineFileStore.getAudioFile(meta.audioKey);
        if (!file) return null;

        // Update last played
        meta.lastPlayedAt = Date.now();
        await offlineMetadataStore.addTrack(meta);

        return URL.createObjectURL(file);
      } catch (e) {
        console.error('Error getting offline audio URL:', e);
        return null;
      }
    },
    [isSupported],
  );

  const value = {
    downloadedTracks,
    storageInfo,
    isOnline,
    isInitialized,
    isSupported,
    downloadTrack,
    removeTrack,
    removeAll,
    isDownloaded,
    getAudioUrl,
    refreshStorageInfo,
  };

  return (
    <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
  );
}
