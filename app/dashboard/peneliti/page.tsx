'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthChange, logout, getUserProfile, UserProfile } from '@/app/service/authentication';

export default function DashboardPenelitiPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.push('/login');
      } else {
        const uProfile = await getUserProfile(user.uid);
        if (uProfile && (uProfile.role === 'peneliti' || uProfile.role === 'nelayan-modern')) {
          setProfile(uProfile);
        } else if (uProfile) {
          const paths = {
            'nelayan': '/dashboard/nelayan',
            'nelayan-modern': '/dashboard/peneliti',
            'masyarakat': '/dashboard/masyarakat',
            'peneliti': '/dashboard/peneliti',
          };
          router.push(uProfile.role ? paths[uProfile.role] : '/fill-form');
        } else {
          router.push('/fill-form');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const isNelayanModern = profile?.role === 'nelayan-modern';

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col">
      {/* Navbar */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <span className="font-bold tracking-widest text-sm text-white">OCEANAGARA</span>
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-400 font-medium bg-zinc-900 border border-zinc-800 px-2.5 py-1 uppercase tracking-wider">
            {isNelayanModern ? 'Nelayan Modern' : 'Peneliti'}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-grow p-6 md:p-12 max-w-5xl w-full mx-auto flex flex-col justify-center">
        <div className="border border-zinc-800 p-8 md:p-12 bg-zinc-900/50 backdrop-blur-sm relative">
          <div className="absolute top-0 left-0 w-24 h-px bg-white" />
          <div className="absolute top-0 left-0 w-px h-24 bg-white" />

          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">
            Papan Info Utama
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight mb-4 text-white">
            Selamat Datang, {profile?.displayName || (isNelayanModern ? 'Nelayan Modern' : 'Peneliti')}!
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed mb-8 max-w-xl">
            {isNelayanModern ? (
              'Anda masuk ke Dashboard Nelayan Modern. Kelola data tangkapan berskala besar Anda, monitor sensor telemetri kapal secara terintegrasi, dan petakan tangkapan menggunakan sistem digital canggih.'
            ) : (
              'Anda masuk ke Dashboard Peneliti. Akses data set perikanan kelautan, amati grafik migrasi spesies tangkap, dan unduh data telemetri historis terpadu untuk kebutuhan publikasi ilmiah.'
            )}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-zinc-800">
            {isNelayanModern ? (
              <>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Nama Kapal Modern</span>
                  <p className="text-sm font-semibold text-white uppercase">{String(profile?.namaKapal || '-')}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Sistem Navigasi</span>
                  <p className="text-sm font-semibold text-white uppercase">{String(profile?.sistemNavigasi || '-')}</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Bidang Riset</span>
                  <p className="text-sm font-semibold text-white uppercase">{String(profile?.bidangRiset || '-')}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Institusi / Universitas</span>
                  <p className="text-sm font-semibold text-white uppercase">{String(profile?.institusi || '-')}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
