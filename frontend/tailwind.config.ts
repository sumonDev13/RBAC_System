
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Base backgrounds
        base:     '#080C10',
        surface:  '#0D1117',
        elevated: '#131920',
        border:   '#1E2A35',
        hover:    '#1A2530',
        // Accent
        accent: {
          DEFAULT: '#00D4FF',
          dim:     'rgba(0,212,255,0.12)',
          glow:    'rgba(0,212,255,0.25)',
          soft:    '#00B8D9',
        },
        // Semantic
        success: { DEFAULT: '#00E5A0', dim: 'rgba(0,229,160,0.12)'   },
        warning: { DEFAULT: '#FFB547', dim: 'rgba(255,181,71,0.12)'  },
        danger:  { DEFAULT: '#FF5C5C', dim: 'rgba(255,92,92,0.12)'   },
        // Text
        primary:   '#EDF2F7',
        secondary: '#7A9BB5',
        muted:     '#3D5468',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body:    ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        sm:  '6px',
        md:  '10px',
        lg:  '16px',
        xl:  '24px',
        '2xl': '32px',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-10px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition:  '200% 0' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
        pulse: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0.4' },
        },
      },
      animation: {
        'fade-up':  'fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in':  'fadeIn 0.3s ease both',
        'slide-in': 'slideIn 0.35s cubic-bezier(0.22,1,0.36,1) both',
        shimmer:    'shimmer 1.5s infinite',
        spin:       'spin 0.7s linear infinite',
        pulse:      'pulse 2s ease-in-out infinite',
      },
      boxShadow: {
        'accent-glow': '0 0 24px rgba(0,212,255,0.25)',
        'accent-sm':   '0 0 0 3px rgba(0,212,255,0.12)',
      },
    },
  },
  plugins: [],
};

export default config;