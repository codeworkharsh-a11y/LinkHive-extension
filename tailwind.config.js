/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./*.js"],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0f172a',
        'glass-bg': 'rgb(var(--glass-rgb) / var(--glass-opacity))',
        'glass-border': 'var(--glass-border)',
        'glass-border-hover': 'var(--glass-border-hover)',
        'card-divider': 'var(--card-divider)',
        'neon-green': 'rgb(var(--neon-rgb) / <alpha-value>)',
        'neon-green-glow': 'rgba(var(--neon-rgb), 0.5)',
        'white': 'rgb(var(--tx-white-rgb) / <alpha-value>)',
        'slate': {
          200: 'rgb(var(--tx-200-rgb) / <alpha-value>)',
          300: 'rgb(var(--tx-300-rgb) / <alpha-value>)',
          400: 'rgb(var(--tx-400-rgb) / <alpha-value>)',
          500: 'rgb(var(--tx-500-rgb) / <alpha-value>)',
          700: 'rgb(var(--tx-700-rgb) / <alpha-value>)',
          800: 'rgb(var(--tx-800-rgb) / <alpha-value>)',
          900: 'rgb(var(--tx-900-rgb) / <alpha-value>)',
          950: 'rgb(var(--tx-950-rgb) / <alpha-value>)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 15px rgba(var(--neon-rgb), 0.5)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'neon-glow': '0 0 10px rgba(var(--neon-rgb), 0.3), inset 0 0 5px rgba(var(--neon-rgb), 0.2)',
        'glass-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
}
