import React from 'react';

export interface NelayanModernData {
  namaKapal: string;
  nomorKapal: string;
  jenisKapal: string;
  ukuranKapal: string;
  wilayahOperasi: string;
  nomorIzin: string;
  pengalamanTahun: string;
  teknologiDigunakan: string;
  sistemNavigasi: string;
  alatPenangkapan: string;
}

interface NelayanModernFormProps {
  data: NelayanModernData;
  onChange: (data: NelayanModernData) => void;
}

export default function NelayanModernForm({ data, onChange }: NelayanModernFormProps) {
  const updateField = (field: keyof NelayanModernData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="nm-nama" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Nama Kapal *</label>
          <input
            id="nm-nama"
            type="text"
            required
            value={data.namaKapal}
            onChange={(e) => updateField('namaKapal', e.target.value)}
            placeholder="KM Teknologi Maju"
            className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="nm-nomor" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Nomor Registrasi *</label>
          <input
            id="nm-nomor"
            type="text"
            required
            value={data.nomorKapal}
            onChange={(e) => updateField('nomorKapal', e.target.value)}
            placeholder="GT-2024-XXXX"
            className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="nm-jenis" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Jenis Kapal</label>
          <select
            id="nm-jenis"
            value={data.jenisKapal}
            onChange={(e) => updateField('jenisKapal', e.target.value)}
            className="w-full px-4 py-3 border border-zinc-300 bg-white text-zinc-900 text-sm focus:outline-none focus:border-zinc-900 transition-colors appearance-none"
          >
            <option value="">Pilih jenis kapal</option>
            {['Purse Seiner', 'Longline', 'Trawler', 'Kapal Riset', 'Kapal Motor Besar', 'Lainnya'].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="nm-ukuran" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Ukuran (GT)</label>
          <input
            id="nm-ukuran"
            type="text"
            value={data.ukuranKapal}
            onChange={(e) => updateField('ukuranKapal', e.target.value)}
            placeholder="Mis. 100 GT"
            className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
          />
        </div>
      </div>
      <div>
        <label htmlFor="nm-wilayah" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Wilayah Operasi *</label>
        <input
          id="nm-wilayah"
          type="text"
          required
          value={data.wilayahOperasi}
          onChange={(e) => updateField('wilayahOperasi', e.target.value)}
          placeholder="Mis. Laut Arafura, ZEE Indonesia"
          className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
        />
      </div>
      <div>
        <label htmlFor="nm-teknologi" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Teknologi yang Digunakan</label>
        <input
          id="nm-teknologi"
          type="text"
          value={data.teknologiDigunakan}
          onChange={(e) => updateField('teknologiDigunakan', e.target.value)}
          placeholder="Mis. GPS, AIS, Sonar, VSAT"
          className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="nm-navigasi" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Sistem Navigasi</label>
          <input
            id="nm-navigasi"
            type="text"
            value={data.sistemNavigasi}
            onChange={(e) => updateField('sistemNavigasi', e.target.value)}
            placeholder="Mis. ECDIS, Radar"
            className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="nm-alat" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Alat Penangkapan</label>
          <input
            id="nm-alat"
            type="text"
            value={data.alatPenangkapan}
            onChange={(e) => updateField('alatPenangkapan', e.target.value)}
            placeholder="Mis. Purse seine, Long line"
            className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="nm-izin" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Nomor SIPI</label>
          <input
            id="nm-izin"
            type="text"
            value={data.nomorIzin}
            onChange={(e) => updateField('nomorIzin', e.target.value)}
            placeholder="Nomor izin berlayar"
            className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="nm-exp" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Pengalaman (Tahun)</label>
          <input
            id="nm-exp"
            type="number"
            min="0"
            value={data.pengalamanTahun}
            onChange={(e) => updateField('pengalamanTahun', e.target.value)}
            placeholder="Mis. 15"
            className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
