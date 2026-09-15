// Keep Tailwind available to every build entry point, independently of Vite's
// framework configuration. Tailwind v4 processes source() and @theme directives.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
