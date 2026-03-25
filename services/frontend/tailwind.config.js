/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'SFMono-Regular', 'Cascadia Code', 'monospace'],
      },
      fontSize: {
        base: ['14px', '1.5'],
      },
      colors: {
        base:           '#0b0b10',
        elevated:       '#10101a',
        overlay:        '#161620',
        accent:         '#7c3aed',
        'accent-hover': '#8b5cf6',
        success:        '#10b981',
        danger:         '#f43f5e',
        warning:        '#f59e0b',
        'text-primary': '#ededf4',
        'text-secondary':'#7e7e9e',
        'text-muted':   '#48485e',
        border:         'rgba(255,255,255,0.06)',
        'border-mid':   'rgba(255,255,255,0.10)',
      },
    },
  },
  plugins: [],
};
