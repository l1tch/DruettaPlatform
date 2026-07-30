import type { Config } from "tailwindcss";

// Design tokens mirror lacomune.eu: flat red/black/white, no rounded corners,
// bold sans-serif type. "ink" is the neutral scale for text/borders/surfaces,
// "brand" is the signature red used for primary actions and accents.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#fafafa",
          100: "#f2f2f2",
          200: "#e0e0e0",
          300: "#c7c7c7",
          400: "#9a9a9a",
          500: "#707070",
          600: "#525252",
          700: "#3a3a3a",
          800: "#242424",
          900: "#141414",
          950: "#0a0a0a",
        },
        brand: {
          50: "#fdecee",
          100: "#fad0d5",
          200: "#f3a1ab",
          300: "#ea6c7c",
          400: "#e23b53",
          500: "#e2142f",
          600: "#c60f28",
          700: "#a10c21",
          800: "#7d0919",
          900: "#5c0713",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Arial", "sans-serif"],
      },
      borderRadius: {
        // Flat design: keep the scale defined (some libraries reference it)
        // but every component in this app is styled with sharp corners.
        DEFAULT: "0px",
        md: "0px",
        lg: "0px",
        xl: "0px",
      },
    },
  },
  plugins: [],
};

export default config;
