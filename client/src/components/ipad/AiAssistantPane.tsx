import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Square,
  RotateCcw,
  KeyRound,
  X,
  ChevronDown,
  Check,
  Copy,
  FileCode2,
  Terminal,
  FileText,
  GraduationCap,
  Zap,
  Bug,
  Lightbulb,
  Gauge,
  FlaskConical,
  Eye,
  EyeOff,
  ExternalLink,
  Brain,
  ChevronRight,
  GitCompare,
  ArrowDownToLine,
  Wand2,
  ImagePlus,
  Code2
} from 'lucide-react';
import {
  AiAssistantMode,
  AiSettings,
  AiThinkingLevel,
  GEMINI_MODELS,
  GeminiImageAttachment,
  buildIdeSystemInstruction,
  getModelMeta,
  resolveEffectiveModelId,
  streamGeminiInteraction
} from '../../services/geminiAi';
import { IdeDiagnostic, WorkspaceFile } from '../../types/ide';
import { TerminalChunk } from '../BottomPanel';
import type { EditorCodeSelection } from '../CodeEditor';

export interface AiAutoPromptRequest {
  id: number;
  prompt: string;
  includeCode?: boolean;
  includeConsole?: boolean;
  includeNotes?: boolean;
  forceMode?: AiAssistantMode;
  attachedImage?: {
    mimeType: string;
    data: string;
    previewUrl: string;
    thumbUrl: string;
    resolution?: 'low' | 'medium' | 'high';
  };
}

interface AiAssistantPaneProps {
  activeFile: WorkspaceFile | null;
  activeCode: string;
  codeSelection?: EditorCodeSelection | null;
  projectKey: string;
  logs: TerminalChunk[];
  diagnostics: IdeDiagnostic[];
  settings: AiSettings;
  onUpdateSettings: (patch: Partial<AiSettings>) => void;
  onApplyCodeToFile: (code: string, openDiffAfter?: boolean) => void;
  onInsertCodeAtCursor: (code: string) => void;
  onOpenDiffViewer: () => void;
  onClose: () => void;
  autoPrompt?: AiAutoPromptRequest | null;
  onConsumeAutoPrompt?: (id: number) => void;
  isSheet?: boolean;
}

interface PendingImageItem {
  id: string;
  mimeType: string;
  data: string;
  previewUrl: string;
  thumbUrl: string;
  resolution?: 'low' | 'medium' | 'high';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  thought?: string;
  modelId?: string;
  fallbackNotice?: string;
  retryPrompt?: string;
  contextTags?: string[];
  imageThumbs?: string[];
  totalTokens?: number;
  error?: string;
  streaming?: boolean;
}

interface PersistedChatSession {
  messages: ChatMessage[];
  interactionId: string | null;
  interactionModelId: string | null;
}

function chatStorageKeyFor(projectKey: string): string {
  return `localcode.ai.chat.v1::${projectKey || 'default'}`;
}

function loadPersistedChat(projectKey: string): PersistedChatSession {
  try {
    const raw = localStorage.getItem(chatStorageKeyFor(projectKey));
    if (!raw) return { messages: [], interactionId: null, interactionModelId: null };
    const parsed = JSON.parse(raw) as Partial<PersistedChatSession>;
    const msgs = Array.isArray(parsed.messages)
      ? parsed.messages
          .filter(
            (m) =>
              m &&
              (m.role === 'user' || m.role === 'assistant') &&
              (m.role === 'user' || Boolean(m.text?.trim()) || Boolean(m.error))
          )
          .map((m) => ({ ...m, streaming: false }))
          .slice(-20)
      : [];
    return {
      messages: msgs,
      interactionId: typeof parsed.interactionId === 'string' ? parsed.interactionId : null,
      interactionModelId:
        typeof parsed.interactionModelId === 'string' ? parsed.interactionModelId : null
    };
  } catch {
    return { messages: [], interactionId: null, interactionModelId: null };
  }
}

function savePersistedChat(projectKey: string, session: PersistedChatSession): void {
  try {
    const cleanMessages = session.messages
      .filter((m) => !m.streaming && (m.text.trim() || m.error || (m.imageThumbs && m.imageThumbs.length > 0)))
      .slice(-20)
      .map((m) => ({
        ...m,
        streaming: false,
        // Giới hạn tối đa 2 thumbnail nhỏ mỗi tin nhắn để localStorage luôn nhẹ
        imageThumbs: m.imageThumbs?.slice(0, 2)
      }));
    localStorage.setItem(
      chatStorageKeyFor(projectKey),
      JSON.stringify({
        messages: cleanMessages,
        interactionId: session.interactionId,
        interactionModelId: session.interactionModelId
      })
    );
  } catch {
    // Nếu bộ nhớ đầy thì lưu phiên bản không kèm thumbnail
    try {
      const lite = session.messages
        .filter((m) => !m.streaming && (m.text.trim() || m.error))
        .slice(-14)
        .map(({ imageThumbs: _drop, ...rest }) => ({ ...rest, streaming: false }));
      localStorage.setItem(
        chatStorageKeyFor(projectKey),
        JSON.stringify({
          messages: lite,
          interactionId: session.interactionId,
          interactionModelId: session.interactionModelId
        })
      );
    } catch {
      // Bỏ qua nếu vượt hạn mức storage
    }
  }
}

function buildRecentHistoryContext(messages: ChatMessage[]): string {
  const recent = messages
    .filter((m) => !m.streaming && !m.error && m.text.trim().length > 0)
    .slice(-6);
  if (recent.length === 0) return '';
  const lines = recent.map((m) => {
    const speaker = m.role === 'user' ? 'Người dùng' : 'Trợ lý';
    const body = m.text.length > 900 ? `${m.text.slice(0, 900)}...` : m.text;
    return `${speaker}: ${body}`;
  });
  return `[TÓM TẮT NGỮ CẢNH HỘI THOẠI TRƯỚC ĐÓ]\n${lines.join('\n\n')}`;
}

function compressImageFileForGemini(file: File): Promise<PendingImageItem | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          // Ảnh chất lượng rõ (tối đa 1280px) để Gemini đọc mượt chữ & công thức toán trên bảng/giấy
          const maxDim = 1280;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const jpegUrl = canvas.toDataURL('image/jpeg', 0.84);
          const base64Data = jpegUrl.replace(/^data:image\/jpeg;base64,/, '');

          // Thumbnail siêu nhỏ (~180px) để lưu lịch sử chat không tốn bộ nhớ
          const thumbMax = 180;
          const tScale = Math.min(1, thumbMax / Math.max(img.width, img.height));
          const tCanvas = document.createElement('canvas');
          tCanvas.width = Math.max(1, Math.round(img.width * tScale));
          tCanvas.height = Math.max(1, Math.round(img.height * tScale));
          const tCtx = tCanvas.getContext('2d');
          let thumbUrl = jpegUrl;
          if (tCtx) {
            tCtx.fillStyle = '#FFFFFF';
            tCtx.fillRect(0, 0, tCanvas.width, tCanvas.height);
            tCtx.drawImage(img, 0, 0, tCanvas.width, tCanvas.height);
            thumbUrl = tCanvas.toDataURL('image/jpeg', 0.72);
          }

          resolve({
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            mimeType: 'image/jpeg',
            data: base64Data,
            previewUrl: jpegUrl,
            thumbUrl
          });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Biểu tượng Ngôi sao 4 cánh tối giản đồng bộ trực tiếp theo màu nhấn của Theme hiện tại
 */
