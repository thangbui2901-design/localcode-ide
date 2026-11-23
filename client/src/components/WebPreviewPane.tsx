import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshCw,
  ExternalLink,
  X,
  Monitor,
  Tablet,
  Smartphone,
  Radio,
  ImagePlus,
  Zap,
  Download
} from 'lucide-react';
import { WorkspaceFile } from '../types/ide';

export type PreviewViewport = 'desktop' | 'tablet' | 'mobile';

interface WebPreviewPaneProps {
  files: WorkspaceFile[];
  activeFile: WorkspaceFile | null;
  selectedHtmlPath: string | null;
  revision: number;
  onSelectHtmlPath: (path: string) => void;
  onImportAssets: (fileList: FileList) => void;
  onConsoleMessage: (type: 'stdout' | 'stderr', text: string) => void;
  onExportSuccess?: (fileName: string) => void;
  onClose: () => void;
}

/** Chuẩn hóa đường dẫn tương đối hỗ trợ cả ./ và ../ */
function resolveRelativePath(rawUrl: string, baseDir: string): string {
  const clean = rawUrl.split('?')[0].split('#')[0].trim();
  const isRootRelative = clean.startsWith('/');
  const combined = isRootRelative ? clean.slice(1) : baseDir ? `${baseDir}/${clean}` : clean;
  const segments = combined.split('/');
  const stack: string[] = [];

  for (const seg of segments) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      stack.pop();
    } else {
      stack.push(seg);
    }
  }
  return stack.join('/');
}

function lookupWorkspaceFile(
  rawUrl: string,
  baseDir: string,
  fileMap: Map<string, WorkspaceFile>
): WorkspaceFile | undefined {
  const resolved = resolveRelativePath(rawUrl, baseDir);
  const rootFallback = resolveRelativePath(rawUrl, '');
  return fileMap.get(resolved) || fileMap.get(rootFallback);
}

/** Phân giải đệ quy @import và url(...) trong CSS (chống lặp vô hạn) */
function resolveCssContent(
  cssText: string,
  cssBaseDir: string,
  fileMap: Map<string, WorkspaceFile>,
  visited: Set<string> = new Set()
): string {
  const withImports = cssText.replace(
    /@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)\s*([^;]*);/gi,
    (full, _q1, urlFromFn, _q2, urlFromStr, mediaQuery) => {
      const rawImportUrl = (urlFromFn || urlFromStr || '').trim();
      if (!rawImportUrl || /^(https?:|data:|blob:)/i.test(rawImportUrl)) {
        return full;
      }
      const matched = lookupWorkspaceFile(rawImportUrl, cssBaseDir, fileMap);
      if (!matched || matched.language !== 'css') {
        return full;
      }
      if (visited.has(matched.path)) {
        return `/* Bỏ qua vòng lặp @import: ${matched.path} */`;
      }

      const nextVisited = new Set(visited);
      nextVisited.add(matched.path);
      const subSlash = matched.path.lastIndexOf('/');
      const subDir = subSlash >= 0 ? matched.path.slice(0, subSlash) : '';
      const inlined = resolveCssContent(matched.content, subDir, fileMap, nextVisited);
      const mq = (mediaQuery || '').trim();

      return mq ? `@media ${mq} {\n${inlined}\n}` : `/* @import "${matched.path}" */\n${inlined}`;
    }
  );

  return withImports.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, _quote, rawUrl) => {
    const trimmed = rawUrl.trim();
    if (!trimmed || /^(https?:|data:|blob:|#)/i.test(trimmed)) return full;
    const matched = lookupWorkspaceFile(trimmed, cssBaseDir, fileMap);
    if (!matched || !matched.content.startsWith('data:')) return full;
    return `url("${matched.content}")`;
  });
}

function escapeInlineScript(jsCode: string): string {
  return jsCode.replace(/<\/(script)/gi, '<\\/$1');
}

