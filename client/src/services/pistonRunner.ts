// client/src/services/pistonRunner.ts
import { CompilerSettings, WorkspaceFile } from '../types/ide';

export interface SyncedWorkspaceFile {
  name: string;
  content: string;
}

export interface PistonLogCallback {
  onChunk: (type: 'stdout' | 'stderr' | 'status', text: string) => void;
  onFinish?: (code: number, elapsedMs: number, waitingForInput?: boolean) => void;
  onSyncedFiles?: (files: SyncedWorkspaceFile[]) => void;
}

export interface PistonRunOptions {
  interactive?: boolean;
  suppressHeader?: boolean;
  syncFiles?: boolean;
}

const WAIT_INPUT_MARKER = '__LC_WAIT_INPUT_9F3A__';
const FS_START_MARKER = '__LC_FS_START_9F3A__';
const FS_END_MARKER = '__LC_FS_END_9F3A__';

function collectWorkspaceDataFiles(
  activeFile: WorkspaceFile,
  latestFiles: WorkspaceFile[]
): SyncedWorkspaceFile[] {
  const getDir = (filePath: string) =>
    filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';
  const activeDir = getDir(activeFile.path);
  const dataExt = /\.(txt|in|inp|out|csv|dat|json|log|md|xml)$/i;

  const result: SyncedWorkspaceFile[] = [];
  let totalBytes = 0;

  for (const f of latestFiles || []) {
    if (f.path === activeFile.path || f.language === 'asset') continue;
    if (getDir(f.path) !== activeDir) continue;
    if (!dataExt.test(f.name)) continue;
    const len = f.content.length;
    if (len > 65536 || totalBytes + len > 163840) continue;
    totalBytes += len;
    result.push({ name: f.name, content: f.content });
    if (result.length >= 12) break;
  }

  return result;
}

