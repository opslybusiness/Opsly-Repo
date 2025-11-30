/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'opsly-purple': '#9333EA',
        'opsly-dark': '#0F0F0F',
        'opsly-gray': '#1A1A1A',
        'opsly-card': '#1E1E2E',
      },
    },
  },
  plugins: [],
}

