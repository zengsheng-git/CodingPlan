/** @type {import('tailwindcss').Config} */

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: { center: true },
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          950: '#06070D',
          900: '#0A0B14',
          800: '#10111E',
          700: '#161728',
          600: '#1F2138',
          500: '#262840',
          400: '#363A57',
        },
        cyan: {
          DEFAULT: '#5EE6E6',
          soft: '#7AEFEF',
          deep: '#16B5B5',
        },
        violet: {
          DEFAULT: '#9B6BFF',
          soft: '#B894FF',
          deep: '#6B3FE0',
        },
        amber: {
          DEFAULT: '#F5B14C',
          soft: '#F8C775',
        },
        rose: {
          DEFAULT: '#FF6B9B',
        },
        text: {
          primary: '#E8EAF2',
          secondary: '#9CA0B5',
          muted: '#5E6378',
        },
      },
      backgroundImage: {
        'grid':
          'linear-gradient(rgba(94,230,230,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(94,230,230,0.06) 1px, transparent 1px)',
        'grid-fade':
          'radial-gradient(circle at 50% 0%, rgba(155,107,255,0.10), transparent 60%), radial-gradient(circle at 80% 100%, rgba(94,230,230,0.10), transparent 60%)',
      },
      backgroundSize: {
        grid: '40px 40px',
      },
      boxShadow: {
        glow: '0 0 24px rgba(94,230,230,0.25), 0 0 60px rgba(155,107,255,0.18)',
        'glow-violet': '0 0 24px rgba(155,107,255,0.35), 0 0 60px rgba(155,107,255,0.15)',
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(94,230,230,0.08), 0 24px 60px -20px rgba(0,0,0,0.7)',
        cardHover:
          '0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 1px rgba(94,230,230,0.20), 0 32px 80px -20px rgba(0,0,0,0.7)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        'spin-slow': 'spin-slow 1.2s linear infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'count-up': 'count-up 0.5s ease-out both',
      },
    },
  },
  plugins: [],
}
