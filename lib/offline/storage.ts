export interface StorageInfo {
  usageBytes: number;
  quotaBytes: number;
  usageFormatted: string; // e.g. "245 MB"
  quotaFormatted: string; // e.g. "2.1 GB"
  percentUsed: number; // 0-100
  isPersistent: boolean;
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    !navigator.storage.persist
  ) {
    return false;
  }

  try {
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) {
      return true;
    }

    return await navigator.storage.persist();
  } catch (e) {
    console.error('Error requesting persistent storage:', e);
    return false;
  }
}

export async function checkIsPersistent(): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    !navigator.storage.persisted
  ) {
    return false;
  }
  try {
    return await navigator.storage.persisted();
  } catch (e) {
    return false;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export async function getStorageInfo(): Promise<StorageInfo> {
  let usageBytes = 0;
  let quotaBytes = 0;

  if (
    typeof navigator !== 'undefined' &&
    navigator.storage &&
    navigator.storage.estimate
  ) {
    try {
      const estimate = await navigator.storage.estimate();
      usageBytes = estimate.usage || 0;
      quotaBytes = estimate.quota || 0;
    } catch (e) {
      console.error('Error getting storage estimate:', e);
    }
  }

  const isPersistent = await checkIsPersistent();

  return {
    usageBytes,
    quotaBytes,
    usageFormatted: formatBytes(usageBytes),
    quotaFormatted: formatBytes(quotaBytes),
    percentUsed:
      quotaBytes > 0 ? Math.round((usageBytes / quotaBytes) * 100) : 0,
    isPersistent,
  };
}
