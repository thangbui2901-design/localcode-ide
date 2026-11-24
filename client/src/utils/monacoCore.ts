// @ts-nocheck
// Slim Monaco Editor entry: chỉ nạp đúng các ngôn ngữ cần thiết (C/C++, Python, HTML, CSS, JS, JSON, Markdown + Java/C#/SQL)
// Cắt bỏ ~55 ngôn ngữ thừa & ts.worker (6MB) để giảm hơn 50% dung lượng app và RAM trên iPhone/iPad.

import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution';
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution';
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution';
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution';
import 'monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution';

import 'monaco-editor/esm/vs/language/css/monaco.contribution';
import 'monaco-editor/esm/vs/language/html/monaco.contribution';
import 'monaco-editor/esm/vs/language/json/monaco.contribution';

export * from 'monaco-editor/esm/vs/editor/edcore.main';
