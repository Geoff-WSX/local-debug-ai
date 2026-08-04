/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './src/popup/**/*.{vue,ts}',
    './src/popup/index.html',
  ],
  theme: {
    extend: {
      colors: {
        // 深色主题（VS Code 风格）
        base: {
          DEFAULT: '#1e1e1e',
          panel: '#252526',
          hover: '#2d2d30',
          active: '#37373d',
        },
        // 面层级：底 → 面板 → 卡片 → 浮层，形成立体纵深感
        surface: {
          raised: '#2b2b2f',      // 卡片底（比 panel 亮一档）
          overlay: '#2f2f34',     // 浮层/对话框底
          sunken: '#1a1a1c',      // 凹陷区底（输入/代码区）
        },
        edge: {
          DEFAULT: '#3e3e42',
          strong: '#4a4a4f',
          faint: 'rgba(62, 62, 66, 0.6)',
        },
        tprimary: '#e8e8e8',
        tsecondary: '#9d9d9d',
        tdisabled: '#6e6e73',
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
          soft: 'rgba(59, 130, 246, 0.15)',
        },
        success: {
          DEFAULT: '#4ec9b0',
          soft: 'rgba(78, 201, 176, 0.15)',
        },
        danger: {
          DEFAULT: '#f44747',
          soft: 'rgba(244, 71, 71, 0.15)',
        },
        warning: {
          DEFAULT: '#cca700',
          soft: 'rgba(204, 167, 0, 0.15)',
        },
      },
      keyframes: {
        'pulse-rec': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(244, 71, 71, 0.5)' },
          '50%': { opacity: '0.7', boxShadow: '0 0 0 4px rgba(244, 71, 71, 0)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'pulse-rec': 'pulse-rec 1.5s ease-in-out infinite',
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
      },
      boxShadow: {
        'card': '0 1px 0 rgba(255,255,255,0.03) inset, 0 2px 8px rgba(0, 0, 0, 0.35)',
        'card-hover': '0 2px 4px rgba(255,255,255,0.04) inset, 0 4px 16px rgba(0, 0, 0, 0.45)',
        'pop': '0 8px 24px rgba(0, 0, 0, 0.5)',
        'edge-top': '0 -1px 0 rgba(255,255,255,0.04) inset',
      },
    },
  },
  plugins: [],
}
