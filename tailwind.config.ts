import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        foreground: 'hsl(0 0% 98%)',
        background: 'hsl(222 47% 5%)',
        accent: 'hsl(210 90% 60%)',
        accent2: 'hsl(280 100% 60%)'
      },
      keyframes: {
        swirl: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.04)' }
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.6' }
        }
      },
      animation: {
        'swirl-slow': 'swirl 16s linear infinite',
        breathe: 'breathe 3s ease-in-out infinite',
        glow: 'glowPulse 2.4s ease-in-out infinite'
      }
    }
  },
  plugins: []
};

export default config;


