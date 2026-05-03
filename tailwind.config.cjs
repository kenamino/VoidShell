/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        abyss: {
          950: '#05070c',
          900: '#0a0f18',
          800: '#101826',
          700: '#172133',
        },
        frost: {
          500: '#7ea7ff',
          400: '#9ebdff',
          300: '#c6d6ff',
        },
      },
      boxShadow: {
        cold: '0 0 0 1px rgba(126,167,255,0.10), 0 14px 30px rgba(5,10,20,0.55)',
      },
      keyframes: {
        'panel-in': {
          '0%': { opacity: '0', transform: 'translateY(18px) scale(0.99)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'line-pulse': {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'panel-in': 'panel-in 480ms cubic-bezier(0.2, 0.65, 0.2, 1) both',
        'line-pulse': 'line-pulse 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
