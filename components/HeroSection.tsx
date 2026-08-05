import Image from 'next/image';
import Navbar from './Navbar';

export default function HeroSection() {
  return (
    <section className="relative w-full min-h-[100vh] md:min-h-[100vh] flex flex-col justify-between overflow-hidden bg-zinc-950">
      {/* Background Image */}
      <div className="absolute inset-0 w-full h-full z-0 select-none pointer-events-none">
        <Image
          src="/img/nelayan.png"
          alt="Traditional fisherman boat in the open ocean"
          fill
          priority
          sizes="100vw"
          className="object-cover object-bottom"
        />
      </div>

      {/* Navigation */}
      <Navbar />

      {/* Hero content */}
      <div className="relative z-10 flex-1 max-w-7xl mx-auto px-6 md:px-12 w-full flex items-center pt-24 pb-16">
        <div className="max-w-2xl text-white select-text">
          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-4 select-none">
            OCEANAGARA
          </h1>

          {/* Tagline */}
          <p className="text-base sm:text-lg md:text-xl font-medium tracking-wide text-zinc-100 leading-relaxed mb-8">
            Cerdas Memantau, Aman Berlayar, Mutu Terjaga.
          </p>

          {/* Action buttons (CTAs) */}
          <div className="flex flex-wrap gap-4">
            <a
              href="#maps"
              className="px-6 py-3 border border-white bg-white text-zinc-950 text-xs font-bold uppercase tracking-wider hover:bg-transparent hover:text-white transition-colors duration-200"
            >
              Mulai Memantau
            </a>
            <a
              href="#feature"
              className="px-6 py-3 border border-white text-white text-xs font-bold uppercase tracking-wider hover:bg-white hover:text-zinc-950 transition-colors duration-200"
            >
              Pelajari Fitur
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
