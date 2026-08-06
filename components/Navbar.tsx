'use client';

import { useState, useEffect } from 'react';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
          ? 'bg-white/70 backdrop-blur-md border-b border-white/20 shadow-sm py-4'
          : 'bg-transparent py-6'
        }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">
        {/* Logo */}
        <a
          href="#"
          className={`text-lg font-bold tracking-widest transition-colors duration-200 ${isScrolled
              ? 'text-zinc-900'
              : 'text-white'
            }`}
        >
          OCEANAGARA
        </a>

        {/* Desktop Nav Items */}
        <div className="hidden md:flex items-center gap-8">
          <a
            href="#maps"
            className={`text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${isScrolled
                ? 'text-zinc-500 hover:text-zinc-900'
                : 'text-zinc-600 hover:text-white'
              }`}
          >
            Maps
          </a>
          <a
            href="#feature"
            className={`text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${isScrolled
                ? 'text-zinc-500 hover:text-zinc-900'
                : 'text-zinc-600 hover:text-white'
              }`}
          >
            Feature
          </a>
          <a
            href="#about-us"
            className={`text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${isScrolled
                ? 'text-zinc-500 hover:text-zinc-900'
                : 'text-zinc-600 hover:text-white'
              }`}
          >
            About Us
          </a>
          <a
            href="#login"
            className={`text-xs font-semibold uppercase tracking-wider transition-colors duration-200 px-4 py-2 border rounded-none ${isScrolled
                ? 'border-zinc-900 text-zinc-900 hover:bg-zinc-900 hover:text-white'
                : 'border-zinc-600 text-zinc-600 hover:bg-white hover:text-zinc-955'
              }`}
          >
            Login
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 focus:outline-none"
          aria-label="Toggle menu"
        >
          <svg
            className={`w-6 h-6 ${isScrolled ? 'text-zinc-900' : 'text-white'
              }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Drawer */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-zinc-950/95 transform transition-transform duration-200 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        <div className="flex flex-col items-center justify-center h-full gap-8 text-sm font-semibold uppercase tracking-wider text-white">
          <a
            href="#maps"
            onClick={() => setIsMobileMenuOpen(false)}
            className="hover:text-zinc-400 transition-colors"
          >
            Maps
          </a>
          <a
            href="#feature"
            onClick={() => setIsMobileMenuOpen(false)}
            className="hover:text-zinc-400 transition-colors"
          >
            Feature
          </a>
          <a
            href="#about-us"
            onClick={() => setIsMobileMenuOpen(false)}
            className="hover:text-zinc-400 transition-colors"
          >
            About Us
          </a>
          <a
            href="#login"
            onClick={() => setIsMobileMenuOpen(false)}
            className="px-6 py-2.5 border border-white text-white hover:bg-white hover:text-zinc-950 transition-colors"
          >
            Login
          </a>
        </div>
      </div>
    </nav>
  );
}