function escapeCString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function wrapCppRuntimeShim(
  code: string,
  isC: boolean,
  opts: {
    interactive: boolean;
    syncFiles: boolean;
    dataFiles: SyncedWorkspaceFile[];
    fileName?: string;
  }
): string {
  const { interactive, syncFiles, dataFiles, fileName } = opts;
  if (!interactive && !syncFiles) return code;
  const safeFileLabel = escapeCString(fileName || (isC ? 'main.c' : 'main.cpp'));

  const safeUserCode =
    !isC && interactive
      ? code.replace(/\bsync_with_stdio\s*\(\s*(?:false|0)\s*\)/g, 'sync_with_stdio(true)')
      : code;

  const encoder = new TextEncoder();
  const mountedDecls = dataFiles
    .map((f, idx) => {
      const bytes = Array.from(encoder.encode(f.content));
      const byteList = bytes.length > 0 ? bytes.join(',') : '0';
      return `static const unsigned char __lc_mf_${idx}[] = {${byteList}};`;
    })
    .join('\n');

  const mountedInit = dataFiles
    .map((f, idx) => {
      const bytesLen = encoder.encode(f.content).length;
      const safeName = escapeCString(f.name);
      return `  __lc_mount_file("${safeName}", __lc_mf_${idx}, ${bytesLen});`;
    })
    .join('\n');

  const interactivePart = interactive
    ? `
static char *__lc_in_buf = NULL;
static size_t __lc_in_len = 0;
static size_t __lc_in_pos = 0;

static void __lc_pause_for_input(void) {
#ifdef __cplusplus
  std::cout.flush();
  std::cerr.flush();
#endif
  fflush(stdout);
  fflush(stderr);
  const char *marker = "\\n${WAIT_INPUT_MARKER}\\n";
  (void)!write(2, marker, strlen(marker));
  _exit(88);
}

static ssize_t __lc_cookie_read(void *cookie, char *buf, size_t size) {
  (void)cookie;
  if (size == 0) return 0;
  if (__lc_in_pos >= __lc_in_len) {
    __lc_pause_for_input();
  }
  buf[0] = __lc_in_buf[__lc_in_pos++];
  return 1;
}

#ifdef __cplusplus
class __LcCinBuf : public std::streambuf {
  char ch;
protected:
  int_type underflow() override {
    if (gptr() < egptr()) return traits_type::to_int_type(*gptr());
    if (__lc_in_pos >= __lc_in_len) {
      __lc_pause_for_input();
    }
    ch = __lc_in_buf[__lc_in_pos++];
    setg(&ch, &ch, &ch + 1);
    return traits_type::to_int_type(ch);
  }
};
static __LcCinBuf __lc_cin_buf;
#endif
`
    : '';

  const fsSyncPart = syncFiles
    ? `
static char __lc_pre_names[64][256];
static int __lc_pre_count = 0;
static char __lc_mnt_names[16][256];
static size_t __lc_mnt_lens[16];
static unsigned int __lc_mnt_hashes[16];
static int __lc_mnt_count = 0;

static unsigned int __lc_fnv1a(const unsigned char *data, size_t len) {
  unsigned int h = 2166136261u;
  for (size_t i = 0; i < len; i++) {
    h ^= (unsigned int)data[i];
    h *= 16777619u;
  }
  return h;
}

static int __lc_str_ends_with(const char *s, const char *suf) {
  size_t ls = strlen(s), lf = strlen(suf);
  return ls >= lf && strcmp(s + ls - lf, suf) == 0;
}

${mountedDecls}

__attribute__((unused))
static void __lc_mount_file(const char *name, const unsigned char *data, size_t len) {
  FILE *fp = fopen(name, "wb");
  if (fp) {
    if (len > 0) fwrite(data, 1, len, fp);
    fclose(fp);
  }
  if (__lc_mnt_count < 16) {
    snprintf(__lc_mnt_names[__lc_mnt_count], 256, "%s", name);
    __lc_mnt_lens[__lc_mnt_count] = len;
    __lc_mnt_hashes[__lc_mnt_count] = __lc_fnv1a(data, len);
    __lc_mnt_count++;
  }
}

static void __lc_emit_b64(const unsigned char *data, size_t len) {
  static const char tbl[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  char out[4096];
  size_t op = 0;
  for (size_t i = 0; i < len; i += 3) {
    unsigned int v = ((unsigned int)data[i]) << 16;
    if (i + 1 < len) v |= ((unsigned int)data[i + 1]) << 8;
    if (i + 2 < len) v |= ((unsigned int)data[i + 2]);
    out[op++] = tbl[(v >> 18) & 63];
    out[op++] = tbl[(v >> 12) & 63];
    out[op++] = (i + 1 < len) ? tbl[(v >> 6) & 63] : '=';
    out[op++] = (i + 2 < len) ? tbl[v & 63] : '=';
    if (op >= sizeof(out) - 8) {
      (void)!write(2, out, op);
      op = 0;
    }
  }
  if (op > 0) (void)!write(2, out, op);
}

__attribute__((destructor))
static void __lc_sync_files_back(void) {
  DIR *d = opendir(".");
  if (!d) return;
  int started = 0;
  struct dirent *ent;
  while ((ent = readdir(d)) != NULL) {
    const char *nm = ent->d_name;
    if (nm[0] == '.') continue;
    if (strcmp(nm, "a.out") == 0) continue;
    if (__lc_str_ends_with(nm, ".c") || __lc_str_ends_with(nm, ".cpp") ||
        __lc_str_ends_with(nm, ".cc") || __lc_str_ends_with(nm, ".cxx") ||
        __lc_str_ends_with(nm, ".h") || __lc_str_ends_with(nm, ".hpp") ||
        __lc_str_ends_with(nm, ".o") || __lc_str_ends_with(nm, ".s")) {
      continue;
    }
    struct stat st;
    if (stat(nm, &st) != 0 || !S_ISREG(st.st_mode)) continue;
    if (st.st_size < 0 || st.st_size > 131072) continue;

    int mnt_idx = -1;
    for (int i = 0; i < __lc_mnt_count; i++) {
      if (strcmp(__lc_mnt_names[i], nm) == 0) {
        mnt_idx = i;
        break;
      }
    }
    if (mnt_idx == -1) {
      int was_pre = 0;
      for (int i = 0; i < __lc_pre_count; i++) {
        if (strcmp(__lc_pre_names[i], nm) == 0) {
          was_pre = 1;
          break;
        }
      }
      if (was_pre) continue;
      if ((st.st_mode & S_IXUSR) != 0 &&
          !__lc_str_ends_with(nm, ".txt") && !__lc_str_ends_with(nm, ".out") &&
          !__lc_str_ends_with(nm, ".in") && !__lc_str_ends_with(nm, ".inp") &&
          !__lc_str_ends_with(nm, ".csv") && !__lc_str_ends_with(nm, ".dat") &&
          !__lc_str_ends_with(nm, ".json") && !__lc_str_ends_with(nm, ".log") &&
          !__lc_str_ends_with(nm, ".md")) {
        continue;
      }
    }

    FILE *fp = fopen(nm, "rb");
    if (!fp) continue;
    size_t fsz = (size_t)st.st_size;
    unsigned char *fbuf = (unsigned char *)malloc(fsz > 0 ? fsz : 1);
    if (!fbuf) {
      fclose(fp);
      continue;
    }
    size_t got = fsz > 0 ? fread(fbuf, 1, fsz, fp) : 0;
    fclose(fp);

    if (mnt_idx != -1 &&
        got == __lc_mnt_lens[mnt_idx] &&
        __lc_fnv1a(fbuf, got) == __lc_mnt_hashes[mnt_idx]) {
      free(fbuf);
      continue;
    }

    if (!started) {
      const char *hdr = "\\n${FS_START_MARKER}\\n";
      (void)!write(2, hdr, strlen(hdr));
      started = 1;
    }
    (void)!write(2, nm, strlen(nm));
    (void)!write(2, "|", 1);
    __lc_emit_b64(fbuf, got);
    (void)!write(2, "\\n", 1);
    free(fbuf);
  }
  closedir(d);
  if (started) {
    const char *ftr = "${FS_END_MARKER}\\n";
    (void)!write(2, ftr, strlen(ftr));
  }
}
`
    : '';

  const initFsBody = syncFiles
    ? `
  DIR *pd = opendir(".");
  if (pd) {
    struct dirent *pe;
    while ((pe = readdir(pd)) != NULL && __lc_pre_count < 64) {
      if (pe->d_name[0] == '.') continue;
      snprintf(__lc_pre_names[__lc_pre_count], 256, "%s", pe->d_name);
      __lc_pre_count++;
    }
    closedir(pd);
  }
${mountedInit}
`
    : '';

  const initStdinBody = interactive
    ? `
  size_t cap = 4096;
  __lc_in_buf = (char *)malloc(cap);
  if (__lc_in_buf) {
    ssize_t r;
    while ((r = read(0, __lc_in_buf + __lc_in_len, cap - __lc_in_len)) > 0) {
      __lc_in_len += (size_t)r;
      if (__lc_in_len >= cap) {
        cap *= 2;
        char *nb = (char *)realloc(__lc_in_buf, cap);
        if (!nb) break;
        __lc_in_buf = nb;
      }
    }
    cookie_io_functions_t fns = { __lc_cookie_read, NULL, NULL, NULL };
    FILE *new_in = fopencookie(NULL, "r", fns);
    if (new_in) {
      setvbuf(new_in, NULL, _IONBF, 0);
      stdin = new_in;
    }
  }
  setvbuf(stdout, NULL, _IONBF, 0);
#ifdef __cplusplus
  std::cin.rdbuf(&__lc_cin_buf);
  std::cout.setf(std::ios::unitbuf);
#endif
`
    : '';

  const shim = `#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wall"
#pragma GCC diagnostic ignored "-Wextra"
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
${syncFiles ? '#include <dirent.h>\n#include <sys/stat.h>' : ''}
#ifdef __cplusplus
#include <iostream>
#include <streambuf>
#endif
${interactivePart}
${fsSyncPart}
__attribute__((constructor))
static void __lc_init_runtime(void) {
${initFsBody}
${initStdinBody}
}
#pragma GCC diagnostic pop
#line 1 "${safeFileLabel}"
`;

  return shim + safeUserCode;
}

