import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        sidebar: token("sidebar"),
        surface: token("surface"),
        elevated: token("elevated"),
        line: token("line"),
        ink: token("ink"),
        ink2: token("ink2"),
        ink3: token("ink3"),
        accent: token("accent"),
        accentink: token("accent-ink"),
        danger: token("danger"),
        codebg: token("codebg"),
      },
    },
  },
  plugins: [],
};

export default config;
