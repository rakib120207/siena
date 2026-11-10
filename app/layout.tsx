import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Siena",
  description: "Siena is a Groq-powered chat assistant with floating, draggable Q/A cards.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const themeScript = `(function(){try{var d=document.documentElement;var t="system";var raw=localStorage.getItem("siena:v1");if(raw){var s=JSON.parse(raw);if(s&&s.settings&&(s.settings.theme==="light"||s.settings.theme==="dark")){t=s.settings.theme}}var dark=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(dark){d.classList.add("dark")}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
