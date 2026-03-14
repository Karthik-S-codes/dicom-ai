/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        pacs: '0 10px 24px rgba(2, 6, 23, 0.35)'
      }
    }
  },
  plugins: []
};
