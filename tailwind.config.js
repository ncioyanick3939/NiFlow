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
        sans: ['"Instrument Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Instrument Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        // Swiss Editorial: höchstens 6 px. Kreise (rounded-full) nur für Punkte und Häkchen.
        DEFAULT: '4px',
        sm: '3px',
        md: '4px',
        lg: '5px',
        xl: '6px',
        '2xl': '6px',
      },
      boxShadow: {
        // Schatten nur für schwebende Ebenen (Blätter, Hinweise, gezogene Termine)
        sheet: '0 16px 40px -16px rgb(0 0 0 / 0.28)',
        pop: 'none',
        float: '0 6px 18px -8px rgb(0 0 0 / 0.35)',
      },
    },
  },
  plugins: [],
}
