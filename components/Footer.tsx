import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-zinc-900 text-zinc-400 py-16 border-t border-zinc-800">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Logo & Info */}
          <div className="flex flex-col gap-4">
            <span className="text-2xl font-extrabold tracking-wider text-white">
              OCEANAGARA
            </span>
            <p className="text-sm leading-relaxed text-zinc-500">
              Platform teknologi maritim komprehensif untuk mendukung keselamatan pelayaran, pemantauan tangkapan, dan kesejahteraan nelayan di seluruh perairan Indonesia.
            </p>
          </div>

          {/* Column 1: Features */}
          <div>
            <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-4">
              Layanan & Fitur
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#maps" className="hover:text-blue-400 transition-colors">
                  Pemetaan Kapal AIS
                </a>
              </li>
              <li>
                <a href="#feature" className="hover:text-blue-400 transition-colors">
                  Prediksi Cuaca Laut
                </a>
              </li>
              <li>
                <a href="#feature" className="hover:text-blue-400 transition-colors">
                  Sinyal SOS & Darurat
                </a>
              </li>
              <li>
                <a href="#feature" className="hover:text-blue-400 transition-colors">
                  Manajemen Rantai Dingin
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2: Company */}
          <div>
            <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-4">
              Perusahaan
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#about-us" className="hover:text-blue-400 transition-colors">
                  Tentang Kami
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-blue-400 transition-colors">
                  Hubungi Kontak
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-blue-400 transition-colors">
                  Karir & Relawan
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-blue-400 transition-colors">
                  Blog Berita
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div>
            <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-4">
              Kebijakan & Ketentuan
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#" className="hover:text-blue-400 transition-colors">
                  Syarat & Ketentuan
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-blue-400 transition-colors">
                  Kebijakan Privasi
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-blue-400 transition-colors">
                  Lisensi Peta (GIS)
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-zinc-800 my-8" />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} Oceanagara. Seluruh Hak Cipta Dilindungi Undang-Undang.
          </p>

          {/* Socials */}
          <div className="flex gap-4">
            <a
              href="#"
              className="w-9 h-9 rounded-full bg-zinc-850 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors text-zinc-500"
              aria-label="Facebook"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
              </svg>
            </a>
            <a
              href="#"
              className="w-9 h-9 rounded-full bg-zinc-850 hover:bg-sky-500 hover:text-white flex items-center justify-center transition-colors text-zinc-500"
              aria-label="Twitter"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
              </svg>
            </a>
            <a
              href="#"
              className="w-9 h-9 rounded-full bg-zinc-850 hover:bg-pink-600 hover:text-white flex items-center justify-center transition-colors text-zinc-500"
              aria-label="Instagram"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
