/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#080A0D',
        primary: '#7C8CFF',
        accent: '#42E8C6',
        surface: '#11151B',
        border: '#26303A',
        muted: '#475260',
        text: {
          primary: '#F4F7FB',
          secondary: '#9AA6B2',
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'Inter', 'Arial', 'sans-serif'],
        mono: ['Consolas', 'Courier New', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        glow: '0 14px 35px rgba(124, 140, 255, 0.22)',
        'glow-accent': '0 14px 35px rgba(66, 232, 198, 0.18)',
        'glow-sm': '0 10px 24px rgba(124, 140, 255, 0.16)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}
