// tailwind.config.js
/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        base:     '#080C10',
        surface:  '#0D1117',
        elevated: '#131920',
        border:   '#1E2A35',
        hover:    '#1A2530',

        accent: {
          DEFAULT: '#00D4FF',
          dim:     'rgba(0,212,255,0.12)',
          glow:    'rgba(0,212,255,0.25)',
          soft:    '#00B8D9',
        },

        success: { 
          DEFAULT: '#00E5A0', 
          dim: 'rgba(0,229,160,0.12)' 
        },
        warning: { 
          DEFAULT: '#FFB547', 
          dim: 'rgba(255,181,71,0.12)' 
        },
        danger:  { 
          DEFAULT: '#FF5C5C', 
          dim: 'rgba(255,92,92,0.12)' 
        },

        primary:   '#EDF2F7',
        secondary: '#7A9BB5',
        muted:     '#3D5468',
      },

      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body:    ['DM Sans', 'sans-serif'],
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