function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function extractMarkersAndSyncedFiles(text: string): {
  cleaned: string;
  waitFound: boolean;
  syncedFiles: SyncedWorkspaceFile[];
} {
  let working = text;
  const syncedFiles: SyncedWorkspaceFile[] = [];

  const fsRegex = new RegExp(
    `\\r?\\n?${FS_START_MARKER}\\r?\\n([\\s\\S]*?)${FS_END_MARKER}\\r?\\n?`,
    'g'
  );
  working = working.replace(fsRegex, (_match, body: string) => {
    const lines = body.split(/\r?\n/);
    for (const line of lines) {
      const sep = line.indexOf('|');
      if (sep <= 0) continue;
      const name = line.slice(0, sep).trim();
      const b64 = line.slice(sep + 1).trim();
      if (!name || name.includes('/') || name.includes('..')) continue;
      try {
        syncedFiles.push({ name, content: b64 ? decodeBase64Utf8(b64) : '' });
      } catch {
        // ignore invalid base64
      }
    }
    return '';
  });

  let waitFound = false;
  if (working.includes(WAIT_INPUT_MARKER)) {
    waitFound = true;
    working = working.replace(new RegExp(`\\r?\\n?${WAIT_INPUT_MARKER}\\r?\\n?`, 'g'), '');
  }

  return { cleaned: working.trim(), waitFound, syncedFiles };
}

