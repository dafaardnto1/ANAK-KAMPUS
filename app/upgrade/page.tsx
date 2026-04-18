"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { Zap, Crown, Check, ArrowLeft, Loader2 } from 'lucide-react';

declare global {
  interface Window { snap: any; }
}

export default function UpgradePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/auth');
      else setUser(data.user);
    });

    // Load Midtrans Snap JS
    const script = document.createElement('script');
    script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
    // GANTI KE PRODUCTION: https://app.midtrans.com/snap/snap.js
    script.setAttribute('data-client-key', 'YOUR_MIDTRANS_CLIENT_KEY'); // Ganti dengan Client Key Midtrans kamu
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  const handleUpgrade = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Panggil API route untuk buat transaksi Midtrans
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });
      const { token } = await res.json();

      // Buka Midtrans Snap popup
      window.snap.pay(token, {
        onSuccess: async (result: any) => {
          console.log('Payment success', result);
          // Update is_premium di Supabase
          await supabase.from('profiles').update({ is_premium: true }).eq('id', user.id);
          alert('🎉 Upgrade berhasil! Kamu sekarang Premium!');
          router.push('/');
        },
        onPending: (result: any) => {
          console.log('Payment pending', result);
          alert('Pembayaran pending. Selesaikan pembayaran kamu!');
        },
        onError: (result: any) => {
          console.error('Payment error', result);
          alert('Pembayaran gagal. Coba lagi!');
        },
        onClose: () => {
          console.log('Snap closed');
        }
      });
    } catch (e) {
      console.error(e);
      alert('Error membuat transaksi. Coba lagi!');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    '500 download per akun',
    'Semua 17 fitur konversi',
    'Reset otomatis tiap 15 hari',
    'Prioritas support',
    'Bebas watermark',
    'Akses fitur baru lebih awal',
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050810] flex items-center justify-center p-5">
      <div className="w-full max-w-sm">

        <button onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-600 text-xs font-bold mb-6 duration-200">
          <ArrowLeft size={14}/> Kembali
        </button>

        <div className="bg-white dark:bg-[#0B0F1A] rounded-[2.5rem] border border-gray-200 dark:border-gray-800 p-8 shadow-xl overflow-hidden relative">

          {/* BG DECORATION */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full -translate-y-1/2 translate-x-1/2"/>

          {/* HEADER */}
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-orange-400 to-red-600 p-2.5 rounded-2xl shadow-lg shadow-red-500/30">
              <Crown size={18} className="text-white fill-current"/>
            </div>
            <div>
              <h1 className="font-black uppercase text-sm tracking-tight text-gray-900 dark:text-white">Premium</h1>
              <p className="text-[10px] text-gray-400 font-bold">Upgrade akun kamu</p>
            </div>
          </div>

          {/* PRICE */}
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30">
            <p className="text-[10px] font-black uppercase text-red-400 mb-1">Harga</p>
            <div className="flex items-end gap-1.5">
              <span className="text-3xl font-black text-red-600">Rp 15.000</span>
              <span className="text-xs text-gray-400 font-bold mb-1">/ lifetime</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Bayar sekali, pakai selamanya</p>
          </div>

          {/* FEATURES */}
          <div className="space-y-2.5 mb-7">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                  <Check size={10} className="text-white" strokeWidth={3}/>
                </div>
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{f}</span>
              </div>
            ))}
          </div>

          {/* BUTTON */}
          <button onClick={handleUpgrade} disabled={loading}
            className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest duration-200 flex items-center justify-center gap-2
              ${loading ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-xl shadow-red-500/30 hover:scale-[1.02] active:scale-95'}`}>
            {loading ? <><Loader2 size={14} className="animate-spin"/> Memproses...</> : <><Crown size={14} className="fill-current"/> Upgrade Sekarang</>}
          </button>

          <p className="text-center text-[10px] text-gray-400 mt-4">
            Pembayaran aman via Midtrans • Transfer Bank, QRIS, GoPay, dll
          </p>
        </div>
      </div>
    </div>
  );
}