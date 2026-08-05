import HeroSection from "@/components/HeroSection";
import Features from "@/components/Features";
import AboutUs from "@/components/AboutUs";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 scroll-smooth">
      {/* Hero section with navigation and hand-torn divider */}
      <HeroSection />

      {/* Main content wrapper */}
      <main className="flex-grow">
        {/* Features list (Cerdas Memantau, Aman Berlayar, Mutu Terjaga) */}
        <Features />

        {/* Detailed About Us info */}
        <AboutUs />
      </main>

      {/* Modern footer */}
      <Footer />
    </div>
  );
}
