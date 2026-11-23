import * as monaco from 'monaco-editor';

let registered = false;

export function registerCppSnippets(monacoInstance: typeof monaco) {
  if (registered) return;
  registered = true;

  monacoInstance.languages.registerCompletionItemProvider('cpp', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = new monacoInstance.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn
      );

      const K = monacoInstance.languages.CompletionItemKind.Snippet;
      const R = monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet;

      return {
        suggestions: [
          {
            label: 'cp',
            kind: K,
            detail: 'DSA Competitive Programming Template',
            insertText: [
              '#include <bits/stdc++.h>',
              'using namespace std;',
              '',
              'void solve() {',
              '    ${1:int n; cin >> n;}',
              '}',
              '',
              'int main() {',
              '    ios::sync_with_stdio(false);',
              '    cin.tie(nullptr);',
              '    ${0:solve();}',
              '    return 0;',
              '}'
            ].join('\n'),
            insertTextRules: R,
            range
          },
          {
            label: 'class',
            kind: K,
            detail: 'C++ OOP Class (Encapsulation + Constructor)',
            insertText: [
              'class ${1:ClassName} {',
              'private:',
              '    ${2:std::string name;}',
              '',
              'public:',
              '    ${1:ClassName}() = default;',
              '    ${1:ClassName}(${3:std::string name}) : ${4:name(std::move(name))} {}',
              '',
              '    void display() const {',
              '        ${0:std::cout << name << \'\\n\';}',
              '    }',
              '};'
            ].join('\n'),
            insertTextRules: R,
            range
          },
          {
            label: 'struct',
            kind: K,
            detail: 'DSA Struct with operator<',
            insertText: [
              'struct ${1:Node} {',
              '    ${2:int u, w;}',
              '    bool operator<(const ${1:Node}& other) const {',
              '        return ${3:w > other.w};',
              '    }',
              '};$0'
            ].join('\n'),
            insertTextRules: R,
            range
          },
          {
            label: 'fori',
            kind: K,
            detail: 'for (int i = 0; i < n; i++)',
            insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    $0\n}',
            insertTextRules: R,
            range
          },
          {
            label: 'all',
            kind: K,
            detail: 'v.begin(), v.end()',
            insertText: '${1:v}.begin(), ${1:v}.end()$0',
            insertTextRules: R,
            range
          }
        ]
      };
    }
  });
}
