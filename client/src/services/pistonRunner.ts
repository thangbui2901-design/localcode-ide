// client/src/services/pistonRunner.ts
import { CompilerSettings, WorkspaceFile } from '../types/ide';

export interface PistonLogCallback {
  onChunk: (type: 'stdout' | 'stderr' | 'status', text: string) => void;
  onFinish?: (code: number, elapsedMs: number) => void;
}

interface WandboxExtraFile {
  file: string;
  code: string;
}

const WANDBOX_COMPILE_URL = 'https://wandbox.org/api/compile.json';
const ANSI_REGEX = new RegExp('\\x1b\\[[0-9;]*[a-zA-Z]', 'g');

let persistentPythonWorker: Worker | null = null;
let activePythonKill: (() => void) | null = null;
let activeCppAbort: AbortController | null = null;

function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}

/**
 * Dừng khẩn cấp tiến trình Python Worker (vòng lặp vô hạn) hoặc hủy request C/C++
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

  if (activeCppAbort) {
    activeCppAbort.abort();
    activeCppAbort = null;
  }
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
  callbacks: PistonLogCallback
): Promise<{ exitCode: number; elapsedMs: number }> {
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
          elapsedMs: Number(msg.elapsedMs) || Math.round(performance.now() - startTime)
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

    worker.postMessage({ type: 'run', code, stdin });
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
): { entryCode: string; extraFiles: WandboxExtraFile[]; extraSourceNames: string[] } {
  const getDir = (filePath: string) =>
    filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';

  const activeDir = getDir(activeFile.path);
  const validExt = isC ? /\.(c|h)$/i : /\.(cpp|cc|cxx|hpp|hh|h)$/i;
  const sourceExt = isC ? /\.c$/i : /\.(cpp|cc|cxx)$/i;

  const siblingFiles = (latestFiles || []).filter(
    (f) => getDir(f.path) === activeDir && validExt.test(f.name)
  );

  if (siblingFiles.length <= 1) {
    return { entryCode: activeFile.content, extraFiles: [], extraSourceNames: [] };
  }

  const hasMain = (content: string) => /\bint\s+main\s*\(/.test(content);
  const entryFile =
    (hasMain(activeFile.content) ? activeFile : siblingFiles.find((f) => hasMain(f.content))) ||
    activeFile;

  const extraFiles: WandboxExtraFile[] = [];
  const extraSourceNames: string[] = [];

  for (const file of siblingFiles) {
    if (file.path === entryFile.path) continue;
    extraFiles.push({ file: file.name, code: file.content });
    if (sourceExt.test(file.name)) {
      extraSourceNames.push(file.name);
    }
  }

  return { entryCode: entryFile.content, extraFiles, extraSourceNames };
}

async function runWithGodbolt(
  activeFile: WorkspaceFile,
  latestFiles: WorkspaceFile[],
  compilerSettings: CompilerSettings,
  stdin: string,
  signal: AbortSignal,
  callbacks: PistonLogCallback
): Promise<{ exitCode: number; elapsedMs: number }> {
  const startTime = performance.now();
  const isC = activeFile.language === 'c';
  const compilerId = isC ? 'cg142' : 'g142';
  const stdFlag = resolveStdFlag(isC, compilerSettings);
  const { entryCode, extraFiles } = prepareCppProjectFiles(activeFile, latestFiles, isC);

  let combinedSource = entryCode;
  if (extraFiles.length > 0) {
    const fileMap = new Map(extraFiles.map((f) => [f.file, f.code]));
    combinedSource = combinedSource.replace(
      /^\s*#include\s+"([^"]+)"\s*$/gm,
      (match, incName: string) => {
        const headerContent = fileMap.get(incName);
        if (headerContent !== undefined) {
          fileMap.delete(incName);
          return `// --- ${incName} ---\n${headerContent}`;
        }
        return match;
      }
    );

    const remainingSources = Array.from(fileMap.entries())
      .map(([name, code]) => `// --- ${name} ---\n${code}`)
      .join('\n\n');

    if (remainingSources) {
      combinedSource = `${remainingSources}\n\n${combinedSource}`;
    }
  }

  const response = await fetch(`https://godbolt.org/api/compiler/${compilerId}/compile`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      source: combinedSource,
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
  const stderr = extractLines(data.stderr).trim();
  const exitCode: number = typeof data.code === 'number' ? data.code : buildCode;

  if (buildCode !== 0 && buildStderr) {
    callbacks.onChunk('stderr', `${buildStderr}\n`);
    return { exitCode: buildCode, elapsedMs };
  }

  if (stdout) callbacks.onChunk('stdout', `${stdout}\n`);
  const allErr = [buildStderr, stderr].filter(Boolean).join('\n');
  if (allErr) callbacks.onChunk('stderr', `${allErr}\n`);

  return { exitCode, elapsedMs };
}

async function runWithWandboxFallback(
  activeFile: WorkspaceFile,
  latestFiles: WorkspaceFile[],
  compilerSettings: CompilerSettings,
  stdin: string,
  signal: AbortSignal,
  callbacks: PistonLogCallback
): Promise<{ exitCode: number; elapsedMs: number }> {
  const startTime = performance.now();
  const isC = activeFile.language === 'c';
  const stdFlag = resolveStdFlag(isC, compilerSettings);
  const { entryCode, extraFiles, extraSourceNames } = prepareCppProjectFiles(
    activeFile,
    latestFiles,
    isC
  );

  const payload: Record<string, unknown> = {
    compiler: isC ? 'gcc-13.2.0-c' : 'gcc-13.2.0',
    code: entryCode,
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
  const programError = stripAnsi(data.program_error || '');
  const exitCode =
    data.status !== undefined && !Number.isNaN(parseInt(String(data.status), 10))
      ? parseInt(String(data.status), 10)
      : 1;

  if (compileError && exitCode !== 0 && !programOutput && !programError) {
    callbacks.onChunk('stderr', `${compileError.trim()}\n`);
    return { exitCode, elapsedMs };
  }

  if (programOutput) callbacks.onChunk('stdout', programOutput);
  const combinedStderr = [compileError.trim(), programError.trim()].filter(Boolean).join('\n');
  if (combinedStderr) callbacks.onChunk('stderr', `${combinedStderr}\n`);

  return { exitCode, elapsedMs };
}

export async function executeWithPiston(
  activeFile: WorkspaceFile,
  latestFiles: WorkspaceFile[],
  compilerSettings: CompilerSettings,
  stdinPreset: string,
  callbacks: PistonLogCallback
): Promise<void> {
  const startAll = performance.now();
  const lang = activeFile.language;

  const cmdLabel =
    lang === 'python'
      ? `[Pyodide Worker] python3 ${activeFile.name}`
      : lang === 'c'
        ? `[GCC 14.2] gcc ${activeFile.name} -o main && ./main`
        : `[G++ 14.2] g++ ${activeFile.name} -o main && ./main`;

  callbacks.onChunk('status', `> ${cmdLabel}\n`);

  try {
    let result: { exitCode: number; elapsedMs: number };

    if (lang === 'python') {
      result = await runPythonInWorker(activeFile.content, stdinPreset || '', callbacks);
    } else if (lang === 'cpp' || lang === 'c') {
      const abortController = new AbortController();
      activeCppAbort = abortController;

      try {
        result = await runWithGodbolt(
          activeFile,
          latestFiles,
          compilerSettings,
          stdinPreset || '',
          abortController.signal,
          callbacks
        );
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          callbacks.onChunk('stderr', '\n[Đã hủy yêu cầu biên dịch C/C++]\n');
          result = { exitCode: 130, elapsedMs: Math.round(performance.now() - startAll) };
        } else {
          result = await runWithWandboxFallback(
            activeFile,
            latestFiles,
            compilerSettings,
            stdinPreset || '',
            abortController.signal,
            callbacks
          );
        }
      } finally {
        activeCppAbort = null;
      }
    } else {
      throw new Error(`Ngôn ngữ "${lang}" chưa được hỗ trợ thực thi.`);
    }

    callbacks.onFinish?.(result.exitCode, result.elapsedMs);
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const message = isAbort
      ? 'Đã dừng tiến trình theo yêu cầu.'
      : err instanceof Error
        ? err.message
        : 'Lỗi kết nối không xác định';
    callbacks.onChunk('stderr', `${message}\n`);
    callbacks.onFinish?.(-1, Math.round(performance.now() - startAll));
  }
}