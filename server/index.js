import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, execSync } from 'node:child_process';
import { attachLanguageServer } from './lspBridge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_DIR = path.resolve(__dirname, '../workspace');
const BUILD_DIR = path.join(WORKSPACE_DIR, '.localcode_build');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

function findCompilerPath(binName) {
  try {
    const cmd = process.platform === 'win32' ? `where ${binName}` : `which ${binName}`;
    const found = execSync(cmd, { encoding: 'utf8' }).split(/\r?\n/)[0]?.trim();
    if (found) return found.replace(/\\/g, '/');
  } catch {
    return `C:/msys64/ucrt64/bin/${binName}.exe`;
  }
  return binName;
}

function findPythonRunner() {
  const candidates = [];

  if (process.platform === 'win32') {
    try {
      const out = execSync('where python', { encoding: 'utf8' });
      for (const line of out.split(/\r?\n/)) {
        const p = line.trim();
        if (p && !p.toLowerCase().includes('\\microsoft\\windowsapps\\')) {
          candidates.push({ cmd: p, prefixArgs: [] });
        }
      }
    } catch {}

    try {
      const pyPath = execSync('py -c "import sys; print(sys.executable)"', { encoding: 'utf8' }).trim();
      if (pyPath && !pyPath.toLowerCase().includes('\\microsoft\\windowsapps\\')) {
        candidates.push({ cmd: pyPath, prefixArgs: [] });
      }
    } catch {}

    candidates.push(
      { cmd: 'C:/msys64/ucrt64/bin/python3.exe', prefixArgs: [] },
      { cmd: 'C:/msys64/ucrt64/bin/python.exe', prefixArgs: [] }
    );
  } else {
    candidates.push({ cmd: 'python3', prefixArgs: [] }, { cmd: 'python', prefixArgs: [] });
  }

  for (const c of candidates) {
    try {
      execSync(`"${c.cmd}" --version`, { stdio: 'ignore' });
      return c;
    } catch {}
  }

  return { cmd: process.platform === 'win32' ? 'py' : 'python3', prefixArgs: [] };
}

const GPP_PATH = findCompilerPath('g++');
const GCC_PATH = findCompilerPath('gcc');
const PYTHON_RUNNER = findPythonRunner();

const IGNORED_NAMES = new Set(['compile_flags.txt', 'compile_commands.json', '.localcode_build', '.git', 'node_modules']);

async function scanWorkspaceRecursive(currentDir = WORKSPACE_DIR, relBase = '') {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const tree = [];
  const flatFiles = [];

  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.clang-format' && entry.name !== '.gitignore') continue;
    if (IGNORED_NAMES.has(entry.name)) continue;

    const fullPath = path.join(currentDir, entry.name);
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const sub = await scanWorkspaceRecursive(fullPath, relPath);
      tree.push({
        name: entry.name,
        path: relPath,
        type: 'folder',
        children: sub.tree
      });
      flatFiles.push(...sub.flatFiles);
    } else if (entry.isFile()) {
      const content = await fs.readFile(fullPath, 'utf8');
      const fileObj = {
        name: entry.name,
        path: relPath,
        uri: pathToFileURL(fullPath).href,
        content
      };
      tree.push({
        name: entry.name,
        path: relPath,
        type: 'file',
        file: fileObj
      });
      flatFiles.push(fileObj);
    }
  }

  return { tree, flatFiles };
}

async function syncCompileCommands(cppStandard = 'gnu++17', cStandard = 'c11') {
  const { flatFiles } = await scanWorkspaceRecursive();
  const commands = [];
  const normDir = WORKSPACE_DIR.replace(/\\/g, '/');

  for (const f of flatFiles) {
    const fullPath = `${normDir}/${f.path}`;
    const fileDir = path.posix.dirname(fullPath);

    if (f.name.endsWith('.cpp') || f.name.endsWith('.cc') || f.name.endsWith('.hpp') || f.name.endsWith('.h')) {
      commands.push({
        directory: normDir,
        command: `"${GPP_PATH}" -std=${cppStandard} -I"${fileDir}" -I"${normDir}" -Wall -Wextra "${fullPath}"`,
        file: fullPath
      });
    } else if (f.name.endsWith('.c')) {
      commands.push({
        directory: normDir,
        command: `"${GCC_PATH}" -std=${cStandard} -I"${fileDir}" -I"${normDir}" -Wall -Wextra "${fullPath}"`,
        file: fullPath
      });
    }
  }

  await fs.writeFile(path.join(WORKSPACE_DIR, 'compile_commands.json'), JSON.stringify(commands, null, 2), 'utf8');
}

