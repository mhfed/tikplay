export class OfflineFileStore {
  private dirName = 'tikplay-offline';

  async init(): Promise<void> {
    if (
      typeof navigator === 'undefined' ||
      !('storage' in navigator) ||
      !navigator.storage.getDirectory
    ) {
      throw new Error('OPFS is not supported in this browser');
    }
    const rootDir = await navigator.storage.getDirectory();
    await rootDir.getDirectoryHandle(this.dirName, { create: true });
  }

  private async getDir(): Promise<FileSystemDirectoryHandle> {
    if (
      typeof navigator === 'undefined' ||
      !('storage' in navigator) ||
      !navigator.storage.getDirectory
    ) {
      throw new Error('OPFS is not supported in this browser');
    }
    const rootDir = await navigator.storage.getDirectory();
    return await rootDir.getDirectoryHandle(this.dirName, { create: true });
  }

  async saveAudio(
    audioKey: string,
    blob: Blob,
  ): Promise<{ fileName: string; fileSize: number }> {
    const dir = await this.getDir();
    const fileName = `audio-${audioKey}.m4a`;
    const fileHandle = await dir.getFileHandle(fileName, { create: true });

    // FileSystemWritableFileStream is standard in modern browsers (Chrome/Safari)
    // @ts-ignore - TS might miss createWritable on FileSystemFileHandle
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    return { fileName, fileSize: blob.size };
  }

  async saveAudioFromStream(
    audioKey: string,
    reader: ReadableStreamDefaultReader<Uint8Array>,
    contentLength: number,
    onProgress?: (percent: number) => void,
  ): Promise<{ fileName: string; fileSize: number }> {
    const dir = await this.getDir();
    const fileName = `audio-${audioKey}.m4a`;
    const fileHandle = await dir.getFileHandle(fileName, { create: true });

    // @ts-ignore
    const writable = await fileHandle.createWritable();

    let receivedLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        await writable.write(value as unknown as FileSystemWriteChunkType);
        receivedLength += value.length;
        if (contentLength && onProgress) {
          onProgress(receivedLength / contentLength);
        }
      }
    }

    await writable.close();
    return { fileName, fileSize: receivedLength };
  }

  async getAudioFile(audioKey: string): Promise<File | null> {
    try {
      const dir = await this.getDir();
      const fileName = `audio-${audioKey}.m4a`;
      const fileHandle = await dir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return file;
    } catch (e) {
      // File doesn't exist or other error
      return null;
    }
  }

  async deleteAudio(audioKey: string): Promise<void> {
    try {
      const dir = await this.getDir();
      const fileName = `audio-${audioKey}.m4a`;
      await dir.removeEntry(fileName);
    } catch (e) {
      console.error('Error deleting audio file:', e);
    }
  }

  async getTotalUsedBytes(): Promise<number> {
    try {
      const dir = await this.getDir();
      let totalBytes = 0;
      // @ts-ignore - Async iteration for OPFS
      for await (const [name, handle] of dir.entries()) {
        if (handle.kind === 'file' && name.startsWith('audio-')) {
          const file = await handle.getFile();
          totalBytes += file.size;
        }
      }
      return totalBytes;
    } catch (e) {
      console.error('Error calculating OPFS bytes:', e);
      return 0;
    }
  }

  async clearAll(): Promise<void> {
    try {
      const dir = await this.getDir();
      // @ts-ignore
      for await (const [name, handle] of dir.entries()) {
        if (name.startsWith('audio-')) {
          await dir.removeEntry(name);
        }
      }
    } catch (e) {
      console.error('Error clearing OPFS:', e);
    }
  }

  isSupported(): boolean {
    if (typeof navigator === 'undefined') return false;
    return 'storage' in navigator && !!navigator.storage.getDirectory;
  }
}

export const offlineFileStore = new OfflineFileStore();