interface WandboxExtraFile {
  file: string;
  code: string;
}

const WANDBOX_COMPILE_URL = 'https://wandbox.org/api/compile.json';
const ANSI_REGEX = new RegExp('\\x1b\\[[0-9;]*[a-zA-Z]', 'g');
const CLANG_PRELOADED_KEY = 'codeide_clang_wasm_preloaded';

let persistentPythonWorker: Worker | null = null;
let activePythonKill: (() => void) | null = null;
let persistentClangWorker: Worker | null = null;
let activeClangKill: (() => void) | null = null;
let activeCppAbort: AbortController | null = null;

function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}

export function isOfflineCppPreloaded(): boolean {
  try {
    return localStorage.getItem(CLANG_PRELOADED_KEY) === '1';
  } catch {
    return false;
  }
}

function markOfflineCppPreloaded(): void {
  try {
    localStorage.setItem(CLANG_PRELOADED_KEY, '1');
  } catch {
    // ignore
  }
}

/**
 * Dừng khẩn cấp tiến trình Python/Clang Worker (vòng lặp vô hạn) hoặc hủy request C/C++ Cloud
 */
export function terminateCloudExecution(): void {
  if (activePythonKill) {
    if (persistentPythonWorker) {
      persistentPythonWorker.terminate();
      persistentPythonWorker = null;
    }
    const killFn = activePythonKill;
    activePythonKill = null;
    killFn();
  }

  if (activeClangKill) {
    if (persistentClangWorker) {
      persistentClangWorker.terminate();
      persistentClangWorker = null;
    }
    const killFn = activeClangKill;
    activeClangKill = null;
    killFn();
  }

  if (activeCppAbort) {
    activeCppAbort.abort();
    activeCppAbort = null;
  }
}

function getOrCreateClangWorker(): Worker {
  if (!persistentClangWorker) {
    persistentClangWorker = new Worker(
      new URL('../workers/clangWasmWorker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return persistentClangWorker;
}

export function preloadOfflineCppCompiler(
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = getOrCreateClangWorker();
    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
    };

    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'preload-progress' && typeof msg.percent === 'number') {
        onProgress?.(msg.percent);
      } else if (msg.type === 'preload-done') {
        cleanup();
        if (msg.ok) {
          markOfflineCppPreloaded();
          onProgress?.(100);
          resolve();
        } else {
          reject(new Error(msg.error || 'Không thể tải trình biên dịch Clang WASM'));
        }
      }
    };

    worker.onerror = (err) => {
      cleanup();
      persistentClangWorker?.terminate();
      persistentClangWorker = null;
      reject(new Error(err.message || 'Lỗi khởi tạo Clang WASM Worker'));
    };

    worker.postMessage({ type: 'preload' });
  });
}

function runCppInClangWasmWorker(
  activeFile: WorkspaceFile,
  latestFiles: WorkspaceFile[],
  compilerSettings: CompilerSettings,
  stdin: string,
  interactive: boolean,
  syncFiles: boolean,
  dataFiles: SyncedWorkspaceFile[],
  suppressWarnings: boolean,
  callbacks: PistonLogCallback
): Promise<{
  exitCode: number;
  elapsedMs: number;
  waitingForInput?: boolean;
  syncedFiles?: SyncedWorkspaceFile[];
}> {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const isC = activeFile.language === 'c';
    const stdFlag = resolveStdFlag(isC, compilerSettings);
    const { entryCode, entryFileName, extraFiles, extraSourceNames } = prepareCppProjectFiles(
      activeFile,
      latestFiles,
      isC
    );
    const worker = getOrCreateClangWorker();

    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
      activeClangKill = null;
    };

    activeClangKill = () => {
      cleanup();
      callbacks.onChunk('stderr', '\n[Tiến trình Offline C/C++ đã bị dừng bởi người dùng (SIGKILL)]\n');
      resolve({
        exitCode: 137,
        elapsedMs: Math.round(performance.now() - startTime),
        waitingForInput: false,
        syncedFiles: []
      });
    };

    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'done') {
        cleanup();
        markOfflineCppPreloaded();
        resolve({
          exitCode: Number(msg.exitCode) || 0,
          elapsedMs: Number(msg.elapsedMs) || Math.round(performance.now() - startTime),
          waitingForInput: Boolean(msg.waitingForInput),
          syncedFiles: Array.isArray(msg.syncedFiles) ? msg.syncedFiles : []
        });
        return;
      }

      if (msg.type === 'status' || msg.type === 'stdout' || msg.type === 'stderr') {
        callbacks.onChunk(msg.type, String(msg.text ?? ''));
      }
    };

    worker.onerror = (err) => {
      cleanup();
      persistentClangWorker?.terminate();
      persistentClangWorker = null;
      callbacks.onChunk('stderr', `Lỗi Offline Clang Worker: ${err.message || 'Không xác định'}\n`);
      resolve({
        exitCode: 1,
        elapsedMs: Math.round(performance.now() - startTime),
        waitingForInput: false,
        syncedFiles: []
      });
    };

    worker.postMessage({
      type: 'run',
      code: entryCode,
      isC,
      fileName: entryFileName,
      stdFlag,
      stdin,
      interactive,
      syncFiles,
      suppressWarnings,
      extraFiles,
      extraSourceNames,
      workspaceFiles: dataFiles
    });
  });
}