async function ensureWorkspace() {
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  await fs.mkdir(BUILD_DIR, { recursive: true });
  await fs.mkdir(path.join(WORKSPACE_DIR, 'dsa_sorting'), { recursive: true });
  await fs.mkdir(path.join(WORKSPACE_DIR, 'oop_demo'), { recursive: true });
  await fs.mkdir(path.join(WORKSPACE_DIR, 'searching'), { recursive: true });

  const defaults = {
    'default.cpp': `// Created on LocalCode IDE.

#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    if (cin >> n) {
        vector<int> a(n);
        for (int &x : a) cin >> x;
        sort(a.begin(), a.end());
        for (int x : a) cout << x << ' ';
        cout << '\\n';
    }
    return 0;
}
`,
    'dsa_sorting/two_sum.cpp': `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, target;
    if (!(cin >> n >> target)) return 0;
    unordered_map<int, int> seen;
    for (int i = 0; i < n; i++) {
        int x;
        cin >> x;
        if (seen.count(target - x)) {
            cout << seen[target - x] << ' ' << i << '\\n';
            return 0;
        }
        seen[x] = i;
    }
    cout << "-1\\n";
    return 0;
}
`,
    'oop_demo/Student.h': `#pragma once
#include <string>

class Student {
private:
    std::string id;
    std::string name;
    double gpa;

public:
    Student(std::string id, std::string name, double gpa);
    void display() const;
    double getGpa() const;
};
`,
    'oop_demo/Student.cpp': `#include "Student.h"
#include <iostream>
#include <iomanip>

Student::Student(std::string id, std::string name, double gpa)
    : id(std::move(id)), name(std::move(name)), gpa(gpa) {}

void Student::display() const {
    std::cout << "[" << id << "] " << name
              << " - GPA: " << std::fixed << std::setprecision(2) << gpa << '\\n';
}

double Student::getGpa() const {
    return gpa;
}
`,
    'oop_demo/main.cpp': `#include "Student.h"
#include <vector>
#include <algorithm>

int main() {
    std::vector<Student> list = {
        Student("SV01", "Bui Duc Thang", 3.85),
        Student("SV02", "Nguyen Minh Anh", 3.60),
        Student("SV03", "Tran Hoang Nam", 3.92)
    };

    std::sort(list.begin(), list.end(), [](const Student& a, const Student& b) {
        return a.getGpa() > b.getGpa();
    });

    for (const auto& sv : list) {
        sv.display();
    }
    return 0;
}
`,
    'searching/binary_search.py': `from bisect import bisect_left

arr = [2, 5, 8, 12, 16, 23, 38, 56]
target = 23
idx = bisect_left(arr, target)
print(f"Found {target} at index {idx}")
`,
    'README.md': `# LocalCode IDE – DSA & OOP Workspace\n\n- **DSA**: Dán testcase vào tab **INPUT** rồi nhấn **Run (F5)**.\n- **OOP đa tệp**: Mở bất kỳ tệp nào trong \`oop_demo/\` (\`Student.h\`, \`Student.cpp\`, \`main.cpp\`) và nhấn **Run** để biên dịch liên kết toàn bộ module.\n`
  };

  for (const [relPath, content] of Object.entries(defaults)) {
    const target = path.join(WORKSPACE_DIR, relPath);
    try {
      await fs.access(target);
    } catch {
      await fs.writeFile(target, content, 'utf8');
    }
  }

  await syncCompileCommands();
}

function safeResolve(relPath) {
  const resolved = path.resolve(WORKSPACE_DIR, relPath);
  if (!resolved.startsWith(WORKSPACE_DIR)) {
    throw new Error('Invalid path traversal');
  }
  return resolved;
}

