/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e3f2fd',
          100: '#bbdefb',
          200: '#90caf9',
          300: '#64b5f6',
          400: '#42a5f5',
          500: '#1e88e5',
          600: '#1565c0',
          700: '#0d47a1',
        },
        background: {
          DEFAULT: '#f5f7fa',
          card: '#ffffff',
          hover: '#eceff1',
        },
        text: {
          primary: '#263238',
          secondary: '#546e7a',
          muted: '#90a4ae',
        },
        success: '#4caf50',
        warning: '#ff9800',
        danger: '#f44336',
        info: '#2196f3',
      },
      fontFamily: {
        sans: ['PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
