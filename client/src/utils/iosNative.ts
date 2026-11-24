import { WorkspaceFile } from '../types/ide';

const HAPTICS_KEY = 'codeide_haptics_enabled';
const IOS_FILES_AUTO_MIRROR_KEY = 'codeide_ios_files_auto_mirror';

interface CapacitorHapticsPlugin {
  impact?: (options: { style: 'HEAVY' | 'MEDIUM' | 'LIGHT' }) => Promise<void>;
  notification?: (options: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }) => Promise<void>;
  selectionChanged?: () => Promise<void>;
}

interface CapacitorFilesystemEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  mtime?: number;
  uri?: string;
}

interface CapacitorFilesystemPlugin {
  writeFile?: (options: {
    path: string;
    data: string;
    directory: string;
    encoding?: string;
    recursive?: boolean;
  }) => Promise<{ uri?: string }>;
  readFile?: (options: {
    path: string;
    directory: string;
    encoding?: string;
  }) => Promise<{ data: string | Blob }>;
  mkdir?: (options: {
    path: string;
    directory: string;
    recursive?: boolean;
  }) => Promise<void>;
  readdir?: (options: {
    path: string;
    directory: string;
  }) => Promise<{ files: Array<CapacitorFilesystemEntry | string> }>;
  deleteFile?: (options: {
    path: string;
    directory: string;
  }) => Promise<void>;
  rmdir?: (options: {
    path: string;
    directory: string;
    recursive?: boolean;
  }) => Promise<void>;
  rename?: (options: {
    from: string;
    to: string;
    directory: string;
    toDirectory?: string;
  }) => Promise<void>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    Haptics?: CapacitorHapticsPlugin;
    Filesystem?: CapacitorFilesystemPlugin;
    StatusBar?: {
      setStyle?: (opts: { style: 'DARK' | 'LIGHT' | 'DEFAULT' }) => Promise<void>;
    };
  };
}

function getCapacitor(): CapacitorGlobal | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNativeCapacitorApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'capacitor:' ||
    Boolean(getCapacitor()?.isNativePlatform?.())
  );
}

export function isNativeHapticsAvailable(): boolean {
  return Boolean(getCapacitor()?.Plugins?.Haptics?.impact);
}

export function isNativeIosFilesSyncAvailable(): boolean {
  return Boolean(getCapacitor()?.Plugins?.Filesystem?.writeFile);
}

export function isWebDirectorySyncAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
  );
}

/* ==================== 1A: NATIVE iOS/iPadOS TAPTIC ENGINE HAPTICS ==================== */

export function isHapticsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(HAPTICS_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(HAPTICS_KEY, String(enabled));
  } catch {
    // ignore storage quota errors
  }
}

function tryWebVibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Safari Web does not implement Vibration API — silently ignore
  }
}

export function hapticLight(): void {
  if (!isHapticsEnabled()) return;
  const haptics = getCapacitor()?.Plugins?.Haptics;
  if (haptics?.impact) {
    haptics.impact({ style: 'LIGHT' }).catch(() => {});
    return;
  }
  tryWebVibrate(8);
}

export function hapticSelection(): void {
  if (!isHapticsEnabled()) return;
  const haptics = getCapacitor()?.Plugins?.Haptics;
  if (haptics?.selectionChanged) {
    haptics.selectionChanged().catch(() => {});
    return;
  }
  if (haptics?.impact) {
    haptics.impact({ style: 'LIGHT' }).catch(() => {});
    return;
  }
  tryWebVibrate(6);
}

export function hapticMedium(): void {
  if (!isHapticsEnabled()) return;
  const haptics = getCapacitor()?.Plugins?.Haptics;
  if (haptics?.impact) {
    haptics.impact({ style: 'MEDIUM' }).catch(() => {});
    return;
  }
  tryWebVibrate(14);
}

export function hapticSuccess(): void {
  if (!isHapticsEnabled()) return;
  const haptics = getCapacitor()?.Plugins?.Haptics;
  if (haptics?.notification) {
    haptics.notification({ type: 'SUCCESS' }).catch(() => {});
    return;
  }
  tryWebVibrate([10, 40, 14]);
}