/** Tạo bộ phân giải ES Module (import / export) sang Blob URL cho Live Preview */
function createJsModuleBundler(fileMap: Map<string, WorkspaceFile>) {
  const blobCache = new Map<string, string>();
  const visiting = new Set<string>();
  const createdUrls: string[] = [];

  const transformJsCode = (code: string, baseDir: string): string => {
    const resolveSpecifier = (spec: string): string | null => {
      if (!spec || /^(https?:|data:|blob:)/i.test(spec)) return null;
      const matched = lookupWorkspaceFile(spec, baseDir, fileMap);
      if (!matched) return null;

      if (matched.language === 'javascript') {
        return getJsBlobUrl(matched);
      }
      if (matched.language === 'json') {
        const jsonModuleCode = `export default ${matched.content};\n`;
        const jsonBlob = new Blob([jsonModuleCode], { type: 'application/javascript;charset=utf-8' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        createdUrls.push(jsonUrl);
        return jsonUrl;
      }
      return null;
    };

    let out = code.replace(
      /(\b(?:import|export)\b[^;'"]*?\bfrom\s*)(['"])([^'"]+)\2/g,
      (full, prefix, quote, spec) => {
        const mappedUrl = resolveSpecifier(spec);
        return mappedUrl ? `${prefix}${quote}${mappedUrl}${quote}` : full;
      }
    );

    out = out.replace(/(\bimport\s*)(['"])([^'"]+)\2/g, (full, prefix, quote, spec) => {
      const mappedUrl = resolveSpecifier(spec);
      return mappedUrl ? `${prefix}${quote}${mappedUrl}${quote}` : full;
    });

    out = out.replace(/(\bimport\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g, (full, prefix, quote, spec, suffix) => {
      const mappedUrl = resolveSpecifier(spec);
      return mappedUrl ? `${prefix}${quote}${mappedUrl}${quote}${suffix}` : full;
    });

    return out;
  };

  const getJsBlobUrl = (jsFile: WorkspaceFile): string => {
    const cached = blobCache.get(jsFile.path);
    if (cached) return cached;
    if (visiting.has(jsFile.path)) return '';

    visiting.add(jsFile.path);
    const slash = jsFile.path.lastIndexOf('/');
    const jsDir = slash >= 0 ? jsFile.path.slice(0, slash) : '';
    const transformed = transformJsCode(jsFile.content, jsDir);

    const blob = new Blob([transformed], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    createdUrls.push(url);
    blobCache.set(jsFile.path, url);
    visiting.delete(jsFile.path);
    return url;
  };

  return { getJsBlobUrl, transformJsCode, createdUrls };
}

/** Đóng gói mã JS thành Data URL (dùng khi xuất 1 tệp HTML độc lập để không phụ thuộc Blob URL tạm thời) */
function createStandaloneJsDataUrl(
  jsFile: WorkspaceFile,
  fileMap: Map<string, WorkspaceFile>,
  visiting: Set<string> = new Set()
): string {
  if (visiting.has(jsFile.path)) return '';
  visiting.add(jsFile.path);

  const slash = jsFile.path.lastIndexOf('/');
  const baseDir = slash >= 0 ? jsFile.path.slice(0, slash) : '';

  const resolveExportSpecifier = (spec: string): string | null => {
    if (!spec || /^(https?:|data:|blob:)/i.test(spec)) return null;
    const matched = lookupWorkspaceFile(spec, baseDir, fileMap);
    if (!matched) return null;

    if (matched.language === 'javascript') {
      return createStandaloneJsDataUrl(matched, fileMap, new Set(visiting));
    }
    if (matched.language === 'json') {
      const jsonCode = `export default ${matched.content};\n`;
      return `data:application/javascript;charset=utf-8,${encodeURIComponent(jsonCode)}`;
    }
    return null;
  };

  let out = jsFile.content.replace(
    /(\b(?:import|export)\b[^;'"]*?\bfrom\s*)(['"])([^'"]+)\2/g,
    (full, prefix, quote, spec) => {
      const mapped = resolveExportSpecifier(spec);
      return mapped ? `${prefix}${quote}${mapped}${quote}` : full;
    }
  );

  out = out.replace(/(\bimport\s*)(['"])([^'"]+)\2/g, (full, prefix, quote, spec) => {
    const mapped = resolveExportSpecifier(spec);
    return mapped ? `${prefix}${quote}${mapped}${quote}` : full;
  });

  return `data:application/javascript;charset=utf-8,${encodeURIComponent(out)}`;
}

function buildBundledHtml(
  targetHtml: WorkspaceFile | null,
  allFiles: WorkspaceFile[],
  standaloneExport = false
): { html: string; blobUrls: string[] } {
  const fileMap = new Map<string, WorkspaceFile>();
  allFiles.forEach((f) => fileMap.set(f.path, f));

  const { getJsBlobUrl, transformJsCode, createdUrls } = createJsModuleBundler(fileMap);

  const virtualAssets: Record<string, { content: string; mime: string }> = {};
  allFiles.forEach((f) => {
    if (f.language === 'json') {
      virtualAssets[f.path] = { content: f.content, mime: 'application/json;charset=utf-8' };
    } else if (f.language === 'asset' && f.content.startsWith('data:')) {
      const mimeMatch = f.content.match(/^data:([^;]+);/);
      virtualAssets[f.path] = {
        content: f.content,
        mime: mimeMatch ? mimeMatch[1] : 'application/octet-stream'
      };
    }
  });

  const slashIdx = targetHtml ? targetHtml.path.lastIndexOf('/') : -1;
  const baseDir = slashIdx >= 0 && targetHtml ? targetHtml.path.slice(0, slashIdx) : '';

  const bridgeScript = standaloneExport
    ? ''
    : `
<script>
(function () {
  var VIRTUAL_ASSETS = ${escapeInlineScript(JSON.stringify(virtualAssets))};
  var CURRENT_BASE_DIR = ${JSON.stringify(baseDir)};

  function resolveAssetEntry(url) {
    if (typeof url !== 'string') return null;
    if (/^(https?:|data:|blob:)/i.test(url)) return null;
    var clean = url.split('?')[0].split('#')[0].trim().replace(/^\\.?\\//, '');
    return VIRTUAL_ASSETS[clean] || null;
  }

  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      var entry = resolveAssetEntry(url);
      if (entry) {
        if (entry.content.indexOf('data:') === 0) {
          return origFetch.call(window, entry.content, init);
        }
        return Promise.resolve(new Response(entry.content, {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': entry.mime }
        }));
      }
      return origFetch.apply(window, arguments);
    };
  }

  function send(level, args) {
    try {
      var formatted = Array.prototype.slice.call(args).map(function (item) {
        if (typeof item === 'object' && item !== null) {
          try { return JSON.stringify(item, null, 2); } catch (e) { return String(item); }
        }
        return String(item);
      }).join(' ');
      window.parent.postMessage({
        source: 'localcode-live-preview',
        level: level,
        text: formatted + '\\n'
      }, '*');
    } catch (err) {}
  }

  var origLog = console.log;
  var origWarn = console.warn;
  var origErr = console.error;
  console.log = function () { send('log', arguments); origLog.apply(console, arguments); };
  console.warn = function () { send('warn', arguments); origWarn.apply(console, arguments); };
  console.error = function () { send('error', arguments); origErr.apply(console, arguments); };

  document.addEventListener('click', function (e) {
    var el = e.target;
    while (el && el.tagName !== 'A') {
      el = el.parentElement;
    }
    if (!el) return;
    var href = el.getAttribute('href');
    if (!href) return;
    if (/^(https?:|mailto:|tel:|javascript:|data:|blob:)/i.test(href)) return;

    if (href.charAt(0) === '#') {
      var id = href.slice(1);
      var targetEl = id ? document.getElementById(id) : null;
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    e.preventDefault();
    window.parent.postMessage({
      source: 'localcode-live-preview',
      action: 'navigate',
      href: href,
      baseDir: CURRENT_BASE_DIR
    }, '*');
  }, true);

  window.addEventListener('error', function (e) {
    send('error', ['[Runtime Error] ' + e.message + (e.lineno ? ' (dòng ' + e.lineno + ')' : '')]);
  });
  window.addEventListener('unhandledrejection', function (e) {
    send('error', ['[Promise Error] ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason))]);
  });
})();
</script>`;

  if (!targetHtml) {
    const cssBlocks = allFiles
      .filter((f) => f.language === 'css')
      .map((f) => {
        const slash = f.path.lastIndexOf('/');
        const cssDir = slash >= 0 ? f.path.slice(0, slash) : '';
        const resolvedCss = resolveCssContent(f.content, cssDir, fileMap, new Set([f.path]));
        return `<style data-source="${f.path}">\n${resolvedCss}\n</style>`;
      })
      .join('\n');

    const jsBlocks = allFiles
      .filter((f) => f.language === 'javascript')
      .map((f) => {
        if (standaloneExport) {
          return `<script type="module">\n${escapeInlineScript(f.content)}\n</script>`;
        }
        const blobUrl = getJsBlobUrl(f);
        return `<script type="module" data-source="${f.path}" src="${blobUrl}"></script>`;
      })
      .join('\n');

    return {
      html: `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Live Preview</title>
  ${bridgeScript}
  ${cssBlocks}
</head>
<body style="font-family: system-ui, sans-serif; padding: 20px;">
  <p style="opacity: 0.7; font-size: 13px;">Đang chạy xem trước trực tiếp (tạo thêm tệp <b>index.html</b> để thiết kế giao diện đầy đủ).</p>
  ${jsBlocks}
</body>
</html>`,
      blobUrls: createdUrls
    };
  }

  let html = targetHtml.content;

  // 1. Nhúng <link rel="stylesheet" href="..."> (kèm @import đệ quy) và favicon
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) return tag;
    const href = hrefMatch[1];
    if (/^(https?:|data:|blob:)/i.test(href)) return tag;

    if (/rel\s*=\s*["']?stylesheet["']?/i.test(tag)) {
      const matched = lookupWorkspaceFile(href, baseDir, fileMap);
      if (!matched) return tag;
      const cssSlash = matched.path.lastIndexOf('/');
      const cssDir = cssSlash >= 0 ? matched.path.slice(0, cssSlash) : '';
      const resolvedCss = resolveCssContent(matched.content, cssDir, fileMap, new Set([matched.path]));
      return standaloneExport
        ? `<style>\n${resolvedCss}\n</style>`
        : `<style data-source="${matched.path}">\n${resolvedCss}\n</style>`;
    }

    if (/rel\s*=\s*["']?[^"']*icon[^"']*["']?/i.test(tag)) {
      const matched = lookupWorkspaceFile(href, baseDir, fileMap);
      if (matched && matched.content.startsWith('data:')) {
        return tag.replace(hrefMatch[0], `href="${matched.content}"`);
      }
    }
    return tag;
  });

  // 2. Xử lý <script src="..."> và <script> nội tuyến
  html = html.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (full, attrs: string, innerCode: string) => {
      const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      const isModuleAttr = /\btype\s*=\s*["']?module["']?/i.test(attrs);

      if (srcMatch) {
        const src = srcMatch[1];
        if (/^(https?:|data:|blob:)/i.test(src)) return full;

        const matched = lookupWorkspaceFile(src, baseDir, fileMap);
        if (!matched) return full;

        const hasModuleSyntax = /\b(?:import|export)\b/.test(matched.content);

        // Khi xuất 1 tệp HTML độc lập: nhúng trực tiếp code JS vào thẻ <script> (hoặc data: URL nếu có import)
        if (standaloneExport) {
          const cleanAttrs = attrs.replace(srcMatch[0], '').trim();
          const typeAttr = !isModuleAttr && hasModuleSyntax ? ' type="module"' : '';
          const attrString = `${typeAttr}${cleanAttrs ? ` ${cleanAttrs}` : ''}`;

          if (hasModuleSyntax) {
            const dataUrl = createStandaloneJsDataUrl(matched, fileMap);
            return `<script${attrString} src="${dataUrl}"></script>`;
          }
          return `<script${attrString}>\n${escapeInlineScript(matched.content)}\n</script>`;
        }

        const blobUrl = getJsBlobUrl(matched);
        let nextAttrs = attrs.replace(srcMatch[0], `src="${blobUrl}"`);
        if (!isModuleAttr && hasModuleSyntax) {
          nextAttrs = ` type="module"${nextAttrs}`;
        }
        return `<script${nextAttrs}></script>`;
      }

      const transformedInline =
        isModuleAttr && !standaloneExport ? transformJsCode(innerCode, baseDir) : innerCode;
      return `<script${attrs}>${escapeInlineScript(transformedInline)}</script>`;
    }
  );

  // 3. Ánh xạ thuộc tính src="./..." trên <img>, <source>, <video>, <audio>
  html = html.replace(
    /<(img|source|video|audio)\b([^>]*?)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>/gi,
    (full, tagName, before, srcVal, after) => {
      if (/^(https?:|data:|blob:)/i.test(srcVal)) return full;
      const matched = lookupWorkspaceFile(srcVal, baseDir, fileMap);
      if (!matched || !matched.content.startsWith('data:')) return full;
      return `<${tagName}${before}src="${matched.content}"${after}>`;
    }
  );

  // 4. Ánh xạ @import và url('./...') trong thẻ <style> nội tuyến
  html = html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_full, attrs, cssBody) => {
    const resolvedInlineCss = resolveCssContent(cssBody, baseDir, fileMap);
    return `<style${attrs}>${resolvedInlineCss}</style>`;
  });

  if (bridgeScript) {
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${bridgeScript}`);
    } else {
      html = `${bridgeScript}\n${html}`;
    }
  }

  return { html, blobUrls: createdUrls };
}

export const WebPreviewPane: React.FC<WebPreviewPaneProps> = ({
  files,
  activeFile,
  selectedHtmlPath,
  revision,
  onSelectHtmlPath,
  onImportAssets,
  onConsoleMessage,
  onExportSuccess,
  onClose
}) => {
  const [viewport, setViewport] = useState<PreviewViewport>('desktop');
  const [manualReloadKey, setManualReloadKey] = useState(0);
  const [debouncedHtml, setDebouncedHtml] = useState<string>('');
  const [cssHotFlashed, setCssHotFlashed] = useState(false);
  const [navigatedPath, setNavigatedPath] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const savedScrollRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastStructuralSigRef = useRef<string>('');
  const hotFlashTimerRef = useRef<number | null>(null);
  const activeBlobUrlsRef = useRef<string[]>([]);

  const filesRef = useRef(files);
  filesRef.current = files;

  const htmlFiles = useMemo(() => files.filter((f) => f.language === 'html'), [files]);

  useEffect(() => {
    if (activeFile?.language === 'html') {
      setNavigatedPath(activeFile.path);
    }
  }, [activeFile?.path, activeFile?.language]);

  useEffect(() => {
    if (selectedHtmlPath) {
      setNavigatedPath(selectedHtmlPath);
    }
  }, [selectedHtmlPath]);

  const targetHtmlFile = useMemo(() => {
    if (navigatedPath) {
      const found = htmlFiles.find((f) => f.path === navigatedPath);
      if (found) return found;
    }
    if (activeFile?.language === 'html') return activeFile;
    if (selectedHtmlPath) {
      const found = htmlFiles.find((f) => f.path === selectedHtmlPath);
      if (found) return found;
    }
    return htmlFiles.find((f) => f.name.toLowerCase() === 'index.html') || htmlFiles[0] || null;
  }, [navigatedPath, activeFile, selectedHtmlPath, htmlFiles]);

  const structuralSignature = useMemo(() => {
    const nonCssParts = files
      .filter((f) => f.language !== 'css')
      .map((f) => `${f.path}:${f.content.length}:${f.language === 'asset' ? '' : f.content}`)
      .join('|');
    return `${targetHtmlFile?.path || 'virtual'}::${manualReloadKey}::${nonCssParts}`;
  }, [files, targetHtmlFile, manualReloadKey]);

  const cssSignature = useMemo(() => {
    return files
      .filter((f) => f.language === 'css')
      .map((f) => `${f.path}:${f.content}`)
      .join('|');
  }, [files]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.source !== 'localcode-live-preview') return;

      if (e.data.action === 'navigate') {
        const rawHref = String(e.data.href || '');
        const fromDir = String(e.data.baseDir || '');
        const resolved = resolveRelativePath(rawHref, fromDir);
        const currentHtmls = filesRef.current.filter((f) => f.language === 'html');

        const matchedPage =
          currentHtmls.find((f) => f.path === resolved) ||
          currentHtmls.find((f) => f.path === `${resolved}.html`) ||
          currentHtmls.find((f) => f.path === `${resolved}/index.html`);

        if (matchedPage) {
          savedScrollRef.current = { x: 0, y: 0 };
          setNavigatedPath(matchedPage.path);
          onSelectHtmlPath(matchedPage.path);
        } else {
          onConsoleMessage(
            'stderr',
            `[Live Server] Không tìm thấy trang "${rawHref}" trong Workspace.\n`
          );
        }
        return;
      }

      const level = e.data.level;
      const text = String(e.data.text ?? '');
      if (level === 'error' || level === 'warn') {
        onConsoleMessage('stderr', level === 'warn' ? `[Warn] ${text}` : text);
      } else {
        onConsoleMessage('stdout', text);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onConsoleMessage, onSelectHtmlPath]);

  useEffect(() => {
    return () => {
      if (hotFlashTimerRef.current) window.clearTimeout(hotFlashTimerRef.current);
      activeBlobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const win = iframeRef.current?.contentWindow;
        if (win) {
          savedScrollRef.current = { x: win.scrollX || 0, y: win.scrollY || 0 };
        }
      } catch {
        // Bỏ qua nếu iframe chưa sẵn sàng
      }

      const prevUrls = activeBlobUrlsRef.current;
      const { html, blobUrls } = buildBundledHtml(targetHtmlFile, filesRef.current, false);
      activeBlobUrlsRef.current = blobUrls;
      lastStructuralSigRef.current = structuralSignature;
      setDebouncedHtml(html);

      if (prevUrls.length > 0) {
        window.setTimeout(() => {
          prevUrls.forEach((u) => URL.revokeObjectURL(u));
        }, 1500);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [structuralSignature, targetHtmlFile]);

  useEffect(() => {
    if (!debouncedHtml) return;
    if (lastStructuralSigRef.current !== structuralSignature) return;

    const timer = window.setTimeout(() => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;

      const currentFiles = filesRef.current;
      const fileMap = new Map<string, WorkspaceFile>();
      currentFiles.forEach((f) => fileMap.set(f.path, f));

      let updatedAny = false;
      currentFiles
        .filter((f) => f.language === 'css')
        .forEach((cssFile) => {
          const styleEl = doc.querySelector(`style[data-source="${CSS.escape(cssFile.path)}"]`);
          if (styleEl) {
            const slash = cssFile.path.lastIndexOf('/');
            const cssDir = slash >= 0 ? cssFile.path.slice(0, slash) : '';
            const resolvedCss = resolveCssContent(
              cssFile.content,
              cssDir,
              fileMap,
              new Set([cssFile.path])
            );
            if (styleEl.textContent !== resolvedCss) {
              styleEl.textContent = resolvedCss;
              updatedAny = true;
            }
          }
        });

      if (updatedAny) {
        setCssHotFlashed(true);
        if (hotFlashTimerRef.current) window.clearTimeout(hotFlashTimerRef.current);
        hotFlashTimerRef.current = window.setTimeout(() => setCssHotFlashed(false), 1100);
      }
    }, 120);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cssSignature, revision]);

  const handleIframeLoad = useCallback(() => {
    try {
      const win = iframeRef.current?.contentWindow;
      const { x, y } = savedScrollRef.current;
      if (win && (x > 0 || y > 0)) {
        win.scrollTo(x, y);
      }
    } catch {
      // Bỏ qua
    }
  }, []);

  const handleOpenInNewTab = () => {
    const { html, blobUrls } = buildBundledHtml(targetHtmlFile, files, false);
    const pageBlob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(pageBlob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
    }, 60000);
  };

  /** Xuất 1 tệp HTML độc lập (đã nhúng sẵn toàn bộ CSS, JS và hình ảnh) */
  const handleExportStandaloneHtml = () => {
    const { html } = buildBundledHtml(targetHtmlFile, files, true);
    const fileName = targetHtmlFile?.name || 'index.html';
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    onExportSuccess?.(fileName);
  };

  const frameWidthClass =
    viewport === 'mobile'
      ? 'w-[375px] max-w-full rounded-2xl shadow-2xl my-2'
      : viewport === 'tablet'
        ? 'w-[768px] max-w-full rounded-2xl shadow-2xl my-2'
        : 'w-full h-full';

  return (
    <div
      style={{ backgroundColor: 'var(--bg-panel-alt)' }}
      className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden"
    >
      <div
        style={{ backgroundColor: 'var(--bg-panel-alt)' }}
        className="h-9 px-2.5 flex items-center justify-between gap-1.5 shrink-0"
      >
        <div
          style={{ backgroundColor: 'var(--bg-elevated)' }}
          className="flex-1 min-w-0 h-7 px-2.5 rounded-xl flex items-center gap-1.5 text-[11px]"
        >
          <span className="flex items-center gap-1 text-emerald-500 font-bold shrink-0">
            <Radio size={12} className="animate-pulse" />
            <span>LIVE</span>
          </span>
          <span style={{ color: 'var(--text-secondary)' }} className="hidden lg:inline truncate font-mono">
            http://127.0.0.1:5500/
          </span>

          {htmlFiles.length > 1 ? (
            <select
              value={targetHtmlFile?.path || ''}
              onChange={(e) => {
                setNavigatedPath(e.target.value);
                onSelectHtmlPath(e.target.value);
              }}
              style={{ color: 'var(--text-primary)' }}
              className="bg-transparent font-mono font-semibold outline-none cursor-pointer truncate"
            >
              {htmlFiles.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.path}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ color: 'var(--text-primary)' }} className="font-mono font-semibold truncate">
              {targetHtmlFile?.path || 'preview.html'}
            </span>
          )}

          {cssHotFlashed && (
            <span className="ml-auto px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold flex items-center gap-0.5 shrink-0">
              <Zap size={10} />
              <span>CSS Hot</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => assetInputRef.current?.click()}
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          className="h-7 px-2 rounded-xl text-[11px] font-medium flex items-center gap-1 btn-lift shrink-0"
          title="Tải ảnh (.png, .jpg, .svg), font hoặc .json vào Workspace"
        >
          <ImagePlus size={12} className="text-emerald-500" />
          <span className="hidden xl:inline">Asset</span>
        </button>
        <input
          ref={assetInputRef}
          type="file"
          multiple
          accept="image/*,.json,.woff,.woff2,.ttf,.otf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onImportAssets(e.target.files);
              e.target.value = '';
            }
          }}
        />

        <div
          style={{ backgroundColor: 'var(--bg-elevated)' }}
          className="hidden sm:flex items-center p-0.5 rounded-xl gap-0.5 shrink-0"
        >
          <button
            type="button"
            onClick={() => setViewport('desktop')}
            className={`p-1 rounded-lg transition-colors ${
              viewport === 'desktop'
                ? 'accent-pill-active'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title="Khung nhìn Desktop (100%)"
          >
            <Monitor size={12} />
          </button>
          <button
            type="button"
            onClick={() => setViewport('tablet')}
            className={`p-1 rounded-lg transition-colors ${
              viewport === 'tablet'
                ? 'accent-pill-active'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title="Khung nhìn iPad / Tablet (768px)"
          >
            <Tablet size={12} />
          </button>
          <button
            type="button"
            onClick={() => setViewport('mobile')}
            className={`p-1 rounded-lg transition-colors ${
              viewport === 'mobile'
                ? 'accent-pill-active'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title="Khung nhìn iPhone / Mobile (375px)"
          >
            <Smartphone size={12} />
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setManualReloadKey((k) => k + 1)}
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            className="w-7 h-7 rounded-xl flex items-center justify-center hover:text-[var(--text-primary)] btn-lift"
            title="Tải lại toàn bộ trang (Hard Reload)"
          >
            <RefreshCw size={12} />
          </button>

          <button
            type="button"
            onClick={handleExportStandaloneHtml}
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            className="w-7 h-7 rounded-xl flex items-center justify-center hover:text-emerald-500 btn-lift"
            title="Xuất 1 tệp HTML độc lập (đã nhúng sẵn CSS, JS & ảnh)"
          >
            <Download size={12} />
          </button>

          <button
            type="button"
            onClick={handleOpenInNewTab}
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            className="w-7 h-7 rounded-xl flex items-center justify-center hover:text-[var(--text-primary)] btn-lift"
            title="Mở trong tab trình duyệt mới"
          >
            <ExternalLink size={12} />
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            className="w-7 h-7 rounded-xl flex items-center justify-center hover:text-rose-500 btn-lift"
            title="Tắt Live Server"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full flex justify-center overflow-auto bg-[#141418]/30">
        <iframe
          ref={iframeRef}
          key={`${targetHtmlFile?.path || 'virtual'}-${manualReloadKey}`}
          title="Live Server Preview"
          srcDoc={debouncedHtml}
          onLoad={handleIframeLoad}
          sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
          className={`bg-white border-0 flex-1 ${frameWidthClass}`}
        />
      </div>
    </div>
  );
};