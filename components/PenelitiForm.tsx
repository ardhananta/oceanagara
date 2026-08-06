import React from 'react';

export interface PenelitiData {
  bidangRiset: string;
  institusi: string;
  gelar: string;
  topikPenelitian: string;
  tujuanPenggunaan: string;
}

interface PenelitiFormProps {
  data: PenelitiData;
  onChange: (data: PenelitiData) => void;
}

export default function PenelitiForm({ data, onChange }: PenelitiFormProps) {
  const updateField = (field: keyof PenelitiData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="pen-bidang" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Bidang Riset *</label>
          <select
            id="pen-bidang"
            required
            value={data.bidangRiset}
            onChange={(e) => updateField('bidangRiset', e.target.value)}
            className="w-full px-4 py-3 border border-zinc-300 bg-white text-zinc-900 text-sm focus:outline-none focus:border-zinc-900 transition-colors appearance-none"
          >
            <option value="">Pilih bidang</option>
            {['Biologi Kelautan', 'Oseanografi', 'Perikanan', 'Lingkungan Laut', 'Teknologi Maritim', 'Sosial Ekonomi Pesisir', 'Lainnya'].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pen-gelar" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Gelar Akademik</label>
          <select
            id="pen-gelar"
            value={data.gelar}
            onChange={(e) => updateField('gelar', e.target.value)}
            className="w-full px-4 py-3 border border-zinc-300 bg-white text-zinc-900 text-sm focus:outline-none focus:border-zinc-900 transition-colors appearance-none"
          >
            <option value="">Pilih gelar</option>
            {['S1', 'S2', 'S3 / Doktor', 'Profesor', 'Lainnya'].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="pen-institusi" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Institusi / Universitas *</label>
        <input
          id="pen-institusi"
          type="text"
          required
          value={data.institusi}
          onChange={(e) => updateField('institusi', e.target.value)}
          placeholder="Mis. LIPI, IPB, UNDIP, UNHAS"
          className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
        />
      </div>
      <div>
        <label htmlFor="pen-topik" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Topik Penelitian</label>
        <input
          id="pen-topik"
          type="text"
          value={data.topikPenelitian}
          onChange={(e) => updateField('topikPenelitian', e.target.value)}
          placeholder="Mis. Pola migrasi ikan tuna di Laut Banda"
          className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
        />
      </div>
      <div>
        <label htmlFor="pen-tujuan" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Tujuan Penggunaan Platform</label>
        <textarea
          id="pen-tujuan"
          rows={3}
          value={data.tujuanPenggunaan}
          onChange={(e) => updateField('tujuanPenggunaan', e.target.value)}
          placeholder="Jelaskan bagaimana Anda akan menggunakan data dari Oceanagara..."
          className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors resize-none"
        />
      </div>
    </div>
  );
}