async function resolveCompilationSources(sourcePath, isCpp) {
  const sourceDir = path.dirname(sourcePath);
  const extSet = isCpp ? new Set(['.cpp', '.cc', '.cxx']) : new Set(['.c']);
  const isHeader = sourcePath.endsWith('.h') || sourcePath.endsWith('.hpp');
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  const siblingSources = [];
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (extSet.has(ext)) {
      const full = path.join(sourceDir, ent.name);
      const code = await fs.readFile(full, 'utf8');
      const hasMain = /\bint\s+main\s*\(/.test(code);
      siblingSources.push({ full, name: ent.name, code, hasMain });
    }
  }

  if (isHeader) {
    const targets = siblingSources.map((s) => s.full);
    return { sources: targets.length ? targets : [sourcePath], sourceDir, isMultiFile: targets.length > 1 };
  }

  const mainCount = siblingSources.filter((s) => s.hasMain).length;
  if (sourceDir !== WORKSPACE_DIR && siblingSources.length > 1 && mainCount <= 1) {
    return {
      sources: siblingSources.map((s) => s.full),
      sourceDir,
      isMultiFile: true
    };
  }

  const currentObj = siblingSources.find((s) => s.full === sourcePath);
  if (currentObj) {
    const localIncludes = [...currentObj.code.matchAll(/#include\s+"([^"]+)"/g)].map((m) => m[1]);
    if (localIncludes.length > 0) {
      const linked = new Set([sourcePath]);
      for (const inc of localIncludes) {
        const base = path.parse(inc).name;
        const impl = siblingSources.find((s) => path.parse(s.name).name === base && !s.hasMain);
        if (impl) linked.add(impl.full);
      }
      if (linked.size > 1) {
        return { sources: [...linked], sourceDir, isMultiFile: true };
      }
    }
  }

  return { sources: [sourcePath], sourceDir, isMultiFile: false };
}

app.get('/api/files', async (_req, res) => {
  const data = await scanWorkspaceRecursive();
  res.json({ tree: data.tree, files: data.flatFiles });
});

app.post('/api/files', async (req, res) => {
  const { path: relPath, name, content = '' } = req.body;
  const targetRel = relPath || name;
  const fullPath = safeResolve(targetRel);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf8');
  await syncCompileCommands();
  res.json({ ok: true, path: targetRel, uri: pathToFileURL(fullPath).href });
});

app.post('/api/folders', async (req, res) => {
  const { path: relPath } = req.body;
  const fullPath = safeResolve(relPath);
  await fs.mkdir(fullPath, { recursive: true });
  res.json({ ok: true });
});

app.delete('/api/entry', async (req, res) => {
  const { path: relPath } = req.body;
  const fullPath = safeResolve(relPath);
  if (fullPath === WORKSPACE_DIR) {
    return res.status(400).json({ error: 'Cannot delete root workspace' });
  }
  await fs.rm(fullPath, { recursive: true, force: true });
  await syncCompileCommands();
  res.json({ ok: true });
});

app.post('/api/compiler-config', async (req, res) => {
  const { cppStandard = 'gnu++17', cStandard = 'c11' } = req.body;
  await syncCompileCommands(cppStandard, cStandard);
  res.json({ ok: true });
});

app.post('/api/format', async (req, res) => {
  const { code, language } = req.body;
  if (language === 'c' || language === 'cpp') {
    const cf = spawn('clang-format', ['--style={BasedOnStyle: Microsoft, IndentWidth: 4}']);
    let out = '';
    cf.stdout.on('data', (d) => (out += d.toString('utf8')));
    cf.on('error', () => res.json({ formatted: code }));
    cf.on('close', (exitCode) => res.json({ formatted: exitCode === 0 && out ? out : code }));
    cf.stdin.write(code);
    cf.stdin.end();
  } else {
    res.json({ formatted: code });
  }
});

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === '/ws/lsp') {
    const lang = url.searchParams.get('lang') || 'cpp';
    wss.handleUpgrade(request, socket, head, (ws) => {
      attachLanguageServer(ws, lang, WORKSPACE_DIR);
    });
  } else if (url.pathname === '/ws/run') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleCodeExecution(ws);
    });
  } else {
    socket.destroy();
  }
});

