// client/src/workers/pyodideWorker.ts

interface WorkspaceDataFile {
  name: string;
  content: string;
}

interface RunPayload {
  type: 'run';
  code: string;
  stdin: string;
  interactive?: boolean;
  workspaceFiles?: WorkspaceDataFile[];
  syncFiles?: boolean;
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
    pyodide.globals.set('__INTERACTIVE_MODE__', Boolean(msg.interactive));
    pyodide.globals.set('__SYNC_FILES__', Boolean(msg.syncFiles));
    pyodide.globals.set('__WORKSPACE_FILES_JSON__', JSON.stringify(msg.workspaceFiles || []));

    const runnerScript = `
import sys
import io
import os
import json
import builtins
import traceback

class _WaitForInput(BaseException):
    pass

class _InteractiveStdin:
    def __init__(self, data):
        self._buf = data
        self._pos = 0
    def readline(self, size=-1):
        if self._pos >= len(self._buf):
            raise _WaitForInput()
        nl = self._buf.find('\\n', self._pos)
        end = len(self._buf) if nl == -1 else nl + 1
        if size is not None and size >= 0:
            end = min(end, self._pos + size)
        chunk = self._buf[self._pos:end]
        self._pos = end
        return chunk
    def read(self, size=-1):
        if self._pos >= len(self._buf):
            raise _WaitForInput()
        if size is None or size < 0:
            chunk = self._buf[self._pos:]
            self._pos = len(self._buf)
            return chunk
        chunk = self._buf[self._pos:self._pos + size]
        self._pos += len(chunk)
        return chunk
    def __iter__(self):
        return self
    def __next__(self):
        line = self.readline()
        if not line:
            raise StopIteration
        return line

_mounted_map = {}
_pre_files = set()
if __SYNC_FILES__:
    try:
        for _entry in os.listdir('.'):
            if os.path.isfile(_entry):
                _pre_files.add(_entry)
        for _wf in json.loads(__WORKSPACE_FILES_JSON__):
            _wname = os.path.basename(_wf.get('name', ''))
            _wcontent = _wf.get('content', '')
            if _wname and '/' not in _wname:
                with open(_wname, 'w', encoding='utf-8') as _f:
                    _f.write(_wcontent)
                _mounted_map[_wname] = _wcontent
    except Exception:
        pass

_old_stdin = sys.stdin
_old_stdout = sys.stdout
_old_stderr = sys.stderr
_old_input = builtins.input

_out_buf = io.StringIO()
_err_buf = io.StringIO()
sys.stdout = _out_buf
sys.stderr = _err_buf

if __INTERACTIVE_MODE__:
    sys.stdin = _InteractiveStdin(__USER_STDIN__)
    def _interactive_input(prompt=''):
        if prompt:
            sys.stdout.write(str(prompt))
            sys.stdout.flush()
        line = sys.stdin.readline()
        if line.endswith('\\n'):
            line = line[:-1]
        return line
    builtins.input = _interactive_input
else:
    sys.stdin = io.StringIO(__USER_STDIN__)

_exit_code = 0
_waiting_input = False
_isolated_globals = {"__name__": "__main__"}

try:
    exec(compile(__USER_CODE__, "main.py", "exec"), _isolated_globals)
except _WaitForInput:
    _exit_code = 88
    _waiting_input = True
except SystemExit as e:
    _exit_code = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
except Exception:
    traceback.print_exc(file=_err_buf)
    _exit_code = 1
finally:
    sys.stdin = _old_stdin
    sys.stdout = _old_stdout
    sys.stderr = _old_stderr
    builtins.input = _old_input

_synced_out = []
if __SYNC_FILES__ and not _waiting_input:
    try:
        for _entry in os.listdir('.'):
            if _entry.startswith('.') or not os.path.isfile(_entry):
                continue
            if _entry in _pre_files and _entry not in _mounted_map:
                continue
            if _entry.endswith(('.py', '.pyc', '.so', '.wasm')):
                continue
            if os.path.getsize(_entry) > 131072:
                continue
            try:
                with open(_entry, 'r', encoding='utf-8', errors='replace') as _rf:
                    _txt = _rf.read()
                if _entry in _mounted_map and _mounted_map[_entry] == _txt:
                    continue
                _synced_out.append({'name': _entry, 'content': _txt})
            except Exception:
                pass
    except Exception:
        pass

(_out_buf.getvalue(), _err_buf.getvalue(), _exit_code, _waiting_input, json.dumps(_synced_out))
`;

    try {
      const resultProxy = await pyodide.runPythonAsync(runnerScript);
      const [stdout, stderr, exitCode, waitingForInput, syncedJson] = resultProxy.toJs() as [
        string,
        string,
        number,
        boolean,
        string
      ];
      resultProxy.destroy();

      let syncedFiles: WorkspaceDataFile[] = [];
      try {
        const parsed = JSON.parse(syncedJson || '[]');
        if (Array.isArray(parsed)) syncedFiles = parsed;
      } catch {
        // ignore
      }

      const elapsedMs = Math.round(performance.now() - startTime);
      if (stdout) workerCtx.postMessage({ type: 'stdout', text: stdout });
      if (stderr) workerCtx.postMessage({ type: 'stderr', text: stderr });

      workerCtx.postMessage({
        type: 'done',
        exitCode: Number(exitCode) || 0,
        elapsedMs,
        waitingForInput: Boolean(waitingForInput),
        syncedFiles
      });
    } finally {
      pyodide.globals.delete('__USER_CODE__');
      pyodide.globals.delete('__USER_STDIN__');
      pyodide.globals.delete('__INTERACTIVE_MODE__');
      pyodide.globals.delete('__SYNC_FILES__');
      pyodide.globals.delete('__WORKSPACE_FILES_JSON__');
    }
  } catch (err: unknown) {
    const elapsedMs = Math.round(performance.now() - startTime);
    const message = err instanceof Error ? err.message : 'Lỗi thực thi Python Worker';
    workerCtx.postMessage({ type: 'stderr', text: `${message}\n` });
    workerCtx.postMessage({ type: 'done', exitCode: 1, elapsedMs });
  }
};