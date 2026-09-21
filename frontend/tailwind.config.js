/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Cairo", "Segoe UI", "Tahoma", "Arial", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#2563eb",
          dark: "#1d4ed8",
          light: "#eff6ff",
          50: "#dbeafe",
        },
        danger: {
          DEFAULT: "#dc2626",
          dark: "#b91c1c",
          light: "#fef2f2",
        },
        success: {
          DEFAULT: "#059669",
          dark: "#047857",
          light: "#ecfdf5",
        },
        warning: {
          DEFAULT: "#d97706",
          dark: "#b45309",
          light: "#fffbeb",
        },
      },
      boxShadow: {
        xs: "0 1px 2px rgba(15, 23, 42, 0.05)",
        sm: "0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)",
        md: "0 4px 12px rgba(15, 23, 42, 0.1)",
        lg: "0 10px 30px rgba(15, 23, 42, 0.15)",
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
      },
    },
  },
  plugins: [],
};
