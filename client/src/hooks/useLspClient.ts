import { useEffect, useRef, useState, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { ExecutionMode, IdeDiagnostic, SupportedLanguage, WorkspaceFile } from '../types/ide';
import { getStandaloneCompletions } from '../services/standaloneIntelliSense';

interface PendingRequest {
  resolve: (val: any) => void;
  reject: (err: any) => void;
}

function mapCompletionKind(lspKind?: number): monaco.languages.CompletionItemKind {
  const K = monaco.languages.CompletionItemKind;
  switch (lspKind) {
    case 2: return K.Method;
    case 3: return K.Function;
    case 4: return K.Constructor;
    case 5: return K.Field;
    case 6: return K.Variable;
    case 7: return K.Class;
    case 8: return K.Interface;
    case 9: return K.Module;
    case 10: return K.Property;
    case 12: return K.Value;
    case 13: return K.Enum;
    case 14: return K.Keyword;
    case 15: return K.Snippet;
    case 21: return K.Constant;
    case 22: return K.Struct;
    default: return K.Text;
  }
}

export function useLspClient(
  mode: ExecutionMode,
  activeFile: WorkspaceFile | null,
  allFiles: WorkspaceFile[],
  onDiagnostics: (uri: string, diags: IdeDiagnostic[]) => void,
  onNavigateToLocation: (uri: string, line: number, column: number) => void
) {
  const socketsRef = useRef<Record<string, WebSocket>>({});
  const readyRef = useRef<{ cpp: boolean; python: boolean }>({ cpp: false, python: false });
  const pendingRef = useRef<Record<string, Map<number, PendingRequest>>>({ cpp: new Map(), python: new Map() });
  const versionMapRef = useRef<Record<string, number>>({});
  const openedUrisRef = useRef<Set<string>>(new Set());
  const latestFileRef = useRef<WorkspaceFile | null>(activeFile);
  const allFilesRef = useRef<WorkspaceFile[]>(allFiles);
  const modeRef = useRef<ExecutionMode>(mode);
  const nextIdRef = useRef(1);

  latestFileRef.current = activeFile;
  allFilesRef.current = allFiles;
  modeRef.current = mode;

  const [lspStatus, setLspStatus] = useState<{ cpp: string; python: string }>({
    cpp: mode === 'standalone' ? 'Cloud STL' : 'Connecting...',
    python: mode === 'standalone' ? 'Cloud Py3' : 'Connecting...'
  });

  const sendNotification = useCallback((channel: 'cpp' | 'python', method: string, params: any): boolean => {
    const ws = socketsRef.current[channel];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ jsonrpc: '2.0', method, params }));
      return true;
    }
    return false;
  }, []);

  const sendRequest = useCallback((channel: 'cpp' | 'python', method: string, params: any): Promise<any> => {
    const ws = socketsRef.current[channel];
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.resolve(null);
    }
    const id = nextIdRef.current++;
    return new Promise((resolve, reject) => {
      pendingRef.current[channel].set(id, { resolve, reject });
      ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
      setTimeout(() => {
        if (pendingRef.current[channel].has(id)) {
          pendingRef.current[channel].delete(id);
          resolve(null);
        }
      }, 3000);
    });
  }, []);

  const syncDocument = useCallback(
    (file: WorkspaceFile, content: string) => {
      if (modeRef.current === 'standalone') return;
      if (file.language === 'markdown' || file.language === 'plaintext') return;
      const channel: 'cpp' | 'python' = file.language === 'python' ? 'python' : 'cpp';
      if (!readyRef.current[channel]) return;

      const languageId = file.language === 'c' ? 'c' : file.language === 'cpp' ? 'cpp' : 'python';

      if (!openedUrisRef.current.has(file.uri)) {
        const sent = sendNotification(channel, 'textDocument/didOpen', {
          textDocument: { uri: file.uri, languageId, version: 1, text: content }
        });
        if (sent) {
          openedUrisRef.current.add(file.uri);
          versionMapRef.current[file.uri] = 1;
        }
      } else {
        const nextVer = (versionMapRef.current[file.uri] || 1) + 1;
        const sent = sendNotification(channel, 'textDocument/didChange', {
          textDocument: { uri: file.uri, version: nextVer },
          contentChanges: [{ text: content }]
        });
        if (sent) {
          versionMapRef.current[file.uri] = nextVer;
        }
      }
    },
    [sendNotification]
  );

  useEffect(() => {
    const disposables: monaco.IDisposable[] = [];
    const langs: SupportedLanguage[] = ['cpp', 'c', 'python'];

    langs.forEach((langId) => {
      const channel: 'cpp' | 'python' = langId === 'python' ? 'python' : 'cpp';

      disposables.push(
        monaco.languages.registerCompletionItemProvider(langId, {
          triggerCharacters: ['.', ':', '>', '<', '/', '"', "'", '#'],
          provideCompletionItems: async (model, position, context) => {
            if (modeRef.current === 'standalone' || !readyRef.current[channel]) {
              return getStandaloneCompletions(model, position, langId, allFilesRef.current);
            }

            const result = await sendRequest(channel, 'textDocument/completion', {
              textDocument: { uri: model.uri.toString() },
              position: { line: position.lineNumber - 1, character: position.column - 1 },
              context: {
                triggerKind: context.triggerCharacter ? 2 : 1,
                triggerCharacter: context.triggerCharacter
              }
            });

            const items = Array.isArray(result) ? result : result?.items || [];
            if (items.length === 0) {
              return getStandaloneCompletions(model, position, langId, allFilesRef.current);
            }

            const word = model.getWordUntilPosition(position);
            const defaultRange = new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn
            );

            return {
              incomplete: true,
              suggestions: items.map((item: any) => {
                const cleanLabel = String(item.label || '').trim();
                const editRange = item.textEdit?.range
                  ? new monaco.Range(
                      item.textEdit.range.start.line + 1,
                      item.textEdit.range.start.character + 1,
                      item.textEdit.range.end.line + 1,
                      item.textEdit.range.end.character + 1
                    )
                  : defaultRange;

                return {
                  label: {
                    label: cleanLabel,
                    detail: item.detail ? `  ${item.detail}` : undefined
                  },
                  kind: mapCompletionKind(item.kind),
                  detail: item.detail,
                  documentation:
                    typeof item.documentation === 'string'
                      ? item.documentation
                      : item.documentation?.value
                      ? { value: item.documentation.value }
                      : undefined,
                  insertText: item.textEdit?.newText || item.insertText || cleanLabel,
                  insertTextRules:
                    item.insertTextFormat === 2
                      ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                      : undefined,
                  sortText: item.sortText,
                  filterText: (item.filterText || cleanLabel).trim(),
                  range: editRange
                };
              })
            };
          }
        })
      );

      disposables.push(
        monaco.languages.registerHoverProvider(langId, {
          provideHover: async (model, position) => {
            if (modeRef.current === 'standalone' || !readyRef.current[channel]) return null;
            const res = await sendRequest(channel, 'textDocument/hover', {
              textDocument: { uri: model.uri.toString() },
              position: { line: position.lineNumber - 1, character: position.column - 1 }
            });
            if (!res?.contents) return null;
            const raw = Array.isArray(res.contents) ? res.contents[0] : res.contents;
            const value = typeof raw === 'string' ? raw : raw.value || '';
            return { contents: [{ value }] };
          }
        })
      );

      disposables.push(
        monaco.languages.registerSignatureHelpProvider(langId, {
          signatureHelpTriggerCharacters: ['(', ','],
          provideSignatureHelp: async (model, position) => {
            if (modeRef.current === 'standalone' || !readyRef.current[channel]) return null;
            const res = await sendRequest(channel, 'textDocument/signatureHelp', {
              textDocument: { uri: model.uri.toString() },
              position: { line: position.lineNumber - 1, character: position.column - 1 }
            });
            if (!res?.signatures?.length) return null;
            return {
              dispose: () => {},
              value: {
                signatures: res.signatures.map((s: any) => ({
                  label: s.label,
                  documentation: typeof s.documentation === 'string' ? s.documentation : s.documentation?.value,
                  parameters: (s.parameters || []).map((p: any) => ({
                    label: p.label,
                    documentation: typeof p.documentation === 'string' ? p.documentation : p.documentation?.value
                  }))
                })),
                activeSignature: res.activeSignature || 0,
                activeParameter: res.activeParameter || 0
              }
            };
          }
        })
      );

      disposables.push(
        monaco.languages.registerDefinitionProvider(langId, {
          provideDefinition: async (model, position) => {
            if (modeRef.current === 'standalone' || !readyRef.current[channel]) return null;
            const res = await sendRequest(channel, 'textDocument/definition', {
              textDocument: { uri: model.uri.toString() },
              position: { line: position.lineNumber - 1, character: position.column - 1 }
            });
            const locs = Array.isArray(res) ? res : res ? [res] : [];
            return locs.map((loc: any) => {
              const targetUri = loc.targetUri || loc.uri;
              const range = loc.targetSelectionRange || loc.range;
              if (targetUri !== model.uri.toString()) {
                onNavigateToLocation(targetUri, range.start.line + 1, range.start.character + 1);
              }
              return {
                uri: monaco.Uri.parse(targetUri),
                range: new monaco.Range(
                  range.start.line + 1,
                  range.start.character + 1,
                  range.end.line + 1,
                  range.end.character + 1
                )
              };
            });
          }
        })
      );
    });

    if (mode === 'standalone') {
      setLspStatus({ cpp: 'Cloud STL', python: 'Cloud Py3' });
      return () => {
        disposables.forEach((d) => d.dispose());
      };
    }

    const channels: Array<'cpp' | 'python'> = ['cpp', 'python'];
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    channels.forEach((channel) => {
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/lsp?lang=${channel}`);
      socketsRef.current[channel] = ws;

      ws.onopen = async () => {
        const initRes = await sendRequest(channel, 'initialize', {
          processId: null,
          clientInfo: { name: 'LocalCode IDE', version: '2.0.0' },
          capabilities: {
            textDocument: {
              synchronization: { dynamicRegistration: false, didSave: true },
              completion: {
                completionItem: {
                  snippetSupport: true,
                  documentationFormat: ['markdown', 'plaintext'],
                  insertReplaceSupport: true
                }
              },
              hover: { contentFormat: ['markdown', 'plaintext'] },
              signatureHelp: {
                signatureInformation: { documentationFormat: ['markdown', 'plaintext'] }
              },
              definition: { linkSupport: true },
              references: {}
            }
          }
        });

        if (initRes) {
          sendNotification(channel, 'initialized', {});
          readyRef.current[channel] = true;
          setLspStatus((prev) => ({
            ...prev,
            [channel]: channel === 'cpp' ? 'clangd Ready' : 'Pyright Ready'
          }));

          const current = latestFileRef.current;
          if (current) {
            const currentChannel = current.language === 'python' ? 'python' : 'cpp';
            if (currentChannel === channel) {
              syncDocument(current, current.content);
            }
          }
        }
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.id !== undefined && pendingRef.current[channel].has(msg.id)) {
          const req = pendingRef.current[channel].get(msg.id)!;
          pendingRef.current[channel].delete(msg.id);
          req.resolve(msg.result);
          return;
        }

        if (msg.method === 'localcode/lspStatus' && msg.params?.error) {
          setLspStatus((prev) => ({ ...prev, [channel]: 'Built-in STL' }));
        }

        if (msg.method === 'textDocument/publishDiagnostics' && msg.params) {
          const { uri, diagnostics } = msg.params;
          const decodedPath = decodeURIComponent(uri);
          const fileName = decodedPath.split('/').pop() || '';
          const mapped: IdeDiagnostic[] = (diagnostics || []).map((d: any) => ({
            uri,
            filePath: decodedPath,
            fileName,
            line: d.range.start.line + 1,
            column: d.range.start.character + 1,
            endLine: d.range.end.line + 1,
            endColumn: d.range.end.character + 1,
            severity: d.severity === 1 ? 'error' : d.severity === 2 ? 'warning' : 'info',
            message: d.message,
            source: d.source || (channel === 'cpp' ? 'clangd' : 'Pyright')
          }));

          const model = monaco.editor.getModels().find((m) => m.uri.toString() === uri);
          if (model) {
            monaco.editor.setModelMarkers(
              model,
              channel,
              mapped.map((m) => ({
                startLineNumber: m.line,
                startColumn: m.column,
                endLineNumber: m.endLineNumber ?? m.line,
                endColumn: m.endColumn ?? m.column + 1,
                message: m.message,
                severity:
                  m.severity === 'error'
                    ? monaco.MarkerSeverity.Error
                    : m.severity === 'warning'
                    ? monaco.MarkerSeverity.Warning
                    : monaco.MarkerSeverity.Info
              }))
            );
          }

          onDiagnostics(uri, mapped);
        }
      };

      ws.onclose = () => {
        readyRef.current[channel] = false;
      };
    });

    return () => {
      disposables.forEach((d) => d.dispose());
      openedUrisRef.current.clear();
      Object.values(socketsRef.current).forEach((ws) => ws.close());
    };
  }, [mode, sendRequest, sendNotification, onDiagnostics, onNavigateToLocation, syncDocument]);

  useEffect(() => {
    if (activeFile && mode === 'local') {
      syncDocument(activeFile, activeFile.content);
    }
  }, [activeFile?.uri, mode, syncDocument]);

  return { lspStatus, syncDocument };
}
