export type UiThemeId =
  | 'midnight-indigo'
  | 'tokyo-night'
  | 'catppuccin-mocha'
  | 'nord-frost'
  | 'cyber-emerald'
  | 'dracula-neon'
  | 'vscode-dark'
  | 'oled-obsidian'
  | 'lavender-light'
  | 'github-light'
  | 'rose-pine-dawn'
  | 'solarized-light';

export interface ThemeSyntaxPalette {
  foreground: string;
  comment: string;
  keyword: string;
  string: string;
  number: string;
  type: string;
  lineNumber: string;
}

export interface ThemeDefinition {
  id: UiThemeId;
  name: string;
  shortName: string;
  mode: 'dark' | 'light';
  canvasBg: string;
  bgSwatch: string;
  accentSwatch: string;
  monacoTheme: string;
  syntax: ThemeSyntaxPalette;
}

export const UI_THEMES: ThemeDefinition[] = [
  {
    id: 'midnight-indigo',
    name: 'Midnight Navy',
    shortName: 'Midnight',
    mode: 'dark',
    canvasBg: '#060913',
    bgSwatch: '#0F1629',
    accentSwatch: '#3B82F6',
    monacoTheme: 'vs-dark-modern',
    syntax: {
      foreground: '#ECEAF8',
      comment: '6E7191',
      keyword: 'A78BFA',
      string: '5EEAD4',
      number: 'F472B6',
      type: '38BDF8',
      lineNumber: '#5C5F7A'
    }
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    shortName: 'Tokyo Night',
    mode: 'dark',
    canvasBg: '#13141E',
    bgSwatch: '#1A1B26',
    accentSwatch: '#7AA2F7',
    monacoTheme: 'vs-dark-modern',
    syntax: {
      foreground: '#C0CAF5',
      comment: '565F89',
      keyword: 'BB9AF7',
      string: '9ECE6A',
      number: 'FF9E64',
      type: '2AC3DE',
      lineNumber: '#3B4261'
    }
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    shortName: 'Catppuccin',
    mode: 'dark',
    canvasBg: '#161622',
    bgSwatch: '#1E1E2E',
    accentSwatch: '#CBA6F7',
    monacoTheme: 'vs-dark-modern',
    syntax: {
      foreground: '#CDD6F4',
      comment: '6C7086',
      keyword: 'CBA6F7',
      string: 'A6E3A1',
      number: 'FAB387',
      type: '89DCEB',
      lineNumber: '#585B70'
    }
  },
  {
    id: 'nord-frost',
    name: 'Nord Frost',
    shortName: 'Nord Frost',
    mode: 'dark',
    canvasBg: '#232832',
    bgSwatch: '#2E3440',
    accentSwatch: '#88C0D0',
    monacoTheme: 'vs-dark-modern',
    syntax: {
      foreground: '#ECEFF4',
      comment: '616E88',
      keyword: '81A1C1',
      string: 'A3BE8C',
      number: 'B48EAD',
      type: '8FBCBB',
      lineNumber: '#4C566A'
    }
  },
  {
    id: 'cyber-emerald',
    name: 'Cyber Emerald',
    shortName: 'Emerald',
    mode: 'dark',
    canvasBg: '#060D0B',
    bgSwatch: '#0C1714',
    accentSwatch: '#10B981',
    monacoTheme: 'vs-dark-modern',
    syntax: {
      foreground: '#E6F7F1',
      comment: '5B7D72',
      keyword: '34D399',
      string: '67E8F9',
      number: 'FBBF24',
      type: '38BDF8',
      lineNumber: '#3E5E54'
    }
  },
  {
    id: 'dracula-neon',
    name: 'Dracula Neon',
    shortName: 'Dracula',
    mode: 'dark',
    canvasBg: '#13141B',
    bgSwatch: '#1B1C26',
    accentSwatch: '#BD93F9',
    monacoTheme: 'vs-dark-modern',
    syntax: {
      foreground: '#F8F8F2',
      comment: '6272A4',
      keyword: 'FF79C6',
      string: 'F1FA8C',
      number: 'BD93F9',
      type: '8BE9FD',
      lineNumber: '#5A6185'
    }
  },
  {
    id: 'vscode-dark',
    name: 'VS Code Dark+',
    shortName: 'Dark+',
    mode: 'dark',
    canvasBg: '#0E0E10',
    bgSwatch: '#1A1A1D',
    accentSwatch: '#0EA5E9',
    monacoTheme: 'vs-dark-modern',
    syntax: {
      foreground: '#E4E4E7',
      comment: '6A9955',
      keyword: '569CD6',
      string: 'CE9178',
      number: 'B5CEA8',
      type: '4EC9B0',
      lineNumber: '#6B7280'
    }
  },
  {
    id: 'oled-obsidian',
    name: 'OLED Obsidian',
    shortName: 'OLED Black',
    mode: 'dark',
    canvasBg: '#000000',
    bgSwatch: '#0D0E13',
    accentSwatch: '#38BDF8',
    monacoTheme: 'vs-dark-modern',
    syntax: {
      foreground: '#F4F4F6',
      comment: '6B7280',
      keyword: 'C084FC',
      string: '34D399',
      number: 'FB7185',
      type: '38BDF8',
      lineNumber: '#525866'
    }
  },
  {
    id: 'lavender-light',
    name: 'Lavender Daylight',
    shortName: 'Daylight',
    mode: 'light',
    canvasBg: '#EEF1F8',
    bgSwatch: '#FFFFFF',
    accentSwatch: '#6D4AFF',
    monacoTheme: 'code-ide-light',
    syntax: {
      foreground: '#17162B',
      comment: '8C89A6',
      keyword: '6D4AFF',
      string: '0D9488',
      number: 'DB2777',
      type: '0284C7',
      lineNumber: '#9E9BB8'
    }
  },
  {
    id: 'github-light',
    name: 'GitHub Studio',
    shortName: 'GitHub',
    mode: 'light',
    canvasBg: '#F3F5F8',
    bgSwatch: '#FFFFFF',
    accentSwatch: '#0969DA',
    monacoTheme: 'code-ide-light',
    syntax: {
      foreground: '#1F2328',
      comment: '6E7781',
      keyword: 'CF222E',
      string: '0A3069',
      number: '0550AE',
      type: '8250DF',
      lineNumber: '#8C959F'
    }
  },
  {
    id: 'rose-pine-dawn',
    name: 'Rosé Pine Dawn',
    shortName: 'Rosé Dawn',
    mode: 'light',
    canvasBg: '#F2E9E1',
    bgSwatch: '#FAF4ED',
    accentSwatch: '#D7827E',
    monacoTheme: 'code-ide-light',
    syntax: {
      foreground: '#575279',
      comment: '9893A5',
      keyword: '286983',
      string: 'EA9D34',
      number: 'B4637A',
      type: '907AA9',
      lineNumber: '#9893A5'
    }
  },
  {
    id: 'solarized-light',
    name: 'Solarized Paper',
    shortName: 'Solarized',
    mode: 'light',
    canvasBg: '#EEE8D5',
    bgSwatch: '#FDF6E3',
    accentSwatch: '#D97706',
    monacoTheme: 'code-ide-light',
    syntax: {
      foreground: '#2C3539',
      comment: '93A1A1',
      keyword: '859900',
      string: '2AA198',
      number: 'D33682',
      type: '268BD2',
      lineNumber: '#93A1A1'
    }
  }
];

export function getThemeById(id: string | null | undefined): ThemeDefinition {
  return UI_THEMES.find((t) => t.id === id) || UI_THEMES[0];
}
