import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function attachLanguageServer(ws, language, workspaceDir) {
  const isCpp = language === 'cpp' || language === 'c';
  const command = isCpp
    ? 'clangd'
    : process.platform === 'win32'
    ? 'pyright-langserver.cmd'
    : 'pyright-langserver';

  const args = isCpp
    ? [
        '--background-index',
        '--completion-style=detailed',
        '--header-insertion=iwyu',
        '--query-driver=**'
      ]
    : ['--stdio'];

  const lspProcess = spawn(command, args, {
    cwd: workspaceDir,
    shell: process.platform === 'win32' && !isCpp,
    env: { ...process.env }
  });

  let stdoutBuffer = Buffer.alloc(0);

  lspProcess.stdout.on('data', (chunk) => {
    stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);

    while (true) {
      const headerEnd = stdoutBuffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const headerText = stdoutBuffer.subarray(0, headerEnd).toString('utf8');
      const match = headerText.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        stdoutBuffer = stdoutBuffer.subarray(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;

      if (stdoutBuffer.length < messageEnd) break;

      const jsonText = stdoutBuffer.subarray(messageStart, messageEnd).toString('utf8');
      stdoutBuffer = stdoutBuffer.subarray(messageEnd);

      if (ws.readyState === ws.OPEN) {
        ws.send(jsonText);
      }
    }
  });

  lspProcess.stderr.on('data', (err) => {
    const msg = err.toString('utf8');
    if (ws.readyState === ws.OPEN && msg.includes('ERROR')) {
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'localcode/lspLog',
          params: { level: 'error', message: msg }
        })
      );
    }
  });

  lspProcess.on('error', () => {
    if (ws.readyState === ws.OPEN) {
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'localcode/lspStatus',
          params: {
            ready: false,
            error: `Không tìm thấy ${command} trong PATH.`
          }
        })
      );
    }
  });

  const rootUri = pathToFileURL(workspaceDir).href;

  ws.on('message', (raw) => {
    try {
      const text = raw.toString('utf8');
      const parsed = JSON.parse(text);

      if (parsed.method === 'initialize' && parsed.params) {
        parsed.params.rootUri = rootUri;
        parsed.params.workspaceFolders = [{ uri: rootUri, name: 'workspace' }];
      }

      const payload = JSON.stringify(parsed);
      const header = `Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n`;
      if (lspProcess.stdin.writable) {
        lspProcess.stdin.write(header + payload, 'utf8');
      }
    } catch (e) {
      console.error('[LSP Bridge Parse Error]', e);
    }
  });

  ws.on('close', () => {
    if (!lspProcess.killed) {
      lspProcess.kill();
    }
  });
}
