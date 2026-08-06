import React from 'react';

export interface MasyarakatData {
  pekerjaan: string;
  institusi: string;
  tujuanPenggunaan: string;
}

interface MasyarakatFormProps {
  data: MasyarakatData;
  onChange: (data: MasyarakatData) => void;
}

export default function MasyarakatForm({ data, onChange }: MasyarakatFormProps) {
  const updateField = (field: keyof MasyarakatData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="mas-pekerjaan" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Pekerjaan / Profesi *</label>
        <select
          id="mas-pekerjaan"
          required
          value={data.pekerjaan}
          onChange={(e) => updateField('pekerjaan', e.target.value)}
          className="w-full px-4 py-3 border border-zinc-300 bg-white text-zinc-900 text-sm focus:outline-none focus:border-zinc-900 transition-colors appearance-none"
        >
          <option value="">Pilih profesi</option>
          {['Jurnalis / Media', 'Pegawai Pemerintah', 'LSM / NGO', 'Pengusaha / Bisnis', 'Mahasiswa', 'Masyarakat Umum', 'Lainnya'].map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="mas-institusi" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Institusi / Organisasi</label>
        <input
          id="mas-institusi"
          type="text"
          value={data.institusi}
          onChange={(e) => updateField('institusi', e.target.value)}
          placeholder="Nama institusi atau organisasi"
          className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
        />
      </div>
      <div>
        <label htmlFor="mas-tujuan" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Tujuan Penggunaan *</label>
        <textarea
          id="mas-tujuan"
          rows={4}
          required
          value={data.tujuanPenggunaan}
          onChange={(e) => updateField('tujuanPenggunaan', e.target.value)}
          placeholder="Jelaskan tujuan Anda menggunakan platform Oceanagara..."
          className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors resize-none"
        />
      </div>
    </div>
  );
}
