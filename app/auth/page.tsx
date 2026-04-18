"use client";
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async () => {
    if (!email || !password) { setError('Isi email dan password!'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      if (mode === 'register') {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setSuccess('Cek email kamu untuk konfirmasi akun!');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.push('/');
      }
    } catch (e: any) {
      setError(e.message || 'Terjadi error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050810] flex items-center justify-center p-5">
      <div className="w-full max-w-sm">

        {/* LOGO */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="bg-red-600 p-2 rounded-xl shadow-lg shadow-red-500/30">
            <Zap size={18} className="text-white fill-current"/>
          </div>
          <span className="text-lg font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">
            ANAK <span className="text-red-600">KAMPUS</span>
          </span>
        </div>

        <div className="bg-white dark:bg-[#0B0F1A] rounded-[2.5rem] border border-gray-200 dark:border-gray-800 p-8 shadow-xl">

          {/* TAB */}
          <div className="flex bg-gray-100 dark:bg-gray-900 rounded-2xl p-1 mb-7">
            {(['login','register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setSuccess(''); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider duration-200
                  ${mode === m ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
                {m === 'login' ? 'Masuk' : 'Daftar'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {/* EMAIL */}
            <div className="relative">
              <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email kamu"
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm font-medium outline-none border bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:border-red-500 duration-200"
              />
            </div>

            {/* PASSWORD */}
            <div className="relative">
              <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input
                type={showPass ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="Password"
                className="w-full pl-11 pr-11 py-3.5 rounded-2xl text-sm font-medium outline-none border bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:border-red-500 duration-200"
              />
              <button onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>

            {/* ERROR / SUCCESS */}
            {error && <p className="text-red-500 text-xs font-bold text-center bg-red-50 dark:bg-red-900/20 py-2.5 px-4 rounded-xl">{error}</p>}
            {success && <p className="text-green-600 text-xs font-bold text-center bg-green-50 dark:bg-green-900/20 py-2.5 px-4 rounded-xl">{success}</p>}

            {/* SUBMIT */}
            <button onClick={handleSubmit} disabled={loading}
              className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest duration-200 flex items-center justify-center gap-2
                ${loading ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-red-600 text-white shadow-xl shadow-red-500/30 hover:scale-[1.02] active:scale-95'}`}>
              {loading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Memproses...
                </>
              ) : (
                <>
                  {mode === 'login' ? 'Masuk' : 'Buat Akun'}
                  <ArrowRight size={14}/>
                </>
              )}
            </button>
          </div>

          {mode === 'login' && (
            <p className="text-center text-[10px] text-gray-400 dark:text-gray-600 mt-5 font-bold">
              Belum punya akun?{' '}
              <button onClick={() => setMode('register')} className="text-red-500 hover:text-red-600 duration-200">Daftar gratis</button>
            </p>
          )}
        </div>

        <p className="text-center text-[10px] text-gray-400 mt-5">Dengan mendaftar, kamu menyetujui syarat & ketentuan ANAK KAMPUS</p>
      </div>
    </div>
  );
}