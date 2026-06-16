import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { VaultGate } from "@/components/VaultGate";

// Serif élégante pour les titres — l'aura « galerie »
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Sans neutre et lisible pour l'interface
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Provenance — Due Diligence",
  description:
    "Outil local d'aide à la vigilance LCB-FT pour le marché de l'art. " +
    "Fonctionne hors-ligne, aucune donnée envoyée dans le cloud.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${playfair.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* Le coffre chiffré garde la coquille : rien n'est rendu tant qu'il
            n'est pas déverrouillé. */}
        <VaultGate>
          {/* Coquille applicative : barre latérale fixe + zone de travail */}
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 min-w-0">{children}</main>
          </div>
        </VaultGate>
      </body>
    </html>
  );
}
