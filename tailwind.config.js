/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080808',
        card: '#0E0E0E',
        gold: '#C8A96E',
        goldLight: '#E8D5A3',
        divider: '#2A2A2A',
        muted: '#666666',
        secondary: '#999999',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
