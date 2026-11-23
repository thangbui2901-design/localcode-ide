import * as monaco from 'monaco-editor';
import { WorkspaceFile } from '../types/ide';

const CPP_HEADERS = [
  'bits/stdc++.h',
  'iostream',
  'vector',
  'string',
  'algorithm',
  'map',
  'unordered_map',
  'set',
  'unordered_set',
  'queue',
  'stack',
  'deque',
  'list',
  'array',
  'tuple',
  'utility',
  'numeric',
  'functional',
  'memory',
  'bitset',
  'cmath',
  'cstdio',
  'cstdlib',
  'cstring',
  'iomanip',
  'climits',
  'cassert',
  'stdio.h',
  'stdlib.h',
  'string.h',
  'math.h',
  'ctype.h',
  'stdbool.h',
  'stdint.h',
  'limits.h'
];

const STD_SYMBOLS: Array<{ label: string; kind: 'fn' | 'type' | 'var'; detail: string; insert?: string }> = [
  { label: 'cout', kind: 'var', detail: 'std::ostream' },
  { label: 'cin', kind: 'var', detail: 'std::istream' },
  { label: 'endl', kind: 'fn', detail: 'std::ostream& endl' },
  { label: 'string', kind: 'type', detail: 'std::basic_string<char>' },
  { label: 'vector', kind: 'type', detail: 'template<class T> class vector', insert: 'vector<${1:int}>' },
  { label: 'map', kind: 'type', detail: 'template<class K, class V> class map', insert: 'map<${1:int}, ${2:int}>' },
  { label: 'unordered_map', kind: 'type', detail: 'Hash table O(1)', insert: 'unordered_map<${1:int}, ${2:int}>' },
  { label: 'set', kind: 'type', detail: 'Ordered set O(log N)', insert: 'set<${1:int}>' },
  { label: 'unordered_set', kind: 'type', detail: 'Hash set O(1)', insert: 'unordered_set<${1:int}>' },
  { label: 'pair', kind: 'type', detail: 'std::pair<T1, T2>', insert: 'pair<${1:int}, ${2:int}>' },
  { label: 'make_pair', kind: 'fn', detail: 'std::make_pair(a, b)', insert: 'make_pair(${1:a}, ${2:b})' },
  { label: 'queue', kind: 'type', detail: 'FIFO queue', insert: 'queue<${1:int}>' },
  { label: 'priority_queue', kind: 'type', detail: 'Max-Heap priority_queue', insert: 'priority_queue<${1:int}>' },
  { label: 'stack', kind: 'type', detail: 'LIFO stack', insert: 'stack<${1:int}>' },
  { label: 'deque', kind: 'type', detail: 'Double-ended queue', insert: 'deque<${1:int}>' },
  { label: 'sort', kind: 'fn', detail: 'void sort(first, last)', insert: 'sort(${1:v}.begin(), ${1:v}.end())' },
  { label: 'reverse', kind: 'fn', detail: 'void reverse(first, last)', insert: 'reverse(${1:v}.begin(), ${1:v}.end())' },
  { label: 'lower_bound', kind: 'fn', detail: 'Binary search >= val', insert: 'lower_bound(${1:v}.begin(), ${1:v}.end(), ${2:x})' },
  { label: 'upper_bound', kind: 'fn', detail: 'Binary search > val', insert: 'upper_bound(${1:v}.begin(), ${1:v}.end(), ${2:x})' },
  { label: 'binary_search', kind: 'fn', detail: 'bool binary_search(first, last, val)' },
  { label: 'next_permutation', kind: 'fn', detail: 'bool next_permutation(first, last)' },
  { label: 'max', kind: 'fn', detail: 'const T& max(a, b)' },
  { label: 'min', kind: 'fn', detail: 'const T& min(a, b)' },
  { label: 'swap', kind: 'fn', detail: 'void swap(a, b)' },
  { label: 'abs', kind: 'fn', detail: 'Absolute value' },
  { label: 'gcd', kind: 'fn', detail: 'Greatest common divisor (C++17)' },
  { label: 'lcm', kind: 'fn', detail: 'Least common multiple (C++17)' },
  { label: 'fixed', kind: 'var', detail: 'std::ios_base::fixed' },
  { label: 'setprecision', kind: 'fn', detail: 'std::setprecision(int n)', insert: 'setprecision(${1:2})' },
  { label: 'move', kind: 'fn', detail: 'std::move(T&&)' },
  { label: 'unique_ptr', kind: 'type', detail: 'Smart pointer (unique ownership)', insert: 'unique_ptr<${1:T}>' },
  { label: 'shared_ptr', kind: 'type', detail: 'Smart pointer (reference counted)', insert: 'shared_ptr<${1:T}>' }
];

