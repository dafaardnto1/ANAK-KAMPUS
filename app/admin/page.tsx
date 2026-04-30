"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Shield, Users, Activity, Ticket, Plus, Trash2, ArrowLeft, LogOut, 
  CheckCircle2, Crown, Search, Filter, Download, RefreshCw, BarChart2 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Dashboard state
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  
  const [newVoucher, setNewVoucher] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Search & Filters
  const [searchEmail, setSearchEmail] = useState('');
  const [logFilter, setLogFilter] = useState('ALL');

  // Stats
  const totalUsers = users.length;
  const premiumUsers = users.filter(u => u.is_premium).length;
  const freeUsers = totalUsers - premiumUsers;

  // Real-time polling
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      fetchData(false);
    }, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'dafaardianto466@gmail.com' && password === 'dafaadmin466bekasi') {
      setIsAuthenticated(true);
      setError('');
      fetchData(true);
    } else {
      setError('Email atau password salah!');
    }
  };

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // Fetch users
      const { data: usersData, error: usersErr } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (!usersErr && usersData) setUsers(usersData);

      // Fetch logs
      const { data: logsData, error: logsErr } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false });
      if (!logsErr && logsData) setLogs(logsData);

      // Fetch vouchers
      const { data: vouchersData, error: vouchersErr } = await supabase.from('vouchers').select('*').order('created_at', { ascending: false });
      if (!vouchersErr && vouchersData) setVouchers(vouchersData);

      setLastRefreshed(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- VOUCHER ACTIONS ---
  const handleCreateVoucher = async () => {
    if (!newVoucher) return;
    try {
      const { error } = await supabase.from('vouchers').insert([{ code: newVoucher.toUpperCase() }]);
      if (error) throw error;
      setNewVoucher('');
      fetchData(false);
    } catch (err: any) {
      alert('Gagal membuat voucher: ' + err.message);
    }
  };

  const handleDeleteVoucher = async (id: string) => {
    if (!confirm('Hapus voucher ini?')) return;
    try {
      await supabase.from('vouchers').delete().eq('id', id);
      fetchData(false);
    } catch (err: any) {
      alert('Gagal hapus: ' + err.message);
    }
  };

  // --- USER CONTROLS ---
  const handleTogglePremium = async (id: string, isPremium: boolean) => {
    if (!confirm(`Ubah status premium user ini menjadi ${!isPremium}?`)) return;
    try {
      await supabase.from('profiles').update({ is_premium: !isPremium }).eq('id', id);
      fetchData(false);
    } catch (err: any) {
      alert('Gagal mengubah status: ' + err.message);
    }
  };

  const handleResetQuota = async (id: string) => {
    if (!confirm('Reset kuota download user ini menjadi 0?')) return;
    try {
      await supabase.from('profiles').update({ download_count: 0 }).eq('id', id);
      fetchData(false);
    } catch (err: any) {
      alert('Gagal reset kuota: ' + err.message);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('HAPUS user ini dari database secara permanen?')) return;
    try {
      await supabase.from('profiles').delete().eq('id', id);
      fetchData(false);
    } catch (err: any) {
      alert('Gagal hapus user: ' + err.message);
    }
  };

  // --- EXPORT CSV ---
  const exportCSV = (data: any[], filename: string) => {
    if (data.length === 0) return alert('Tidak ada data untuk diekspor');
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(v => `"${v}"`).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- DATA PROCESSING FOR CHARTS & LISTS ---
  const filteredUsers = users.filter(u => u.email?.toLowerCase().includes(searchEmail.toLowerCase()));
  
  const filteredLogs = logs.filter(log => {
    if (logFilter === 'ALL') return true;
    return log.action === logFilter;
  });

  const chartData = useMemo(() => {
    // Kelompokkan user berdasarkan tanggal (7 hari terakhir)
    const dataMap: Record<string, number> = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dataMap[dateStr] = 0;
    }

    users.forEach(u => {
      const dStr = new Date(u.created_at).toISOString().split('T')[0];
      if (dataMap[dStr] !== undefined) {
        dataMap[dStr]++;
      }
    });

    return Object.keys(dataMap).map(date => ({
      date: date.substring(5), // ambil MM-DD
      Users: dataMap[date]
    }));
  }, [users]);

  // --- RENDER ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(220,38,38,0.15)] relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-red-600/20 blur-3xl rounded-full" />
          <div className="flex justify-center mb-6 relative">
            <div className="bg-gradient-to-br from-red-500 to-red-700 p-4 rounded-2xl shadow-lg shadow-red-600/30">
              <Shield size={32} className="text-white" />
            </div>
          </div>
          <h1 className="text-xl font-black text-white text-center mb-1">GOD MODE</h1>
          <p className="text-xs text-gray-400 text-center mb-8 uppercase tracking-widest font-bold">Admin Portal</p>
          
          <form onSubmit={handleLogin} className="space-y-4 relative">
            <div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-red-500 outline-none transition-all placeholder-gray-500"
                placeholder="Admin Email" />
            </div>
            <div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-red-500 outline-none transition-all placeholder-gray-500"
                placeholder="Admin Password" />
            </div>
            {error && <p className="text-red-400 text-xs font-bold text-center bg-red-500/10 border border-red-500/20 py-2 rounded-lg">{error}</p>}
            <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl transition-all shadow-lg shadow-red-600/30 hover:scale-[1.02] active:scale-95">
              Access System
            </button>
          </form>
          <button onClick={() => router.push('/')} className="w-full mt-6 text-gray-500 text-xs font-bold hover:text-white transition-colors flex items-center justify-center gap-2">
            <ArrowLeft size={14} /> Back to App
          </button>
        </div>
      </div>
    );
  }

  const glassCls = "bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-xl";

  return (
    <div className="min-h-screen bg-[#050810] text-gray-200 p-4 lg:p-8 relative selection:bg-red-500/30">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-7xl mx-auto space-y-6 relative">
        
        {/* Header */}
        <div className={`${glassCls} p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-orange-500 to-red-600 p-3 rounded-2xl shadow-lg shadow-red-600/30">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight uppercase">God Mode Dashboard</h1>
              <p className="text-xs text-gray-400 font-bold tracking-wider uppercase flex items-center gap-2">
                Anak Kampus <span className="w-1 h-1 bg-gray-500 rounded-full" /> Last Sync: {lastRefreshed.toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => fetchData(true)} disabled={loading} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {loading ? 'Syncing...' : 'Force Sync'}
            </button>
            <button onClick={() => setIsAuthenticated(false)} className="px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2">
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>

        {/* Stats Grid & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className={`${glassCls} p-6 flex items-center gap-5 relative overflow-hidden group`}>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl relative"><Users size={24} className="text-blue-400" /></div>
              <div className="relative"><p className="text-gray-400 text-xs font-black tracking-widest uppercase">Total Users</p><p className="text-4xl font-black text-white mt-1">{totalUsers}</p></div>
            </div>
            <div className={`${glassCls} p-6 flex items-center gap-5 relative overflow-hidden group`}>
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl relative"><Crown size={24} className="text-orange-400" /></div>
              <div className="relative"><p className="text-gray-400 text-xs font-black tracking-widest uppercase">Premium</p><p className="text-4xl font-black text-white mt-1">{premiumUsers}</p></div>
            </div>
            <div className={`${glassCls} p-6 flex items-center gap-5 relative overflow-hidden group`}>
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl relative"><Ticket size={24} className="text-emerald-400" /></div>
              <div className="relative"><p className="text-gray-400 text-xs font-black tracking-widest uppercase">Vouchers</p><p className="text-4xl font-black text-white mt-1">{vouchers.length}</p></div>
            </div>
          </div>

          <div className={`lg:col-span-3 ${glassCls} p-6`}>
            <div className="flex items-center gap-3 mb-6">
              <BarChart2 className="text-blue-400" size={20} />
              <h2 className="font-black text-white uppercase tracking-widest text-sm">Pertumbuhan User (7 Hari Terakhir)</h2>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Line type="monotone" dataKey="Users" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Activity Logs */}
          <div className={`lg:col-span-1 ${glassCls} flex flex-col h-[600px]`}>
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="text-blue-400" size={20} />
                <h2 className="font-black text-white uppercase tracking-widest text-sm">Live Logs</h2>
              </div>
              <button onClick={() => exportCSV(logs, 'activity_logs')} className="text-gray-400 hover:text-white p-2 bg-white/5 rounded-lg transition-colors" title="Export CSV"><Download size={14}/></button>
            </div>
            <div className="p-4 border-b border-white/5 bg-black/20">
              <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                <Filter size={16} className="text-gray-500" />
                <select value={logFilter} onChange={e => setLogFilter(e.target.value)} className="bg-transparent text-xs text-white outline-none w-full font-bold">
                  <option value="ALL">Semua Aktivitas</option>
                  <option value="USER_REGISTER">Pendaftaran Baru</option>
                  <option value="USER_LOGIN">Login</option>
                  <option value="UPGRADE_PREMIUM_PAID">Beli Premium (Midtrans)</option>
                  <option value="CLAIM_VOUCHER_VVIP">Klaim Voucher</option>
                </select>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredLogs.slice(0, 100).map(log => (
                <div key={log.id} className="bg-white/5 border border-white/5 p-3 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider
                      ${log.action.includes('PREMIUM') || log.action.includes('VOUCHER') ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 
                        log.action === 'USER_REGISTER' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 
                        'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                      {log.action}
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium">{new Date(log.created_at).toLocaleTimeString('id-ID')}</span>
                  </div>
                  <p className="text-xs text-gray-300 font-medium truncate" title={log.user_email}>{log.user_email || 'Unknown User'}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{new Date(log.created_at).toLocaleDateString('id-ID')}</p>
                </div>
              ))}
              {filteredLogs.length === 0 && <p className="text-center text-xs text-gray-500 mt-10">Tidak ada log.</p>}
            </div>
          </div>

          {/* Users List & Vouchers */}
          <div className="lg:col-span-2 space-y-6 flex flex-col">
            
            {/* Vouchers Panel Mini */}
            <div className={`${glassCls}`}>
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Ticket className="text-emerald-400" size={18} />
                  <h2 className="font-black text-white uppercase tracking-widest text-sm">VVIP Generator</h2>
                </div>
              </div>
              <div className="p-4 bg-black/20 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex gap-2 w-full sm:w-auto">
                  <input type="text" value={newVoucher} onChange={e => setNewVoucher(e.target.value)} placeholder="KODE-PROMO-BARU" 
                    className="flex-1 sm:w-64 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white uppercase focus:border-emerald-500 outline-none font-bold tracking-wider" />
                  <button onClick={handleCreateVoucher} className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-500 border border-emerald-500/30 px-4 rounded-xl transition-all font-black uppercase text-xs tracking-widest whitespace-nowrap">
                    Generate
                  </button>
                </div>
                <div className="flex-1 flex overflow-x-auto gap-2 pb-1 scrollbar-hide">
                  {vouchers.slice(0, 5).map(v => (
                    <div key={v.id} className={`flex-shrink-0 px-3 py-2 rounded-xl border flex items-center gap-3 min-w-[150px]
                      ${v.is_used ? 'bg-gray-900/50 border-gray-800' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                      <div>
                        <p className={`text-xs font-black uppercase tracking-wider ${v.is_used ? 'text-gray-500 line-through' : 'text-emerald-400'}`}>{v.code}</p>
                        <p className="text-[9px] text-gray-500 truncate max-w-[100px]">{v.is_used ? v.used_by : 'Tersedia'}</p>
                      </div>
                      {!v.is_used && (
                        <button onClick={() => handleDeleteVoucher(v.id)} className="ml-auto text-gray-500 hover:text-red-400"><Trash2 size={12}/></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Users Database */}
            <div className={`${glassCls} flex-1 flex flex-col`}>
              <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <Users className="text-orange-400" size={20} />
                  <h2 className="font-black text-white uppercase tracking-widest text-sm">User Management</h2>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 flex-1 sm:w-64">
                    <Search size={14} className="text-gray-500" />
                    <input type="text" placeholder="Cari email..." value={searchEmail} onChange={e => setSearchEmail(e.target.value)}
                      className="bg-transparent border-none outline-none text-xs text-white py-2.5 w-full" />
                  </div>
                  <button onClick={() => exportCSV(users, 'users_db')} className="px-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-gray-300 transition-colors" title="Export Users CSV">
                    <Download size={14} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-0 min-h-[300px]">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-black/40 text-gray-500 text-[10px] uppercase sticky top-0 backdrop-blur-md">
                    <tr>
                      <th className="px-6 py-4 font-black tracking-widest">User Info</th>
                      <th className="px-6 py-4 font-black tracking-widest">Status</th>
                      <th className="px-6 py-4 font-black tracking-widest text-center">Download</th>
                      <th className="px-6 py-4 font-black tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-200">{u.email}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">Joined: {new Date(u.created_at).toLocaleDateString('id-ID')}</p>
                        </td>
                        <td className="px-6 py-4">
                          {u.is_premium 
                            ? <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 w-max shadow-[0_0_10px_rgba(249,115,22,0.2)]"><Crown size={10} /> Premium</span>
                            : <span className="bg-white/5 text-gray-400 border border-white/10 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider w-max inline-block">Gratis</span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="font-mono text-xs bg-black/40 px-3 py-1 rounded-lg border border-white/5 text-gray-300">{u.download_count}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleTogglePremium(u.id, u.is_premium)} className={`p-2 rounded-lg border text-xs font-bold transition-all ${u.is_premium ? 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white' : 'bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20'}`} title={u.is_premium ? "Cabut Premium" : "Beri Premium"}>
                              <Crown size={14} />
                            </button>
                            <button onClick={() => handleResetQuota(u.id)} className="p-2 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all" title="Reset Kuota ke 0">
                              <RefreshCw size={14} />
                            </button>
                            <button onClick={() => handleDeleteUser(u.id)} className="p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all" title="Hapus Akun Permanen">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500 text-sm font-medium">Tidak ada user yang ditemukan.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
