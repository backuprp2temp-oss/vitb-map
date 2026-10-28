/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Dark, low-glare palette
        ink: {
          950: "#0b0d10",
          900: "#111418",
          850: "#161a20",
          800: "#1c2129",
          700: "#262d38",
          600: "#333c4a",
          500: "#4a5666",
          400: "#6b7686",
          300: "#98a2b3",
          200: "#c4cbd6",
        },
        accent: {
          DEFAULT: "#4f9cf9",
          hover: "#6cadfa",
          dim: "#1d3a5f",
        },
        route: "#ffb454",
        success: "#4ade80",
        warn: "#fbbf24",
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