function getOrCreatePythonWorker(): Worker {
  if (!persistentPythonWorker) {
    persistentPythonWorker = new Worker(
      new URL('../workers/pyodideWorker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return persistentPythonWorker;
}

function runPythonInWorker(
  code: string,
  stdin: string,
  interactive: boolean,
  syncFiles: boolean,
  workspaceFiles: SyncedWorkspaceFile[],
  callbacks: PistonLogCallback
): Promise<{
  exitCode: number;
  elapsedMs: number;
  waitingForInput?: boolean;
  syncedFiles?: SyncedWorkspaceFile[];
}> {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const worker = getOrCreatePythonWorker();

    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
      activePythonKill = null;
    };

    activePythonKill = () => {
      cleanup();
      callbacks.onChunk('stderr', '\n[Tiến trình đã bị dừng bởi người dùng (SIGKILL)]\n');
      resolve({
        exitCode: 137,
        elapsedMs: Math.round(performance.now() - startTime)
      });
    };

    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'done') {
        cleanup();
        resolve({
          exitCode: Number(msg.exitCode) || 0,
          elapsedMs: Number(msg.elapsedMs) || Math.round(performance.now() - startTime),
          waitingForInput: Boolean(msg.waitingForInput),
          syncedFiles: Array.isArray(msg.syncedFiles) ? msg.syncedFiles : []
        });
        return;
      }

      if (msg.type === 'status' || msg.type === 'stdout' || msg.type === 'stderr') {
        callbacks.onChunk(msg.type, String(msg.text ?? ''));
      }
    };

    worker.onerror = (err) => {
      cleanup();
      persistentPythonWorker?.terminate();
      persistentPythonWorker = null;
      callbacks.onChunk('stderr', `Lỗi Web Worker: ${err.message || 'Không xác định'}\n`);
      resolve({
        exitCode: 1,
        elapsedMs: Math.round(performance.now() - startTime)
      });
    };

    worker.postMessage({ type: 'run', code, stdin, interactive, syncFiles, workspaceFiles });
  });
}

function resolveStdFlag(isC: boolean, compilerSettings: CompilerSettings): string {
  if (isC) {
    const stdRaw = String(compilerSettings.cStandard || '').toLowerCase();
    if (stdRaw.includes('17')) return '-std=gnu17';
    if (stdRaw.includes('99')) return '-std=gnu99';
    if (stdRaw.includes('89') || stdRaw.includes('90')) return '-std=gnu89';
    return '-std=gnu11';
  }

  const stdRaw = String(compilerSettings.cppStandard || '').toLowerCase();
  if (stdRaw.includes('23')) return '-std=gnu++23';
  if (stdRaw.includes('20')) return '-std=gnu++20';
  if (stdRaw.includes('14')) return '-std=gnu++14';
  if (stdRaw.includes('11')) return '-std=gnu++11';
  return '-std=gnu++17';
}

