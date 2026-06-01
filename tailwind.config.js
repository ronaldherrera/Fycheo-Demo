/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#135bec",
          light: "#3b76f6",
          dark: "#0a3cb3",
        },
        background: {
          dark: "#0B0E14",
          DEFAULT: "#101622",
          light: "#F6F6F8",
        },
        surface: {
          dark: "#151B2B",
          light: "#FFFFFF",
          highlight: "#1E273B",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#94A3B8",
          muted: "#64748B",
        },
        border: {
          dark: "#2A3447",
          light: "#E2E8F0",
        },
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
      },
      fontFamily: {
        display: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      borderRadius: {
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        glow: "0 0 20px -5px rgba(19, 91, 236, 0.4)",
        "glow-lg": "0 0 30px -5px rgba(19, 91, 236, 0.5)",
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        drawStroke: {
          "0%": { strokeDashoffset: "100" },
          "100%": { strokeDashoffset: "0" },
        },
        pop: {
          "0%": { transform: "scale(0.95)" },
          "40%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1)" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200px 0" },
          "100%": { backgroundPosition: "calc(200px + 100%) 0" },
        }
      },
      animation: {
        draw: "drawStroke 1.5s ease-out forwards",
        pop: "pop 0.3s ease-out",
        fadeInUp: "fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        shimmer: "shimmer 2s infinite linear",
      },
    },
  },
  plugins: [],
}
