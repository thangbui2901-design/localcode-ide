/**
 * Gemini 4 & Gemini 3.8 Streaming Client (Google Interactions API)
 * Hỗ trợ: gemini-4-hydrogen (Free Tier), gemini-4-neon, gemini-4-argon,
 * gemini-4-carbon, gemini-3.8-flash, gemini-3.5-flash-lite và Custom Model ID.
 * Chạy 100% bằng fetch() + SSE stream thuần (~0 KB dependency nặng).
 */

export type AiThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';
export type AiAssistantMode = 'tutor' | 'coder';

export interface GeminiModelInfo {
  id: string;
  label: string;
  shortLabel: string;
  tier: 'free' | 'paid' | 'fast';
  tierLabel: string;
  description: string;
  accent: string;
  supportsThinking: boolean;
}

export const GEMINI_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    shortLabel: 'Hydrogen',
    tier: 'free',
    tierLabel: 'Miễn phí',
    description: 'Tốc độ cao, lập trình hằng ngày & học thuật toán (1M context)',
    accent: '#38BDF8',
    supportsThinking: true
  },
  {
    id: 'gemini-4-neon',
    label: 'Gemini 4 Neon',
    shortLabel: 'Neon',
    tier: 'paid',
    tierLabel: 'Paid · Pro',
    description: 'Suy luận sâu, debug đa file, tái cấu trúc & CTDL nâng cao',
    accent: '#A855F7',
    supportsThinking: true
  },
  {
    id: 'gemini-4-argon',
    label: 'Gemini 4 Argon',
    shortLabel: 'Argon',
    tier: 'paid',
    tierLabel: 'Paid · Frontier',
    description: 'Đỉnh cao suy luận phức tạp, tối ưu thuật toán & nghiên cứu',
    accent: '#F59E0B',
    supportsThinking: true
  },
  {
    id: 'gemini-4-carbon',
    label: 'Gemini 4 Carbon',
    shortLabel: 'Carbon',
    tier: 'paid',
    tierLabel: 'Paid · Deep',
    description: 'Suy luận chuyên sâu dài hạn cho kiến trúc & logic khó',
    accent: '#FB7185',
    supportsThinking: true
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    shortLabel: '3.8 Flash',
    tier: 'fast',
    tierLabel: 'Siêu tốc',
    description: 'Phản hồi nhanh, cân bằng giải thích code & đa phương thức',
    accent: '#34D399',
    supportsThinking: true
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    shortLabel: '3.5 Lite',
    tier: 'fast',
    tierLabel: 'Siêu nhẹ',
    description: 'Chi phí cực thấp, trả lời tức thì cho câu hỏi cú pháp ngắn',
    accent: '#2DD4BF',
    supportsThinking: false
  }
];

export interface AiSettings {
  apiKey: string;
  modelId: string;
  customModelId: string;
  thinkingLevel: AiThinkingLevel;
  assistantMode: AiAssistantMode;
  showDockButton: boolean;
}

const AI_SETTINGS_STORAGE_KEY = 'localcode.ai.settings.v1';

export const DEFAULT_AI_SETTINGS: AiSettings = {
  apiKey: '',
  modelId: 'gemini-4-hydrogen',
  customModelId: '',
  thinkingLevel: 'low',
  assistantMode: 'tutor',
  showDockButton: true
};

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      modelId: typeof parsed.modelId === 'string' && parsed.modelId ? parsed.modelId : 'gemini-4-hydrogen',
      customModelId: typeof parsed.customModelId === 'string' ? parsed.customModelId : '',
      thinkingLevel:
        parsed.thinkingLevel === 'minimal' ||
        parsed.thinkingLevel === 'low' ||
        parsed.thinkingLevel === 'medium' ||
        parsed.thinkingLevel === 'high'
          ? parsed.thinkingLevel
          : 'low',
      assistantMode: parsed.assistantMode === 'coder' ? 'coder' : 'tutor',
      showDockButton: typeof parsed.showDockButton === 'boolean' ? parsed.showDockButton : true
    };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAiSettings(next: AiSettings): void {
  try {
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota issues
  }
}

