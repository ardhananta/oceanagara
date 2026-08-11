'use client';

import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { onAuthChange, saveUserProfile, getUserProfile, redirectUserIfLoggedIn } from '@/app/service/authentication';
import { WILAYAH_INDONESIA } from '@/app/service/regions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── Import Sub-Components ────────────────────────────────────────────────────
import NelayanForm, { NelayanData } from '@/components/NelayanForm';
import NelayanModernForm, { NelayanModernData } from '@/components/NelayanModernForm';
import MasyarakatForm, { MasyarakatData } from '@/components/MasyarakatForm';
import PenelitiForm, { PenelitiData } from '@/components/PenelitiForm';

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = 'nelayan' | 'nelayan-modern' | 'masyarakat' | 'peneliti' | null;

// ─── Role definitions ─────────────────────────────────────────────────────────
const ROLES = [
  {
    id: 'nelayan' as const,
    label: 'Nelayan Tradisional',
    desc: 'Nelayan yang beroperasi dengan metode dan peralatan tradisional.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'nelayan-modern' as const,
    label: 'Nelayan Modern',
    desc: 'Nelayan dengan kapal berteknologi tinggi, GPS, dan peralatan digital.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    ),
  },
  {
    id: 'masyarakat' as const,
    label: 'Masyarakat Umum',
    desc: 'Warga, jurnalis, atau pemantau yang ingin mengakses informasi kelautan.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'peneliti' as const,
    label: 'Peneliti',
    desc: 'Akademisi atau ilmuwan yang meneliti ekosistem, tangkapan, dan data laut.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
] as const;

// ─── Default field states ──────────────────────────────────────────────────────
const defaultNelayan: NelayanData = {
  namaKapal: '', nomorKapal: '', jenisKapal: '',
  ukuranKapal: '', wilayahOperasi: '', nomorIzin: '', pengalamanTahun: '',
};

const defaultNelayanModern: NelayanModernData = {
  ...defaultNelayan,
  teknologiDigunakan: '', sistemNavigasi: '', alatPenangkapan: '',
};

const defaultMasyarakat: MasyarakatData = {
  pekerjaan: '', institusi: '', tujuanPenggunaan: '',
};

const defaultPeneliti: PenelitiData = {
  bidangRiset: '', institusi: '', gelar: '', topikPenelitian: '', tujuanPenggunaan: '',
};

export default function FillFormPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role>(null);

  // Common
  const [noHP, setNoHP] = useState('');
  const [provinsi, setProvinsi] = useState('');
  const [kota, setKota] = useState('');
  const [alamat, setAlamat] = useState('');

  // Role-specific states
  const [nelayanData, setNelayanData] = useState<NelayanData>(defaultNelayan);
  const [nelayanModernData, setNelayanModernData] = useState<NelayanModernData>(defaultNelayanModern);
  const [masyarakatData, setMasyarakatData] = useState<MasyarakatData>(defaultMasyarakat);
  const [penelitiData, setPenelitiData] = useState<PenelitiData>(defaultPeneliti);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      if (!u) {
        router.push('/login');
        return;
      }
      setUser(u);
      // Security Guard: Prevent user who already filled profile from accessing form again
      const profile = await getUserProfile(u.uid);
      if (profile && profile.profileCompleted && profile.role) {
        redirectUserIfLoggedIn(u.uid, router.push);
        return;
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  function handleNextStep(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!role) { setError('Pilih peran Anda terlebih dahulu.'); return; }
    if (!noHP.trim()) { setError('Nomor HP wajib diisi.'); return; }
    if (!provinsi.trim() || !kota.trim()) { setError('Provinsi dan kota wajib diisi.'); return; }
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!user) return;

    if ((role === 'nelayan') && (!nelayanData.namaKapal || !nelayanData.wilayahOperasi)) {
      setError('Nama kapal dan wilayah operasi wajib diisi.'); return;
    }
    if ((role === 'nelayan-modern') && (!nelayanModernData.namaKapal || !nelayanModernData.wilayahOperasi)) {
      setError('Nama kapal dan wilayah operasi wajib diisi.'); return;
    }
    if (role === 'masyarakat' && !masyarakatData.pekerjaan) {
      setError('Pekerjaan wajib diisi.'); return;
    }
    if (role === 'peneliti' && (!penelitiData.bidangRiset || !penelitiData.institusi)) {
      setError('Bidang riset dan institusi wajib diisi.'); return;
    }

    setLoading(true);
    try {
      const roleData =
        role === 'nelayan' ? nelayanData :
          role === 'nelayan-modern' ? nelayanModernData :
            role === 'masyarakat' ? masyarakatData :
              penelitiData;

      await saveUserProfile(user.uid, {
        uid: user.uid, email: user.email,
        displayName: user.displayName,
        role, noHP, provinsi, kota, alamat,
        ...roleData,
      });

      const redirects: Record<NonNullable<Role>, string> = {
        'nelayan': '/dashboard/nelayan',
        'nelayan-modern': '/dashboard/peneliti',
        'masyarakat': '/dashboard/masyarakat',
        'peneliti': '/dashboard/peneliti',
      };
      router.push(redirects[role!]);
    } catch {
      setError('Gagal menyimpan profil. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <svg className="w-6 h-6 text-zinc-600 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="2" strokeDasharray="30 70" />
        </svg>
      </div>
    );
  }

  const selectedRoleLabel = ROLES.find((r) => r.id === role)?.label ?? '';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-30 bg-white border-b border-zinc-200 px-6 md:px-12 py-4 flex items-center justify-between">
        <Link href="/" className="text-zinc-900 text-sm font-bold tracking-widest uppercase">
          OCEANAGARA
        </Link>
        <div className="flex items-center gap-3">
          {([{ n: 1, label: 'Profil & Peran' }, { n: 2, label: 'Detail' }] as const).map(({ n, label }, i) => (
            <div key={n} className="flex items-center gap-3">
              {i > 0 && <div className="w-8 h-px bg-zinc-200" />}
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold transition-colors ${step === n ? 'bg-zinc-900 text-white'
                    : step > n ? 'bg-emerald-500 text-white'
                      : 'border border-zinc-300 text-zinc-400'
                  }`}>
                  {step > n
                    ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    : n}
                </div>
                <span className={`hidden sm:block text-[10px] font-semibold uppercase tracking-widest ${step === n ? 'text-zinc-900' : 'text-zinc-400'}`}>
                  {label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12 md:py-16">
        {/* Step 1 */}
        {step === 1 && (
          <form onSubmit={handleNextStep} noValidate>
            <div className="mb-10">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Langkah 1 dari 2</p>
              <h1 className="text-2xl font-extrabold text-zinc-900 uppercase tracking-tight">Identifikasi Peran Anda</h1>
              <p className="mt-2 text-sm text-zinc-500">Pilih peran yang paling sesuai untuk mendapatkan akses fitur yang tepat.</p>
            </div>

            {error && (
              <div className="mb-6 px-4 py-3 border border-red-200 bg-red-50 text-red-700 text-xs font-medium">{error}</div>
            )}

            <div className="mb-8">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Saya adalah *</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ROLES.map(({ id, label, desc, icon }) => (
                  <button
                    key={id}
                    id={`role-${id}`}
                    type="button"
                    onClick={() => setRole(id)}
                    className={`relative p-6 border-2 text-left transition-all duration-150 ${role === id ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 bg-white hover:border-zinc-400'
                      }`}
                  >
                    {role === id && (
                      <div className="absolute top-3 right-3 w-5 h-5 bg-zinc-900 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <div className="w-10 h-10 border border-zinc-200 flex items-center justify-center mb-4 text-zinc-700">
                      {icon}
                    </div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Peran</p>
                    <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-tight mt-1">{label}</h3>
                    <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Contact info */}
            <div className="space-y-5">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-t border-zinc-100 pt-6">Informasi Kontak</p>

              <div>
                <label htmlFor="form-nohp" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Nomor HP / WhatsApp *</label>
                <input id="form-nohp" type="tel" autoComplete="tel" required value={noHP} onChange={(e) => setNoHP(e.target.value)}
                  placeholder="+62 8xx xxxx xxxx"
                  className="w-full px-4 py-3 border border-zinc-300 bg-white text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="form-provinsi" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Provinsi *</label>
                  <select
                    id="form-provinsi"
                    required
                    value={provinsi}
                    onChange={(e) => {
                      setProvinsi(e.target.value);
                      setKota('');
                    }}
                    className="w-full px-4 py-3 border border-zinc-300 bg-white text-zinc-900 text-sm focus:outline-none focus:border-zinc-900 transition-colors appearance-none"
                  >
                    <option value="">Pilih Provinsi</option>
                    {Object.keys(WILAYAH_INDONESIA).map((prov) => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="form-kota" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Kota / Kabupaten *</label>
                  <select
                    id="form-kota"
                    required
                    value={kota}
                    disabled={!provinsi}
                    onChange={(e) => setKota(e.target.value)}
                    className="w-full px-4 py-3 border border-zinc-300 bg-white text-zinc-900 text-sm focus:outline-none focus:border-zinc-900 transition-colors appearance-none disabled:opacity-50 disabled:bg-zinc-50"
                  >
                    <option value="">{provinsi ? 'Pilih Kota / Kabupaten' : 'Pilih Provinsi Dahulu'}</option>
                    {provinsi &&
                      WILAYAH_INDONESIA[provinsi as keyof typeof WILAYAH_INDONESIA]?.map((kt) => (
                        <option key={kt} value={kt}>{kt}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="form-alamat" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Alamat Lengkap</label>
                <textarea id="form-alamat" rows={2} value={alamat} onChange={(e) => setAlamat(e.target.value)}
                  placeholder="Jalan, nomor, kelurahan..."
                  className="w-full px-4 py-3 border border-zinc-300 bg-white text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors resize-none" />
              </div>
            </div>

            <button id="fill-form-next" type="submit"
              className="w-full mt-8 py-3.5 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2">
              Lanjutkan
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </form>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-10">
              <button type="button" onClick={() => { setStep(1); setError(''); }}
                className="flex items-center gap-2 text-[10px] text-zinc-400 uppercase tracking-widest hover:text-zinc-900 transition-colors mb-6">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
                Kembali
              </button>

              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Langkah 2 dari 2</p>
              <h1 className="text-2xl font-extrabold text-zinc-900 uppercase tracking-tight">
                {role === 'nelayan' ? 'Data Kapal & Operasional' :
                  role === 'nelayan-modern' ? 'Data Kapal & Teknologi' :
                    role === 'peneliti' ? 'Data Riset & Institusi' :
                      'Data Profesi'}
              </h1>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 border border-zinc-200 bg-zinc-50">
                <div className="w-1.5 h-1.5 bg-zinc-900" />
                <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">{selectedRoleLabel}</span>
              </div>
            </div>

            {error && (
              <div className="mb-6 px-4 py-3 border border-red-200 bg-red-50 text-red-700 text-xs font-medium">{error}</div>
            )}

            {/* Render role-specific form components */}
            {role === 'nelayan' && (
              <NelayanForm data={nelayanData} onChange={setNelayanData} />
            )}

            {role === 'nelayan-modern' && (
              <NelayanModernForm data={nelayanModernData} onChange={setNelayanModernData} />
            )}

            {role === 'masyarakat' && (
              <MasyarakatForm data={masyarakatData} onChange={setMasyarakatData} />
            )}

            {role === 'peneliti' && (
              <PenelitiForm data={penelitiData} onChange={setPenelitiData} />
            )}

            <button id="fill-form-submit" type="submit" disabled={loading}
              className="w-full mt-8 py-3.5 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="3" strokeDasharray="30 70" />
                  </svg>
                  Menyimpan profil...
                </>
              ) : (
                <>
                  Simpan & Lanjutkan ke Dashboard
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </>
              )}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
