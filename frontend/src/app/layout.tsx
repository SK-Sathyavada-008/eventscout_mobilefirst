import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import NavBar from "@/components/NavBar";
import BottomNav from "@/components/BottomNav";
import Toast from "@/components/Toast";
import OfflineBanner from "@/components/OfflineBanner";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export const metadata: Metadata = {
  title: "EventScout — Find. Track. Never Miss an Opportunity.",
  description: "Your gateway to hackathons, workshops, conferences, and tech opportunities.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EventScout",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.className} bg-[#0b0f19] text-slate-100 min-h-screen flex flex-col antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <ServiceWorkerRegister />
          <OfflineBanner />
          <NavBar />
          <Toast />

          {/* Main Page Content: with bottom padding for mobile navigation bar */}
          <main className="flex-grow pb-24 md:pb-8">{children}</main>

          {/* Persistent Mobile Bottom Navigation */}
          <BottomNav />

          {/* Desktop Footer (hidden on mobile to keep native app feel) */}
          <footer className="hidden md:block border-t border-slate-800/80 bg-[#090d16] py-8 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-400">
              <p>EventScout — Find. Track. Never Miss an Opportunity.</p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}