const GeminiMark: React.FC<{ size?: number; className?: string }> = ({
  size = 18,
  className = ''
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
    <defs>
      <linearGradient id="cwyThemeAiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--accent-primary)" />
        <stop offset="100%" stopColor="var(--accent-secondary)" />
      </linearGradient>
    </defs>
    <path
      d="M12 2.2C12.88 7.25 16.75 11.12 21.8 12C16.75 12.88 12.88 16.75 12 21.8C11.12 16.75 7.25 12.88 2.2 12C7.25 11.12 11.12 7.25 12 2.2Z"
      fill="url(#cwyThemeAiGrad)"
    />
  </svg>
);

function readProblemNotesText(projectKey: string): string {
  try {
    const raw = localStorage.getItem(`localcode.ipad.notes.v1::${projectKey || 'default'}`);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    const md = typeof parsed?.markdown === 'string' ? parsed.markdown.trim() : '';
    if (!md || md.startsWith('# Ghi chú & Đề bài\n\nDán đề bài LeetCode')) return '';
    return md;
  } catch {
    return '';
  }
}

function formatMathText(raw: string): React.ReactNode {
  const cleaned = raw
    .trim()
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\mathbf\{([^}]+)\}/g, '$1')
    .replace(/\\mathcal\{([^}]+)\}/g, '$1')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\log\b/g, 'log')
    .replace(/\\ln\b/g, 'ln')
    .replace(/\\min\b/g, 'min')
    .replace(/\\max\b/g, 'max')
    .replace(/\\bmod\b|\\mod\b/g, 'mod')
    .replace(/\\leq?|\\leqslant/g, '≤')
    .replace(/\\geq?|\\geqslant/g, '≥')
    .replace(/\\neq|\\ne\b/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\pm/g, '±')
    .replace(/\\infty/g, '∞')
    .replace(/\\rightarrow|\\to\b/g, '→')
    .replace(/\\leftarrow/g, '←')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\Leftrightarrow/g, '⇔')
    .replace(/\\sum\b/g, '∑')
    .replace(/\\prod\b/g, '∏')
    .replace(/\\in\b/g, '∈')
    .replace(/\\notin\b/g, '∉')
    .replace(/\\subset/g, '⊂')
    .replace(/\\cup/g, '∪')
    .replace(/\\cap/g, '∩')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\epsilon|\\varepsilon/g, 'ε')
    .replace(/\\theta/g, 'θ')
    .replace(/\\Theta/g, 'Θ')
    .replace(/\\Omega/g, 'Ω')
    .replace(/\\omega/g, 'ω')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\pi/g, 'π')
    .replace(/\\ldots|\\dots/g, '…')
    .replace(/\\left|\\right/g, '')
    .replace(/\\,|\\;|\\:|\\!/g, ' ')
    .replace(/\\([{}[\]_])/g, '$1')
    .replace(/\s+/g, ' ');

  // Chuyển số mũ ^ và chỉ số dưới _ sang <sup> / <sub> đẹp mắt
  const nodes: React.ReactNode[] = [];
  const subSupRegex = /(\^(?:\{[^}]+\}|[a-zA-Z0-9+-])|_(?:\{[^}]+\}|[a-zA-Z0-9+-]))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = subSupRegex.exec(cleaned)) !== null) {
    if (m.index > last) nodes.push(cleaned.slice(last, m.index));
    const tok = m[0];
    const body = tok.slice(1).replace(/^\{|\}$/g, '');
    if (tok.startsWith('^')) {
      nodes.push(
        <sup key={`sup-${k++}`} className="text-[0.76em] leading-none">
          {body}
        </sup>
      );
    } else {
      nodes.push(
        <sub key={`sub-${k++}`} className="text-[0.76em] leading-none">
          {body}
        </sub>
      );
    }
    last = m.index + tok.length;
  }
  if (last < cleaned.length) nodes.push(cleaned.slice(last));
  return nodes;
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|\$\$[^$]+\$\$|\$(?!\s)[^$\n]+?(?<!\s)\$|\\\([^)\n]+\\\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={`c-${keyIdx++}`}
          style={{
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)'
          }}
          className="px-1.5 py-0.5 rounded-md font-mono text-[11px] font-medium"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`b-${keyIdx++}`} className="font-bold" style={{ color: 'var(--text-primary)' }}>
          {renderInlineMarkdown(token.slice(2, -2))}
        </strong>
      );
    } else if (
      (token.startsWith('$$') && token.endsWith('$$')) ||
      (token.startsWith('$') && token.endsWith('$')) ||
      (token.startsWith('\\(') && token.endsWith('\\)'))
    ) {
      const inner = token.startsWith('$$')
        ? token.slice(2, -2)
        : token.startsWith('\\(')
          ? token.slice(2, -2)
          : token.slice(1, -1);
      parts.push(
        <span
          key={`m-${keyIdx++}`}
          style={{
            backgroundColor: 'color-mix(in srgb, var(--accent-primary) 10%, var(--bg-panel-alt))',
            color: 'var(--text-primary)'
          }}
          className="px-1.5 py-0.5 rounded-md font-mono text-[11.5px] font-semibold"
        >
          {formatMathText(inner)}
        </span>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={`i-${keyIdx++}`} className="italic opacity-90">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

interface MarkdownBlockProps {
  content: string;
  hasActiveFile: boolean;
  onApplyCode: (code: string) => void;
  onInsertCode: (code: string) => void;
  onOpenDiff: () => void;
}

const AiMarkdownView: React.FC<MarkdownBlockProps> = React.memo(
  ({ content, hasActiveFile, onApplyCode, onInsertCode, onOpenDiff }) => {
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const [appliedIdx, setAppliedIdx] = useState<number | null>(null);

    const blocks = useMemo(() => {
      const result: Array<
        | { kind: 'text'; text: string }
        | { kind: 'code'; lang: string; code: string }
      > = [];
      const regex = /```([a-zA-Z0-9+#._-]*)\r?\n([\s\S]*?)```/g;
      let lastIdx = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(content)) !== null) {
        if (match.index > lastIdx) {
          result.push({ kind: 'text', text: content.slice(lastIdx, match.index) });
        }
        result.push({
          kind: 'code',
          lang: (match[1] || 'code').trim(),
          code: match[2].replace(/\n$/, '')
        });
        lastIdx = match.index + match[0].length;
      }

      if (lastIdx < content.length) {
        const rest = content.slice(lastIdx);
        const openFenceIdx = rest.indexOf('```');
        if (openFenceIdx !== -1) {
          if (openFenceIdx > 0) {
            result.push({ kind: 'text', text: rest.slice(0, openFenceIdx) });
          }
          const afterFence = rest.slice(openFenceIdx + 3);
          const nlIdx = afterFence.indexOf('\n');
          if (nlIdx !== -1) {
            result.push({
              kind: 'code',
              lang: afterFence.slice(0, nlIdx).trim() || 'code',
              code: afterFence.slice(nlIdx + 1)
            });
          } else {
            result.push({ kind: 'text', text: rest.slice(openFenceIdx) });
          }
        } else {
          result.push({ kind: 'text', text: rest });
        }
      }
      return result;
    }, [content]);

    const handleCopy = async (code: string, idx: number) => {
      try {
        await navigator.clipboard.writeText(code);
        setCopiedIdx(idx);
        window.setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1600);
      } catch {
        // Ignore clipboard denial
      }
    };

    const renderTextSegment = (segment: string, segIdx: number) => {
      const lines = segment.split('\n');
      return lines.map((line, i) => {
        const key = `${segIdx}-${i}`;
        const trimmed = line.trim();
        if (!trimmed) return <div key={key} className="h-1.5" />;

        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={key}
              className="text-[12.5px] font-bold mt-3 mb-1 tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {renderInlineMarkdown(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3
              key={key}
              className="text-[13.5px] font-extrabold mt-3 mb-1 tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {renderInlineMarkdown(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2
              key={key}
              className="text-sm font-extrabold mt-2.5 mb-1 tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {renderInlineMarkdown(trimmed.slice(2))}
            </h2>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={key} className="flex items-start gap-2 text-[13px] leading-relaxed my-0.5 pl-0.5">
              <span
                className="mt-2 w-1.5 h-1.5 rounded-full shrink-0 opacity-75"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              />
              <span className="min-w-0 flex-1">{renderInlineMarkdown(trimmed.slice(2))}</span>
            </div>
          );
        }
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={key} className="flex items-start gap-2 text-[13px] leading-relaxed my-0.5 pl-0.5">
              <span
                className="text-[11.5px] font-bold shrink-0 mt-0.5 min-w-[16px]"
                style={{ color: 'var(--accent-primary)' }}
              >
                {numMatch[1]}.
              </span>
              <span className="min-w-0 flex-1">{renderInlineMarkdown(numMatch[2])}</span>
            </div>
          );
        }
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={key}
              style={{
                backgroundColor: 'var(--bg-panel-alt)',
                color: 'var(--text-secondary)'
              }}
              className="my-2 px-3 py-2 rounded-xl text-[12px] leading-relaxed"
            >
              {renderInlineMarkdown(trimmed.slice(2))}
            </blockquote>
          );
        }
        return (
          <p key={key} className="text-[13px] leading-relaxed my-0.5">
            {renderInlineMarkdown(line)}
          </p>
        );
      });
    };

    return (
      <div className="space-y-1.5 min-w-0 break-words">
        {blocks.map((block, idx) => {
          if (block.kind === 'text') {
            return <div key={`t-${idx}`}>{renderTextSegment(block.text, idx)}</div>;
          }

          const isCopied = copiedIdx === idx;
          const isApplied = appliedIdx === idx;
          const isRealCode = block.code.trim().length > 0 && block.lang.toLowerCase() !== 'text';

          return (
            <div
              key={`c-${idx}`}
              style={{
                backgroundColor: 'var(--bg-canvas)'
              }}
              className="my-2.5 rounded-2xl overflow-hidden"
            >
              <div
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 55%, transparent)'
                }}
                className="px-3 py-1.5 flex items-center justify-between gap-2"
              >
                <span
                  className="text-[10px] font-mono font-bold uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {block.lang || 'code'}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleCopy(block.code, idx)}
                    style={{
                      backgroundColor: 'var(--bg-panel)',
                      color: isCopied ? '#10B981' : 'var(--text-secondary)'
                    }}
                    className="h-6 px-2 rounded-lg text-[10px] font-semibold flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
                    title="Sao chép đoạn code"
                  >
                    {isCopied ? <Check size={11} /> : <Copy size={11} />}
                    <span>{isCopied ? 'Đã chép' : 'Chép'}</span>
                  </button>

                  {hasActiveFile && isRealCode && (
                    <>
                      <button
                        type="button"
                        onClick={() => onInsertCode(block.code)}
                        style={{
                          backgroundColor: 'var(--bg-panel)',
                          color: 'var(--text-secondary)'
                        }}
                        className="h-6 px-2 rounded-lg text-[10px] font-semibold flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
                        title="Chèn vào vị trí con trỏ hiện tại"
                      >
                        <ArrowDownToLine size={11} />
                        <span className="hidden sm:inline">Chèn</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onApplyCode(block.code);
                          setAppliedIdx(idx);
                        }}
                        style={{
                          backgroundColor: isApplied
                            ? 'rgba(16, 185, 129, 0.16)'
                            : 'var(--accent-primary)',
                          color: isApplied ? '#10B981' : '#FFFFFF'
                        }}
                        className="h-6 px-2.5 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:brightness-110 transition-all"
                        title="Tự động lưu bản gốc Snapshot rồi áp dụng vào tệp hiện tại"
                      >
                        {isApplied ? <Check size={11} /> : <Wand2 size={11} />}
                        <span>{isApplied ? 'Đã áp dụng' : 'Áp dụng'}</span>
                      </button>

                      {isApplied && (
                        <button
                          type="button"
                          onClick={onOpenDiff}
                          style={{
                            backgroundColor: 'var(--bg-panel)',
                            color: 'var(--accent-primary)'
                          }}
                          className="h-6 px-2 rounded-lg text-[10px] font-semibold flex items-center gap-1"
                          title="So sánh bản gốc với bản vừa áp dụng"
                        >
                          <GitCompare size={11} />
                          <span>Diff</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <pre
                style={{ color: 'var(--text-primary)' }}
                className="p-3 font-mono text-[11.5px] leading-relaxed overflow-x-auto select-text"
              >
                <code>{block.code}</code>
              </pre>
            </div>
          );
        })}
      </div>
    );
  }
);