const STL_MEMBER_METHODS = [
  { label: 'push_back', detail: 'void push_back(val)', insert: 'push_back(${1:x})' },
  { label: 'emplace_back', detail: 'void emplace_back(args...)', insert: 'emplace_back(${1:x})' },
  { label: 'pop_back', detail: 'void pop_back()', insert: 'pop_back()' },
  { label: 'size', detail: 'size_t size() const', insert: 'size()' },
  { label: 'empty', detail: 'bool empty() const', insert: 'empty()' },
  { label: 'clear', detail: 'void clear()', insert: 'clear()' },
  { label: 'begin', detail: 'iterator begin()', insert: 'begin()' },
  { label: 'end', detail: 'iterator end()', insert: 'end()' },
  { label: 'front', detail: 'reference front()', insert: 'front()' },
  { label: 'back', detail: 'reference back()', insert: 'back()' },
  { label: 'top', detail: 'const_reference top()', insert: 'top()' },
  { label: 'push', detail: 'void push(val)', insert: 'push(${1:x})' },
  { label: 'pop', detail: 'void pop()', insert: 'pop()' },
  { label: 'insert', detail: 'insert(val)', insert: 'insert(${1:x})' },
  { label: 'erase', detail: 'erase(it / key)', insert: 'erase(${1:x})' },
  { label: 'find', detail: 'iterator find(key)', insert: 'find(${1:x})' },
  { label: 'count', detail: 'size_t count(key)', insert: 'count(${1:x})' },
  { label: 'substr', detail: 'string substr(pos, len)', insert: 'substr(${1:0}, ${2:len})' },
  { label: 'length', detail: 'size_t length() const', insert: 'length()' },
  { label: 'first', detail: 'pair::first' },
  { label: 'second', detail: 'pair::second' }
];

const PYTHON_BUILTINS = [
  'print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted', 'reversed',
  'sum', 'min', 'max', 'abs', 'pow', 'divmod', 'round', 'int', 'float', 'str', 'list',
  'dict', 'set', 'tuple', 'bool', 'input', 'open', 'isinstance', 'hasattr', 'getattr'
];

