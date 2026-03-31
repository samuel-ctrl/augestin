/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./shared-ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        brown: {
          50: "#fdf8f1",
          100: "#f5e6d3",
          200: "#e8cba5",
          300: "#d4a574",
          400: "#c08a50",
          500: "#a0714a",
          600: "#7a5638",
          700: "#5c3f2a",
          800: "#3d2a1c",
          900: "#261a11",
        },
      },
    },
  },
  plugins: [],
};
