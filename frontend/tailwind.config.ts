import type { Config } from "tailwindcss";

const configuration: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/composants/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette principale — bleu-marine professionnel et profond
        primaire: {
          50:  "#f0f4ff",
          100: "#dde6ff",
          200: "#c3d0ff",
          300: "#9db1ff",
          400: "#6e88fc",
          500: "#4561f7",
          600: "#2e3fed",
          700: "#2530d4",
          800: "#2129ab",
          900: "#1e2787",
          950: "#10154f",
        },
        // Accent ambre-doré — pour les CTA et éléments de mise en valeur
        accent: {
          50:  "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        // Tons neutres premium pour les fonds de section
        ardoise: {
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        // Couleurs sémantiques
        succes:  "#16a34a",
        alerte:  "#d97706",
        danger:  "#dc2626",
        info:    "#0ea5e9",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        xl:  "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      backgroundImage: {
        "grille-fine": "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
        "grille-sombre": "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grille": "40px 40px",
      },
      animation: {
        "pulse-lent": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fondu-haut": "fondu-haut 0.6s ease-out",
      },
      keyframes: {
        "fondu-haut": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      boxShadow: {
        "carte":   "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)",
        "carte-lg": "0 4px 24px -2px rgba(0,0,0,0.10), 0 2px 8px -2px rgba(0,0,0,0.06)",
        "accent":  "0 4px 24px -4px rgba(245, 158, 11, 0.4)",
        "primaire": "0 4px 24px -4px rgba(69, 97, 247, 0.4)",
      },
    },
  },
  plugins: [],
};

export default configuration;
