export default {
  theme: {
    extend: {
      colors: {
        noir: {
          950: "#0b0b0f",
          900: "#15151c",
          850: "#1d1d27",
          800: "#262632",
          700: "#373744",
          500: "#8d8d9c",
          300: "#c6c6d0",
          100: "#f4f3f8",
        },
        violet: {
          400: "#b7a2ff",
          500: "#a78bfa",
          600: "#8b6ce7",
        },
        status: {
          success: "#34d399",
          warning: "#fbbf24",
          danger: "#fb7185",
        },
      },
      borderRadius: {
        panel: "16px",
        control: "12px",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      boxShadow: {
        active: "0 0 24px rgb(167 139 250 / 18%)",
      },
    },
  },
};
