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
        // Aare: tiefes Petrol für Struktur (Seitenleiste, Tagesbereich)
        deep: v('deep'),
        deepink: v('deep-ink'),
        deepmuted: v('deep-muted'),
        // Safran: nur für "jetzt" und "als Nächstes"
        sun: v('sun'),
        sunink: v('sun-ink'),
        cat: v('c'),
        exam: v('exam'),
        warn: v('warn'),
      },
      fontFamily: {
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Figtree', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // Rundung nach Hierarchie: kleine Elemente wenig, grosse Bereiche viel
        DEFAULT: '10px',
        sm: '8px',
        md: '12px',
        lg: '18px',
        xl: '24px',
        '2xl': '30px',
      },
      boxShadow: {
        sheet: '0 24px 60px -18px rgb(var(--deep) / 0.45)',
        pop: '0 2px 8px -2px rgb(var(--deep) / 0.18)',
        float: '0 10px 30px -10px rgb(var(--deep) / 0.5)',
      },
    },
  },
  plugins: [],
}
