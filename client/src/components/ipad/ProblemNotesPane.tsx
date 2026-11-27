import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Eye,
  Edit3,
  ImagePlus,
  FlaskConical,
  Trash2,
  X,
  Sparkles
} from 'lucide-react';

interface ProblemNoteData {
  markdown: string;
  images: string[];
  quickInput: string;
  quickExpected: string;
}

interface ProblemNotesPaneProps {
  projectKey: string;
  onSendSampleToTests: (input: string, expectedOutput: string, name?: string) => void;
  onClose: () => void;
}

function storageKeyFor(projectKey: string): string {
  return `localcode.ipad.notes.v1::${projectKey || 'default'}`;
}

const DEFAULT_NOTE: ProblemNoteData = {
  markdown:
    '# Ghi chú & Đề bài\n\nDán đề bài LeetCode / Codeforces, ảnh chụp bảng, hoặc ghi chú độ phức tạp `O(N log N)` ở đây.\n\n**Input:**\n```\n5\n1 2 3 4 5\n```\n**Output:**\n```\n15\n```',
  images: [],
  quickInput: '',
  quickExpected: ''
};

function extractSamplesFromMarkdown(md: string): Array<{ input: string; expected: string }> {
  const results: Array<{ input: string; expected: string }> = [];
  // Match Input: ```...``` Output: ```...``` pairs
  const regex =
    /(?:input|đầu vào)[^\n]*\n+```[^\n]*\n([\s\S]*?)```[\s\S]*?(?:output|expected|đầu ra)[^\n]*\n+```[^\n]*\n([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(md)) !== null) {
    results.push({
      input: m[1].trimEnd(),
      expected: m[2].trimEnd()
    });
  }
  return results;
}

export const ProblemNotesPane: React.FC<ProblemNotesPaneProps> = ({
  projectKey,
  onSendSampleToTests,
  onClose
}) => {
  const [data, setData] = useState<ProblemNoteData>(DEFAULT_NOTE);
  const [previewMode, setPreviewMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKeyFor(projectKey));
      if (raw) {
        const parsed = JSON.parse(raw);
        setData({
          markdown: typeof parsed.markdown === 'string' ? parsed.markdown : DEFAULT_NOTE.markdown,
          images: Array.isArray(parsed.images) ? parsed.images : [],
          quickInput: typeof parsed.quickInput === 'string' ? parsed.quickInput : '',
          quickExpected: typeof parsed.quickExpected === 'string' ? parsed.quickExpected : ''
        });
        return;
      }
    } catch {
      // ignore
    }
    setData(DEFAULT_NOTE);
  }, [projectKey]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKeyFor(projectKey), JSON.stringify(data));
      } catch {
        // quota exceeded
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [data, projectKey]);

  const detectedSamples = useMemo(() => extractSamplesFromMarkdown(data.markdown), [data.markdown]);

  const appendImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      // Compress large screenshots for localStorage safety
      const img = new Image();
      img.onload = () => {
        const maxW = 1200;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const compressed = c.toDataURL('image/jpeg', 0.82);
        setData((prev) => ({ ...prev, images: [...prev.images.slice(-3), compressed] }));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          appendImageFile(file);
        }
      }
    }
  };

  // Minimal safe markdown renderer for clean preview
  const renderMarkdownBlocks = (text: string) => {
    const lines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    let inCode = false;
    let codeBuf: string[] = [];

    lines.forEach((line, i) => {
      if (line.trim().startsWith('```')) {
        if (!inCode) {
          inCode = true;
          codeBuf = [];
        } else {
          inCode = false;
          nodes.push(
            <pre
              key={`code-${i}`}
              style={{ backgroundColor: 'var(--bg-canvas)' }}
              className="my-2 p-2.5 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed"
            >
              {codeBuf.join('\n')}
            </pre>
          );
        }
        return;
      }

      if (inCode) {
        codeBuf.push(line);
        return;
      }

      if (line.startsWith('### ')) {
        nodes.push(
          <h3 key={i} className="text-xs font-bold mt-3 mb-1">
            {line.slice(4)}
          </h3>
        );
      } else if (line.startsWith('## ')) {
        nodes.push(
          <h2 key={i} className="text-sm font-bold mt-3 mb-1">
            {line.slice(3)}
          </h2>
        );
      } else if (line.startsWith('# ')) {
        nodes.push(
          <h1 key={i} className="text-base font-extrabold mt-1 mb-1.5">
            {line.slice(2)}
          </h1>
        );
      } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        nodes.push(
          <div key={i} className="flex gap-2 text-xs leading-relaxed my-0.5 pl-1">
            <span style={{ color: 'var(--accent-primary)' }}>•</span>
            <span>{line.trim().slice(2)}</span>
          </div>
        );
      } else if (!line.trim()) {
        nodes.push(<div key={i} className="h-2" />);
      } else {
        nodes.push(
          <p key={i} className="text-xs leading-relaxed my-0.5" style={{ color: 'var(--text-primary)' }}>
            {line}
          </p>
        );
      }
    });

    return nodes;
  };

  return (
    <div
      style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }}
      className="h-full flex flex-col overflow-hidden"
      onPaste={handlePaste}
    >
      {/* Borderless Header matching AI & Console */}
      <div
        style={{ backgroundColor: 'var(--bg-panel)' }}
        className="h-11 px-3 flex items-center justify-between gap-2 shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} style={{ color: 'var(--accent-primary)' }} className="shrink-0" />
          <span className="text-[12.5px] font-bold tracking-tight truncate">Đề bài &amp; Ghi chú</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            style={{ backgroundColor: 'var(--bg-panel-alt)', color: 'var(--text-primary)' }}
            className="h-7 px-2.5 rounded-lg text-[10.5px] font-semibold flex items-center gap-1 hover:bg-[var(--bg-elevated)] transition-colors"
          >
            {previewMode ? <Edit3 size={11} /> : <Eye size={11} />}
            <span>{previewMode ? 'Sửa' : 'Xem đẹp'}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ color: 'var(--text-secondary)' }}
            className="w-7 h-7 rounded-lg hover:bg-[var(--bg-panel-alt)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
            title="Chèn ảnh đề bài (hoặc dán Ctrl+V / Cmd+V)"
          >
            <ImagePlus size={13.5} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) appendImageFile(f);
              e.target.value = '';
            }}
          />

          <button
            type="button"
            onClick={onClose}
            style={{ color: 'var(--text-secondary)' }}
            className="w-7 h-7 rounded-lg hover:bg-[var(--bg-panel-alt)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {/* Attached Problem Screenshots */}
        {data.images.length > 0 && (
          <div className="space-y-2">
            {data.images.map((src, idx) => (
              <div key={idx} className="relative group rounded-xl overflow-hidden bg-black/20">
                <img src={src} alt={`Ảnh đề ${idx + 1}`} className="w-full h-auto max-h-56 object-contain" />
                <button
                  type="button"
                  onClick={() =>
                    setData((prev) => ({
                      ...prev,
                      images: prev.images.filter((_, i) => i !== idx)
                    }))
                  }
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/65 text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title="Xóa ảnh"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Markdown Editor or Rendered View */}
        {previewMode ? (
          <div className="select-text">{renderMarkdownBlocks(data.markdown)}</div>
        ) : (
          <textarea
            value={data.markdown}
            onChange={(e) => setData((prev) => ({ ...prev, markdown: e.target.value }))}
            placeholder="Dán đề bài, ghi chú thuật toán, hoặc dán ảnh trực tiếp (Cmd+V)..."
            style={{
              backgroundColor: 'var(--bg-panel-alt)',
              color: 'var(--text-primary)'
            }}
            className="w-full min-h-[210px] p-3 rounded-xl text-xs leading-relaxed outline-none resize-y font-mono select-text"
          />
        )}

        {/* Smart Extracted Samples Banner — Borderless */}
        {detectedSamples.length > 0 && (
          <div
            style={{ backgroundColor: 'var(--bg-active)' }}
            className="p-2.5 rounded-xl space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--accent-primary)' }}>
                <Sparkles size={12} />
                Tìm thấy {detectedSamples.length} Sample trong đề bài
              </span>
              <button
                type="button"
                onClick={() => {
                  detectedSamples.forEach((s, idx) => {
                    onSendSampleToTests(s.input, s.expected, `Sample #${idx + 1}`);
                  });
                }}
                style={{ backgroundColor: 'var(--accent-primary)' }}
                className="px-2.5 py-1 rounded-lg text-white text-[10px] font-bold flex items-center gap-1 btn-lift"
              >
                <FlaskConical size={11} />
                <span>Đưa vào Tests</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Manual Sample -> Tests Sender — Borderless */}
        <div
          style={{ backgroundColor: 'var(--bg-panel-alt)' }}
          className="p-2.5 rounded-xl space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
              Gửi nhanh Sample sang tab Tests
            </span>
            <button
              type="button"
              onClick={() => {
                if (!data.quickInput.trim() && !data.quickExpected.trim()) return;
                onSendSampleToTests(data.quickInput, data.quickExpected);
                setData((prev) => ({ ...prev, quickInput: '', quickExpected: '' }));
              }}
              disabled={!data.quickInput.trim() && !data.quickExpected.trim()}
              style={{ backgroundColor: 'var(--accent-primary)' }}
              className="px-2.5 py-1 rounded-lg text-white text-[10px] font-bold disabled:opacity-40 flex items-center gap-1"
            >
              <FlaskConical size={11} />
              <span>Thêm Test</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <textarea
              value={data.quickInput}
              onChange={(e) => setData((prev) => ({ ...prev, quickInput: e.target.value }))}
              placeholder="Sample Input..."
              rows={3}
              style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }}
              className="w-full p-2 rounded-lg text-[11px] font-mono outline-none resize-none select-text"
            />
            <textarea
              value={data.quickExpected}
              onChange={(e) => setData((prev) => ({ ...prev, quickExpected: e.target.value }))}
              placeholder="Expected Output..."
              rows={3}
              style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }}
              className="w-full p-2 rounded-lg text-[11px] font-mono outline-none resize-none select-text"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
