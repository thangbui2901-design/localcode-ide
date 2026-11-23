import React from 'react';

interface FileTypeIconProps {
  fileName: string;
  isFolder?: boolean;
  isOpen?: boolean;
  size?: number;
  className?: string;
}

export const FileTypeIcon: React.FC<FileTypeIconProps> = ({
  fileName,
  isFolder = false,
  isOpen = false,
  size = 16,
  className = ''
}) => {
  const lower = fileName.trim().toLowerCase();

  // 1. Thư mục (Đóng / Mở)
  if (isFolder) {
    return isOpen ? (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <path
          d="M3 6.5A2.5 2.5 0 0 1 5.5 4h4.17a2 2 0 0 1 1.41.59l1.33 1.32a2 2 0 0 0 1.42.59H18.5A2.5 2.5 0 0 1 21 9v1H6.2a2 2 0 0 0-1.93 1.48L2.6 17.6A2.5 2.5 0 0 1 3 16.2V6.5Z"
          fill="#F59E0B"
        />
        <path
          d="M4.3 11.5A1.8 1.8 0 0 1 6.04 10H20.6a1.4 1.4 0 0 1 1.35 1.77l-1.72 6.4A2.2 2.2 0 0 1 18.1 19.8H4.6a1.8 1.8 0 0 1-1.74-2.27l1.44-6.03Z"
          fill="#FBBF24"
        />
      </svg>
    ) : (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <path
          d="M3 6.5A2.5 2.5 0 0 1 5.5 4h4.17a2 2 0 0 1 1.41.59l1.33 1.32a2 2 0 0 0 1.42.59H18.5A2.5 2.5 0 0 1 21 9v8.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Z"
          fill="#EAB308"
        />
      </svg>
    );
  }

  // 2. JavaScript (.js, .mjs, .cjs)
  if (/\.(js|mjs|cjs)$/.test(lower)) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect x="2" y="2" width="20" height="20" rx="4" fill="#F7DF1E" />
        <text
          x="19.5"
          y="19"
          textAnchor="end"
          fill="#18181B"
          fontSize="10.5"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          JS
        </text>
      </svg>
    );
  }

  // 3. TypeScript (.ts)
  if (lower.endsWith('.ts')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect x="2" y="2" width="20" height="20" rx="4" fill="#3178C6" />
        <text
          x="19.5"
          y="19"
          textAnchor="end"
          fill="#FFFFFF"
          fontSize="10.5"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          TS
        </text>
      </svg>
    );
  }

  // 4. React JSX / TSX (.jsx, .tsx)
  if (/\.(jsx|tsx)$/.test(lower)) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect x="2" y="2" width="20" height="20" rx="4" fill="#16222F" />
        <circle cx="12" cy="12" r="1.8" fill="#61DAFB" />
        <ellipse cx="12" cy="12" rx="7.5" ry="3" stroke="#61DAFB" strokeWidth="1.4" />
        <ellipse
          cx="12"
          cy="12"
          rx="7.5"
          ry="3"
          transform="rotate(60 12 12)"
          stroke="#61DAFB"
          strokeWidth="1.4"
        />
        <ellipse
          cx="12"
          cy="12"
          rx="7.5"
          ry="3"
          transform="rotate(120 12 12)"
          stroke="#61DAFB"
          strokeWidth="1.4"
        />
      </svg>
    );
  }

  // 5. Ngôn ngữ C (.c)
  if (lower.endsWith('.c')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <path
          d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z"
          fill="#2563EB"
        />
        <text
          x="12"
          y="16.2"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="12"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          C
        </text>
      </svg>
    );
  }

  // 6. Ngôn ngữ C++ (.cpp, .cc, .cxx)
  if (/\.(cpp|cc|cxx)$/.test(lower)) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <path
          d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z"
          fill="#0284C7"
        />
        <text
          x="12"
          y="15.2"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="8.8"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          C++
        </text>
      </svg>
    );
  }

  // 7. Header C/C++ (.h, .hpp, .hh)
  if (/\.(h|hpp|hh)$/.test(lower)) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect x="2" y="2" width="20" height="20" rx="5" fill="#8B5CF6" />
        <text
          x="12"
          y="16.3"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="12"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          H
        </text>
      </svg>
    );
  }

  // 8. Python (.py)
  if (lower.endsWith('.py')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <path
          d="M11.9 2.5c-4.2 0-3.9 1.8-3.9 1.8v1.9h4v.6H6.4S3.5 6.5 3.5 11s2.5 4.3 2.5 4.3h1.5v-2.1s-.1-2.5 2.4-2.5h4.1s2.3.1 2.3-2.2V4.8s.4-2.3-4.4-2.3Zm-2.2 1.3a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Z"
          fill="#3776AB"
        />
        <path
          d="M12.1 21.5c4.2 0 3.9-1.8 3.9-1.8v-1.9h-4v-.6h5.6s2.9.3 2.9-4.2-2.5-4.3-2.5-4.3h-1.5v2.1s.1 2.5-2.4 2.5H10s-2.3-.1-2.3 2.2v3.7s-.4 2.3 4.4 2.3Zm2.2-1.3a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z"
          fill="#FFD43B"
        />
      </svg>
    );
  }

  // 9. HTML (.html, .htm)
  if (/\.(html|htm)$/.test(lower)) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <path d="M3.5 2.5h17l-1.55 17.2L12 21.7l-6.95-2L3.5 2.5Z" fill="#E44D26" />
        <path
          d="M9.4 9.2L6.6 12l2.8 2.8M14.6 9.2l2.8 2.8-2.8 2.8"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // 10. CSS (.css, .scss, .less)
  if (/\.(css|scss|less)$/.test(lower)) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <path d="M3.5 2.5h17l-1.55 17.2L12 21.7l-6.95-2L3.5 2.5Z" fill="#2563EB" />
        <path
          d="M9.8 7.5l-.8 9M15 7.5l-.8 9M7.2 10.3h9.8M6.8 13.7h9.8"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // 11. JSON (.json)
  if (lower.endsWith('.json')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect x="2" y="2" width="20" height="20" rx="5" fill="#F59E0B" />
        <text
          x="12"
          y="16"
          textAnchor="middle"
          fill="#18181B"
          fontSize="11.5"
          fontWeight="800"
          fontFamily="monospace"
        >
          {'{}'}
        </text>
      </svg>
    );
  }

  // 12. Markdown (.md, .markdown)
  if (/\.(md|markdown)$/.test(lower)) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect x="2" y="4" width="20" height="16" rx="3.5" fill="#0EA5E9" />
        <path
          d="M5.5 15V9l2.7 3.3L10.9 9v6M16.5 9v6m0 0-2-2m2 2 2-2"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // 13. Hình ảnh (.png, .jpg, .svg, .webp, .gif...)
  if (/\.(png|jpe?g|gif|webp|svg|ico|bmp)$/.test(lower)) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`shrink-0 ${className}`}
      >
        <rect x="2.5" y="3.5" width="19" height="17" rx="4" fill="#10B981" />
        <circle cx="8.5" cy="9" r="1.8" fill="#FEF08A" />
        <path
          d="M4.5 17.5l4.6-4.8a1.2 1.2 0 0 1 1.75 0l2.65 2.75 1.9-1.95a1.2 1.2 0 0 1 1.72 0l2.38 4H4.5Z"
          fill="#ECFDF5"
        />
      </svg>
    );
  }

  // 14. Tệp mặc định
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 ${className}`}
    >
      <path
        d="M6 2.5h8.2L19.5 7.8V19.5A2 2 0 0 1 17.5 21.5h-11A2 2 0 0 1 4.5 19.5v-15A2 2 0 0 1 6.5 2.5Z"
        fill="#64748B"
      />
      <path d="M14 2.5v5.5h5.5" fill="#94A3B8" />
    </svg>
  );
};