export const AiAssistantPane: React.FC<AiAssistantPaneProps> = ({
  activeFile,
  activeCode,
  codeSelection = null,
  projectKey,
  logs,
  diagnostics,
  settings,
  onUpdateSettings,
  onApplyCodeToFile,
  onInsertCodeAtCursor,
  onOpenDiffViewer,
  onClose,
  autoPrompt = null,
  onConsumeAutoPrompt,
  isSheet = false
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadPersistedChat(projectKey).messages);
  const [sessionKey, setSessionKey] = useState(projectKey);
  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImageItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);

  useEffect(() => {
    if (!isStreaming) {
      setWaitSeconds(0);
      return;
    }
    setWaitSeconds(0);
    const id = window.setInterval(() => {
      setWaitSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isStreaming]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [keyEditorOpen, setKeyEditorOpen] = useState(false);
  const [draftApiKey, setDraftApiKey] = useState(settings.apiKey);
  const [showKeyText, setShowKeyText] = useState(false);
  const [draftCustomModel, setDraftCustomModel] = useState(settings.customModelId);
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});

  // Context toggles
  const [attachFile, setAttachFile] = useState(true);
  const [attachSelection, setAttachSelection] = useState(true);
  const [attachConsole, setAttachConsole] = useState(false);
  const [attachNotes, setAttachNotes] = useState(false);

  const interactionIdRef = useRef<string | null>(null);
  const interactionModelRef = useRef<string | null>(null);
  const hydratedProjectRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const handledAutoPromptIdRef = useRef<number>(0);

  // Tự động nạp lịch sử chat riêng cho từng file / project
  useEffect(() => {
    if (hydratedProjectRef.current === projectKey) return;
    const isProjectSwitch = hydratedProjectRef.current !== null;
    hydratedProjectRef.current = projectKey;
    const saved = loadPersistedChat(projectKey);
    interactionIdRef.current = saved.interactionId;
    interactionModelRef.current = saved.interactionModelId;
    if (isProjectSwitch) {
      abortRef.current?.abort();
      abortRef.current = null;
      setIsStreaming(false);
      setMessages(saved.messages);
      setPendingImages([]);
      setSessionKey(projectKey);
    }
  }, [projectKey]);

  // Lưu lịch sử chat bền vững vào localStorage mỗi khi hoàn tất tin nhắn
  useEffect(() => {
    if (isStreaming || sessionKey !== projectKey) return;
    savePersistedChat(projectKey, {
      messages,
      interactionId: interactionIdRef.current,
      interactionModelId: interactionModelRef.current
    });
  }, [messages, isStreaming, projectKey, sessionKey]);

  // Kiểm tra đoạn code đang được bôi đen trong Monaco có thuộc tệp hiện tại không
  const activeSelection = useMemo(() => {
    if (!codeSelection || !codeSelection.text.trim()) return null;
    if (activeFile && codeSelection.filePath !== activeFile.path) return null;
    return codeSelection;
  }, [codeSelection, activeFile]);

  const selectionRangeKey = activeSelection
    ? `${activeSelection.filePath}:${activeSelection.startLine}-${activeSelection.endLine}`
    : '';

  useEffect(() => {
    if (selectionRangeKey) {
      setAttachSelection(true);
    }
  }, [selectionRangeKey]);

  useEffect(() => {
    setDraftApiKey(settings.apiKey);
  }, [settings.apiKey]);

  useEffect(() => {
    setDraftCustomModel(settings.customModelId);
  }, [settings.customModelId]);

  const effectiveModelId = resolveEffectiveModelId(settings);
  const activeModelMeta = useMemo(() => getModelMeta(effectiveModelId), [effectiveModelId]);

  const consoleText = useMemo(() => {
    const joined = logs
      .map((l) => l.text)
      .join('')
      .trim();
    if (joined.length <= 3500) return joined;
    return joined.slice(-3500);
  }, [logs]);

  const hasConsoleError = useMemo(() => {
    return (
      diagnostics.some((d) => d.severity === 'error') ||
      logs.some((l) => l.type === 'stderr' && l.text.trim().length > 0)
    );
  }, [diagnostics, logs]);

  const hasNotesContent = useMemo(
    () => readProblemNotesText(projectKey).length > 0,
    [projectKey, messages.length]
  );

  useEffect(() => {
    if (hasConsoleError) {
      setAttachConsole(true);
    }
  }, [hasConsoleError]);

  useEffect(() => {
    if (!modelMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [modelMenuOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(120, Math.max(36, el.scrollHeight))}px`;
  }, [input]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleStopStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    );
  }, []);

  const handleResetChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    interactionIdRef.current = null;
    interactionModelRef.current = null;
    setIsStreaming(false);
    setMessages([]);
    setPendingImages([]);
    try {
      localStorage.removeItem(chatStorageKeyFor(projectKey));
    } catch {
      // Bỏ qua nếu trình duyệt chặn storage
    }
  }, [projectKey]);

  const appendImageFiles = useCallback(async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (rawFiles.length === 0) return;
    const processed = await Promise.all(rawFiles.slice(0, 3).map(compressImageFileForGemini));
    const valid = processed.filter((item): item is PendingImageItem => item !== null);
    if (valid.length === 0) return;
    setPendingImages((prev) => [...prev, ...valid].slice(0, 3));
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) imageFiles.push(f);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        void appendImageFiles(imageFiles);
      }
    },
    [appendImageFiles]
  );

  const sendMessage = useCallback(
    async (
      rawPrompt: string,
      opts?: {
        includeCode?: boolean;
        includeConsole?: boolean;
        includeNotes?: boolean;
        overrideMode?: AiAssistantMode;
        extraImages?: PendingImageItem[];
      }
    ) => {
      const promptText = rawPrompt.trim();
      const imagesToSend =
        opts?.extraImages && opts.extraImages.length > 0
          ? [...opts.extraImages, ...pendingImages].slice(0, 3)
          : pendingImages;
      if ((!promptText && imagesToSend.length === 0) || isStreaming) return;

      if (!settings.apiKey.trim()) {
        setKeyEditorOpen(true);
        return;
      }

      const effectivePromptText =
        promptText ||
        'Hãy đọc kỹ đề bài / nội dung trong ảnh này, giải thích rõ yêu cầu và gợi ý hướng cài đặt code.';

      const useCode = opts?.includeCode ?? attachFile;
      const useConsole = opts?.includeConsole ?? attachConsole;
      const useNotes = opts?.includeNotes ?? attachNotes;
      const modeToUse = opts?.overrideMode ?? settings.assistantMode;

      const contextSections: string[] = [];
      const contextTags: string[] = [];

      if (imagesToSend.length > 0) {
        contextTags.push(imagesToSend.length === 1 ? 'Ảnh' : `Ảnh ×${imagesToSend.length}`);
      }

      if (activeSelection && attachSelection) {
        const selSnippet =
          activeSelection.text.length > 6000
            ? `${activeSelection.text.slice(0, 6000)}\n// ... (đã rút gọn)`
            : activeSelection.text;
        contextSections.push(
          `[ĐOẠN CODE NGƯỜI DÙNG ĐANG BÔI ĐEN: ${activeSelection.fileName} (dòng ${activeSelection.startLine}–${activeSelection.endLine})]\n\`\`\`${activeFile?.language || ''}\n${selSnippet}\n\`\`\``
        );
        contextTags.push(`L${activeSelection.startLine}–${activeSelection.endLine}`);
      }

      if (useCode && activeFile) {
        const snippet =
          activeCode.length > 14000 ? `${activeCode.slice(0, 14000)}\n// ... (đã rút gọn)` : activeCode;
        contextSections.push(
          `[TỆP ĐANG MỞ: ${activeFile.path} (${activeFile.language})]\n\`\`\`${activeFile.language}\n${snippet}\n\`\`\``
        );
        contextTags.push(activeFile.name);
      }

      if (useConsole && (consoleText || diagnostics.length > 0)) {
        const diagLines = diagnostics
          .slice(0, 12)
          .map((d) => `Dòng ${d.line}:${d.column} [${d.severity}]: ${d.message}`)
          .join('\n');
        const combinedLog = [diagLines, consoleText].filter(Boolean).join('\n\n');
        if (combinedLog) {
          contextSections.push(`[CONSOLE / LỖI BIÊN DỊCH]\n\`\`\`text\n${combinedLog}\n\`\`\``);
          contextTags.push('Console');
        }
      }

      if (useNotes) {
        const noteMd = readProblemNotesText(projectKey);
        if (noteMd) {
          contextSections.push(`[ĐỀ BÀI & GHI CHÚ]\n${noteMd.slice(0, 4500)}`);
          contextTags.push('Đề bài');
        }
      }

      const fullPrompt =
        contextSections.length > 0
          ? `${contextSections.join('\n\n')}\n\n[YÊU CẦU CỦA NGƯỜI DÙNG]\n${effectivePromptText}`
          : effectivePromptText;

      const userMsgId = `u_${Date.now()}`;
      const aiMsgId = `a_${Date.now() + 1}`;
      const modelUsed = resolveEffectiveModelId(settings);

      // Chỉ nối previous_interaction_id nếu trùng đúng model trước đó; đổi model giữa chừng -> dùng fallbackHistoryText mượt mà!
      const canReuseInteraction = Boolean(
        interactionIdRef.current && interactionModelRef.current === modelUsed
      );
      const fallbackHistoryText = buildRecentHistoryContext(messages);

      const imageAttachments: GeminiImageAttachment[] = imagesToSend.map(
        ({ mimeType, data, resolution }) => ({
          mimeType,
          data,
          resolution
        })
      );
      const imageThumbs = imagesToSend.map((img) => img.thumbUrl);

      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          role: 'user',
          text: effectivePromptText,
          contextTags,
          imageThumbs: imageThumbs.length > 0 ? imageThumbs : undefined
        },
        {
          id: aiMsgId,
          role: 'assistant',
          text: '',
          thought: '',
          modelId: modelUsed,
          retryPrompt: effectivePromptText,
          streaming: true
        }
      ]);
      setInput('');
      setPendingImages([]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let activeStreamModel = modelUsed;
        const result = await streamGeminiInteraction({
          apiKey: settings.apiKey,
          modelId: modelUsed,
          input: fullPrompt,
          images: imageAttachments.length > 0 ? imageAttachments : undefined,
          fallbackHistoryText,
          systemInstruction: buildIdeSystemInstruction(modeToUse),
          thinkingLevel: settings.thinkingLevel,
          previousInteractionId: canReuseInteraction ? interactionIdRef.current : null,
          signal: controller.signal,
          onInteractionId: (id) => {
            interactionIdRef.current = id;
            interactionModelRef.current = activeStreamModel;
          },
          onModelFallback: (fbId, notice) => {
            activeStreamModel = fbId;
            interactionModelRef.current = fbId;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId ? { ...m, modelId: fbId, fallbackNotice: notice } : m
              )
            );
          },
          onThoughtDelta: (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId ? { ...m, thought: (m.thought || '') + chunk } : m
              )
            );
          },
          onTextDelta: (chunk) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === aiMsgId ? { ...m, text: m.text + chunk } : m))
            );
          }
        });

        interactionModelRef.current = result.actualModelId;
        if (result.interactionId) {
          interactionIdRef.current = result.interactionId;
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  modelId: result.actualModelId,
                  text: result.text || m.text || '(Không có nội dung phản hồi từ mô hình.)',
                  thought: result.thought || m.thought,
                  totalTokens: result.totalTokens,
                  streaming: false
                }
              : m
          )
        );
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
          );
        } else {
          const message = err instanceof Error ? err.message : 'Đã xảy ra lỗi khi gọi Gemini API.';
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, error: message, streaming: false } : m
            )
          );
        }
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [
      isStreaming,
      pendingImages,
      messages,
      settings,
      attachFile,
      attachSelection,
      attachConsole,
      attachNotes,
      activeSelection,
      activeFile,
      activeCode,
      consoleText,
      diagnostics,
      projectKey
    ]
  );

  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  const onConsumeAutoPromptRef = useRef(onConsumeAutoPrompt);
  onConsumeAutoPromptRef.current = onConsumeAutoPrompt;

  useEffect(() => {
    if (!autoPrompt || autoPrompt.id === handledAutoPromptIdRef.current) return;

    // Trì hoãn 1 tick để React StrictMode (dev) hủy sạch mount nháp mà KHÔNG làm abort nhầm fetch()!
    const timer = window.setTimeout(() => {
      if (autoPrompt.id === handledAutoPromptIdRef.current) return;
      handledAutoPromptIdRef.current = autoPrompt.id;
      onConsumeAutoPromptRef.current?.(autoPrompt.id);

      const sketchItem: PendingImageItem | null = autoPrompt.attachedImage
        ? {
            id: `sketch_${autoPrompt.id}`,
            mimeType: autoPrompt.attachedImage.mimeType,
            data: autoPrompt.attachedImage.data,
            previewUrl: autoPrompt.attachedImage.previewUrl,
            thumbUrl: autoPrompt.attachedImage.thumbUrl,
            resolution: autoPrompt.attachedImage.resolution
          }
        : null;

      if (!settings.apiKey.trim()) {
        setKeyEditorOpen(true);
        setInput(autoPrompt.prompt);
        if (sketchItem) {
          setPendingImages((prev) => [sketchItem, ...prev].slice(0, 3));
        }
        return;
      }

      void sendMessageRef.current(autoPrompt.prompt, {
        includeCode: autoPrompt.includeCode ?? true,
        includeConsole: autoPrompt.includeConsole ?? true,
        includeNotes: autoPrompt.includeNotes ?? false,
        overrideMode: autoPrompt.forceMode,
        extraImages: sketchItem ? [sketchItem] : undefined
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [autoPrompt, settings.apiKey]);

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({ apiKey: draftApiKey.trim() });
    setKeyEditorOpen(false);
  };

  const quickActions = [
    {
      id: 'debug',
      icon: <Bug size={14} />,
      color: '#FB7185',
      title: hasConsoleError ? 'Giải thích lỗi vừa chạy' : 'Tìm lỗi tiềm ẩn',
      subtitle: hasConsoleError ? 'Đọc log đỏ từ Console' : 'Soi bug logic & biên mảng',
      highlight: hasConsoleError,
      prompt: hasConsoleError
        ? 'Hãy giải thích chi tiết lỗi biên dịch / runtime trong Console, chỉ rõ dòng bị sai và hướng dẫn cách sửa.'
        : 'Hãy rà soát mã nguồn đang mở xem có lỗi tiềm ẩn, tràn số, truy cập ngoài mảng hay trường hợp biên nào không.',
      includeConsole: true
    },
    {
      id: 'algo',
      icon: <Lightbulb size={14} />,
      color: '#38BDF8',
      title: 'Gợi ý thuật toán',
      subtitle: 'Tư duy & CTDL tối ưu',
      highlight: false,
      prompt:
        'Hãy phân tích hướng giải và gợi ý cấu trúc dữ liệu / thuật toán tối ưu cho bài này (kèm đánh giá Big-O).',
      includeNotes: true
    },
    {
      id: 'optimize',
      icon: <Gauge size={14} />,
      color: '#10B981',
      title: 'Tối ưu & Big-O',
      subtitle: 'Giảm TLE / MLE, sạch code',
      highlight: false,
      prompt:
        'Hãy đánh giá độ phức tạp thời gian/không gian (Big-O) của đoạn code hiện tại và gợi ý cách tối ưu sạch hơn.'
    },
    {
      id: 'tests',
      icon: <FlaskConical size={14} />,
      color: '#F59E0B',
      title: 'Sinh test biên',
      subtitle: 'Case hiểm (0, âm, max N)',
      highlight: false,
      prompt:
        'Hãy tạo 4 bộ test case hiểm (trường hợp biên như n=0, n=1, số lớn, dữ liệu trùng/âm) kèm Input và Output mong đợi.'
    }
  ];

  const hasApiKey = settings.apiKey.trim().length > 0;
  const canSend = Boolean(input.trim() || pendingImages.length > 0);

  return (
    <div
      onPaste={handlePaste}
      style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }}
      className={`h-full flex flex-col overflow-hidden relative select-none ${
        isSheet ? 'rounded-t-3xl' : ''
      }`}
    >
      {/* Quầng sáng cực dịu đồng bộ màu Theme — không có bất kỳ đường kẻ cứng nào */}
      <div
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 90% 55% at 50% -18%, color-mix(in srgb, var(--accent-primary) 16%, transparent) 0%, transparent 72%)'
        }}
        className="pointer-events-none absolute inset-x-0 top-0 h-36 z-0"
      />

      {/* ==================== HEADER TỐI GIẢN KHÔNG VIỀN (APPLE / CLAUDE STYLE) ==================== */}
      <div className="relative z-20 px-3.5 pt-3 pb-1.5 flex items-center justify-between gap-2 shrink-0">
        {/* Model Picker Pill — mềm mại, không viền */}
        <div className="relative min-w-0" ref={modelMenuRef}>
          <button
            type="button"
            onClick={() => setModelMenuOpen((v) => !v)}
            style={{
              backgroundColor: 'var(--bg-panel-alt)',
              color: 'var(--text-primary)'
            }}
            className="h-8 pl-2.5 pr-2.5 rounded-full flex items-center gap-2 max-w-[190px] hover:bg-[var(--bg-elevated)] active:scale-[0.97] transition-all"
            title="Chọn mô hình Gemini & mức độ suy luận"
          >
            <GeminiMark size={14} className="shrink-0" />
            <span className="text-[12px] font-bold tracking-tight truncate">
              {activeModelMeta.shortLabel}
            </span>
            <ChevronDown
              size={12}
              className={`shrink-0 transition-transform duration-200 ${
                modelMenuOpen ? 'rotate-180' : ''
              }`}
              style={{ color: 'var(--text-secondary)' }}
            />
          </button>

          {/* FLOATING MODEL & THINKING POPOVER — BÓNG ĐỔ MỀM, KHÔNG VIỀN THÔ */}
          {modelMenuOpen && (
            <div
              style={{
                backgroundColor: 'var(--bg-panel)',
                boxShadow:
                  '0 20px 50px -12px rgba(0, 0, 0, 0.32), 0 0 0 1px color-mix(in srgb, var(--text-primary) 6%, transparent)'
              }}
              className="absolute left-0 top-10 w-[284px] max-w-[82vw] rounded-2xl p-2 z-50 ios-popover-enter space-y-2"
            >
              <div className="px-2.5 pt-1 flex items-center justify-between">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Mô hình Gemini
                </span>
                <span className="text-[10px] opacity-70" style={{ color: 'var(--text-secondary)' }}>
                  1M Context
                </span>
              </div>

              <div className="space-y-1 max-h-[250px] overflow-y-auto pr-0.5">
                {GEMINI_MODELS.map((m) => {
                  const selected = settings.modelId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onUpdateSettings({ modelId: m.id });
                        setModelMenuOpen(false);
                      }}
                      style={{
                        backgroundColor: selected ? 'var(--bg-active)' : 'transparent'
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-left hover:bg-[var(--bg-panel-alt)] transition-colors flex items-start gap-2.5"
                    >
                      <span
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: m.accent }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className="text-[12px] font-bold truncate"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {m.label}
                          </span>
                          <span
                            style={{
                              backgroundColor:
                                m.tier === 'free'
                                  ? 'rgba(16, 185, 129, 0.14)'
                                  : m.tier === 'fast'
                                    ? 'rgba(56, 189, 248, 0.14)'
                                    : 'rgba(168, 85, 247, 0.14)',
                              color:
                                m.tier === 'free'
                                  ? '#10B981'
                                  : m.tier === 'fast'
                                    ? '#0EA5E9'
                                    : '#A855F7'
                            }}
                            className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold shrink-0"
                          >
                            {m.tierLabel}
                          </span>
                        </div>
                        <p
                          className="text-[10.5px] leading-snug mt-0.5"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {m.description}
                        </p>
                      </div>
                      {selected && (
                        <Check
                          size={13}
                          className="shrink-0 mt-1"
                          style={{ color: 'var(--accent-primary)' }}
                        />
                      )}
                    </button>
                  );
                })}

                {/* Custom Model ID — Borderless */}
                <div
                  style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                  className="p-2.5 rounded-xl space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                      Custom Model ID
                    </span>
                    {settings.modelId === '__custom__' && (
                      <span className="text-[9.5px] font-bold" style={{ color: 'var(--accent-primary)' }}>
                        Đang dùng
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={draftCustomModel}
                      onChange={(e) => setDraftCustomModel(e.target.value)}
                      placeholder="vd: gemini-4-neon"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        color: 'var(--text-primary)'
                      }}
                      className="flex-1 min-w-0 h-7 px-2.5 rounded-lg font-mono text-[10.5px] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!draftCustomModel.trim()) return;
                        onUpdateSettings({
                          modelId: '__custom__',
                          customModelId: draftCustomModel.trim()
                        });
                        setModelMenuOpen(false);
                      }}
                      style={{ backgroundColor: 'var(--accent-primary)', color: '#FFFFFF' }}
                      className="h-7 px-2.5 rounded-lg text-[10.5px] font-bold shrink-0"
                    >
                      Dùng
                    </button>
                  </div>
                </div>
              </div>

              {/* Thinking Level — Borderless segmented */}
              <div className="pt-1 px-1 space-y-1.5">
                <span
                  className="px-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Brain size={11} />
                  Mức suy luận
                </span>
                <div
                  style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                  className="p-0.5 rounded-xl grid grid-cols-4 gap-0.5"
                >
                  {(
                    [
                      { id: 'minimal', label: 'Tức thì' },
                      { id: 'low', label: 'Nhanh' },
                      { id: 'medium', label: 'Vừa' },
                      { id: 'high', label: 'Sâu' }
                    ] as Array<{ id: AiThinkingLevel; label: string }>
                  ).map((lv) => {
                    const active = settings.thinkingLevel === lv.id;
                    return (
                      <button
                        key={lv.id}
                        type="button"
                        onClick={() => onUpdateSettings({ thinkingLevel: lv.id })}
                        style={{
                          backgroundColor: active ? 'var(--bg-panel)' : 'transparent',
                          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                          boxShadow: active ? '0 2px 6px -2px rgba(0,0,0,0.14)' : undefined
                        }}
                        className="py-1 rounded-lg text-[10.5px] font-semibold transition-all"
                      >
                        {lv.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Ghost Icon Actions (không đóng khung) */}
        <div className="flex items-center gap-0.5 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleResetChat}
              className="w-8 h-8 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-alt)] flex items-center justify-center transition-colors"
              title="Cuộc trò chuyện mới"
            >
              <RotateCcw size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setKeyEditorOpen((v) => !v)}
            className="relative w-8 h-8 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-alt)] flex items-center justify-center transition-colors"
            title={hasApiKey ? 'Quản lý Gemini API Key (đã lưu)' : 'Nhập Gemini API Key'}
          >
            <KeyRound size={14} />
            <span
              className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                hasApiKey ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-alt)] flex items-center justify-center transition-colors"
            title="Đóng Trợ lý AI"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ==================== INLINE API KEY DRAWER (BORDERLESS) ==================== */}
      {keyEditorOpen && (
        <form
          onSubmit={handleSaveApiKey}
          style={{ backgroundColor: 'var(--bg-panel-alt)' }}
          className="relative z-10 mx-3.5 mt-1.5 p-3 rounded-2xl space-y-2.5 shrink-0 tab-content-enter"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] font-bold flex items-center gap-1.5">
              <KeyRound size={13} style={{ color: 'var(--accent-primary)' }} />
              <span>Gemini API Key cá nhân</span>
            </span>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent-primary)' }}
              className="text-[11px] font-semibold hover:underline flex items-center gap-1"
            >
              <span>Lấy miễn phí</span>
              <ExternalLink size={10} />
            </a>
          </div>

          <div className="flex items-center gap-1.5">
            <div
              style={{ backgroundColor: 'var(--bg-panel)' }}
              className="flex-1 h-9 px-3 rounded-xl flex items-center gap-1.5"
            >
              <input
                type={showKeyText ? 'text' : 'password'}
                value={draftApiKey}
                onChange={(e) => setDraftApiKey(e.target.value)}
                placeholder="Dán khóa AIzaSy..."
                style={{ color: 'var(--text-primary)' }}
                className="flex-1 min-w-0 bg-transparent font-mono text-xs outline-none select-text"
              />
              <button
                type="button"
                onClick={() => setShowKeyText((v) => !v)}
                style={{ color: 'var(--text-secondary)' }}
                className="p-1 hover:text-[var(--text-primary)]"
              >
                {showKeyText ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>

            <button
              type="submit"
              style={{ backgroundColor: 'var(--accent-primary)', color: '#FFFFFF' }}
              className="h-9 px-3.5 rounded-xl text-xs font-bold shrink-0 hover:brightness-110 active:scale-95 transition-all"
            >
              Lưu
            </button>
          </div>
          <p className="text-[10.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Lưu cục bộ trên máy bạn. Gói miễn phí chạy mượt với{' '}
            <strong style={{ color: 'var(--text-primary)' }}>Gemini 4 Hydrogen</strong>.
          </p>
        </form>
      )}

      {/* ==================== STREAM / MINIMALIST BORDERLESS EMPTY STATE ==================== */}
      <div
        ref={scrollRef}
        className="relative z-10 flex-1 min-h-0 overflow-y-auto px-3.5 py-3 space-y-4 select-text"
      >
        {messages.length === 0 ? (
          <div className="min-h-full flex flex-col justify-between gap-5 py-2">
            {/* Editorial Hero — Không viền, thoáng sạch */}
            <div className="pt-4 pb-1 px-1 text-center space-y-3">
              <div className="relative inline-flex items-center justify-center">
                <span
                  aria-hidden="true"
                  style={{
                    background:
                      'radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 30%, transparent) 0%, transparent 72%)'
                  }}
                  className="absolute w-20 h-20 rounded-full blur-xl ai-aurora-pulse"
                />
                <div
                  style={{
                    backgroundColor: 'var(--bg-panel-alt)',
                    boxShadow: 'var(--shadow-card)'
                  }}
                  className="relative w-12 h-12 rounded-2xl flex items-center justify-center"
                >
                  <GeminiMark size={24} />
                </div>
              </div>

              <div className="space-y-1">
                <h3
                  className="text-[16px] font-extrabold tracking-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {activeFile ? `Mình giúp gì cho ${activeFile.name}?` : `Trợ lý ${activeModelMeta.label}`}
                </h3>
                <p
                  className="text-[12px] leading-relaxed max-w-[280px] mx-auto"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {settings.assistantMode === 'tutor'
                    ? 'Chế độ Gia sư • Gợi ý tư duy & giải thích lỗi để bạn tự code.'
                    : 'Chế độ Kỹ sư • Đề xuất mã sạch, tối ưu Big-O & áp dụng 1 chạm.'}
                </p>
              </div>

              {/* Compact Borderless Key Banner (chỉ hiện khi chưa dán API Key) */}
              {!hasApiKey && !keyEditorOpen && (
                <div
                  style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                  className="mx-auto max-w-sm p-3 rounded-2xl flex items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold flex items-center gap-1.5">
                      <KeyRound size={13} style={{ color: 'var(--accent-primary)' }} />
                      <span className="truncate">Kết nối Gemini miễn phí</span>
                    </div>
                    <p className="text-[10.5px] mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                      Lấy khóa tại Google AI Studio
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKeyEditorOpen(true)}
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      color: '#FFFFFF',
                      boxShadow: '0 6px 16px -6px var(--accent-glow)'
                    }}
                    className="h-8 px-3.5 rounded-xl text-[11.5px] font-bold shrink-0 hover:brightness-110 active:scale-95 transition-all"
                  >
                    Nhập Key
                  </button>
                </div>
              )}
            </div>

            {/* 4 Gợi ý nhanh — 100% KHÔNG VIỀN, nền tonal mịn màng */}
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((qa) => (
                <button
                  key={qa.id}
                  type="button"
                  onClick={() =>
                    void sendMessage(qa.prompt, {
                      includeCode: true,
                      includeConsole: qa.includeConsole,
                      includeNotes: qa.includeNotes
                    })
                  }
                  style={{
                    backgroundColor: qa.highlight
                      ? 'color-mix(in srgb, #FB7185 11%, var(--bg-panel-alt))'
                      : 'var(--bg-panel-alt)'
                  }}
                  className="p-3 rounded-2xl text-left hover:bg-[var(--bg-elevated)] active:scale-[0.97] transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span
                      style={{
                        backgroundColor: `color-mix(in srgb, ${qa.color} 15%, transparent)`,
                        color: qa.color
                      }}
                      className="w-7 h-7 rounded-xl flex items-center justify-center"
                    >
                      {qa.icon}
                    </span>
                    {qa.highlight && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <div
                      className="text-[12px] font-bold leading-snug"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {qa.title}
                    </div>
                    <div
                      className="text-[10.5px] leading-snug mt-0.5 truncate"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {qa.subtitle}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex flex-col items-end gap-1.5">
                  {msg.imageThumbs && msg.imageThumbs.length > 0 && (
                    <div className="flex items-center justify-end gap-1.5 flex-wrap max-w-[88%]">
                      {msg.imageThumbs.map((thumb, idx) => (
                        <img
                          key={`${msg.id}-img-${idx}`}
                          src={thumb}
                          alt={`Ảnh đính kèm ${idx + 1}`}
                          style={{ boxShadow: 'var(--shadow-card)' }}
                          className="h-16 w-auto max-w-[120px] rounded-xl object-cover"
                        />
                      ))}
                    </div>
                  )}
                  <div
                    style={{
                      backgroundColor: 'var(--bg-active)',
                      color: 'var(--text-primary)'
                    }}
                    className="max-w-[88%] px-3.5 py-2.5 rounded-2xl rounded-tr-md text-[13px] leading-relaxed whitespace-pre-wrap"
                  >
                    {msg.text}
                  </div>
                  {msg.contextTags && msg.contextTags.length > 0 && (
                    <div className="flex items-center justify-end flex-wrap gap-1 px-1">
                      {msg.contextTags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            backgroundColor: 'var(--bg-panel-alt)',
                            color: 'var(--text-secondary)'
                          }}
                          className="px-1.5 py-0.5 rounded-md text-[9.5px] font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            const msgMeta = getModelMeta(msg.modelId || effectiveModelId);
            const thoughtOpen = Boolean(expandedThoughts[msg.id]);

            return (
              <div key={msg.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <GeminiMark size={13} className={msg.streaming ? 'animate-spin shrink-0' : 'shrink-0'} />
                    <span
                      className="text-[11px] font-bold truncate"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {msgMeta.label}
                    </span>
                    {msg.fallbackNotice && (
                      <span
                        style={{
                          backgroundColor: 'var(--bg-panel-alt)',
                          color: 'var(--text-secondary)'
                        }}
                        className="px-1.5 py-0.5 rounded-md text-[9.5px] font-medium truncate"
                        title={msg.fallbackNotice}
                      >
                        Dự phòng
                      </span>
                    )}
                  </div>
                  {typeof msg.totalTokens === 'number' && !msg.streaming && (
                    <span
                      className="text-[9.5px] font-mono opacity-60"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {msg.totalTokens.toLocaleString()} tok
                    </span>
                  )}
                </div>

                {/* Collapsible Thinking Summary — Borderless */}
                {msg.thought && (
                  <div
                    style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                    className="rounded-xl overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedThoughts((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))
                      }
                      className="w-full px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span className="flex items-center gap-1.5">
                        <Brain size={12} style={{ color: 'var(--accent-primary)' }} />
                        <span>{msg.streaming && !msg.text ? 'Đang suy luận...' : 'Quá trình suy luận'}</span>
                      </span>
                      <ChevronRight
                        size={12}
                        className={`transition-transform duration-200 ${thoughtOpen ? 'rotate-90' : ''}`}
                      />
                    </button>
                    {thoughtOpen && (
                      <div
                        style={{ color: 'var(--text-secondary)' }}
                        className="px-3 pb-2.5 text-[11.5px] leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto opacity-90"
                      >
                        {msg.thought}
                      </div>
                    )}
                  </div>
                )}

                {/* Assistant Editorial Message — KHÔNG ĐÓNG KHUNG VIỀN */}
                {msg.error ? (
                  <div
                    style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)' }}
                    className="p-3 rounded-2xl space-y-2 text-[12px] text-rose-500 leading-relaxed"
                  >
                    <div className="whitespace-pre-wrap">{msg.error}</div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {msg.retryPrompt && (
                        <button
                          type="button"
                          onClick={() => void sendMessage(msg.retryPrompt!)}
                          style={{
                            backgroundColor: 'var(--accent-primary)',
                            color: '#FFFFFF'
                          }}
                          className="h-7 px-3 rounded-lg text-[11px] font-bold hover:brightness-110"
                        >
                          Thử lại
                        </button>
                      )}
                      {settings.modelId !== 'gemini-3.8-flash' && (
                        <button
                          type="button"
                          onClick={() => onUpdateSettings({ modelId: 'gemini-3.8-flash' })}
                          style={{
                            backgroundColor: 'var(--bg-panel-alt)',
                            color: 'var(--text-primary)'
                          }}
                          className="h-7 px-2.5 rounded-lg text-[11px] font-semibold hover:bg-[var(--bg-elevated)]"
                        >
                          Dùng 3.8 Flash
                        </button>
                      )}
                      {settings.modelId !== 'gemini-4-hydrogen' && (
                        <button
                          type="button"
                          onClick={() => onUpdateSettings({ modelId: 'gemini-4-hydrogen' })}
                          className="h-7 px-2.5 rounded-lg bg-emerald-500/15 text-emerald-500 text-[11px] font-bold hover:bg-emerald-500/25"
                        >
                          Dùng Hydrogen
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setKeyEditorOpen(true)}
                        style={{
                          backgroundColor: 'var(--bg-panel-alt)',
                          color: 'var(--text-secondary)'
                        }}
                        className="h-7 px-2.5 rounded-lg text-[11px] font-semibold"
                      >
                        API Key
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-0.5 py-0.5">
                    {msg.text ? (
                      <AiMarkdownView
                        content={msg.text}
                        hasActiveFile={Boolean(activeFile && activeFile.language !== 'asset')}
                        onApplyCode={(code) => onApplyCodeToFile(code, false)}
                        onInsertCode={onInsertCodeAtCursor}
                        onOpenDiff={onOpenDiffViewer}
                      />
                    ) : msg.streaming ? (
                      <div
                        className="flex items-center gap-2 py-1.5 text-[12px]"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <span className="flex items-center gap-1">
                          <span
                            className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0ms]"
                            style={{ backgroundColor: 'var(--accent-primary)' }}
                          />
                          <span
                            className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:120ms]"
                            style={{ backgroundColor: 'var(--accent-secondary)' }}
                          />
                          <span
                            className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:240ms]"
                            style={{ backgroundColor: 'var(--accent-primary)' }}
                          />
                        </span>
                        <span>
                          {msgMeta.shortLabel} đang suy nghĩ...
                          {waitSeconds > 0 ? ` (${waitSeconds}s)` : ''}
                        </span>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-2 py-1 text-[12px]"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <span>Đã dừng trước khi có phản hồi.</span>
                        {msg.retryPrompt && (
                          <button
                            type="button"
                            onClick={() => void sendMessage(msg.retryPrompt!)}
                            style={{
                              backgroundColor: 'var(--bg-panel-alt)',
                              color: 'var(--accent-primary)'
                            }}
                            className="h-6 px-2.5 rounded-lg text-[11px] font-semibold hover:bg-[var(--bg-elevated)] transition-colors"
                          >
                            Thử lại
                          </button>
                        )}
                      </div>
                    )}

                    {msg.streaming && msg.text && (
                      <span
                        aria-hidden="true"
                        style={{ backgroundColor: 'var(--accent-primary)' }}
                        className="inline-block w-1.5 h-3.5 ml-1 align-middle rounded-full animate-pulse"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ==================== UNIFIED BORDERLESS FLOATING COMPOSER (CURSOR / CLAUDE STYLE) ==================== */}
      <div
        style={{
          paddingBottom: isSheet ? 'max(14px, env(safe-area-inset-bottom))' : '12px'
        }}
        className="relative z-10 px-3 pt-1 shrink-0"
      >
        <div
          onDragOver={(e) => {
            if (e.dataTransfer?.types?.includes('Files')) {
              e.preventDefault();
            }
          }}
          onDrop={(e) => {
            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
              e.preventDefault();
              void appendImageFiles(e.dataTransfer.files);
            }
          }}
          style={{
            backgroundColor: 'var(--bg-panel-alt)',
            boxShadow: 'var(--shadow-card)'
          }}
          className="ai-composer-shell rounded-[22px] p-2.5 flex flex-col gap-2 transition-all"
        >
          {/* Preview ảnh vừa dán / chọn — không viền, bo góc mềm */}
          {pendingImages.length > 0 && (
            <div className="flex items-center gap-2 px-1 pt-0.5 overflow-x-auto no-scrollbar">
              {pendingImages.map((img) => (
                <div key={img.id} className="relative shrink-0 group">
                  <img
                    src={img.previewUrl}
                    alt="Ảnh sắp gửi"
                    className="w-14 h-14 rounded-xl object-cover shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPendingImages((prev) => prev.filter((item) => item.id !== img.id))
                    }
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/75 text-white flex items-center justify-center hover:bg-rose-500 transition-colors"
                    title="Gỡ ảnh này"
                  >
                    <X size={10} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder={
              !hasApiKey
                ? 'Nhập Gemini API Key để bắt đầu...'
                : pendingImages.length > 0
                  ? 'Hỏi về ảnh vừa đính kèm (hoặc bấm Gửi ngay)...'
                  : activeSelection && attachSelection
                    ? `Hỏi về đoạn L${activeSelection.startLine}–L${activeSelection.endLine}...`
                    : `Hỏi ${activeModelMeta.shortLabel} hoặc dán ảnh (Ctrl+V)...`
            }
            style={{ color: 'var(--text-primary)' }}
            className="w-full bg-transparent px-1.5 pt-0.5 text-[13px] leading-snug outline-none resize-none max-h-[120px] select-text placeholder:opacity-55"
          />

          {/* Hidden File Picker cho ảnh đề bài / ảnh chụp màn hình */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                void appendImageFiles(e.target.files);
              }
              e.target.value = '';
            }}
          />

          {/* Bottom Action Row INSIDE Composer: Image + Mode Pill + Context Pills + Circular Send */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
              {/* Đính kèm ảnh đề bài / ảnh chụp màn hình */}
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                style={{
                  backgroundColor:
                    pendingImages.length > 0
                      ? 'color-mix(in srgb, var(--accent-primary) 16%, var(--bg-panel))'
                      : 'transparent',
                  color:
                    pendingImages.length > 0 ? 'var(--accent-primary)' : 'var(--text-secondary)'
                }}
                className="relative h-7 w-7 rounded-full flex items-center justify-center shrink-0 hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] active:scale-95 transition-all"
                title="Đính kèm ảnh đề bài (hoặc Ctrl+V / Cmd+V dán ảnh trực tiếp)"
              >
                <ImagePlus size={13.5} />
                {pendingImages.length > 0 && (
                  <span
                    style={{ backgroundColor: 'var(--accent-primary)', color: '#FFFFFF' }}
                    className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8.5px] font-bold flex items-center justify-center"
                  >
                    {pendingImages.length}
                  </span>
                )}
              </button>

              {/* Compact Tutor / Coder Switch Chip */}
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    assistantMode: settings.assistantMode === 'tutor' ? 'coder' : 'tutor'
                  })
                }
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)'
                }}
                className="h-7 px-2.5 rounded-full text-[10.5px] font-bold flex items-center gap-1 shrink-0 hover:brightness-105 active:scale-95 transition-all"
                title="Chạm để đổi nhanh giữa chế độ Gia sư và Kỹ sư"
              >
                {settings.assistantMode === 'tutor' ? (
                  <>
                    <GraduationCap size={12} style={{ color: 'var(--accent-primary)' }} />
                    <span>Gia sư</span>
                  </>
                ) : (
                  <>
                    <Zap size={12} style={{ color: 'var(--accent-primary)' }} />
                    <span>Kỹ sư</span>
                  </>
                )}
              </button>

              {/* Chip đoạn code đang bôi đen trong Monaco Editor */}
              {activeSelection && (
                <button
                  type="button"
                  onClick={() => setAttachSelection((v) => !v)}
                  style={{
                    backgroundColor: attachSelection
                      ? 'color-mix(in srgb, var(--accent-primary) 16%, var(--bg-panel))'
                      : 'transparent',
                    color: attachSelection ? 'var(--accent-primary)' : 'var(--text-secondary)'
                  }}
                  className="h-7 px-2 rounded-full text-[10.5px] font-bold flex items-center gap-1 shrink-0 hover:bg-[var(--bg-elevated)] transition-colors"
                  title={`Đính kèm đoạn đang bôi đen (dòng ${activeSelection.startLine}–${activeSelection.endLine})`}
                >
                  <Code2 size={11.5} />
                  <span>
                    L{activeSelection.startLine}–L{activeSelection.endLine}
                  </span>
                </button>
              )}

              {activeFile && activeFile.language !== 'asset' && (
                <button
                  type="button"
                  onClick={() => setAttachFile((v) => !v)}
                  style={{
                    backgroundColor: attachFile ? 'var(--bg-active)' : 'transparent',
                    color: attachFile ? 'var(--accent-primary)' : 'var(--text-secondary)'
                  }}
                  className="h-7 px-2 rounded-full text-[10.5px] font-semibold flex items-center gap-1 shrink-0 hover:bg-[var(--bg-elevated)] transition-colors"
                  title="Đính kèm nội dung tệp đang mở"
                >
                  <FileCode2 size={11.5} />
                  <span className="max-w-[72px] truncate">{activeFile.name}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setAttachConsole((v) => !v)}
                style={{
                  backgroundColor: attachConsole
                    ? hasConsoleError
                      ? 'rgba(244, 63, 94, 0.14)'
                      : 'var(--bg-active)'
                    : 'transparent',
                  color: attachConsole
                    ? hasConsoleError
                      ? '#F43F5E'
                      : 'var(--accent-primary)'
                    : 'var(--text-secondary)'
                }}
                className="h-7 px-2 rounded-full text-[10.5px] font-semibold flex items-center gap-1 shrink-0 hover:bg-[var(--bg-elevated)] transition-colors"
                title="Đính kèm log Console & lỗi biên dịch"
              >
                <Terminal size={11.5} />
                <span>Console</span>
                {hasConsoleError && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
              </button>

              <button
                type="button"
                onClick={() => setAttachNotes((v) => !v)}
                style={{
                  backgroundColor: attachNotes ? 'var(--bg-active)' : 'transparent',
                  color: attachNotes ? 'var(--accent-primary)' : 'var(--text-secondary)'
                }}
                className="h-7 px-2 rounded-full text-[10.5px] font-semibold flex items-center gap-1 shrink-0 hover:bg-[var(--bg-elevated)] transition-colors"
                title="Đính kèm Ghi chú & Đề bài"
              >
                <FileText size={11.5} />
                <span>Đề bài</span>
                {hasNotesContent && !attachNotes && (
                  <span
                    className="w-1.5 h-1.5 rounded-full opacity-75"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  />
                )}
              </button>
            </div>

            {isStreaming ? (
              <button
                type="button"
                onClick={handleStopStream}
                className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 hover:brightness-110 active:scale-95 transition-all"
                title="Dừng phản hồi"
              >
                <Square size={11} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void sendMessage(input)}
                disabled={!canSend}
                style={{
                  backgroundColor: canSend ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                  color: canSend ? '#FFFFFF' : 'var(--text-secondary)',
                  boxShadow: canSend ? '0 6px 14px -4px var(--accent-glow)' : undefined
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 disabled:opacity-45 hover:brightness-110 active:scale-95 transition-all"
                title="Gửi (Enter)"
              >
                <ArrowUp size={15} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