function handleCodeExecution(ws) {
  let activeChild = null;

  ws.on('message', async (raw) => {
    const msg = JSON.parse(raw.toString('utf8'));

    if (msg.type === 'stdin' && activeChild && activeChild.stdin.writable) {
      activeChild.stdin.write(msg.data);
      return;
    }

    if (msg.type === 'eof' && activeChild && activeChild.stdin.writable) {
      activeChild.stdin.end();
      return;
    }

    if (msg.type === 'kill' && activeChild) {
      if (process.platform === 'win32' && activeChild.pid) {
        spawn('taskkill', ['/pid', String(activeChild.pid), '/f', '/t']);
      } else {
        activeChild.kill('SIGKILL');
      }
      return;
    }

    if (msg.type === 'run') {
      const {
        filePath,
        fileName,
        code,
        language,
        cStandard = 'c11',
        cppStandard = 'gnu++17',
        initialStdin = '',
        autoEof = true
      } = msg;

      const targetRel = filePath || fileName;
      const sourcePath = safeResolve(targetRel);
      await fs.mkdir(path.dirname(sourcePath), { recursive: true });
      await fs.writeFile(sourcePath, code, 'utf8');

      const send = (payload) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
      };

      const startTime = performance.now();

      if (language === 'python') {
        send({ type: 'status', text: `> ${path.basename(PYTHON_RUNNER.cmd)} -u ${targetRel}\n` });
        activeChild = spawn(PYTHON_RUNNER.cmd, [...PYTHON_RUNNER.prefixArgs, '-u', sourcePath], {
          cwd: WORKSPACE_DIR
        });
        wireProcess(activeChild, send, startTime, initialStdin, autoEof);
        return;
      }

      const isCpp = language === 'cpp';
      const compiler = isCpp ? 'g++' : 'gcc';
      const stdFlag = isCpp ? `-std=${cppStandard}` : `-std=${cStandard}`;
      const { sources, sourceDir, isMultiFile } = await resolveCompilationSources(sourcePath, isCpp);

      const safeExeBase = (isMultiFile ? path.dirname(targetRel) || 'root_project' : targetRel)
        .replace(/[\\/]/g, '_')
        .replace(/\.[^.]+$/, '');
      const exeName = `${safeExeBase}${process.platform === 'win32' ? '.exe' : ''}`;
      const exePath = path.join(BUILD_DIR, exeName);

      const unbufHeader = path.join(BUILD_DIR, 'localcode_unbuf.h');
      await fs.writeFile(
        unbufHeader,
        `#include <stdio.h>\n__attribute__((constructor, used)) static void _lc_unbuf(void){ setvbuf(stdout, NULL, _IONBF, 0); }\n`,
        'utf8'
      );

      const displaySources = sources.map((s) => path.relative(WORKSPACE_DIR, s).replace(/\\/g, '/')).join(' ');
      send({ type: 'status', text: `> ${compiler} ${stdFlag} ${displaySources} -o ${exeName}\n` });

      const compileArgs = ['-include', unbufHeader, stdFlag, `-I${sourceDir}`, '-Wall', '-Wextra', '-O2', ...sources, '-o', exePath];
      const compileProc = spawn(compiler, compileArgs, { cwd: WORKSPACE_DIR });

      compileProc.stderr.on('data', (d) => send({ type: 'stderr', text: d.toString('utf8') }));
      compileProc.on('error', (err) => {
        send({ type: 'stderr', text: `Lỗi khởi chạy ${compiler}: ${err.message}\n` });
        send({ type: 'exit', code: -1, elapsedMs: Math.round(performance.now() - startTime) });
      });

      compileProc.on('close', (code) => {
        if (code !== 0) {
          send({ type: 'exit', code, elapsedMs: Math.round(performance.now() - startTime) });
          return;
        }
        const execStart = performance.now();
        send({ type: 'status', text: `> Chạy ${exeName}...\n` });
        activeChild = spawn(exePath, [], { cwd: WORKSPACE_DIR });
        wireProcess(activeChild, send, execStart, initialStdin, autoEof);
      });
    }
  });

  ws.on('close', () => {
    if (activeChild && !activeChild.killed) activeChild.kill();
  });
}

function wireProcess(child, send, startTime, initialStdin = '', autoEof = true) {
  child.stdout.on('data', (d) => send({ type: 'stdout', text: d.toString('utf8') }));
  child.stderr.on('data', (d) => send({ type: 'stderr', text: d.toString('utf8') }));
  child.on('error', (err) => {
    send({
      type: 'stderr',
      text: `Không thể chạy tiến trình (${err.message}). Hãy cài Python 3 hoặc chuyển sang chế độ Cloud (Piston) ở góc dưới bên trái.\n`
    });
    send({ type: 'exit', code: -1, elapsedMs: Math.round(performance.now() - startTime) });
  });
  child.on('close', (code) => {
    send({ type: 'exit', code: code ?? 0, elapsedMs: Math.round(performance.now() - startTime) });
  });

  if (initialStdin.trim().length > 0 && child.stdin.writable) {
    const formattedInput = initialStdin.endsWith('\n') ? initialStdin : `${initialStdin}\n`;
    child.stdin.write(formattedInput);
    if (autoEof) {
      child.stdin.end();
    }
  }
}

await ensureWorkspace();
const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`LocalCode Backend running on http://localhost:${PORT}`);
  console.log(`Detected Python: ${PYTHON_RUNNER.cmd}`);
});
