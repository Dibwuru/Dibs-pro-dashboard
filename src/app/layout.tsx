import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";
import { ThemeProvider } from "@/components/ThemeProvider";
import PrivyAuthProvider from "@/providers/PrivyAuthProvider";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { SidebarProvider } from "@/components/SidebarContext";
import { Footer } from "@/components/Footer";
import { NetworkGuard } from "@/components/NetworkGuard";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ARCTOR Terminal — Decentralized Trading on Arc",
  description:
    "Swap, stake, and manage your $DIBS tokens on the Arc Testnet with a professional DeFi experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-obsidian relative">
        <ThemeProvider>
          <PrivyAuthProvider>
            {/* Global Atmospheric Glow Components */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
              <div className="absolute top-[-10%] left-[-5%] w-[800px] h-[800px] rounded-full bg-amber-500/[0.04] blur-[180px] dark:bg-amber-500/[0.07]" />
              <div className="absolute bottom-[-15%] right-[-8%] w-[750px] h-[750px] rounded-full bg-orange-500/[0.03] blur-[170px] dark:bg-amber-600/[0.05]" />
            </div>
            <Web3Provider>
              <SidebarProvider>
                <div className="flex min-h-screen">
                  <Sidebar />
                  <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <NetworkGuard />
                    <main className="flex-1 flex flex-col relative z-10 pb-16 lg:pb-0">{children}</main>
                    <BottomNav />
                    <Footer />
                  </div>
                </div>
              </SidebarProvider>
              <Toaster position="bottom-right" theme="dark" richColors closeButton />
            </Web3Provider>
          </PrivyAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