export function resolveEffectiveModelId(settings: AiSettings): string {
  if (settings.modelId === '__custom__') {
    return settings.customModelId.trim() || 'gemini-4-hydrogen';
  }
  return settings.modelId || 'gemini-4-hydrogen';
}

export function getModelMeta(modelId: string): GeminiModelInfo {
  const found = GEMINI_MODELS.find((m) => m.id === modelId);
  if (found) return found;
  return {
    id: modelId,
    label: modelId,
    shortLabel: modelId.replace(/^gemini-/, '').slice(0, 14) || 'Custom',
    tier: 'paid',
    tierLabel: 'Custom',
    description: 'Model Gemini tùy chỉnh do bạn nhập ID',
    accent: '#818CF8',
    supportsThinking: true
  };
}

export function buildIdeSystemInstruction(mode: AiAssistantMode): string {
  if (mode === 'tutor') {
    return [
      'Bạn là Gia sư Lập trình AI tích hợp trong IDE "Code With You" dành cho sinh viên CNTT (C/C++, Python, Web HTML/CSS/JS).',
      'Trả lời bằng tiếng Việt ngắn gọn, rõ ràng, chuyên nghiệp và dễ hiểu.',
      'NGUYÊN TẮC GIA SƯ (TUTOR MODE):',
      '- KHÔNG vội viết nguyên lời giải hoàn chỉnh nếu người dùng đang hỏi hướng giải bài tập; ưu tiên giải thích nguyên nhân lỗi, chỉ rõ dòng/logic sai, phân tích độ phức tạp thời gian & bộ nhớ (Big-O), và đưa ra gợi ý từng bước để người dùng tự code.',
      '- Nếu người dùng gặp lỗi biên dịch (GCC/Clang/Python) hoặc yêu cầu rõ ràng một đoạn code mẫu nhỏ, hãy giải thích bản chất lỗi trước rồi đưa đoạn minh họa ngắn gọn nhất.',
      '- Dùng Markdown rõ ràng, đặt mã nguồn trong block ```ngon_ngu.',
      '- Khi viết độ phức tạp hoặc tên biến (ví dụ `O(n log n)`, `n`, `a[i]`), dùng backtick hoặc ký hiệu Unicode (≤, ≥, ×, ², →) thay vì bọc dấu $...$.'
    ].join('\n');
  }

  return [
    'Bạn là Kỹ sư Phần mềm Senior tích hợp trong IDE "Code With You" (C/C++, Python, Web HTML/CSS/JS).',
    'Trả lời bằng tiếng Việt súc tích, đi thẳng vào giải pháp chuẩn sạch và hiện đại.',
    'NGUYÊN TẮC KỸ SƯ (CODER MODE):',
    '- Phân tích nhanh nguyên nhân gốc rễ, độ phức tạp Big-O và các trường hợp biên (edge cases).',
    '- Khi đề xuất sửa lỗi hoặc tái cấu trúc tệp đang mở, hãy cung cấp mã nguồn hoàn chỉnh, sạch, sẵn sàng chạy trong block ```ngon_ngu để người dùng có thể bấm "Áp dụng vào tệp" trực tiếp.',
    '- Khi viết độ phức tạp hoặc tên biến (ví dụ `O(n)`, `n`), dùng backtick hoặc Unicode (≤, ≥, ×, ²) thay vì LaTeX $...$.',
    '- Giữ cấu trúc code rõ ràng, tránh giải thích dài dòng dư thừa.'
  ].join('\n');
}

export interface GeminiImageAttachment {
  mimeType: string;
  data: string; // Pure base64 (không gồm tiền tố data:image/...;base64,)
  previewUrl?: string;
  resolution?: 'low' | 'medium' | 'high';
}