function prepareCppProjectFiles(
  activeFile: WorkspaceFile,
  latestFiles: WorkspaceFile[],
  isC: boolean
): {
  entryCode: string;
  entryFileName: string;
  extraFiles: WandboxExtraFile[];
  extraSourceNames: string[];
} {
  const getDir = (filePath: string) =>
    filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';

  const activeDir = getDir(activeFile.path);
  const validExt = isC ? /\.(c|h)$/i : /\.(cpp|cc|cxx|hpp|hh|h)$/i;
  const sourceExt = isC ? /\.c$/i : /\.(cpp|cc|cxx)$/i;

  const siblingFiles = (latestFiles || []).filter(
    (f) => getDir(f.path) === activeDir && validExt.test(f.name)
  );

  if (siblingFiles.length <= 1) {
    return {
      entryCode: activeFile.content,
      entryFileName: activeFile.name,
      extraFiles: [],
      extraSourceNames: []
    };
  }

  const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const hasMain = (content: string) =>
    /\b(?:int|void|auto)\s+main\s*\(/.test(stripComments(content));
  const hasLocalIncludes = (content: string) =>
    /^\s*#include\s+"[^"]+"/m.test(stripComments(content));

  const activeHasMain = hasMain(activeFile.content);
  const entryFile =
    (activeHasMain ? activeFile : siblingFiles.find((f) => hasMain(f.content))) || activeFile;

  // Tệp bài tập độc lập (có main() và không #include "..." tệp nội bộ):
  // KHÔNG gộp các tệp .cpp khác cùng thư mục để tránh trùng hàm / trùng int main()!
  if (entryFile.path === activeFile.path && !hasLocalIncludes(entryFile.content)) {
    return {
      entryCode: entryFile.content,
      entryFileName: entryFile.name,
      extraFiles: [],
      extraSourceNames: []
    };
  }

  const extraFiles: WandboxExtraFile[] = [];
  const extraSourceNames: string[] = [];

  for (const file of siblingFiles) {
    if (file.path === entryFile.path) continue;
    // Tuyệt đối không gộp thêm tệp nguồn khác cũng định nghĩa hàm main()
    if (sourceExt.test(file.name) && hasMain(file.content)) continue;
    extraFiles.push({ file: file.name, code: file.content });
    if (sourceExt.test(file.name)) {
      extraSourceNames.push(file.name);
    }
  }

  return {
    entryCode: entryFile.content,
    entryFileName: entryFile.name,
    extraFiles,
    extraSourceNames
  };
}

async function runWithGodbolt(
  activeFile: WorkspaceFile,
  latestFiles: WorkspaceFile[],
  compilerSettings: CompilerSettings,
  stdin: string,
  interactive: boolean,
  syncFiles: boolean,
  dataFiles: SyncedWorkspaceFile[],
  suppressWarnings: boolean,
  signal: AbortSignal,
  callbacks: PistonLogCallback
): Promise<{
  exitCode: number;
  elapsedMs: number;
  waitingForInput?: boolean;
  syncedFiles?: SyncedWorkspaceFile[];
}> {
  const startTime = performance.now();
  const isC = activeFile.language === 'c';
  const compilerId = isC ? 'cg142' : 'g142';
  const stdFlag = resolveStdFlag(isC, compilerSettings);
  const { entryCode, entryFileName, extraFiles } = prepareCppProjectFiles(
    activeFile,
    latestFiles,
    isC
  );

  let combinedSource = entryCode;
  if (extraFiles.length > 0) {
    const fileMap = new Map(extraFiles.map((f) => [f.file, f.code]));
    const inlinedHeaders = new Set<string>();
    const headerBlocks: string[] = [];

    const collectAndStripIncludes = (src: string): string =>
      src.replace(/^\s*#include\s+"([^"]+)"\s*$/gm, (match, incName: string) => {
        if (inlinedHeaders.has(incName)) return '';
        const headerContent = fileMap.get(incName);
        if (headerContent !== undefined) {
          inlinedHeaders.add(incName);
          fileMap.delete(incName);
          const cleanedHeader = collectAndStripIncludes(headerContent);
          headerBlocks.push(`// --- ${incName} ---\n${cleanedHeader}`);
          return '';
        }
        return match;
      });

    const cleanedEntry = collectAndStripIncludes(entryCode);
    const implBlocks: string[] = [];
    for (const [name, code] of Array.from(fileMap.entries())) {
      if (/\.(h|hpp|hh)$/i.test(name)) continue;
      implBlocks.push(`// --- ${name} ---\n${collectAndStripIncludes(code)}`);
    }

    combinedSource = [...headerBlocks, ...implBlocks, cleanedEntry].filter(Boolean).join('\n\n');
  }

  const finalSource = wrapCppRuntimeShim(combinedSource, isC, {
    interactive,
    syncFiles,
    dataFiles,
    fileName: entryFileName
  });

  const response = await fetch(`https://godbolt.org/api/compiler/${compilerId}/compile`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      source: finalSource,
      options: {
        userArguments: `${stdFlag} -O2 -Wall -fno-diagnostics-color`,
        compilerOptions: { executorRequest: true },
        filters: { execute: true },
        executeParameters: { args: [], stdin }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Godbolt API trả về lỗi HTTP ${response.status}`);
  }

  const data = await response.json();
  const elapsedMs = Math.round(performance.now() - startTime);

  const extractLines = (arr?: Array<{ text?: string }>) =>
    Array.isArray(arr) ? stripAnsi(arr.map((item) => item.text ?? '').join('\n')) : '';

  const buildCode: number = data.buildResult?.code ?? 0;
  const buildStderr = extractLines(data.buildResult?.stderr).trim();
  const stdout = extractLines(data.stdout);
  const rawStderr = extractLines(data.stderr);
  const { cleaned: stderr, waitFound, syncedFiles } = extractMarkersAndSyncedFiles(rawStderr);
  const exitCode: number = typeof data.code === 'number' ? data.code : buildCode;
  const waitingForInput = interactive && (waitFound || (exitCode === 88 && buildCode === 0));

  if (buildCode !== 0 && buildStderr) {
    callbacks.onChunk('stderr', `${buildStderr}\n`);
    return { exitCode: buildCode, elapsedMs, waitingForInput: false, syncedFiles: [] };
  }

  if (stdout) {
    callbacks.onChunk('stdout', waitingForInput ? stdout : `${stdout}\n`);
  }
  const allErr = [suppressWarnings ? '' : buildStderr, stderr.trim()].filter(Boolean).join('\n');
  if (allErr) callbacks.onChunk('stderr', `${allErr}\n`);

  return { exitCode, elapsedMs, waitingForInput, syncedFiles };
}

async function runWithWandboxFallback(
  activeFile: WorkspaceFile,
  latestFiles: WorkspaceFile[],
  compilerSettings: CompilerSettings,
  stdin: string,
  interactive: boolean,
  syncFiles: boolean,
  dataFiles: SyncedWorkspaceFile[],
  suppressWarnings: boolean,
  signal: AbortSignal,
  callbacks: PistonLogCallback
): Promise<{
  exitCode: number;
  elapsedMs: number;
  waitingForInput?: boolean;
  syncedFiles?: SyncedWorkspaceFile[];
}> {
  const startTime = performance.now();
  const isC = activeFile.language === 'c';
  const stdFlag = resolveStdFlag(isC, compilerSettings);
  const { entryCode, entryFileName, extraFiles, extraSourceNames } = prepareCppProjectFiles(
    activeFile,
    latestFiles,
    isC
  );

  const finalCode = wrapCppRuntimeShim(entryCode, isC, {
    interactive,
    syncFiles,
    dataFiles,
    fileName: entryFileName
  });

  const payload: Record<string, unknown> = {
    compiler: isC ? 'gcc-13.2.0-c' : 'gcc-13.2.0',
    code: finalCode,
    stdin,
    'compiler-option-raw': [stdFlag, '-O2', '-Wall', ...extraSourceNames].join('\n')
  };

  if (extraFiles.length > 0) {
    payload.codes = extraFiles;
  }

  const response = await fetch(WANDBOX_COMPILE_URL, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Wandbox trả về lỗi HTTP ${response.status}`);
  }

  const data = await response.json();
  const elapsedMs = Math.round(performance.now() - startTime);

  const compileError = stripAnsi(data.compiler_error || '');
  const programOutput = stripAnsi(data.program_output || '');
  const rawProgramError = stripAnsi(data.program_error || '');
  const { cleaned: programError, waitFound, syncedFiles } =
    extractMarkersAndSyncedFiles(rawProgramError);
  const exitCode =
    data.status !== undefined && !Number.isNaN(parseInt(String(data.status), 10))
      ? parseInt(String(data.status), 10)
      : 1;
  const waitingForInput = interactive && (waitFound || (exitCode === 88 && !compileError));

  if (compileError && exitCode !== 0 && !programOutput && !programError) {
    callbacks.onChunk('stderr', `${compileError.trim()}\n`);
    return { exitCode, elapsedMs, waitingForInput: false, syncedFiles: [] };
  }

  if (programOutput) callbacks.onChunk('stdout', programOutput);
  const combinedStderr = [suppressWarnings ? '' : compileError.trim(), programError.trim()]
    .filter(Boolean)
    .join('\n');
  if (combinedStderr) callbacks.onChunk('stderr', `${combinedStderr}\n`);

  return { exitCode, elapsedMs, waitingForInput, syncedFiles };
}