export function hapticWarning(): void {
  if (!isHapticsEnabled()) return;
  const haptics = getCapacitor()?.Plugins?.Haptics;
  if (haptics?.notification) {
    haptics.notification({ type: 'WARNING' }).catch(() => {});
    return;
  }
  tryWebVibrate([12, 35, 12]);
}

export function hapticError(): void {
  if (!isHapticsEnabled()) return;
  const haptics = getCapacitor()?.Plugins?.Haptics;
  if (haptics?.notification) {
    haptics.notification({ type: 'ERROR' }).catch(() => {});
    return;
  }
  tryWebVibrate([18, 45, 22]);
}

/* ==================== 1B: iOS / iPadOS FILES APP (Directory.Documents) 2-WAY SYNC ==================== */

export function isIosFilesAutoMirrorEnabled(): boolean {
  try {
    const raw = localStorage.getItem(IOS_FILES_AUTO_MIRROR_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export function setIosFilesAutoMirrorEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(IOS_FILES_AUTO_MIRROR_KEY, String(enabled));
  } catch {
    // ignore
  }
}

function normalizeRelPath(relPath: string): string {
  return relPath
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');
}

function isBinaryAssetName(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|ico|bmp|woff2?|ttf|otf)$/i.test(name);
}

function guessMimeType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.woff2')) return 'font/woff2';
  if (lower.endsWith('.woff')) return 'font/woff';
  if (lower.endsWith('.ttf')) return 'font/ttf';
  return 'application/octet-stream';
}

function isSyncableFileName(name: string): boolean {
  if (!name || name.startsWith('.') || name === '__MACOSX') return false;
  return /\.(c|cpp|cc|cxx|h|hpp|hh|py|html?|css|js|mjs|jsx|ts|tsx|json|md|txt|in|inp|out|csv|dat|log|xml|svg|png|jpe?g|gif|webp)$/i.test(
    name
  );
}

/**
 * Phản chiếu (mirror) một tệp từ IndexedDB sang thư mục Documents của app iOS/iPadOS
 * để tệp xuất hiện trực tiếp trong ứng dụng Tệp (Files) -> Trên iPad/iPhone của tôi -> Code With You.
 */
export async function mirrorFileToIosDocuments(relPath: string, content: string): Promise<void> {
  if (!isIosFilesAutoMirrorEnabled()) return;
  const fs = getCapacitor()?.Plugins?.Filesystem;
  if (!fs?.writeFile) return;

  const clean = normalizeRelPath(relPath);
  if (!clean) return;

  try {
    const dataUrlMatch = /^data:([^;]+);base64,([\s\S]+)$/i.exec(content);
    if (dataUrlMatch) {
      await fs.writeFile({
        path: clean,
        data: dataUrlMatch[2],
        directory: 'DOCUMENTS',
        recursive: true
      });
    } else {
      await fs.writeFile({
        path: clean,
        data: content,
        directory: 'DOCUMENTS',
        encoding: 'utf8',
        recursive: true
      });
    }
  } catch {
    // Không làm gián đoạn trải nghiệm lưu IndexedDB
  }
}

export async function mirrorFolderToIosDocuments(relPath: string): Promise<void> {
  if (!isIosFilesAutoMirrorEnabled()) return;
  const fs = getCapacitor()?.Plugins?.Filesystem;
  if (!fs?.mkdir) return;

  const clean = normalizeRelPath(relPath);
  if (!clean) return;

  try {
    await fs.mkdir({
      path: clean,
      directory: 'DOCUMENTS',
      recursive: true
    });
  } catch {
    // Thư mục đã tồn tại — bỏ qua
  }
}

export async function deleteFromIosDocuments(relPath: string): Promise<void> {
  if (!isIosFilesAutoMirrorEnabled()) return;
  const fs = getCapacitor()?.Plugins?.Filesystem;
  if (!fs) return;

  const clean = normalizeRelPath(relPath);
  if (!clean) return;

  try {
    await fs.deleteFile?.({ path: clean, directory: 'DOCUMENTS' });
  } catch {
    try {
      await fs.rmdir?.({ path: clean, directory: 'DOCUMENTS', recursive: true });
    } catch {
      // ignore
    }
  }
}

