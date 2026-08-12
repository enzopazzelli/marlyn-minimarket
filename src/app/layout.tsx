import type { Metadata } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Tres roles tipográficos, sin excepciones (prompt-base sección 4.2):
// display para títulos, texto para la interfaz, número monoespaciado
// con tabular-nums para todo precio, código, stock, hora y saldo.
const fuenteDisplay = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const fuenteTexto = Geist({
  variable: "--font-texto",
  subsets: ["latin"],
});

const fuenteNumero = Geist_Mono({
  variable: "--font-numero",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mini Market Merlyn",
  description: "Sistema de gestión — Mini Market Merlyn",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${fuenteDisplay.variable} ${fuenteTexto.variable} ${fuenteNumero.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-fondo text-texto">
        {children}
      </body>
    </html>
  );
}
