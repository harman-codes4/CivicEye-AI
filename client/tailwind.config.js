/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f1f5fb',
          100: '#e2e9f5',
          200: '#c6d4ea',
          500: '#3b5a8a',
          700: '#1e3a5f',
          800: '#142944',
          900: '#0b1f3a',
          950: '#071528',
        },
        teal: {
          50: '#effcf9',
          100: '#d7f7ef',
          200: '#b0eee1',
          300: '#79dfce',
          400: '#3fc7b2',
          500: '#17a893',
          600: '#0d8a7a',
          700: '#0d6f63',
          800: '#0f5850',
          900: '#104942',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 31, 58, 0.04), 0 8px 24px -12px rgba(11, 31, 58, 0.16)',
        lift: '0 2px 6px rgba(11, 31, 58, 0.06), 0 18px 40px -20px rgba(11, 31, 58, 0.28)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};
