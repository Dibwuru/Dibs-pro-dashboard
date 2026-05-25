import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DibsCoin — Decentralized Trading on Arc",
  description:
    "Swap, stake, and manage your DIBS tokens on the Arc Testnet with a professional DeFi experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-obsidian relative">
        {/* Global Atmospheric Glow Components */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-5%] w-[800px] h-[800px] rounded-full bg-[#8B5CF6]/[0.06] blur-[180px]" />
          <div className="absolute bottom-[-15%] right-[-8%] w-[750px] h-[750px] rounded-full bg-[#10B981]/[0.05] blur-[170px]" />
        </div>
        <Web3Provider>
          <Navbar />
          <main className="flex-1 flex flex-col relative z-10">{children}</main>
          <Footer />
        </Web3Provider>
      </body>
    </html>
  );
}
