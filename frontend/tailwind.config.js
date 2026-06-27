/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0B0F14",
          panel: "#111722",
          raised: "#161D2B",
        },
        accent: {
          DEFAULT: "#3DD6B0",
          dim: "#2A9D85",
        },
        warn: "#F2B84B",
        danger: "#F2545B",
        ok: "#3DD6B0",
        line: "#1E2733",
      },
      fontFamily: {
        display: ["'JetBrains Mono'", "monospace"],
        body: ["'Inter'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(61,214,176,0.15), 0 8px 24px -8px rgba(61,214,176,0.25)",
      },
    },
  },
  plugins: [],
};