export async function renameInIosDocuments(oldPath: string, newPath: string): Promise<void> {
  if (!isIosFilesAutoMirrorEnabled()) return;
  const fs = getCapacitor()?.Plugins?.Filesystem;
  if (!fs?.rename) return;

  const cleanOld = normalizeRelPath(oldPath);
  const cleanNew = normalizeRelPath(newPath);
  if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;

  try {
    const parts = cleanNew.split('/');
    if (parts.length > 1) {
      await fs.mkdir?.({
        path: parts.slice(0, -1).join('/'),
        directory: 'DOCUMENTS',
        recursive: true
      }).catch(() => {});
    }
    await fs.rename({
      from: cleanOld,
      to: cleanNew,
      directory: 'DOCUMENTS',
      toDirectory: 'DOCUMENTS'
    });
  } catch {
    // ignore
  }
}

interface ScannedDocFile {
  path: string;
  mtime: number;
  size: number;
}

async function scanIosDocumentsTree(
  fs: CapacitorFilesystemPlugin,
  dirPath = '',
  depth = 0
): Promise<{ files: ScannedDocFile[]; folders: string[] }> {
  const files: ScannedDocFile[] = [];
  const folders: string[] = [];
  if (!fs.readdir || depth > 6) return { files, folders };

  try {
    const res = await fs.readdir({ path: dirPath, directory: 'DOCUMENTS' });
    const entries = Array.isArray(res?.files) ? res.files : [];

    for (const raw of entries) {
      const entry: CapacitorFilesystemEntry =
        typeof raw === 'string'
          ? { name: raw, type: 'file' }
          : raw;
      const name = entry.name;
      if (!name || name.startsWith('.') || name === '__MACOSX' || name === 'Inbox') continue;

      const fullPath = dirPath ? `${dirPath}/${name}` : name;
      if (entry.type === 'directory') {
        folders.push(fullPath);
        const child = await scanIosDocumentsTree(fs, fullPath, depth + 1);
        files.push(...child.files);
        folders.push(...child.folders);
      } else if (isSyncableFileName(name)) {
        const size = typeof entry.size === 'number' ? entry.size : 0;
        if (size <= 1024 * 1024) {
          files.push({
            path: fullPath,
            mtime: typeof entry.mtime === 'number' ? entry.mtime : 0,
            size
          });
        }
      }
    }
  } catch {
    // ignore unreadable folder
  }

  return { files, folders };
}

export interface NativeFilesSyncResult {
  pushed: number;
  pulled: number;
  mode: 'ios-files' | 'web-folder' | 'unsupported';
  folderName?: string;
}

/**
 * Đồng bộ 2 chiều giữa IndexedDB Workspace và thư mục Documents của iOS/iPadOS
 * (hiển thị trong app Tệp / Files -> Trên iPad/iPhone của tôi -> Code With You).
 * Trên máy tính (Chrome/Edge), hỗ trợ chọn thư mục cục bộ qua File System Access API.
 */