export async function executeWithPiston(
  activeFile: WorkspaceFile,
  latestFiles: WorkspaceFile[],
  compilerSettings: CompilerSettings,
  stdinPreset: string,
  callbacks: PistonLogCallback,
  options?: PistonRunOptions
): Promise<void> {
  const startAll = performance.now();
  const lang = activeFile.language;
  const interactive = Boolean(options?.interactive);
  const syncFiles = Boolean(options?.syncFiles);
  const dataFiles = syncFiles ? collectWorkspaceDataFiles(activeFile, latestFiles) : [];

  const cppEngine = compilerSettings.cppEngine || 'auto';
  const isOfflineNow = typeof navigator !== 'undefined' && navigator.onLine === false;
  const useOfflineCppDirect =
    (lang === 'cpp' || lang === 'c') &&
    (cppEngine === 'offline-wasm' || (cppEngine === 'auto' && isOfflineNow));

  const cmdLabel =
    lang === 'python'
      ? `[Pyodide WASM] python3 ${activeFile.name}`
      : useOfflineCppDirect
        ? lang === 'c'
          ? `[Offline Clang WASM] clang ${activeFile.name} -o main.wasm`
          : `[Offline Clang++ WASM] clang++ ${activeFile.name} -o main.wasm`
        : lang === 'c'
          ? `[GCC 14.2] gcc ${activeFile.name} -o main && ./main`
          : `[G++ 14.2] g++ ${activeFile.name} -o main && ./main`;

  if (!options?.suppressHeader) {
    callbacks.onChunk('status', `> ${cmdLabel}\n`);
  }

  try {
    let result: {
      exitCode: number;
      elapsedMs: number;
      waitingForInput?: boolean;
      syncedFiles?: SyncedWorkspaceFile[];
    };

    if (lang === 'python') {
      result = await runPythonInWorker(
        activeFile.content,
        stdinPreset || '',
        interactive,
        syncFiles,
        dataFiles,
        callbacks
      );
    } else if (lang === 'cpp' || lang === 'c') {
      const suppressWarnings = Boolean(options?.suppressHeader);

      if (useOfflineCppDirect) {
        result = await runCppInClangWasmWorker(
          activeFile,
          latestFiles,
          compilerSettings,
          stdinPreset || '',
          interactive,
          syncFiles,
          dataFiles,
          suppressWarnings,
          callbacks
        );
      } else {
        const abortController = new AbortController();
        activeCppAbort = abortController;

        try {
          result = await runWithGodbolt(
            activeFile,
            latestFiles,
            compilerSettings,
            stdinPreset || '',
            interactive,
            syncFiles,
            dataFiles,
            suppressWarnings,
            abortController.signal,
            callbacks
          );
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            callbacks.onChunk('stderr', '\n[Đã hủy yêu cầu biên dịch C/C++]\n');
            result = { exitCode: 130, elapsedMs: Math.round(performance.now() - startAll) };
          } else {
            try {
              result = await runWithWandboxFallback(
                activeFile,
                latestFiles,
                compilerSettings,
                stdinPreset || '',
                interactive,
                syncFiles,
                dataFiles,
                suppressWarnings,
                abortController.signal,
                callbacks
              );
            } catch (wandboxErr: any) {
              if (wandboxErr?.name === 'AbortError') {
                callbacks.onChunk('stderr', '\n[Đã hủy yêu cầu biên dịch C/C++]\n');
                result = { exitCode: 130, elapsedMs: Math.round(performance.now() - startAll) };
              } else if (cppEngine === 'auto') {
                callbacks.onChunk(
                  'status',
                  '> Không kết nối được Cloud Compiler — Tự chuyển sang Offline LLVM Clang WASM...\n'
                );
                activeCppAbort = null;
                result = await runCppInClangWasmWorker(
                  activeFile,
                  latestFiles,
                  compilerSettings,
                  stdinPreset || '',
                  interactive,
                  syncFiles,
                  dataFiles,
                  suppressWarnings,
                  callbacks
                );
              } else {
                throw wandboxErr;
              }
            }
          }
        } finally {
          activeCppAbort = null;
        }
      }
    } else {
      throw new Error(`Ngôn ngữ "${lang}" chưa được hỗ trợ thực thi.`);
    }

    if (result.syncedFiles && result.syncedFiles.length > 0 && !result.waitingForInput) {
      callbacks.onSyncedFiles?.(result.syncedFiles);
    }

    callbacks.onFinish?.(result.exitCode, result.elapsedMs, Boolean(result.waitingForInput));
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const message = isAbort
      ? 'Đã dừng tiến trình theo yêu cầu.'
      : err instanceof Error
        ? err.message
        : 'Lỗi kết nối không xác định';
    callbacks.onChunk('stderr', `${message}\n`);
    callbacks.onFinish?.(-1, Math.round(performance.now() - startAll), false);
  }
}