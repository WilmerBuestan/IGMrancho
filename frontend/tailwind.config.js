/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Verde militar IGM + dorado para acentos
        igm: {
          50: '#f3f6f1', 100: '#e2eadc', 200: '#c5d5ba', 300: '#9fb78e', 400: '#7a9867',
          500: '#5c7b4a', 600: '#476139', 700: '#384c2f', 800: '#2e3d28', 900: '#263322', 950: '#121a10',
        },
        oro: { 300: '#f3d27a', 400: '#ecbd45', 500: '#d9a21f', 600: '#b98116' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