export async function syncWorkspaceWithDeviceFiles(
  currentFiles: WorkspaceFile[],
  saveToIdb: (relPath: string, content: string, skipMirror?: boolean) => Promise<unknown>,
  createFolderInIdb: (relPath: string, skipMirror?: boolean) => Promise<unknown>,
  options?: { allowWebPicker?: boolean }
): Promise<NativeFilesSyncResult> {
  const fs = getCapacitor()?.Plugins?.Filesystem;

  if (fs?.readdir && fs?.readFile && fs?.writeFile) {
    const scanned = await scanIosDocumentsTree(fs);
    const docMap = new Map(scanned.files.map((f) => [f.path, f]));
    const wsMap = new Map(currentFiles.map((f) => [normalizeRelPath(f.path), f]));

    let pulled = 0;
    let pushed = 0;

    for (const folder of scanned.folders) {
      await createFolderInIdb(folder, true);
    }

    // 1. Kéo các tệp mới hoặc mới chỉnh sửa từ ứng dụng Tệp (Files) vào Workspace
    for (const docFile of scanned.files) {
      const wsFile = wsMap.get(docFile.path);
      const wsUpdatedAt = wsFile?.updatedAt || 0;
      const shouldPull = !wsFile || (docFile.mtime > 0 && docFile.mtime > wsUpdatedAt + 1500);

      if (shouldPull) {
        try {
          const isBin = isBinaryAssetName(docFile.path);
          const readRes = await fs.readFile({
            path: docFile.path,
            directory: 'DOCUMENTS',
            encoding: isBin ? undefined : 'utf8'
          });
          let content = typeof readRes.data === 'string' ? readRes.data : '';
          if (isBin && content && !content.startsWith('data:')) {
            content = `data:${guessMimeType(docFile.path)};base64,${content}`;
          }
          if (!wsFile || wsFile.content !== content) {
            await saveToIdb(docFile.path, content, true);
            pulled++;
          }
        } catch {
          // Bỏ qua tệp không đọc được
        }
      }
    }

    // 2. Đẩy các tệp từ Workspace chưa có hoặc mới hơn sang ứng dụng Tệp (Files)
    for (const wsFile of currentFiles) {
      const cleanPath = normalizeRelPath(wsFile.path);
      if (!cleanPath) continue;
      const docFile = docMap.get(cleanPath);
      const wsUpdatedAt = wsFile.updatedAt || Date.now();
      const shouldPush = !docFile || wsUpdatedAt > docFile.mtime + 1500;

      if (shouldPush) {
        try {
          const dataUrlMatch = /^data:([^;]+);base64,([\s\S]+)$/i.exec(wsFile.content);
          if (dataUrlMatch) {
            await fs.writeFile({
              path: cleanPath,
              data: dataUrlMatch[2],
              directory: 'DOCUMENTS',
              recursive: true
            });
          } else {
            await fs.writeFile({
              path: cleanPath,
              data: wsFile.content,
              directory: 'DOCUMENTS',
              encoding: 'utf8',
              recursive: true
            });
          }
          pushed++;
        } catch {
          // ignore
        }
      }
    }

    return { pushed, pulled, mode: 'ios-files', folderName: 'Code With You (Files)' };
  }

  // Fallback trên trình duyệt Desktop (Chrome / Edge): Đồng bộ với thư mục thật trên PC
  if (options?.allowWebPicker && isWebDirectorySyncAvailable()) {
    const picker = (
      window as unknown as {
        showDirectoryPicker: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<any>;
      }
    ).showDirectoryPicker;
    const rootHandle = await picker({ mode: 'readwrite' });

    let pushed = 0;
    let pulled = 0;
    const wsMap = new Map(currentFiles.map((f) => [normalizeRelPath(f.path), f]));
    const existingLocalPaths = new Set<string>();

    const readDirRecursive = async (dirHandle: any, prefix = '', depth = 0) => {
      if (depth > 5) return;
      for await (const [name, handle] of dirHandle.entries()) {
        if (!name || name.startsWith('.') || name === 'node_modules') continue;
        const rel = prefix ? `${prefix}/${name}` : name;
        if (handle.kind === 'directory') {
          await createFolderInIdb(rel, true);
          await readDirRecursive(handle, rel, depth + 1);
        } else if (handle.kind === 'file' && isSyncableFileName(name)) {
          existingLocalPaths.add(rel);
          const file: File = await handle.getFile();
          if (file.size > 1024 * 1024) continue;
          const wsFile = wsMap.get(rel);
          if (!wsFile || file.lastModified > (wsFile.updatedAt || 0) + 1500) {
            const content = isBinaryAssetName(name)
              ? await new Promise<string>((resolve, reject) => {
                  const r = new FileReader();
                  r.onload = () => resolve(String(r.result || ''));
                  r.onerror = () => reject(r.error);
                  r.readAsDataURL(file);
                })
              : await file.text();
            if (!wsFile || wsFile.content !== content) {
              await saveToIdb(rel, content, true);
              pulled++;
            }
          }
        }
      }
    };

    await readDirRecursive(rootHandle);

    // Đẩy các tệp chưa có từ Workspace ra thư mục đã chọn
    for (const wsFile of currentFiles) {
      const clean = normalizeRelPath(wsFile.path);
      if (!clean || existingLocalPaths.has(clean)) continue;
      const parts = clean.split('/');
      let dir = rootHandle;
      for (let i = 0; i < parts.length - 1; i++) {
        dir = await dir.getDirectoryHandle(parts[i], { create: true });
      }
      const fileHandle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(wsFile.content);
      await writable.close();
      pushed++;
    }

    return { pushed, pulled, mode: 'web-folder', folderName: rootHandle.name };
  }

  return { pushed: 0, pulled: 0, mode: 'unsupported' };
}
