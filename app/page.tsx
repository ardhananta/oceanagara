'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthChange, redirectUserIfLoggedIn } from "@/app/service/authentication";
import HeroSection from "@/components/HeroSection";
import Features from "@/components/Features";
import OceanAnalysis from "@/components/OceanAnalysis";
import AboutUs from "@/components/AboutUs";
import Footer from "@/components/Footer";

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      if (user) {
        // Redirect to dashboard if already logged in
        redirectUserIfLoggedIn(user.uid, router.push)
          .finally(() => setCheckingAuth(false));
      } else {
        setCheckingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 scroll-smooth">
      {/* Hero section with navigation and hand-torn divider */}
      <HeroSection />

      {/* Main content wrapper */}
      <main className="flex-grow">
        {/* Features list (Cerdas Memantau, Aman Berlayar, Mutu Terjaga) */}
        <Features />

        {/* Ocean condition analysis with NRT charts */}
        <OceanAnalysis />

        {/* Detailed About Us info */}
        <AboutUs />
      </main>

      {/* Modern footer */}
      <Footer />
    </div>
  );
}
