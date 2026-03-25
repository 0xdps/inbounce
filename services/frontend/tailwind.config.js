/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'IBM Plex Mono', 'SFMono-Regular', 'monospace'],
        display: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['14px', '1.5'],
      },
      colors: {
        base:             '#07070f',
        elevated:         '#0d0d1b',
        overlay:          '#111120',
        surface:          '#161620',
        accent:           '#7c3aed',
        'accent-hover':   '#6d28d9',
        'accent-light':   '#a78bfa',
        success:          '#10b981',
        danger:           '#f43f5e',
        warning:          '#f59e0b',
        'text-primary':   '#eeeef8',
        'text-secondary': '#9090b4',
        'text-muted':     '#545470',
        border:           'rgba(139,92,246,0.12)',
        'border-mid':     'rgba(139,92,246,0.24)',
        'border-s':       'rgba(255,255,255,0.06)',
      },
    },
  },
  plugins: [],
};
