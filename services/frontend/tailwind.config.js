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
        base:           '#0c0c0e',
        elevated:       '#111114',
        overlay:        '#16161a',
        accent:         '#3b82f6',
        'accent-hover': '#60a5fa',
        success:        '#22c55e',
        danger:         '#ef4444',
        warning:        '#f59e0b',
        'text-primary': '#e8e8ec',
        'text-secondary':'#888896',
        'text-muted':   '#4a4a56',
        border:         'rgba(255,255,255,0.07)',
        'border-mid':   'rgba(255,255,255,0.10)',
      },
    },
  },
  plugins: [],
};
