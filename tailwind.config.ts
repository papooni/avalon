import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      colors: {
        // Night palette
        night: { DEFAULT: '#0E1626', deep: '#090F1B', raised: '#16213A', line: '#2A3756' },
        slate: { ink: '#1B1F27' },
        gilt: { DEFAULT: '#D9B26A', bright: '#F0D59A', dim: '#8E7444' },
        loyal: { DEFAULT: '#5B8CE0', soft: '#9DBBF0', deep: '#24427A' },
        treason: { DEFAULT: '#B8394A', soft: '#E58A96', deep: '#5E1A26' },
        parchment: '#ECE4D3',
        // shadcn tokens
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { lg: '14px', md: '10px', sm: '6px' },
      boxShadow: {
        lift: '0 1px 0 rgba(255,255,255,0.04) inset, 0 18px 40px -18px rgba(0,0,0,0.7)',
        glow: '0 0 0 1px rgba(217,178,106,0.35), 0 0 32px -6px rgba(217,178,106,0.35)',
      },
      keyframes: {
        ember: { '0%': { transform: 'translateY(0)', opacity: '0' }, '20%': { opacity: '0.6' }, '100%': { transform: 'translateY(-60vh)', opacity: '0' } },
      },
      animation: { ember: 'ember linear infinite' },
    },
  },
  plugins: [animate],
} satisfies Config;
