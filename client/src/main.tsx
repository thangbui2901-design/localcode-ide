/// <reference types="vite/client" />

import React from 'react';
import ReactDOM from 'react-dom/client';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import App from './App';
import './index.css';

(self as any).MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === 'html') {
      return new htmlWorker();
    }
    if (label === 'css') {
      return new cssWorker();
    }
    return new editorWorker();
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);