export interface StreamGeminiRequest {
  apiKey: string;
  modelId: string;
  input: string;
  images?: GeminiImageAttachment[];
  fallbackHistoryText?: string;
  systemInstruction: string;
  thinkingLevel?: AiThinkingLevel;
  previousInteractionId?: string | null;
  signal?: AbortSignal;
  onInteractionId?: (id: string) => void;
  onModelFallback?: (fallbackModelId: string, reason: string) => void;
  onThoughtDelta?: (chunk: string) => void;
  onTextDelta?: (chunk: string) => void;
}

export interface StreamGeminiResult {
  text: string;
  thought: string;
  interactionId: string | null;
  actualModelId: string;
  totalTokens?: number;
}

const INTERACTIONS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

function formatGeminiErrorMessage(status: number, rawBody: string, modelId: string): string {
  let apiMessage = '';
  try {
    const parsed = JSON.parse(rawBody);
    apiMessage = parsed?.error?.message || parsed?.message || '';
  } catch {
    apiMessage = rawBody.slice(0, 260);
  }

  if (status === 400 && /api key|API_KEY_INVALID/i.test(apiMessage)) {
    return 'API Key Gemini không hợp lệ. Hãy kiểm tra lại khóa tại Google AI Studio (aistudio.google.com/apikey).';
  }
  if (status === 401 || status === 403) {
    return `Không có quyền truy cập model "${modelId}". Nếu bạn đang dùng gói miễn phí (Free Tier), hãy chuyển sang "Gemini 4 Hydrogen" hoặc "Gemini 3.8 Flash".${
      apiMessage ? `\nChi tiết: ${apiMessage}` : ''
    }`;
  }
  if (status === 404) {
    return `Không tìm thấy model "${modelId}" trên tài khoản hiện tại. Hãy thử đổi sang "gemini-4-hydrogen" hoặc kiểm tra lại Custom Model ID.`;
  }
  if (status === 429) {
    return `Đã chạm giới hạn tốc độ / quota của "${modelId}". Hãy đợi vài giây hoặc chuyển sang "Gemini 3.8 Flash" / "Gemini 3.5 Flash-Lite".`;
  }
  if (status === 503 || status === 500) {
    return `Máy chủ Google cho "${modelId}" đang quá tải tạm thời (${status}). Bạn bấm Thử lại hoặc chuyển nhanh sang "Gemini 3.8 Flash" nhé.`;
  }
  return apiMessage
    ? `Lỗi Gemini API (${status}): ${apiMessage}`
    : `Không thể kết nối Gemini API (HTTP ${status}). Hãy kiểm tra kết nối mạng.`;
}

class GeminiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// Ghi nhớ tạm thời model vừa báo quá tải 503 trong 45s để lần hỏi kế tiếp chuyển ngay sang model rảnh (không tốn 5s chờ lỗi lặp!)
const overloadedUntilMap = new Map<string, number>();

class GeminiSlowQueueError extends Error {
  constructor(modelId: string, timeoutMs: number) {
    super(`Model "${modelId}" phản hồi chậm hơn ${Math.round(timeoutMs / 1000)}s`);
    this.name = 'GeminiSlowQueueError';
  }
}

