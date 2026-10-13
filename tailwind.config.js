/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: v('bg'),
        surface: v('surface'),
        surface2: v('surface2'),
        line: v('line'),
        ink: v('ink'),
        muted: v('muted'),
        accent: v('accent'),
        accentink: v('accent-ink'),
        danger: v('danger'),
        // Tinte: invertierte Flächen
        deep: v('deep'),
        deepink: v('deep-ink'),
        deepmuted: v('deep-muted'),
        // Signalrot (gleich wie accent)
        sun: v('sun'),
        sunink: v('sun-ink'),
        cat: v('c'),
        exam: v('exam'),
        warn: v('warn'),
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        // Runde, freundliche Formen
        DEFAULT: '10px',
        sm: '8px',
        md: '12px',
        lg: '14px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        card: '0 1px 2px rgb(30 33 80 / 0.05), 0 6px 18px -10px rgb(30 33 80 / 0.14)',
        pop: '0 8px 18px -8px rgb(var(--accent) / 0.6)',
        sheet: '0 24px 60px -20px rgb(20 22 60 / 0.45)',
        float: '0 10px 24px -10px rgb(20 22 60 / 0.4)',
      },
    },
  },
  plugins: [],
}
