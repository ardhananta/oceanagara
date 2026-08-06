import React from 'react';

export interface NelayanData {
  namaKapal: string;
  nomorKapal: string;
  jenisKapal: string;
  ukuranKapal: string;
  wilayahOperasi: string;
  nomorIzin: string;
  pengalamanTahun: string;
}

interface NelayanFormProps {
  data: NelayanData;
  onChange: (data: NelayanData) => void;
}

export default function NelayanForm({ data, onChange }: NelayanFormProps) {
  const updateField = (field: keyof NelayanData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="k-nama" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Nama Kapal *</label>
          <input
            id="k-nama"
            type="text"
            required
            value={data.namaKapal}
            onChange={(e) => updateField('namaKapal', e.target.value)}
            placeholder="KM Bahari Jaya"
            className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="k-nomor" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Nomor Registrasi *</label>
          <input
            id="k-nomor"
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
          <label htmlFor="k-jenis" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Jenis Kapal</label>
          <select
            id="k-jenis"
            value={data.jenisKapal}
            onChange={(e) => updateField('jenisKapal', e.target.value)}
            className="w-full px-4 py-3 border border-zinc-300 bg-white text-zinc-900 text-sm focus:outline-none focus:border-zinc-900 transition-colors appearance-none"
          >
            <option value="">Pilih jenis kapal</option>
            {['Kapal Motor', 'Perahu Layar', 'Kapal Ikan', 'Perahu Jukung', 'Lainnya'].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="k-ukuran" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Ukuran (GT)</label>
          <input
            id="k-ukuran"
            type="text"
            value={data.ukuranKapal}
            onChange={(e) => updateField('ukuranKapal', e.target.value)}
            placeholder="Mis. 5 GT"
            className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
          />
        </div>
      </div>
      <div>
        <label htmlFor="k-wilayah" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Wilayah Operasi *</label>
        <input
          id="k-wilayah"
          type="text"
          required
          value={data.wilayahOperasi}
          onChange={(e) => updateField('wilayahOperasi', e.target.value)}
          placeholder="Mis. Selat Makassar, Laut Banda"
          className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="k-izin" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Nomor SIPI</label>
          <input
            id="k-izin"
            type="text"
            value={data.nomorIzin}
            onChange={(e) => updateField('nomorIzin', e.target.value)}
            placeholder="Nomor izin berlayar"
            className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="k-exp" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Pengalaman (Tahun)</label>
          <input
            id="k-exp"
            type="number"
            min="0"
            value={data.pengalamanTahun}
            onChange={(e) => updateField('pengalamanTahun', e.target.value)}
            placeholder="Mis. 10"
            className="w-full px-4 py-3 border border-zinc-300 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