async function callInteractionsStream(
  req: StreamGeminiRequest,
  includeThinkingLevel: boolean,
  options?: { firstTokenTimeoutMs?: number }
): Promise<StreamGeminiResult> {
  const isFastLevel = req.thinkingLevel === 'minimal' || req.thinkingLevel === 'low';
  const generationConfig: Record<string, unknown> = {
    temperature: 0.3,
    max_output_tokens: isFastLevel ? 2048 : 4096
  };
  if (includeThinkingLevel && req.thinkingLevel) {
    generationConfig.thinking_level = req.thinkingLevel;
    // Mức Tức thì / Nhanh tắt sinh tóm tắt suy luận để trả lời nhanh hơn rõ rệt
    generationConfig.thinking_summaries = isFastLevel ? 'none' : 'auto';
  }

  // Nếu không nối previous_interaction_id (ví dụ mới đổi model giữa chừng) nhưng có lịch sử trước đó -> tự ghép ngữ cảnh gọn
  const effectiveText =
    !req.previousInteractionId && req.fallbackHistoryText
      ? `${req.fallbackHistoryText}\n\n${req.input}`
      : req.input;

  const inputPayload: unknown =
    req.images && req.images.length > 0
      ? [
          { type: 'text', text: effectiveText },
          ...req.images.map((img) => ({
            type: 'image',
            mime_type: img.mimeType,
            data: img.data
          }))
        ]
      : effectiveText;

  const body: Record<string, unknown> = {
    model: req.modelId,
    input: inputPayload,
    stream: true,
    system_instruction: req.systemInstruction,
    generation_config: generationConfig
  };
  if (req.previousInteractionId) {
    body.previous_interaction_id = req.previousInteractionId;
  }

  // Watchdog chống treo hàng đợi Free Tier: nếu quá N giây không nhận được token nào -> tự ngắt để nhảy dự phòng
  const internalController = new AbortController();
  let timedOutWaitingFirstToken = false;
  let watchdogTimer: number | null = null;
  const clearWatchdog = () => {
    if (watchdogTimer !== null) {
      window.clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
  };
  const onParentAbort = () => internalController.abort();
  if (req.signal) {
    if (req.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    req.signal.addEventListener('abort', onParentAbort, { once: true });
  }
  if (options?.firstTokenTimeoutMs && options.firstTokenTimeoutMs > 0) {
    watchdogTimer = window.setTimeout(() => {
      timedOutWaitingFirstToken = true;
      internalController.abort();
    }, options.firstTokenTimeoutMs);
  }

  let res: Response;
  try {
    res = await fetch(INTERACTIONS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'x-goog-api-key': req.apiKey.trim()
      },
      body: JSON.stringify(body),
      signal: internalController.signal
    });
  } catch (err: unknown) {
    clearWatchdog();
    req.signal?.removeEventListener('abort', onParentAbort);
    if (timedOutWaitingFirstToken && !req.signal?.aborted) {
      throw new GeminiSlowQueueError(req.modelId, options?.firstTokenTimeoutMs || 10000);
    }
    throw err;
  }

  if (!res.ok) {
    clearWatchdog();
    req.signal?.removeEventListener('abort', onParentAbort);
    const errText = await res.text().catch(() => '');
    // Một số model nhẹ hoặc không nhận thinking_level / thinking_summaries -> tự bỏ
    if (
      res.status === 400 &&
      includeThinkingLevel &&
      /thinking_level|thinking_summaries|thinking/i.test(errText)
    ) {
      return callInteractionsStream(req, false, options);
    }
    // Nếu previous_interaction_id cũ đã hết hạn hoặc không khớp model/key -> tự nối lại bằng fallbackHistoryText
    if (
      req.previousInteractionId &&
      (res.status === 400 || res.status === 404) &&
      !/API_KEY_INVALID|api key/i.test(errText) &&
      /interaction|previous_interaction_id|not found|mismatch|model/i.test(errText)
    ) {
      return callInteractionsStream(
        { ...req, previousInteractionId: null },
        includeThinkingLevel,
        options
      );
    }
    throw new GeminiHttpError(res.status, formatGeminiErrorMessage(res.status, errText, req.modelId));
  }

  const contentType = res.headers.get('content-type') || '';

  // Trường hợp server trả JSON không stream
  if (contentType.includes('application/json') && !contentType.includes('event-stream')) {
    clearWatchdog();
    req.signal?.removeEventListener('abort', onParentAbort);
    const data = await res.json();
    let text = '';
    let thought = '';
    const interactionId: string | null = typeof data?.id === 'string' ? data.id : null;
    if (interactionId) req.onInteractionId?.(interactionId);

    if (Array.isArray(data?.steps)) {
      for (const step of data.steps) {
        if (step?.type === 'thought' && typeof step.summary === 'string') {
          thought += step.summary;
        }
        if (step?.type === 'model_output' && Array.isArray(step.content)) {
          for (const part of step.content) {
            if (part?.type === 'text' && typeof part.text === 'string') {
              text += part.text;
            }
          }
        }
      }
    } else if (Array.isArray(data?.outputs)) {
      for (const out of data.outputs) {
        if (out?.type === 'text' && typeof out.text === 'string') text += out.text;
      }
    }
    if (thought) req.onThoughtDelta?.(thought);
    if (text) req.onTextDelta?.(text);
    return {
      text,
      thought,
      interactionId,
      actualModelId: req.modelId,
      totalTokens: data?.usage?.total_tokens
    };
  }

  // Phân tích SSE stream chuẩn Interactions API (`interaction.created`, `step.delta`, `interaction.completed`)
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('Trình duyệt không hỗ trợ đọc luồng stream từ Gemini API.');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';
  let fullThought = '';
  let interactionId: string | null = null;
  let totalTokens: number | undefined;
  let currentEventName = '';

  const processEventLine = (eventName: string, rawData: string) => {
    const trimmed = rawData.trim();
    if (!trimmed || trimmed === '[DONE]') return;

    let payload: any;
    try {
      payload = JSON.parse(trimmed);
    } catch {
      return;
    }

    const evType = payload?.event_type || eventName || '';

    if (evType === 'interaction.created' || evType === 'interaction.start') {
      const id = payload?.interaction?.id || payload?.id;
      if (typeof id === 'string' && id) {
        interactionId = id;
        req.onInteractionId?.(id);
      }
      return;
    }

    if (evType === 'step.delta' || evType === 'content.delta' || payload?.delta) {
      const delta = payload?.delta;
      if (!delta) return;
      if (delta.type === 'text' && typeof delta.text === 'string') {
        clearWatchdog();
        fullText += delta.text;
        req.onTextDelta?.(delta.text);
      } else if (
        (delta.type === 'thought_summary' || delta.type === 'thought') &&
        typeof (delta.text || delta.thought || delta.content) === 'string'
      ) {
        clearWatchdog();
        const chunk = delta.text || delta.thought || delta.content;
        fullThought += chunk;
        req.onThoughtDelta?.(chunk);
      }
      return;
    }

    if (evType === 'interaction.completed' || evType === 'interaction.complete') {
      const id = payload?.interaction?.id || payload?.id;
      if (typeof id === 'string' && id && !interactionId) {
        interactionId = id;
        req.onInteractionId?.(id);
      }
      const tokens = payload?.interaction?.usage?.total_tokens ?? payload?.usage?.total_tokens;
      if (typeof tokens === 'number') totalTokens = tokens;

      // Fallback nếu sự kiện completed chứa sẵn steps hoặc outputs nhưng stream không gửi delta text
      if (!fullText && Array.isArray(payload?.interaction?.steps)) {
        for (const step of payload.interaction.steps) {
          if (step?.type === 'model_output' && Array.isArray(step.content)) {
            for (const part of step.content) {
              if (part?.type === 'text' && typeof part.text === 'string') {
                fullText += part.text;
                req.onTextDelta?.(part.text);
              }
            }
          }
        }
      }
      if (!fullText && Array.isArray(payload?.interaction?.outputs)) {
        for (const out of payload.interaction.outputs) {
          if (out?.type === 'text' && typeof out.text === 'string') {
            fullText += out.text;
            req.onTextDelta?.(out.text);
          }
        }
      }
      return;
    }

    if (evType === 'error' || payload?.error) {
      const errMsg = payload?.error?.message || 'Gemini trả về lỗi trong quá trình xử lý.';
      throw new Error(errMsg);
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          processEventLine(currentEventName, line.slice(5));
        } else if (line.trim() === '') {
          currentEventName = '';
        }
      }
    }

    if (buffer.trim().startsWith('data:')) {
      processEventLine(currentEventName, buffer.trim().slice(5));
    }
  } catch (err: unknown) {
    if (timedOutWaitingFirstToken && !req.signal?.aborted) {
      throw new GeminiSlowQueueError(req.modelId, options?.firstTokenTimeoutMs || 10000);
    }
    throw err;
  } finally {
    clearWatchdog();
    req.signal?.removeEventListener('abort', onParentAbort);
  }

  return {
    text: fullText,
    thought: fullThought,
    interactionId,
    actualModelId: req.modelId,
    totalTokens
  };
}