function extractCodeSymbols(codeSources: string[]) {
  const combined = codeSources.join('\n');
  const types = new Set<string>();
  const functions = new Set<string>();
  const members = new Set<string>();
  const variables = new Set<string>();

  for (const m of combined.matchAll(/\b(?:class|struct)\s+([A-Za-z_][A-Za-z0-9_]*)/g)) {
    types.add(m[1]);
  }

  for (const m of combined.matchAll(/\b(?:void|int|long|double|float|bool|char|string|auto)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
    if (m[1] !== 'main' && m[1] !== 'if' && m[1] !== 'while' && m[1] !== 'for') {
      functions.add(m[1]);
      members.add(m[1]);
    }
  }

  for (const m of combined.matchAll(/\b(?:int|long|double|float|bool|char|string|std::string)\s+([A-Za-z_][A-Za-z0-9_]*)\s*[;=,\[]/g)) {
    variables.add(m[1]);
    members.add(m[1]);
  }

  return { types: [...types], functions: [...functions], members: [...members], variables: [...variables] };
}

export function getStandaloneCompletions(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  langId: string,
  allFiles: WorkspaceFile[]
): monaco.languages.CompletionList {
  const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
  const word = model.getWordUntilPosition(position);
  const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
  const K = monaco.languages.CompletionItemKind;
  const R = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

  if (langId === 'cpp' || langId === 'c') {
    if (/#include\s*<[^>]*$/.test(linePrefix)) {
      return {
        incomplete: true,
        suggestions: CPP_HEADERS.map((h) => ({
          label: h,
          kind: K.File,
          detail: 'Standard Library Header',
          insertText: `${h}>`,
          range
        }))
      };
    }

    if (/#include\s*"[^"]*$/.test(linePrefix)) {
      const headers = allFiles.filter((f) => f.name.endsWith('.h') || f.name.endsWith('.hpp'));
      return {
        suggestions: headers.map((h) => ({
          label: h.name,
          kind: K.File,
          detail: h.path,
          insertText: `${h.name}"`,
          range
        }))
      };
    }

    if (/std::[A-Za-z0-9_]*$/.test(linePrefix)) {
      return {
        suggestions: STD_SYMBOLS.map((s) => ({
          label: s.label,
          kind: s.kind === 'fn' ? K.Function : s.kind === 'type' ? K.Class : K.Variable,
          detail: s.detail,
          insertText: s.insert || s.label,
          insertTextRules: s.insert ? R : undefined,
          range
        }))
      };
    }

    const projectTexts = allFiles
      .filter((f) => f.language === 'cpp' || f.language === 'c')
      .map((f) => f.content);
    const extracted = extractCodeSymbols([model.getValue(), ...projectTexts]);

    if (/(?:\.|->)[A-Za-z0-9_]*$/.test(linePrefix)) {
      const customMembers = extracted.members.map((m) => ({
        label: m,
        kind: K.Method,
        detail: 'Class / Struct Member',
        insertText: m,
        range
      }));
      const stlMembers = STL_MEMBER_METHODS.map((m) => ({
        label: m.label,
        kind: K.Method,
        detail: m.detail,
        insertText: m.insert || m.label,
        insertTextRules: m.insert ? R : undefined,
        range
      }));
    }

    const suggestions: monaco.languages.CompletionItem[] = [
      ...STD_SYMBOLS.map((s) => ({
        label: s.label,
        kind: s.kind === 'fn' ? K.Function : s.kind === 'type' ? K.Class : K.Variable,
        detail: s.detail,
        insertText: s.insert || s.label,
        insertTextRules: s.insert ? R : undefined,
        range
      })),
      ...extracted.types.map((t) => ({
        label: t,
        kind: K.Class,
        detail: 'User Class / Struct',
        insertText: t,
        range
      })),
      ...extracted.functions.map((fn) => ({
        label: fn,
        kind: K.Function,
        detail: 'User Function',
        insertText: fn,
        range
      })),
      ...extracted.variables.map((v) => ({
        label: v,
        kind: K.Variable,
        detail: 'Local / Member Variable',
        insertText: v,
        range
      }))
    ];

    return { suggestions };
  }

  const pyCode = model.getValue();
  const pyDefs = [...pyCode.matchAll(/\bdef\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);
  const pyClasses = [...pyCode.matchAll(/\bclass\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);

  return {
    suggestions: [
      ...PYTHON_BUILTINS.map((b) => ({
        label: b,
        kind: K.Function,
        detail: 'Python Built-in',
        insertText: b,
        range
      })),
      ...pyDefs.map((fn) => ({
        label: fn,
        kind: K.Function,
        detail: 'Function',
        insertText: fn,
        range
      })),
      ...pyClasses.map((cls) => ({
        label: cls,
        kind: K.Class,
        detail: 'Class',
        insertText: cls,
        range
      }))
    ]
  };
}
