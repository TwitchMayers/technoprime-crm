/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
    '../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui'],
        body: ['var(--font-body)', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9e9ff',
          200: '#b9d6ff',
          300: '#8fc0ff',
          400: '#5ea3ff',
          500: '#2f86ff',
          600: '#1b6ce2',
          700: '#1552b0',
          800: '#123f86',
          900: '#0f2e63'
        }
      },
      boxShadow: {
        glow: '0 0 40px rgba(47, 134, 255, 0.35)',
      }
    }
  },
  plugins: []
};
