import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        studio: {
          50: "#f4f6f8",
          100: "#e7ebf0",
          200: "#cdd6e0",
          300: "#a6b5c6",
          400: "#7890a8",
          500: "#57708c",
          600: "#445a73",
          700: "#38495f",
          800: "#323f51",
          900: "#2c3746",
          950: "#1c2330",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
