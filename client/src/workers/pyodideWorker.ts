// client/src/workers/pyodideWorker.ts

interface RunPayload {
  type: 'run';
  code: string;
  stdin: string;
}

const PYODIDE_VERSION = '0.26.4';
const PYODIDE_CDN_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const workerCtx = self as unknown as {
  onmessage: ((event: MessageEvent<RunPayload>) => void) | null;
  postMessage: (message: unknown) => void;
};

let pyodideInstance: any = null;
let loadingPromise: Promise<any> | null = null;

async function ensurePyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    workerCtx.postMessage({
      type: 'status',
      text: '> Đang khởi tạo Python WebAssembly Worker (chỉ mất ~3s cho lần đầu)...\n'
    });

    const mod = await import(/* @vite-ignore */ `${PYODIDE_CDN_BASE}pyodide.mjs`);
    const instance = await mod.loadPyodide({ indexURL: PYODIDE_CDN_BASE });
    pyodideInstance = instance;
    return instance;
  })();

  try {
    return await loadingPromise;
  } catch (err) {
    loadingPromise = null;
    throw err;
  }
}

workerCtx.onmessage = async (event: MessageEvent<RunPayload>) => {
  const msg = event.data;
  if (!msg || msg.type !== 'run') return;

  const startTime = performance.now();

  try {
    const pyodide = await ensurePyodide();

    try {
      await pyodide.loadPackagesFromImports(msg.code, {
        messageCallback: (log: string) => {
          if (log.toLowerCase().includes('loading')) {
            workerCtx.postMessage({
              type: 'status',
              text: `> Đang nạp thư viện: ${log}...\n`
            });
          }
        }
      });
    } catch {
      // Bỏ qua nếu là module nội bộ; Python sẽ báo ImportError chuẩn nếu thực sự thiếu
    }

    pyodide.globals.set('__USER_CODE__', msg.code);
    pyodide.globals.set('__USER_STDIN__', msg.stdin ?? '');

    const runnerScript = `
import sys
import io
import traceback

_old_stdin = sys.stdin
_old_stdout = sys.stdout
_old_stderr = sys.stderr

sys.stdin = io.StringIO(__USER_STDIN__)
_out_buf = io.StringIO()
_err_buf = io.StringIO()
sys.stdout = _out_buf
sys.stderr = _err_buf

_exit_code = 0
_isolated_globals = {"__name__": "__main__"}

try:
    exec(compile(__USER_CODE__, "main.py", "exec"), _isolated_globals)
except SystemExit as e:
    _exit_code = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
except Exception:
    traceback.print_exc(file=_err_buf)
    _exit_code = 1
finally:
    sys.stdin = _old_stdin
    sys.stdout = _old_stdout
    sys.stderr = _old_stderr

(_out_buf.getvalue(), _err_buf.getvalue(), _exit_code)
`;

    try {
      const resultProxy = await pyodide.runPythonAsync(runnerScript);
      const [stdout, stderr, exitCode] = resultProxy.toJs() as [string, string, number];
      resultProxy.destroy();

      const elapsedMs = Math.round(performance.now() - startTime);
      if (stdout) workerCtx.postMessage({ type: 'stdout', text: stdout });
      if (stderr) workerCtx.postMessage({ type: 'stderr', text: stderr });

      workerCtx.postMessage({
        type: 'done',
        exitCode: Number(exitCode) || 0,
        elapsedMs
      });
    } finally {
      pyodide.globals.delete('__USER_CODE__');
      pyodide.globals.delete('__USER_STDIN__');
    }
  } catch (err: unknown) {
    const elapsedMs = Math.round(performance.now() - startTime);
    const message = err instanceof Error ? err.message : 'Lỗi thực thi Python Worker';
    workerCtx.postMessage({ type: 'stderr', text: `${message}\n` });
    workerCtx.postMessage({ type: 'done', exitCode: 1, elapsedMs });
  }
};