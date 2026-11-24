export type DeviceBreakpoint = 'mobile' | 'tablet' | 'desktop';

export type ExecutionMode = 'local' | 'standalone';

export type SupportedLanguage =
  | 'c'
  | 'cpp'
  | 'python'
  | 'markdown'
  | 'plaintext'
  | 'html'
  | 'css'
  | 'javascript'
  | 'json'
  | 'asset';

export interface WorkspaceFile {
  name: string;
  path: string;
  uri: string;
  content: string;
  language: SupportedLanguage;
  dirty?: boolean;
  updatedAt?: number;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  file?: WorkspaceFile;
  updatedAt?: number;
}

export interface TestCaseItem {
  id: string;
  name: string;
  input: string;
  expectedOutput: string;
}

export interface TestCaseResult {
  id: string;
  status: 'idle' | 'running' | 'ac' | 'wa' | 'err';
  actualOutput: string;
  stderr?: string;
  elapsedMs?: number;
}

export interface IdeDiagnostic {
  uri: string;
  fileName?: string;
  line: number;
  column: number;
  endLineNumber?: number;
  endColumn?: number;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  source?: string;
}

export interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative' | 'interval';
  autoSave: boolean;
  formatOnSave: boolean;
  quickSuggestions: boolean;
  suggestOnTriggerCharacters: boolean;
  hardwareKeyboardMode?: boolean;
  theme: string;
}

export type CppCompilerEngine = 'auto' | 'offline-wasm' | 'cloud';

export interface CompilerSettings {
  cStandard: string;
  cppStandard: string;
  pistonUrl?: string;
  cppEngine?: CppCompilerEngine;
}