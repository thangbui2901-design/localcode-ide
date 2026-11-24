// client/src/workers/clangWasmWorker.ts
// 100% Offline C/C++ LLVM Clang + LLD WebAssembly Compiler & WASI Preview 1 Runtime
// Chạy trực tiếp trong Web Worker trên iPadOS / iOS WKWebView & Safari (không cần SharedArrayBuffer).

interface WorkspaceDataFile {
  name: string;
  content: string;
}

interface ExtraSourceFile {
  file: string;
  code: string;
}

interface RunClangPayload {
  type: 'run';
  code: string;
  isC: boolean;
  fileName: string;
  stdFlag: string;
  stdin: string;
  interactive?: boolean;
  syncFiles?: boolean;
  suppressWarnings?: boolean;
  extraFiles?: ExtraSourceFile[];
  extraSourceNames?: string[];
  workspaceFiles?: WorkspaceDataFile[];
}

interface PreloadClangPayload {
  type: 'preload';
}

type WorkerPayload = RunClangPayload | PreloadClangPayload;

type YoWaspTree = { [name: string]: string | Uint8Array | YoWaspTree };

type RunClangFn = (
  args: string[],
  filesIn?: YoWaspTree,
  options?: {
    stdin?: Uint8Array | null;
    stdout?: ((bytes: Uint8Array | null) => void) | null;
    stderr?: ((bytes: Uint8Array | null) => void) | null;
    decodeASCII?: boolean;
    fetchProgress?: (progress: {
      source?: string;
      totalLength?: number;
      doneLength?: number;
    }) => void;
  }
) => Promise<YoWaspTree>;

const YOWASP_CLANG_CDNS = [
  'https://cdn.jsdelivr.net/npm/@yowasp/clang/gen/bundle.js',
  'https://cdn.jsdelivr.net/npm/@yowasp/clang/+esm'
];

const BITS_STDCPP_HEADER = `#pragma once
#include <cassert>
#include <cctype>
#include <cerrno>
#include <cfloat>
#include <cinttypes>
#include <climits>
#include <clocale>
#include <cmath>
#include <csetjmp>
#include <csignal>
#include <cstdarg>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <cwchar>
#include <cwctype>

#ifdef __cplusplus
#include <algorithm>
#include <array>
#include <bitset>
#include <chrono>
#include <complex>
#include <deque>
#include <exception>
#include <fstream>
#include <functional>
#include <initializer_list>
#include <iomanip>
#include <ios>
#include <iosfwd>
#include <iostream>
#include <istream>
#include <iterator>
#include <limits>
#include <list>
#include <locale>
#include <map>
#include <memory>
#include <new>
#include <numeric>
#include <ostream>
#include <queue>
#include <random>
#include <ratio>
#include <regex>
#include <set>
#include <sstream>
#include <stack>
#include <stdexcept>
#include <streambuf>
#include <string>
#include <system_error>
#include <tuple>
#include <type_traits>
#include <typeindex>
#include <typeinfo>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <valarray>
#include <vector>

#if defined(__has_include)
#if __cplusplus >= 201703L
#if __has_include(<any>)
#include <any>
#endif
#if __has_include(<charconv>)
#include <charconv>
#endif
#if __has_include(<optional>)
#include <optional>
#endif
#if __has_include(<string_view>)
#include <string_view>
#endif
#if __has_include(<variant>)
#include <variant>
#endif
#endif
#if __cplusplus >= 202002L
#if __has_include(<bit>)
#include <bit>
#endif
#if __has_include(<numbers>)
#include <numbers>
#endif
#if __has_include(<ranges>)
#include <ranges>
#endif
#if __has_include(<span>)
#include <span>
#endif
#endif
#endif
#endif
`;

const workerCtx = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerPayload>) => void) | null;
  postMessage: (message: unknown) => void;
};

let cachedRunClang: RunClangFn | null = null;
let clangLoadPromise: Promise<RunClangFn> | null = null;

// Cache bản biên dịch WebAssembly gần nhất để các bước nhập stdin tương tác chạy tức thì (< 5ms)
let lastCompiledKey = '';
let lastCompiledModule: WebAssembly.Module | null = null;
let lastCompileWarnings = '';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');

/* ==================== INDEXEDDB OFFLINE CACHE CHO CLANG WASM (HOẠT ĐỘNG CẢ TRONG CAPACITOR iOS .IPA) ==================== */

const WASM_CACHE_DB = 'LocalCodeIDE_ClangWasmCache_v1';
const WASM_CACHE_STORE = 'assets';
let wasmCacheInstalled = false;

interface CachedWasmAsset {
  url: string;
  contentType: string;
  buffer: ArrayBuffer;
  savedAt: number;
}

function openWasmCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(WASM_CACHE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(WASM_CACHE_STORE)) {
        db.createObjectStore(WASM_CACHE_STORE, { keyPath: 'url' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readWasmCache(url: string): Promise<CachedWasmAsset | null> {
  try {
    const db = await openWasmCacheDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(WASM_CACHE_STORE, 'readonly');
      const req = tx.objectStore(WASM_CACHE_STORE).get(url);
      req.onsuccess = () => resolve((req.result as CachedWasmAsset | undefined) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeWasmCache(asset: CachedWasmAsset): Promise<void> {
  try {
    const db = await openWasmCacheDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(WASM_CACHE_STORE, 'readwrite');
      tx.objectStore(WASM_CACHE_STORE).put(asset);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Bỏ qua nếu thiết bị giới hạn dung lượng lưu trữ
  }
}

function installOfflineWasmFetchCache(): void {
  if (wasmCacheInstalled || typeof globalThis.fetch !== 'function') return;
  wasmCacheInstalled = true;
  const nativeFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    const isYoWaspAsset = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@yowasp\//i.test(url);
    if (!isYoWaspAsset || (init?.method && init.method.toUpperCase() !== 'GET')) {
      return nativeFetch(input, init);
    }

    const cached = await readWasmCache(url);
    if (cached && cached.buffer && cached.buffer.byteLength > 0) {
      return new Response(cached.buffer.slice(0), {
        status: 200,
        headers: {
          'Content-Type': cached.contentType || 'application/octet-stream',
          'Content-Length': String(cached.buffer.byteLength)
        }
      });
    }

    const res = await nativeFetch(input, init);
    if (res.ok) {
      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      const clone = res.clone();
      clone
        .arrayBuffer()
        .then((buf) => {
          if (buf.byteLength > 0) {
            return writeWasmCache({ url, contentType, buffer: buf, savedAt: Date.now() });
          }
        })
        .catch(() => {});
    }
    return res;
  };
}

async function importClangBundleWithOfflineCache(url: string): Promise<{ runClang?: RunClangFn }> {
  try {
    const mod = (await import(/* @vite-ignore */ url)) as { runClang?: RunClangFn };
    // Lưu trước mã bundle.js vào IndexedDB để khi mất mạng hoàn toàn vẫn nạp được module
    fetch(url).catch(() => {});
    return mod;
  } catch (networkErr) {
    const cached = await readWasmCache(url);
    if (!cached) throw networkErr;
    const jsText = textDecoder
      .decode(cached.buffer)
      .replace(/\bimport\.meta\.url\b/g, JSON.stringify(url));
    const blobUrl = URL.createObjectURL(new Blob([jsText], { type: 'text/javascript' }));
    try {
      return (await import(/* @vite-ignore */ blobUrl)) as { runClang?: RunClangFn };
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }
}

async function ensureClangCompiler(): Promise<RunClangFn> {
  if (cachedRunClang) return cachedRunClang;
  if (clangLoadPromise) return clangLoadPromise;

  installOfflineWasmFetchCache();

  clangLoadPromise = (async () => {
    workerCtx.postMessage({
      type: 'status',
      text: '> Đang nạp trình biên dịch Offline LLVM Clang WASM (chỉ tải lần đầu và tự lưu bộ nhớ đệm)...\n'
    });

    let lastErr: unknown = null;
    for (const url of YOWASP_CLANG_CDNS) {
      try {
        const mod = await importClangBundleWithOfflineCache(url);
        if (typeof mod?.runClang === 'function') {
          cachedRunClang = mod.runClang;
          return mod.runClang;
        }
      } catch (err) {
        lastErr = err;
      }
    }

    throw new Error(
      `Không thể tải mô-đun Clang WASM Offline (${
        lastErr instanceof Error ? lastErr.message : 'cần kết nối mạng lần đầu để lưu bộ nhớ đệm'
      }).`
    );
  })();

  try {
    return await clangLoadPromise;
  } catch (err) {
    clangLoadPromise = null;
    throw err;
  }
}

function normalizeClangStdFlag(isC: boolean, stdFlag: string): string {
  const raw = (stdFlag || '').toLowerCase();
  if (isC) {
    if (raw.includes('17')) return '-std=c17';
    if (raw.includes('99')) return '-std=c99';
    if (raw.includes('89') || raw.includes('90')) return '-std=c89';
    return '-std=c11';
  }
  if (raw.includes('23')) return '-std=c++23';
  if (raw.includes('20')) return '-std=c++20';
  if (raw.includes('14')) return '-std=c++14';
  if (raw.includes('11')) return '-std=c++11';
  return '-std=c++17';
}

function wrapUnbufferedStdoutShim(code: string, isC: boolean, interactive: boolean): string {
  if (!interactive) return code;
  const safeCode = isC
    ? code
    : code.replace(/\bsync_with_stdio\s*\(\s*(?:false|0)\s*\)/g, 'sync_with_stdio(true)');

  return `#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wall"
#include <stdio.h>
#ifdef __cplusplus
#include <iostream>
#endif
__attribute__((constructor))
static void __lc_wasi_unbuf_stdout(void) {
  setvbuf(stdout, NULL, _IONBF, 0);
#ifdef __cplusplus
  std::cout.setf(std::ios::unitbuf);
#endif
}
#pragma clang diagnostic pop
#line 1
${safeCode}`;
}

/* ==================== WASI PREVIEW 1 RUNTIME (wasi_snapshot_preview1) ==================== */

class WasiExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`WASI exit(${code})`);
    this.code = code;
  }
}

class WasiWaitInputError extends Error {
  constructor() {
    super('WASI waiting for interactive stdin');
  }
}

const ERRNO_SUCCESS = 0;
const ERRNO_BADF = 8;
const ERRNO_EXIST = 20;
const ERRNO_INVAL = 28;
const ERRNO_ISDIR = 31;
const ERRNO_NOENT = 44;
const ERRNO_NOSYS = 52;
const ERRNO_NOTDIR = 54;

const FILETYPE_CHARACTER_DEVICE = 2;
const FILETYPE_DIRECTORY = 3;
const FILETYPE_REGULAR_FILE = 4;

const OFLAGS_CREAT = 1;
const OFLAGS_DIRECTORY = 2;
const OFLAGS_EXCL = 4;
const OFLAGS_TRUNC = 8;
const FDFLAGS_APPEND = 1;

const RIGHTS_ALL = 0x1fffffffn;

interface VirtualFileNode {
  data: Uint8Array;
  ino: number;
  mtimeNs: bigint;
}

interface OpenFd {
  kind: 'stdin' | 'stdout' | 'stderr' | 'dir' | 'file';
  path: string;
  offset: number;
  append: boolean;
}

function normalizeVfsPath(raw: string): string {
  const cleaned = raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '');
  const parts: string[] = [];
  for (const part of cleaned.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join('/');
}

async function runWasiProgram(
  wasmModule: WebAssembly.Module,
  stdinText: string,
  interactive: boolean,
  syncFiles: boolean,
  workspaceFiles: WorkspaceDataFile[]
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  waitingForInput: boolean;
  syncedFiles: WorkspaceDataFile[];
}> {
  const stdinBytes = textEncoder.encode(stdinText);
  let stdinPos = 0;

  const stdoutChunks: Uint8Array[] = [];
  const stderrChunks: Uint8Array[] = [];

  const vfs = new Map<string, VirtualFileNode>();
  const initialSnapshots = new Map<string, string>();
  let nextIno = 10;
  const nowNs = () => BigInt(Date.now()) * 1_000_000n;

  if (syncFiles && workspaceFiles.length > 0) {
    for (const wf of workspaceFiles) {
      const cleanName = normalizeVfsPath(wf.name);
      if (!cleanName || cleanName.includes('/')) continue;
      vfs.set(cleanName, {
        data: textEncoder.encode(wf.content),
        ino: nextIno++,
        mtimeNs: nowNs()
      });
      initialSnapshots.set(cleanName, wf.content);
    }
  }

  const fdTable = new Map<number, OpenFd>([
    [0, { kind: 'stdin', path: '', offset: 0, append: false }],
    [1, { kind: 'stdout', path: '', offset: 0, append: false }],
    [2, { kind: 'stderr', path: '', offset: 0, append: false }],
    [3, { kind: 'dir', path: '.', offset: 0, append: false }]
  ]);
  let nextFd = 4;

  const args = ['program.wasm'];
  const argBytes = args.map((a) => textEncoder.encode(`${a}\0`));
  const envVars: string[] = [];
  const envBytes = envVars.map((e) => textEncoder.encode(`${e}\0`));

  let wasmMemory: WebAssembly.Memory | null = null;
  const getView = () => new DataView(wasmMemory!.buffer);
  const getU8 = () => new Uint8Array(wasmMemory!.buffer);

  const readString = (ptr: number, len: number) =>
    textDecoder.decode(new Uint8Array(wasmMemory!.buffer, ptr, len));

  const writeFilestat = (
    bufPtr: number,
    ino: number,
    filetype: number,
    size: number,
    mtimeNs: bigint
  ) => {
    const view = getView();
    view.setBigUint64(bufPtr, 0n, true); // dev
    view.setBigUint64(bufPtr + 8, BigInt(ino), true); // ino
    view.setUint8(bufPtr + 16, filetype);
    view.setBigUint64(bufPtr + 24, 1n, true); // nlink
    view.setBigUint64(bufPtr + 32, BigInt(size), true); // size
    view.setBigUint64(bufPtr + 40, mtimeNs, true); // atim
    view.setBigUint64(bufPtr + 48, mtimeNs, true); // mtim
    view.setBigUint64(bufPtr + 56, mtimeNs, true); // ctim
  };

  const wasiImports: WebAssembly.ModuleImports = {
    args_sizes_get: (argcPtr: number, argvBufSizePtr: number) => {
      const view = getView();
      const total = argBytes.reduce((s, b) => s + b.length, 0);
      view.setUint32(argcPtr, argBytes.length, true);
      view.setUint32(argvBufSizePtr, total, true);
      return ERRNO_SUCCESS;
    },
    args_get: (argvPtr: number, argvBufPtr: number) => {
      const view = getView();
      const u8 = getU8();
      let offset = argvBufPtr;
      for (let i = 0; i < argBytes.length; i++) {
        view.setUint32(argvPtr + i * 4, offset, true);
        u8.set(argBytes[i], offset);
        offset += argBytes[i].length;
      }
      return ERRNO_SUCCESS;
    },
    environ_sizes_get: (countPtr: number, bufSizePtr: number) => {
      const view = getView();
      const total = envBytes.reduce((s, b) => s + b.length, 0);
      view.setUint32(countPtr, envBytes.length, true);
      view.setUint32(bufSizePtr, total, true);
      return ERRNO_SUCCESS;
    },
    environ_get: (envPtr: number, envBufPtr: number) => {
      const view = getView();
      const u8 = getU8();
      let offset = envBufPtr;
      for (let i = 0; i < envBytes.length; i++) {
        view.setUint32(envPtr + i * 4, offset, true);
        u8.set(envBytes[i], offset);
        offset += envBytes[i].length;
      }
      return ERRNO_SUCCESS;
    },
    clock_res_get: (_clockId: number, resPtr: number) => {
      getView().setBigUint64(resPtr, 1_000_000n, true);
      return ERRNO_SUCCESS;
    },
    clock_time_get: (clockId: number, _precision: bigint, timePtr: number) => {
      const ns =
        clockId === 0
          ? BigInt(Date.now()) * 1_000_000n
          : BigInt(Math.round(performance.now() * 1_000_000));
      getView().setBigUint64(timePtr, ns, true);
      return ERRNO_SUCCESS;
    },
    random_get: (bufPtr: number, bufLen: number) => {
      const slice = new Uint8Array(wasmMemory!.buffer, bufPtr, bufLen);
      if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(slice);
      } else {
        for (let i = 0; i < bufLen; i++) slice[i] = Math.floor(Math.random() * 256);
      }
      return ERRNO_SUCCESS;
    },
    proc_exit: (code: number) => {
      throw new WasiExitError(code);
    },
    proc_raise: (sig: number) => {
      throw new WasiExitError(128 + sig);
    },
    sched_yield: () => ERRNO_SUCCESS,
    fd_prestat_get: (fd: number, bufPtr: number) => {
      const entry = fdTable.get(fd);
      if (!entry || entry.kind !== 'dir') return ERRNO_BADF;
      const view = getView();
      view.setUint8(bufPtr, 0); // PREOPENTYPE_DIR
      view.setUint32(bufPtr + 4, textEncoder.encode(entry.path).length, true);
      return ERRNO_SUCCESS;
    },
    fd_prestat_dir_name: (fd: number, pathPtr: number, pathLen: number) => {
      const entry = fdTable.get(fd);
      if (!entry || entry.kind !== 'dir') return ERRNO_BADF;
      const bytes = textEncoder.encode(entry.path);
      getU8().set(bytes.subarray(0, pathLen), pathPtr);
      return ERRNO_SUCCESS;
    },
    fd_fdstat_get: (fd: number, bufPtr: number) => {
      const entry = fdTable.get(fd);
      if (!entry) return ERRNO_BADF;
      const view = getView();
      const filetype =
        entry.kind === 'dir'
          ? FILETYPE_DIRECTORY
          : entry.kind === 'file'
            ? FILETYPE_REGULAR_FILE
            : FILETYPE_CHARACTER_DEVICE;
      view.setUint8(bufPtr, filetype);
      view.setUint16(bufPtr + 2, entry.append ? FDFLAGS_APPEND : 0, true);
      view.setBigUint64(bufPtr + 8, RIGHTS_ALL, true);
      view.setBigUint64(bufPtr + 16, RIGHTS_ALL, true);
      return ERRNO_SUCCESS;
    },
    fd_fdstat_set_flags: (fd: number, flags: number) => {
      const entry = fdTable.get(fd);
      if (!entry) return ERRNO_BADF;
      entry.append = (flags & FDFLAGS_APPEND) !== 0;
      return ERRNO_SUCCESS;
    },
    fd_fdstat_set_rights: (fd: number) => (fdTable.has(fd) ? ERRNO_SUCCESS : ERRNO_BADF),
    fd_filestat_get: (fd: number, bufPtr: number) => {
      const entry = fdTable.get(fd);
      if (!entry) return ERRNO_BADF;
      if (entry.kind === 'dir') {
        writeFilestat(bufPtr, 1, FILETYPE_DIRECTORY, 0, nowNs());
        return ERRNO_SUCCESS;
      }
      if (entry.kind === 'file') {
        const node = vfs.get(entry.path);
        if (!node) return ERRNO_NOENT;
        writeFilestat(bufPtr, node.ino, FILETYPE_REGULAR_FILE, node.data.length, node.mtimeNs);
        return ERRNO_SUCCESS;
      }
      writeFilestat(bufPtr, fd, FILETYPE_CHARACTER_DEVICE, 0, nowNs());
      return ERRNO_SUCCESS;
    },
    fd_filestat_set_size: (fd: number, sizeBig: bigint) => {
      const entry = fdTable.get(fd);
      if (!entry || entry.kind !== 'file') return ERRNO_BADF;
      const node = vfs.get(entry.path);
      if (!node) return ERRNO_NOENT;
      const nextSize = Math.max(0, Number(sizeBig));
      const resized = new Uint8Array(nextSize);
      resized.set(node.data.subarray(0, Math.min(node.data.length, nextSize)));
      node.data = resized;
      node.mtimeNs = nowNs();
      return ERRNO_SUCCESS;
    },
    fd_filestat_set_times: () => ERRNO_SUCCESS,
    fd_advise: () => ERRNO_SUCCESS,
    fd_allocate: () => ERRNO_SUCCESS,
    fd_sync: () => ERRNO_SUCCESS,
    fd_datasync: () => ERRNO_SUCCESS,
    fd_close: (fd: number) => {
      if (fd <= 3) return ERRNO_SUCCESS;
      if (!fdTable.has(fd)) return ERRNO_BADF;
      fdTable.delete(fd);
      return ERRNO_SUCCESS;
    },
    fd_seek: (fd: number, offsetBig: bigint, whence: number, newOffsetPtr: number) => {
      const entry = fdTable.get(fd);
      if (!entry) return ERRNO_BADF;
      if (entry.kind !== 'file') return ERRNO_INVAL;
      const node = vfs.get(entry.path);
      if (!node) return ERRNO_NOENT;
      const delta = Number(offsetBig);
      let nextPos = entry.offset;
      if (whence === 0) nextPos = delta;
      else if (whence === 1) nextPos = entry.offset + delta;
      else if (whence === 2) nextPos = node.data.length + delta;
      else return ERRNO_INVAL;
      if (nextPos < 0) return ERRNO_INVAL;
      entry.offset = nextPos;
      getView().setBigUint64(newOffsetPtr, BigInt(nextPos), true);
      return ERRNO_SUCCESS;
    },
    fd_tell: (fd: number, offsetPtr: number) => {
      const entry = fdTable.get(fd);
      if (!entry || entry.kind !== 'file') return ERRNO_BADF;
      getView().setBigUint64(offsetPtr, BigInt(entry.offset), true);
      return ERRNO_SUCCESS;
    },
    fd_read: (fd: number, iovsPtr: number, iovsLen: number, nreadPtr: number) => {
      const entry = fdTable.get(fd);
      if (!entry) return ERRNO_BADF;
      const view = getView();
      const u8 = getU8();

      if (entry.kind === 'stdin') {
        let totalRead = 0;
        let requestedBytes = 0;
        for (let i = 0; i < iovsLen; i++) {
          requestedBytes += view.getUint32(iovsPtr + i * 8 + 4, true);
        }
        if (requestedBytes === 0) {
          view.setUint32(nreadPtr, 0, true);
          return ERRNO_SUCCESS;
        }
        if (stdinPos >= stdinBytes.length) {
          if (interactive) {
            throw new WasiWaitInputError();
          }
          view.setUint32(nreadPtr, 0, true);
          return ERRNO_SUCCESS;
        }

        for (let i = 0; i < iovsLen && stdinPos < stdinBytes.length; i++) {
          const ptr = view.getUint32(iovsPtr + i * 8, true);
          const len = view.getUint32(iovsPtr + i * 8 + 4, true);
          const take = Math.min(len, stdinBytes.length - stdinPos);
          if (take > 0) {
            u8.set(stdinBytes.subarray(stdinPos, stdinPos + take), ptr);
            stdinPos += take;
            totalRead += take;
          }
        }
        view.setUint32(nreadPtr, totalRead, true);
        return ERRNO_SUCCESS;
      }

      if (entry.kind === 'file') {
        const node = vfs.get(entry.path);
        if (!node) return ERRNO_NOENT;
        let totalRead = 0;
        for (let i = 0; i < iovsLen && entry.offset < node.data.length; i++) {
          const ptr = view.getUint32(iovsPtr + i * 8, true);
          const len = view.getUint32(iovsPtr + i * 8 + 4, true);
          const take = Math.min(len, node.data.length - entry.offset);
          if (take > 0) {
            u8.set(node.data.subarray(entry.offset, entry.offset + take), ptr);
            entry.offset += take;
            totalRead += take;
          }
        }
        view.setUint32(nreadPtr, totalRead, true);
        return ERRNO_SUCCESS;
      }

      return ERRNO_BADF;
    },
    fd_pread: (fd: number, iovsPtr: number, iovsLen: number, offsetBig: bigint, nreadPtr: number) => {
      const entry = fdTable.get(fd);
      if (!entry || entry.kind !== 'file') return ERRNO_BADF;
      const node = vfs.get(entry.path);
      if (!node) return ERRNO_NOENT;
      const view = getView();
      const u8 = getU8();
      let pos = Math.max(0, Number(offsetBig));
      let totalRead = 0;
      for (let i = 0; i < iovsLen && pos < node.data.length; i++) {
        const ptr = view.getUint32(iovsPtr + i * 8, true);
        const len = view.getUint32(iovsPtr + i * 8 + 4, true);
        const take = Math.min(len, node.data.length - pos);
        if (take > 0) {
          u8.set(node.data.subarray(pos, pos + take), ptr);
          pos += take;
          totalRead += take;
        }
      }
      view.setUint32(nreadPtr, totalRead, true);
      return ERRNO_SUCCESS;
    },
    fd_write: (fd: number, iovsPtr: number, iovsLen: number, nwrittenPtr: number) => {
      const entry = fdTable.get(fd);
      if (!entry) return ERRNO_BADF;
      const view = getView();
      const u8 = getU8();
      let totalWritten = 0;

      if (entry.kind === 'stdout' || entry.kind === 'stderr') {
        const target = entry.kind === 'stdout' ? stdoutChunks : stderrChunks;
        for (let i = 0; i < iovsLen; i++) {
          const ptr = view.getUint32(iovsPtr + i * 8, true);
          const len = view.getUint32(iovsPtr + i * 8 + 4, true);
          if (len > 0) {
            target.push(u8.slice(ptr, ptr + len));
            totalWritten += len;
          }
        }
        view.setUint32(nwrittenPtr, totalWritten, true);
        return ERRNO_SUCCESS;
      }

      if (entry.kind === 'file') {
        let node = vfs.get(entry.path);
        if (!node) {
          node = { data: new Uint8Array(0), ino: nextIno++, mtimeNs: nowNs() };
          vfs.set(entry.path, node);
        }
        for (let i = 0; i < iovsLen; i++) {
          const ptr = view.getUint32(iovsPtr + i * 8, true);
          const len = view.getUint32(iovsPtr + i * 8 + 4, true);
          if (len === 0) continue;
          const writePos = entry.append ? node.data.length : entry.offset;
          const endPos = writePos + len;
          if (endPos > node.data.length) {
            const grown = new Uint8Array(endPos);
            grown.set(node.data);
            node.data = grown;
          }
          node.data.set(u8.subarray(ptr, ptr + len), writePos);
          entry.offset = endPos;
          node.mtimeNs = nowNs();
          totalWritten += len;
        }
        view.setUint32(nwrittenPtr, totalWritten, true);
        return ERRNO_SUCCESS;
      }

      return ERRNO_BADF;
    },
    fd_pwrite: (
      fd: number,
      iovsPtr: number,
      iovsLen: number,
      offsetBig: bigint,
      nwrittenPtr: number
    ) => {
      const entry = fdTable.get(fd);
      if (!entry || entry.kind !== 'file') return ERRNO_BADF;
      const node = vfs.get(entry.path);
      if (!node) return ERRNO_NOENT;
      const view = getView();
      const u8 = getU8();
      let pos = Math.max(0, Number(offsetBig));
      let totalWritten = 0;
      for (let i = 0; i < iovsLen; i++) {
        const ptr = view.getUint32(iovsPtr + i * 8, true);
        const len = view.getUint32(iovsPtr + i * 8 + 4, true);
        if (len === 0) continue;
        const endPos = pos + len;
        if (endPos > node.data.length) {
          const grown = new Uint8Array(endPos);
          grown.set(node.data);
          node.data = grown;
        }
        node.data.set(u8.subarray(ptr, ptr + len), pos);
        pos = endPos;
        node.mtimeNs = nowNs();
        totalWritten += len;
      }
      view.setUint32(nwrittenPtr, totalWritten, true);
      return ERRNO_SUCCESS;
    },
    fd_readdir: (
      fd: number,
      bufPtr: number,
      bufLen: number,
      cookieBig: bigint,
      bufUsedPtr: number
    ) => {
      const entry = fdTable.get(fd);
      if (!entry || entry.kind !== 'dir') return ERRNO_BADF;
      const names = Array.from(vfs.keys());
      const startIndex = Number(cookieBig);
      const view = getView();
      const u8 = getU8();
      let used = 0;

      for (let i = startIndex; i < names.length; i++) {
        const nameBytes = textEncoder.encode(names[i]);
        const recSize = 24 + nameBytes.length;
        if (used + 24 > bufLen) break;
        const node = vfs.get(names[i])!;
        view.setBigUint64(bufPtr + used, BigInt(i + 1), true);
        view.setBigUint64(bufPtr + used + 8, BigInt(node.ino), true);
        view.setUint32(bufPtr + used + 16, nameBytes.length, true);
        view.setUint8(bufPtr + used + 20, FILETYPE_REGULAR_FILE);
        used += 24;
        const copyLen = Math.min(nameBytes.length, bufLen - used);
        u8.set(nameBytes.subarray(0, copyLen), bufPtr + used);
        used += copyLen;
        if (used + recSize > bufLen && copyLen < nameBytes.length) break;
      }

      view.setUint32(bufUsedPtr, used, true);
      return ERRNO_SUCCESS;
    },
    path_open: (
      dirfd: number,
      _dirflags: number,
      pathPtr: number,
      pathLen: number,
      oflags: number,
      _rightsBase: bigint,
      _rightsInheriting: bigint,
      fdflags: number,
      openedFdPtr: number
    ) => {
      const dirEntry = fdTable.get(dirfd);
      if (!dirEntry || dirEntry.kind !== 'dir') return ERRNO_BADF;
      const rel = normalizeVfsPath(readString(pathPtr, pathLen));
      if (!rel || rel === '.') {
        if ((oflags & OFLAGS_DIRECTORY) !== 0 || rel === '') {
          const fd = nextFd++;
          fdTable.set(fd, { kind: 'dir', path: '.', offset: 0, append: false });
          getView().setUint32(openedFdPtr, fd, true);
          return ERRNO_SUCCESS;
        }
        return ERRNO_ISDIR;
      }

      if ((oflags & OFLAGS_DIRECTORY) !== 0) {
        return ERRNO_NOTDIR;
      }

      let node = vfs.get(rel);
      if (node) {
        if ((oflags & OFLAGS_CREAT) !== 0 && (oflags & OFLAGS_EXCL) !== 0) {
          return ERRNO_EXIST;
        }
        if ((oflags & OFLAGS_TRUNC) !== 0) {
          node.data = new Uint8Array(0);
          node.mtimeNs = nowNs();
        }
      } else {
        if ((oflags & OFLAGS_CREAT) === 0) {
          return ERRNO_NOENT;
        }
        node = { data: new Uint8Array(0), ino: nextIno++, mtimeNs: nowNs() };
        vfs.set(rel, node);
      }

      const fd = nextFd++;
      const append = (fdflags & FDFLAGS_APPEND) !== 0;
      fdTable.set(fd, {
        kind: 'file',
        path: rel,
        offset: append ? node.data.length : 0,
        append
      });
      getView().setUint32(openedFdPtr, fd, true);
      return ERRNO_SUCCESS;
    },
    path_filestat_get: (
      dirfd: number,
      _flags: number,
      pathPtr: number,
      pathLen: number,
      bufPtr: number
    ) => {
      const dirEntry = fdTable.get(dirfd);
      if (!dirEntry || dirEntry.kind !== 'dir') return ERRNO_BADF;
      const rel = normalizeVfsPath(readString(pathPtr, pathLen));
      if (!rel || rel === '.') {
        writeFilestat(bufPtr, 1, FILETYPE_DIRECTORY, 0, nowNs());
        return ERRNO_SUCCESS;
      }
      const node = vfs.get(rel);
      if (!node) return ERRNO_NOENT;
      writeFilestat(bufPtr, node.ino, FILETYPE_REGULAR_FILE, node.data.length, node.mtimeNs);
      return ERRNO_SUCCESS;
    },
    path_unlink_file: (dirfd: number, pathPtr: number, pathLen: number) => {
      const dirEntry = fdTable.get(dirfd);
      if (!dirEntry || dirEntry.kind !== 'dir') return ERRNO_BADF;
      const rel = normalizeVfsPath(readString(pathPtr, pathLen));
      if (!vfs.has(rel)) return ERRNO_NOENT;
      vfs.delete(rel);
      return ERRNO_SUCCESS;
    },
    path_rename: (
      oldFd: number,
      oldPathPtr: number,
      oldPathLen: number,
      newFd: number,
      newPathPtr: number,
      newPathLen: number
    ) => {
      if (!fdTable.has(oldFd) || !fdTable.has(newFd)) return ERRNO_BADF;
      const oldRel = normalizeVfsPath(readString(oldPathPtr, oldPathLen));
      const newRel = normalizeVfsPath(readString(newPathPtr, newPathLen));
      const node = vfs.get(oldRel);
      if (!node) return ERRNO_NOENT;
      vfs.delete(oldRel);
      vfs.set(newRel, node);
      return ERRNO_SUCCESS;
    },
    path_create_directory: () => ERRNO_SUCCESS,
    path_remove_directory: () => ERRNO_SUCCESS,
    path_filestat_set_times: () => ERRNO_SUCCESS,
    path_link: () => ERRNO_NOSYS,
    path_readlink: () => ERRNO_NOSYS,
    path_symlink: () => ERRNO_NOSYS,
    poll_oneoff: (
      inPtr: number,
      outPtr: number,
      nsubscriptions: number,
      neventsPtr: number
    ) => {
      const view = getView();
      for (let i = 0; i < nsubscriptions; i++) {
        const subOff = inPtr + i * 48;
        const evOff = outPtr + i * 32;
        const userdata = view.getBigUint64(subOff, true);
        const tag = view.getUint8(subOff + 8);
        view.setBigUint64(evOff, userdata, true);
        view.setUint16(evOff + 8, ERRNO_SUCCESS, true);
        view.setUint8(evOff + 10, tag);
        view.setBigUint64(evOff + 16, tag === 1 ? BigInt(Math.max(0, stdinBytes.length - stdinPos)) : 0n, true);
        view.setUint16(evOff + 24, 0, true);
      }
      view.setUint32(neventsPtr, nsubscriptions, true);
      return ERRNO_SUCCESS;
    },
    sock_recv: () => ERRNO_NOSYS,
    sock_send: () => ERRNO_NOSYS,
    sock_shutdown: () => ERRNO_NOSYS,
    sock_accept: () => ERRNO_NOSYS
  };

  const instance = await WebAssembly.instantiate(wasmModule, {
    wasi_snapshot_preview1: wasiImports
  });

  wasmMemory = instance.exports.memory as WebAssembly.Memory;
  const startFn = instance.exports._start as (() => void) | undefined;
  if (typeof startFn !== 'function') {
    throw new Error('Tệp WebAssembly biên dịch không chứa điểm khởi chạy _start.');
  }

  let exitCode = 0;
  let waitingForInput = false;

  try {
    startFn();
  } catch (err) {
    if (err instanceof WasiWaitInputError) {
      exitCode = 88;
      waitingForInput = true;
    } else if (err instanceof WasiExitError) {
      exitCode = err.code;
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      stderrChunks.push(textEncoder.encode(`\n[WASM Runtime Error] ${msg}\n`));
      exitCode = 1;
    }
  }

  const concatBytes = (chunks: Uint8Array[]): string => {
    const total = chunks.reduce((s, c) => s + c.length, 0);
    if (total === 0) return '';
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    return textDecoder.decode(merged);
  };

  const syncedFiles: WorkspaceDataFile[] = [];
  if (syncFiles && !waitingForInput) {
    for (const [name, node] of vfs.entries()) {
      if (!name || name.startsWith('.') || name.includes('/')) continue;
      if (/\.(c|cpp|cc|cxx|h|hpp|hh|o|s|wasm)$/i.test(name)) continue;
      if (node.data.length > 131072) continue;
      const decoded = textDecoder.decode(node.data);
      if (initialSnapshots.has(name) && initialSnapshots.get(name) === decoded) {
        continue;
      }
      syncedFiles.push({ name, content: decoded });
    }
  }

  return {
    stdout: concatBytes(stdoutChunks),
    stderr: concatBytes(stderrChunks),
    exitCode,
    waitingForInput,
    syncedFiles
  };
}

/* ==================== MESSAGE HANDLER ==================== */

workerCtx.onmessage = async (event: MessageEvent<WorkerPayload>) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === 'preload') {
    try {
      const runClang = await ensureClangCompiler();
      let lastPct = -1;
      await runClang(['clang++', '--version'], {}, {
        stdout: () => {},
        stderr: () => {},
        fetchProgress: (p) => {
          if (p.totalLength && p.totalLength > 0 && typeof p.doneLength === 'number') {
            const pct = Math.min(100, Math.round((p.doneLength / p.totalLength) * 100));
            if (pct !== lastPct && (pct === 100 || pct - lastPct >= 8)) {
              lastPct = pct;
              workerCtx.postMessage({ type: 'preload-progress', percent: pct });
            }
          }
        }
      });
      workerCtx.postMessage({ type: 'preload-done', ok: true });
    } catch (err) {
      workerCtx.postMessage({
        type: 'preload-done',
        ok: false,
        error: err instanceof Error ? err.message : 'Không thể tải Clang WASM'
      });
    }
    return;
  }

  if (msg.type !== 'run') return;
  const startTime = performance.now();

  try {
    const runClang = await ensureClangCompiler();
    const isC = Boolean(msg.isC);
    const interactive = Boolean(msg.interactive);
    const syncFiles = Boolean(msg.syncFiles);
    const stdFlag = normalizeClangStdFlag(isC, msg.stdFlag);
    const entryName = msg.fileName || (isC ? 'main.c' : 'main.cpp');
    const extraFiles = msg.extraFiles || [];
    const extraSourceNames = msg.extraSourceNames || [];

    const compileKey = JSON.stringify({
      isC,
      stdFlag,
      interactive,
      entryName,
      code: msg.code,
      extraFiles
    });

    let wasmModule = lastCompiledKey === compileKey ? lastCompiledModule : null;
    let compileStderr = lastCompiledKey === compileKey ? lastCompileWarnings : '';

    if (!wasmModule) {
      const filesIn: YoWaspTree = {
        [entryName]: wrapUnbufferedStdoutShim(msg.code, isC, interactive),
        bits: {
          'stdc++.h': BITS_STDCPP_HEADER
        }
      };

      for (const ef of extraFiles) {
        filesIn[ef.file] = ef.code;
      }

      const clangArgs = [
        isC ? 'clang' : 'clang++',
        stdFlag,
        '-O1',
        '-Wall',
        '-I.',
        '-fno-color-diagnostics',
        entryName,
        ...extraSourceNames,
        '-o',
        'program.wasm'
      ];

      const stderrParts: Uint8Array[] = [];
      let lastPct = -1;

      try {
        const filesOut = await runClang(clangArgs, filesIn, {
          stdout: () => {},
          stderr: (bytes) => {
            if (bytes && bytes.length > 0) stderrParts.push(bytes.slice());
          },
          fetchProgress: (p) => {
            if (p.totalLength && p.totalLength > 0 && typeof p.doneLength === 'number') {
              const pct = Math.min(100, Math.round((p.doneLength / p.totalLength) * 100));
              if (pct !== lastPct && (pct === 100 || pct - lastPct >= 15)) {
                lastPct = pct;
                workerCtx.postMessage({
                  type: 'status',
                  text: `> Đang tải bộ biên dịch Offline LLVM Clang (${pct}%)...\n`
                });
              }
            }
          }
        });

        const totalErrLen = stderrParts.reduce((s, b) => s + b.length, 0);
        if (totalErrLen > 0) {
          const mergedErr = new Uint8Array(totalErrLen);
          let off = 0;
          for (const b of stderrParts) {
            mergedErr.set(b, off);
            off += b.length;
          }
          compileStderr = textDecoder.decode(mergedErr).trim();
        }

        const compiledBytes = filesOut?.['program.wasm'];
        if (!(compiledBytes instanceof Uint8Array) || compiledBytes.length === 0) {
          throw new Error(compileStderr || 'Biên dịch Clang WASM không tạo ra tệp thực thi.');
        }

        wasmModule = await WebAssembly.compile(new Uint8Array(compiledBytes));
        lastCompiledKey = compileKey;
        lastCompiledModule = wasmModule;
        lastCompileWarnings = compileStderr;
      } catch (compileErr: unknown) {
        const totalErrLen = stderrParts.reduce((s, b) => s + b.length, 0);
        let errText = '';
        if (totalErrLen > 0) {
          const mergedErr = new Uint8Array(totalErrLen);
          let off = 0;
          for (const b of stderrParts) {
            mergedErr.set(b, off);
            off += b.length;
          }
          errText = textDecoder.decode(mergedErr).trim();
        }
        const finalErr =
          errText ||
          (compileErr instanceof Error ? compileErr.message : 'Lỗi biên dịch C/C++ Offline');
        workerCtx.postMessage({ type: 'stderr', text: `${finalErr}\n` });
        workerCtx.postMessage({
          type: 'done',
          exitCode:
            typeof (compileErr as { code?: number })?.code === 'number'
              ? (compileErr as { code: number }).code || 1
              : 1,
          elapsedMs: Math.round(performance.now() - startTime),
          waitingForInput: false,
          syncedFiles: []
        });
        return;
      }
    }

    const runRes = await runWasiProgram(
      wasmModule,
      msg.stdin || '',
      interactive,
      syncFiles,
      msg.workspaceFiles || []
    );

    const elapsedMs = Math.round(performance.now() - startTime);
    if (runRes.stdout) {
      workerCtx.postMessage({ type: 'stdout', text: runRes.stdout });
    }
    const allErr = [msg.suppressWarnings ? '' : compileStderr, runRes.stderr.trim()]
      .filter(Boolean)
      .join('\n');
    if (allErr) {
      workerCtx.postMessage({ type: 'stderr', text: `${allErr}\n` });
    }

    workerCtx.postMessage({
      type: 'done',
      exitCode: runRes.exitCode,
      elapsedMs,
      waitingForInput: runRes.waitingForInput,
      syncedFiles: runRes.syncedFiles
    });
  } catch (err: unknown) {
    const elapsedMs = Math.round(performance.now() - startTime);
    const message = err instanceof Error ? err.message : 'Lỗi trình biên dịch Offline Clang WASM';
    workerCtx.postMessage({ type: 'stderr', text: `${message}\n` });
    workerCtx.postMessage({ type: 'done', exitCode: 1, elapsedMs, waitingForInput: false, syncedFiles: [] });
  }
};
