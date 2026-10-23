/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ao3: {
          red: '#990000',
          darkRed: '#770000',
        }
      }
    },
  },
  plugins: [],
};
