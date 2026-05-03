import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        soc: {
          bg: "#0a0e1a",
          surface: "#111827",
          surface2: "#1a2234",
          surface3: "#1e293b",
          border: "#1e2d4a",
          border2: "#2a3a5c",
          text: "#e2e8f0",
          muted: "#7b8ba3",
          dim: "#4a5a74",
          accent: "#00b4d8",
          accent2: "#06d6a0",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease forwards",
        "slide-in": "slideIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateX(100%)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