export async function streamGeminiInteraction(
  req: StreamGeminiRequest
): Promise<StreamGeminiResult> {
  if (!req.apiKey.trim()) {
    throw new Error('Bạn chưa nhập Gemini API Key. Hãy dán khóa miễn phí từ Google AI Studio để bắt đầu.');
  }

  const primaryMeta = getModelMeta(req.modelId);
  const now = Date.now();
  const isPrimaryCoolingDown = (overloadedUntilMap.get(req.modelId) ?? 0) > now;
  const fallbackOrder = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-4-hydrogen'].filter(
    (id) => id !== req.modelId
  );

  // Nếu model chính vừa báo 503 trong 45s gần đây -> chuyển thẳng model dự phòng trong 0ms thay vì chờ lỗi lần nữa!
  if (isPrimaryCoolingDown) {
    for (const fbId of fallbackOrder) {
      if ((overloadedUntilMap.get(fbId) ?? 0) > now) continue;
      try {
        const fbMeta = getModelMeta(fbId);
        req.onModelFallback?.(
          fbId,
          `${primaryMeta.shortLabel} vừa quá tải — chạy nhanh bằng ${fbMeta.shortLabel}`
        );
        return await callInteractionsStream(
          { ...req, modelId: fbId, previousInteractionId: null },
          fbMeta.supportsThinking
        );
      } catch (fbErr: unknown) {
        if ((fbErr as { name?: string })?.name === 'AbortError') throw fbErr;
        if (fbErr instanceof GeminiHttpError && (fbErr.status === 503 || fbErr.status === 429)) {
          overloadedUntilMap.set(fbId, Date.now() + 45000);
        }
      }
    }
  }

  // Giới hạn thời gian chờ token đầu tiên để chống bị treo 25–45s ở hàng đợi Free Tier
  const primaryTimeoutMs =
    req.thinkingLevel === 'high'
      ? 24000
      : req.thinkingLevel === 'medium'
        ? 15000
        : 9500;

  try {
    const res = await callInteractionsStream(req, primaryMeta.supportsThinking, {
      firstTokenTimeoutMs: primaryTimeoutMs
    });
    overloadedUntilMap.delete(req.modelId);
    return res;
  } catch (err: unknown) {
    if ((err as { name?: string })?.name === 'AbortError') throw err;
    const isSlowQueue = err instanceof GeminiSlowQueueError;
    const isTransientOverload =
      isSlowQueue ||
      (err instanceof GeminiHttpError &&
        (err.status === 503 || err.status === 429 || err.status === 500));
    if (!isTransientOverload) throw err;

    // Đánh dấu model vừa quá tải/treo 45s và chuyển dự phòng NGAY LẬP TỨC (0ms chờ retry chậm!)
    overloadedUntilMap.set(req.modelId, Date.now() + 45000);

    for (const fbId of fallbackOrder) {
      try {
        const fbMeta = getModelMeta(fbId);
        req.onModelFallback?.(
          fbId,
          isSlowQueue
            ? `${primaryMeta.shortLabel} chờ quá lâu — chuyển nhanh sang ${fbMeta.shortLabel}`
            : `${primaryMeta.shortLabel} đang quá tải — chuyển ngay sang ${fbMeta.shortLabel}`
        );
        return await callInteractionsStream(
          {
            ...req,
            modelId: fbId,
            previousInteractionId: null
          },
          fbMeta.supportsThinking
        );
      } catch (fbErr: unknown) {
        if ((fbErr as { name?: string })?.name === 'AbortError') throw fbErr;
        if (fbErr instanceof GeminiHttpError && (fbErr.status === 503 || fbErr.status === 429)) {
          overloadedUntilMap.set(fbId, Date.now() + 45000);
        }
      }
    }

    // Nếu mọi model dự phòng cũng nghẽn, thử lại 1 lần ngắn sau 0.6s
    await sleepWithAbort(600, req.signal);
    return await callInteractionsStream(req, primaryMeta.supportsThinking);
  }
}
