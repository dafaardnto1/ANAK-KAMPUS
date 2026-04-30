"use client";
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from "next-themes";
import { useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';
import mammoth from "mammoth";
import { Document, Packer, Paragraph, TextRun } from "docx";
import * as XLSX from 'xlsx';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import type { Profile } from './lib/supabase';
import {
  FileImage, FileUp, Trash2, Download, Zap,
  FileText, FileSpreadsheet, Layers, Menu, Crown,
  Moon, Sun, Merge, Scissors, Minimize2,
  Stamp, Lock, QrCode, ScanText, X,
  Hash, Info, Settings2, RotateCw, Table,
  Images, PenLine, LogOut, UserCircle,
  Eye, EyeOff, ArrowRight, Sparkles,
  Shrink, FileType, Maximize, GraduationCap,
  Calculator, BookOpen, CaseSensitive,
  Palette, Type, FileSignature, Plus,
  ChevronRight, CheckCircle2, AlertCircle,
  Copy, Check, Clipboard
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ImageItem { id: string; src: string; name: string; rotation: number; }
interface PageItem { index: number; rotation: number; deleted: boolean; }
interface IpkCourse { id: string; name: string; grade: string; credit: string; }
interface PustakaEntry { id: string; author: string; year: string; title: string; pub: string; type: string; }

// ─── Static Data ──────────────────────────────────────────────────────────────
const MENU_GROUPS = [
  {
    label: 'Konversi', icon: 'FileImage', items: [
      { id: 'PICTURE_TO_PDF', name: 'Picture → PDF', icon: 'FileImage' },
      { id: 'WORD_TO_PDF', name: 'Word → PDF', icon: 'Layers' },
      { id: 'PDF_TO_WORD', name: 'PDF → Word', icon: 'FileText' },
      { id: 'TO_EXCEL', name: 'Dokumen → Excel', icon: 'FileSpreadsheet' },
      { id: 'PDF_TO_IMAGE', name: 'PDF → Gambar', icon: 'Images' },
      { id: 'IMAGE_TO_EXCEL', name: 'Gambar → Excel (OCR)', icon: 'Table' },
    ]
  },
  {
    label: 'PDF Tools', icon: 'Layers', items: [
      { id: 'PDF_MERGER', name: 'Gabung PDF', icon: 'Merge' },
      { id: 'PDF_SPLITTER', name: 'Potong PDF', icon: 'Scissors' },
      { id: 'PDF_COMPRESSOR', name: 'Kompres PDF', icon: 'Minimize2' },
      { id: 'ADD_WATERMARK', name: 'Watermark', icon: 'Stamp' },
      { id: 'PROTECT_PDF', name: 'Proteksi PDF', icon: 'Lock' },
      { id: 'PAGE_NUMBERING', name: 'Nomor Halaman', icon: 'Hash' },
      { id: 'METADATA_EDITOR', name: 'Edit Metadata', icon: 'Info' },
      { id: 'PAGE_ORGANIZER', name: 'Atur Halaman', icon: 'Settings2' },
      { id: 'ADD_SIGNATURE', name: 'Tanda Tangan', icon: 'PenLine' },
    ]
  },
  {
    label: 'Gambar', icon: 'Images', items: [
      { id: 'IMAGE_COMPRESSOR', name: 'Kompres Gambar', icon: 'Shrink' },
      { id: 'IMAGE_CONVERTER', name: 'Konversi Format', icon: 'FileType' },
      { id: 'IMAGE_RESIZER', name: 'Resize Gambar', icon: 'Maximize' },
    ]
  },
  {
    label: 'Mahasiswa', icon: 'GraduationCap', items: [
      { id: 'COVER_GENERATOR', name: 'Cover Makalah', icon: 'GraduationCap' },
      { id: 'IPK_CALCULATOR', name: 'Kalkulator IPK', icon: 'Calculator' },
      { id: 'PUSTAKA_GENERATOR', name: 'Daftar Pustaka', icon: 'BookOpen' },
      { id: 'SURAT_GENERATOR', name: 'Surat Mahasiswa', icon: 'FileSignature' },
    ]
  },
  {
    label: 'AI Tools', icon: 'Sparkles', items: [
      { id: 'AI_SUMMARIZER', name: 'Ringkas Jurnal / PDF', icon: 'Sparkles' },
      { id: 'AI_PARAPHRASE', name: 'Parafrase & Anti-Plagiat', icon: 'RotateCw' },
      { id: 'AI_TITLE_GEN', name: 'Generator Judul Skripsi', icon: 'GraduationCap' },
    ]
  },
  {
    label: 'Teks & Warna', icon: 'Type', items: [
      { id: 'WORD_COUNTER', name: 'Hitung Kata', icon: 'CaseSensitive' },
      { id: 'LOREM_IPSUM', name: 'Lorem Ipsum', icon: 'Type' },
      { id: 'COLOR_PICKER', name: 'Color Picker', icon: 'Palette' },
    ]
  },
  {
    label: 'Ekstra', icon: 'QrCode', items: [
      { id: 'QR_CODE', name: 'QR Code Generator', icon: 'QrCode' },
      { id: 'OCR', name: 'OCR Scan', icon: 'ScanText' },
    ]
  }
];

const MODE_CONFIG: Record<string, { accept: string; multi: boolean; label: string; tip: string; noFile?: boolean }> = {
  PICTURE_TO_PDF: { accept: "image/*", multi: true, label: "Upload gambar (bisa banyak)", tip: "Urutan upload = urutan halaman PDF. Klik gambar untuk hapus." },
  WORD_TO_PDF: { accept: ".docx", multi: false, label: "Upload file .docx", tip: "Teks dan format dasar akan dipertahankan." },
  PDF_TO_WORD: { accept: ".pdf", multi: false, label: "Upload file .pdf", tip: "Teks akan diekstrak. PDF berbasis scan mungkin kurang akurat." },
  TO_EXCEL: { accept: ".docx,.pdf", multi: false, label: "Upload .pdf atau .docx", tip: "Cocok untuk dokumen teks berstruktur dan tabel." },
  PDF_TO_IMAGE: { accept: ".pdf", multi: false, label: "Upload file .pdf", tip: "Setiap halaman menjadi file JPG, diunduh sebagai .zip." },
  IMAGE_TO_EXCEL: { accept: "image/*", multi: false, label: "Upload foto atau screenshot tabel", tip: "Foto terang & lurus = hasil OCR lebih akurat." },
  PDF_MERGER: { accept: ".pdf", multi: true, label: "Upload beberapa PDF", tip: "Urutan di daftar = urutan saat digabung." },
  PDF_SPLITTER: { accept: ".pdf", multi: false, label: "Upload PDF yang ingin dipotong", tip: "Masukkan nomor halaman dimulai dari 1." },
  PDF_COMPRESSOR: { accept: ".pdf", multi: false, label: "Upload PDF untuk dikompres", tip: "Kualitas diturunkan ~60% untuk mengurangi ukuran file." },
  ADD_WATERMARK: { accept: ".pdf", multi: false, label: "Upload PDF", tip: "Watermark diagonal transparan di setiap halaman." },
  PROTECT_PDF: { accept: ".pdf", multi: false, label: "Upload PDF", tip: "Metadata proteksi akan ditambahkan ke file." },
  PAGE_NUMBERING: { accept: ".pdf", multi: false, label: "Upload PDF untuk diberi nomor halaman", tip: "Nomor halaman muncul di footer setiap halaman." },
  METADATA_EDITOR: { accept: ".pdf", multi: false, label: "Upload PDF untuk diedit metadata-nya", tip: "Judul, pengarang, subjek, dan kata kunci bisa diubah." },
  PAGE_ORGANIZER: { accept: ".pdf", multi: false, label: "Upload PDF untuk diatur halamannya", tip: "Hapus atau putar halaman tertentu sebelum disimpan." },
  ADD_SIGNATURE: { accept: ".pdf", multi: false, label: "Upload PDF untuk ditandatangani", tip: "Gunakan PNG transparan untuk hasil tanda tangan terbaik." },
  QR_CODE: { accept: "", multi: false, label: "Tidak perlu upload file", tip: "QR diunduh sebagai PNG resolusi tinggi 400×400.", noFile: true },
  OCR: { accept: "image/*", multi: false, label: "Upload foto atau screenshot teks", tip: "Mendukung Bahasa Indonesia dan Inggris." },
  IMAGE_COMPRESSOR: { accept: "image/*", multi: false, label: "Upload gambar untuk dikompres", tip: "Mendukung JPG, PNG, WebP." },
  IMAGE_CONVERTER: { accept: "image/*", multi: false, label: "Upload gambar untuk dikonversi", tip: "Hasil bisa diunduh dalam format JPG, PNG, atau WebP." },
  IMAGE_RESIZER: { accept: "image/*", multi: false, label: "Upload gambar untuk di-resize", tip: "Masukkan lebar/tinggi dalam pixel." },
  COVER_GENERATOR: { accept: "", multi: false, label: "Isi form untuk buat cover makalah", tip: "Diunduh langsung sebagai PDF A4 siap cetak.", noFile: true },
  IPK_CALCULATOR: { accept: "", multi: false, label: "Masukkan nilai mata kuliah kamu", tip: "IPK dihitung secara otomatis dari nilai dan SKS.", noFile: true },
  PUSTAKA_GENERATOR: { accept: "", multi: false, label: "Input data sumber referensi", tip: "Format APA otomatis, siap disalin.", noFile: true },
  SURAT_GENERATOR: { accept: "", multi: false, label: "Pilih template surat", tip: "Surat resmi mahasiswa, diunduh sebagai PDF.", noFile: true },
  WORD_COUNTER: { accept: "", multi: false, label: "Tempel teks untuk dihitung", tip: "Hitung kata, karakter, kalimat, dan estimasi waktu baca.", noFile: true },
  LOREM_IPSUM: { accept: "", multi: false, label: "Generate teks dummy", tip: "Atur jumlah paragraf yang dibutuhkan.", noFile: true },
  COLOR_PICKER: { accept: "", multi: false, label: "Pilih warna untuk desain", tip: "Salin HEX, RGB, atau HSL dengan satu klik.", noFile: true },
  AI_SUMMARIZER: { accept: ".pdf", multi: false, label: "Upload PDF jurnal / artikel ilmiah", tip: "AI akan merangkum isi, metode, hasil, dan kesimpulan secara otomatis. Didukung Groq LLaMA 3.3 70B.", noFile: false },
  AI_PARAPHRASE: { accept: "", multi: false, label: "Tempel teks yang ingin diparafrase", tip: "AI menyusun ulang kalimat secara signifikan agar unik & lolos deteksi plagiarisme, sambil mempertahankan makna.", noFile: true },
  AI_TITLE_GEN: { accept: "", multi: false, label: "Isi jurusan dan minat penelitian kamu", tip: "AI akan generate 10 ide judul skripsi/penelitian yang spesifik, metodologis, dan relevan dengan bidangmu.", noFile: true },
};

const getIcon = (iconName: string, size = 15) => {
  const map: Record<string, React.ReactNode> = {
    FileImage: <FileImage size={size} />, Layers: <Layers size={size} />, FileText: <FileText size={size} />,
    FileSpreadsheet: <FileSpreadsheet size={size} />, Images: <Images size={size} />, Table: <Table size={size} />,
    Merge: <Merge size={size} />, Scissors: <Scissors size={size} />, Minimize2: <Minimize2 size={size} />,
    Stamp: <Stamp size={size} />, Lock: <Lock size={size} />, Hash: <Hash size={size} />,
    Info: <Info size={size} />, Settings2: <Settings2 size={size} />, PenLine: <PenLine size={size} />,
    Shrink: <Shrink size={size} />, FileType: <FileType size={size} />, Maximize: <Maximize size={size} />,
    GraduationCap: <GraduationCap size={size} />, Calculator: <Calculator size={size} />,
    BookOpen: <BookOpen size={size} />, FileSignature: <FileSignature size={size} />,
    CaseSensitive: <CaseSensitive size={size} />, Type: <Type size={size} />, Palette: <Palette size={size} />,
    QrCode: <QrCode size={size} />, ScanText: <ScanText size={size} />,
  };
  return map[iconName] ?? <FileImage size={size} />;
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [localCount, setLocalCount] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const { setTheme, resolvedTheme } = useTheme();
  const [currentMode, setCurrentMode] = useState('PICTURE_TO_PDF');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [multiFiles, setMultiFiles] = useState<File[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Mode-specific state
  const [ocrResult, setOcrResult] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [splitFrom, setSplitFrom] = useState('');
  const [splitTo, setSplitTo] = useState('');
  const [watermarkText, setWatermarkText] = useState('');
  const [pdfPassword, setPdfPassword] = useState('');
  const [qrContent, setQrContent] = useState('');
  const [qrPreview, setQrPreview] = useState('');
  const [pageNumberPos, setPageNumberPos] = useState<'bottom-center' | 'bottom-right' | 'bottom-left'>('bottom-center');
  const [pageNumberStart, setPageNumberStart] = useState('1');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaAuthor, setMetaAuthor] = useState('');
  const [metaSubject, setMetaSubject] = useState('');
  const [metaKeywords, setMetaKeywords] = useState('');
  const [organizerPages, setOrganizerPages] = useState<PageItem[]>([]);
  const [organizerLoaded, setOrganizerLoaded] = useState(false);
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [sigPage, setSigPage] = useState('1');
  const [sigX, setSigX] = useState('50');
  const [sigY, setSigY] = useState('50');
  const [sigWidth, setSigWidth] = useState('150');
  const [compressQuality, setCompressQuality] = useState(80);
  const [targetFormat, setTargetFormat] = useState('jpeg');
  const [resizeWidth, setResizeWidth] = useState('1080');
  const [resizeHeight, setResizeHeight] = useState('');
  const [resizeLock, setResizeLock] = useState(true);
  const [coverData, setCoverData] = useState({ title: '', sub: '', author: '', id: '', uni: '', year: new Date().getFullYear().toString() });
  const [ipkCourses, setIpkCourses] = useState<IpkCourse[]>([]);
  const [ipkNew, setIpkNew] = useState({ name: '', grade: 'A', sks: '3' });
  const [pustakaEntries, setPustakaEntries] = useState<PustakaEntry[]>([]);
  const [pustakaNew, setPustakaNew] = useState({ author: '', year: '', title: '', pub: '' });
  const [suratData, setSuratData] = useState({ type: 'IZIN', name: '', id: '', reason: '', date: '' });
  const [wordText, setWordText] = useState('');
  const [loremCount, setLoremCount] = useState(3);
  const [pickedColor, setPickedColor] = useState('#EF4444');
  const [copiedColor, setCopiedColor] = useState('');

  // AI Tools state
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiParaphraseText, setAiParaphraseText] = useState('');
  const [aiTitleJurusan, setAiTitleJurusan] = useState('');
  const [aiTitleMinat, setAiTitleMinat] = useState('');
  const [aiCopied, setAiCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const isDark = useMemo(() => resolvedTheme === 'dark', [resolvedTheme]);
  const isLoggedIn = useMemo(() => profile !== null, [profile]);
  const isPremium = useMemo(() => profile?.is_premium ?? false, [profile]);
  const MAX_QUOTA = useMemo(() => isPremium ? 500 : 30, [isPremium]);
  const downloadCount = useMemo(() => isLoggedIn ? (profile?.download_count ?? 0) : localCount, [isLoggedIn, profile, localCount]);
  const quotaFull = useMemo(() => downloadCount >= MAX_QUOTA, [downloadCount, MAX_QUOTA]);
  const cfg = useMemo(() => MODE_CONFIG[currentMode], [currentMode]);
  const quotaPct = useMemo(() => Math.min((downloadCount / MAX_QUOTA) * 100, 100), [downloadCount, MAX_QUOTA]);
  const currentItem = useMemo(() => MENU_GROUPS.flatMap(g => g.items).find(i => i.id === currentMode), [currentMode]);

  // ─── Toast ────────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ─── Auth ─────────────────────────────────────────────────────────────────────
  const checkSession = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) {
          setProfile(data);
          const diffDays = Math.floor((Date.now() - new Date(data.last_reset).getTime()) / 86400000);
          if (!data.is_premium && diffDays >= 15) {
            await supabase.from('profiles').update({ download_count: 0, last_reset: new Date().toISOString() }).eq('id', user.id);
            setProfile(prev => prev ? { ...prev, download_count: 0 } : null);
          }
        }
      }
    } catch (e) { console.warn('Session check failed:', e); }
  }, []);

  const resetLoginForm = useCallback(() => {
    setLoginEmail(''); setLoginPassword(''); setLoginError(''); setLoginSuccess(''); setShowPass(false);
  }, []);

  const openLoginModal = useCallback((mode: 'login' | 'register' = 'login') => {
    setLoginMode(mode); resetLoginForm(); setShowLoginModal(true);
  }, [resetLoginForm]);

  const handleLoginSubmit = useCallback(async () => {
    if (!loginEmail || !loginPassword) { setLoginError('Isi email dan password!'); return; }
    setLoginLoading(true); setLoginError(''); setLoginSuccess('');
    try {
      if (loginMode === 'register') {
        const { error } = await supabase.auth.signUp({ email: loginEmail, password: loginPassword });
        if (error) throw error;
        setLoginSuccess('Cek email untuk konfirmasi akun!');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
        if (error) throw error;
        if (data.user) await checkSession();
        setShowLoginModal(false); resetLoginForm();
        router.push('/upgrade');
      }
    } catch (e: any) { setLoginError(e.message || 'Terjadi error'); }
    finally { setLoginLoading(false); }
  }, [loginEmail, loginPassword, loginMode, checkSession, resetLoginForm, router]);

  const handleLogout = useCallback(async () => {
    try { await supabase.auth.signOut(); } catch {}
    setProfile(null); showToast('Berhasil keluar');
  }, [showToast]);

  // ─── Finalize ─────────────────────────────────────────────────────────────────
  const finalizeProcess = useCallback(async () => {
    if (isLoggedIn && profile) {
      const newCount = (profile.download_count ?? 0) + 1;
      try { await supabase.from('profiles').update({ download_count: newCount }).eq('id', profile.id); } catch {}
      setProfile(prev => prev ? { ...prev, download_count: newCount } : null);
    } else {
      const nc = localCount + 1;
      setLocalCount(nc);
      localStorage.setItem('anak_kampus_quota', nc.toString());
    }
    setImages([]); setSingleFile(null); setMultiFiles([]);
    showToast('File berhasil diproses & diunduh!');
  }, [isLoggedIn, profile, localCount, showToast]);

  const saveBlob = useCallback(async (blob: Blob, filename: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename; a.click();
    URL.revokeObjectURL(a.href);
    await finalizeProcess();
  }, [finalizeProcess]);

  // ─── File Handlers ────────────────────────────────────────────────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = '';
    if (currentMode === 'PICTURE_TO_PDF') {
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => setImages(prev => [...prev, { id: Math.random().toString(36), src: reader.result as string, name: file.name, rotation: 0 }]);
        reader.readAsDataURL(file);
      });
    } else if (currentMode === 'PDF_MERGER') {
      setMultiFiles(prev => [...prev, ...files]);
    } else {
      setSingleFile(files[0]);
      if (currentMode === 'PAGE_ORGANIZER') loadOrganizerPages(files[0]);
    }
  }, [currentMode]);

  const loadOrganizerPages = useCallback(async (file: File) => {
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer());
      setOrganizerPages(Array.from({ length: doc.getPageCount() }, (_, i) => ({ index: i, rotation: 0, deleted: false })));
      setOrganizerLoaded(true);
    } catch { showToast('Gagal membaca halaman PDF', 'error'); }
  }, [showToast]);

  // ─── Converter Functions ──────────────────────────────────────────────────────
  const handlePictureToPdf = useCallback(async () => {
    const pdf = new jsPDF();
    images.forEach((img, i) => {
      if (i > 0) pdf.addPage();
      pdf.addImage(img.src, 'JPEG', 10, 10, 190, 0, undefined, 'FAST', img.rotation);
    });
    pdf.save('ANAK_KAMPUS_IMG.pdf');
    await finalizeProcess();
  }, [images, finalizeProcess]);

  const handleWordToPdf = useCallback(async () => {
    const result = await mammoth.extractRawText({ arrayBuffer: await singleFile!.arrayBuffer() });
    const pdf = new jsPDF();
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    const lines = pdf.splitTextToSize(result.value, 180);
    let y = 20;
    lines.forEach((line: string) => {
      if (y > 270) { pdf.addPage(); y = 20; }
      pdf.text(line, 15, y); y += 7;
    });
    pdf.save('ANAK_KAMPUS_WORD.pdf');
    await finalizeProcess();
  }, [singleFile, finalizeProcess]);

  const handlePdfToWord = useCallback(async () => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    const pdf = await pdfjsLib.getDocument({ data: await singleFile!.arrayBuffer() }).promise;
    const lines: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const txt = await (await pdf.getPage(i)).getTextContent();
      lines.push(...txt.items.map((x: any) => x.str));
    }
    const doc = new Document({ sections: [{ children: lines.map(l => new Paragraph({ children: [new TextRun(l)] })) }] });
    await saveBlob(await Packer.toBlob(doc), 'ANAK_KAMPUS_CONVERTED.docx');
  }, [singleFile, saveBlob]);

  const handleToExcel = useCallback(async () => {
    let text = '';
    if (singleFile!.name.endsWith('.docx')) {
      text = (await mammoth.extractRawText({ arrayBuffer: await singleFile!.arrayBuffer() })).value;
    } else {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      const pdf = await pdfjsLib.getDocument({ data: await singleFile!.arrayBuffer() }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const c = await (await pdf.getPage(i)).getTextContent();
        text += c.items.map((x: any) => x.str).join(' ') + '\n';
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(text.split('\n').map(l => [l])), 'Data');
    XLSX.writeFile(wb, 'ANAK_KAMPUS_EXCEL.xlsx');
    await finalizeProcess();
  }, [singleFile, finalizeProcess]);

  const handlePdfToImage = useCallback(async () => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    const pdf = await pdfjsLib.getDocument({ data: await singleFile!.arrayBuffer() }).promise;
    const zip = new JSZip();
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await (page as any).render({ canvasContext: canvas.getContext('2d')!, canvas, viewport }).promise;
      const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.92));
      zip.file(`halaman-${String(i).padStart(3, '0')}.jpg`, blob);
    }
    await saveBlob(await zip.generateAsync({ type: 'blob' }), 'ANAK_KAMPUS_PAGES.zip');
  }, [singleFile, saveBlob]);

  const handleImageToExcel = useCallback(async () => {
    setOcrProgress(0);
    const Tesseract = await import('tesseract.js');
    const result = await (Tesseract as any).recognize(singleFile!, 'ind+eng', {
      logger: (m: any) => { if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100)); }
    });
    const rows = (result.data.text as string).split('\n').filter((l: string) => l.trim())
      .map((l: string) => l.split(/\s{2,}|\t/).map((c: string) => c.trim()).filter(Boolean));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'OCR Result');
    XLSX.writeFile(wb, 'ANAK_KAMPUS_OCR_TABLE.xlsx');
    await finalizeProcess();
  }, [singleFile, finalizeProcess]);

  const handlePdfMerger = useCallback(async () => {
    const merged = await PDFDocument.create();
    for (const file of multiFiles) {
      const doc = await PDFDocument.load(await file.arrayBuffer());
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    }
    await saveBlob(new Blob([await merged.save() as unknown as BlobPart], { type: 'application/pdf' }), 'ANAK_KAMPUS_MERGED.pdf');
  }, [multiFiles, saveBlob]);

  const handlePdfSplitter = useCallback(async () => {
    const from = parseInt(splitFrom) - 1, to = parseInt(splitTo) - 1;
    if (isNaN(from) || isNaN(to) || from < 0 || to < from) { showToast('Nomor halaman tidak valid!', 'error'); return; }
    const src = await PDFDocument.load(await singleFile!.arrayBuffer());
    const newDoc = await PDFDocument.create();
    const pages = await newDoc.copyPages(src, Array.from({ length: to - from + 1 }, (_, i) => from + i));
    pages.forEach(p => newDoc.addPage(p));
    await saveBlob(new Blob([await newDoc.save() as unknown as BlobPart], { type: 'application/pdf' }), 'ANAK_KAMPUS_SPLIT.pdf');
  }, [splitFrom, splitTo, singleFile, saveBlob, showToast]);

  const handlePdfCompressor = useCallback(async () => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    const src = await pdfjsLib.getDocument({ data: await singleFile!.arrayBuffer() }).promise;
    const newDoc = await PDFDocument.create();
    for (let i = 1; i <= src.numPages; i++) {
      const page = await src.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await (page as any).render({ canvasContext: canvas.getContext('2d')!, canvas, viewport }).promise;
      const imgBytes = await fetch(canvas.toDataURL('image/jpeg', 0.6)).then(r => r.arrayBuffer());
      const img = await newDoc.embedJpg(imgBytes);
      const pdfPage = newDoc.addPage([viewport.width, viewport.height]);
      pdfPage.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height });
    }
    await saveBlob(new Blob([await newDoc.save() as unknown as BlobPart], { type: 'application/pdf' }), 'ANAK_KAMPUS_COMPRESSED.pdf');
  }, [singleFile, saveBlob]);

  const handleAddWatermark = useCallback(async () => {
    if (!watermarkText.trim()) { showToast('Isi teks watermark!', 'error'); return; }
    const doc = await PDFDocument.load(await singleFile!.arrayBuffer());
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    doc.getPages().forEach(page => {
      const { width, height } = page.getSize();
      page.drawText(watermarkText, {
        x: width / 2 - watermarkText.length * 12, y: height / 2,
        size: 48, font, color: rgb(0.8, 0.1, 0.1), opacity: 0.2, rotate: degrees(45),
      });
    });
    await saveBlob(new Blob([await doc.save() as unknown as BlobPart], { type: 'application/pdf' }), 'ANAK_KAMPUS_WATERMARKED.pdf');
  }, [watermarkText, singleFile, saveBlob, showToast]);

  const handleProtectPdf = useCallback(async () => {
    if (!pdfPassword.trim()) { showToast('Isi password terlebih dahulu!', 'error'); return; }
    const doc = await PDFDocument.load(await singleFile!.arrayBuffer());
    doc.setTitle(`PROTECTED - ${singleFile!.name}`);
    doc.setAuthor('ANAK KAMPUS');
    doc.setSubject(`Password hint: ${pdfPassword[0]}${'*'.repeat(pdfPassword.length - 1)}`);
    await saveBlob(new Blob([await doc.save() as unknown as BlobPart], { type: 'application/pdf' }), 'ANAK_KAMPUS_PROTECTED.pdf');
  }, [pdfPassword, singleFile, saveBlob, showToast]);

  const handlePageNumbering = useCallback(async () => {
    const startNum = parseInt(pageNumberStart) || 1;
    const doc = await PDFDocument.load(await singleFile!.arrayBuffer());
    const font = await doc.embedFont(StandardFonts.Helvetica);
    doc.getPages().forEach((page, i) => {
      const { width } = page.getSize();
      const label = String(startNum + i);
      const tWidth = font.widthOfTextAtSize(label, 11);
      const x = pageNumberPos === 'bottom-center' ? (width - tWidth) / 2
        : pageNumberPos === 'bottom-right' ? width - tWidth - 30 : 30;
      page.drawText(label, { x, y: 22, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
    });
    await saveBlob(new Blob([await doc.save() as unknown as BlobPart], { type: 'application/pdf' }), 'ANAK_KAMPUS_NUMBERED.pdf');
  }, [pageNumberStart, singleFile, pageNumberPos, saveBlob]);

  const handleMetadataEditor = useCallback(async () => {
    const doc = await PDFDocument.load(await singleFile!.arrayBuffer());
    if (metaTitle.trim()) doc.setTitle(metaTitle.trim());
    if (metaAuthor.trim()) doc.setAuthor(metaAuthor.trim());
    if (metaSubject.trim()) doc.setSubject(metaSubject.trim());
    if (metaKeywords.trim()) doc.setKeywords([metaKeywords.trim()]);
    doc.setProducer('ANAK KAMPUS'); doc.setCreator('ANAK KAMPUS');
    await saveBlob(new Blob([await doc.save() as unknown as BlobPart], { type: 'application/pdf' }), 'ANAK_KAMPUS_EDITED.pdf');
  }, [singleFile, metaTitle, metaAuthor, metaSubject, metaKeywords, saveBlob]);

  const handlePageOrganizer = useCallback(async () => {
    const src = await PDFDocument.load(await singleFile!.arrayBuffer());
    const newDoc = await PDFDocument.create();
    const active = organizerPages.filter(p => !p.deleted);
    const copied = await newDoc.copyPages(src, active.map(p => p.index));
    copied.forEach((page, i) => {
      if (active[i].rotation !== 0) page.setRotation(degrees(active[i].rotation));
      newDoc.addPage(page);
    });
    await saveBlob(new Blob([await newDoc.save() as unknown as BlobPart], { type: 'application/pdf' }), 'ANAK_KAMPUS_ORGANIZED.pdf');
  }, [singleFile, organizerPages, saveBlob]);

  const handleAddSignature = useCallback(async () => {
    if (!sigFile) { showToast('Upload gambar tanda tangan dulu!', 'error'); return; }
    const sigUint8 = new Uint8Array(await sigFile.arrayBuffer());
    const isPng = sigFile.type === 'image/png' || sigFile.name.endsWith('.png');
    const doc = await PDFDocument.load(await singleFile!.arrayBuffer());
    const sigImg = isPng ? await doc.embedPng(sigUint8) : await doc.embedJpg(sigUint8);
    const pages = doc.getPages();
    const pageIndex = Math.min(Math.max(parseInt(sigPage) - 1, 0), pages.length - 1);
    const page = pages[pageIndex];
    const { height } = page.getSize();
    const w = parseInt(sigWidth) || 150;
    page.drawImage(sigImg, {
      x: parseInt(sigX) || 50, y: height - (parseInt(sigY) || 50) - (w * sigImg.height / sigImg.width),
      width: w, height: w * sigImg.height / sigImg.width
    });
    await saveBlob(new Blob([await doc.save() as unknown as BlobPart], { type: 'application/pdf' }), 'ANAK_KAMPUS_SIGNED.pdf');
  }, [sigFile, singleFile, sigPage, sigWidth, sigX, sigY, saveBlob, showToast]);

  const handleOcr = useCallback(async () => {
    setOcrResult(''); setOcrProgress(0);
    const Tesseract = await import('tesseract.js');
    const result = await (Tesseract as any).recognize(singleFile!, 'ind+eng', {
      logger: (m: any) => { if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100)); }
    });
    setOcrResult(result.data.text);
    await finalizeProcess();
  }, [singleFile, finalizeProcess]);

  const handleImageCompressor = useCallback(async () => {
    const img = new Image();
    img.src = URL.createObjectURL(singleFile!);
    await new Promise(res => img.onload = res);
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    canvas.getContext('2d')?.drawImage(img, 0, 0);
    URL.revokeObjectURL(img.src);
    canvas.toBlob(async blob => {
      if (blob) await saveBlob(blob, `compressed_${singleFile!.name.split('.')[0]}.jpg`);
    }, 'image/jpeg', compressQuality / 100);
  }, [singleFile, compressQuality, saveBlob]);

  const handleImageConverter = useCallback(async () => {
    const img = new Image();
    img.src = URL.createObjectURL(singleFile!);
    await new Promise(res => img.onload = res);
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    canvas.getContext('2d')?.drawImage(img, 0, 0);
    URL.revokeObjectURL(img.src);
    const mime = `image/${targetFormat === 'jpg' ? 'jpeg' : targetFormat}`;
    canvas.toBlob(async blob => {
      if (blob) await saveBlob(blob, `converted_${singleFile!.name.split('.')[0]}.${targetFormat}`);
    }, mime, 0.9);
  }, [singleFile, targetFormat, saveBlob]);

  const handleImageResizer = useCallback(async () => {
    const img = new Image();
    img.src = URL.createObjectURL(singleFile!);
    await new Promise(res => img.onload = res);
    const w = parseInt(resizeWidth) || img.width;
    const h = parseInt(resizeHeight) || (resizeLock ? Math.round(img.height * w / img.width) : img.height);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(img.src);
    canvas.toBlob(async blob => {
      if (blob) await saveBlob(blob, `resized_${singleFile!.name}`);
    }, singleFile!.type, 0.9);
  }, [singleFile, resizeWidth, resizeHeight, resizeLock, saveBlob]);

  const handleCoverGenerator = useCallback(async () => {
    const doc = new jsPDF();
    doc.setFillColor(220, 38, 38); doc.rect(0, 0, 210, 12, 'F');
    doc.setFillColor(220, 38, 38); doc.rect(0, 285, 210, 12, 'F');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
    doc.setFontSize(20); doc.text(coverData.uni.toUpperCase() || 'NAMA UNIVERSITAS', 105, 40, { align: 'center' });
    doc.setLineWidth(0.5); doc.setDrawColor(220, 38, 38); doc.line(30, 48, 180, 48);
    doc.setFontSize(14); doc.text('MAKALAH', 105, 65, { align: 'center' });
    doc.setLineWidth(0.3); doc.line(60, 70, 150, 70);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(coverData.title.toUpperCase() || 'JUDUL MAKALAH', 150);
    doc.text(titleLines, 105, 90, { align: 'center' });
    if (coverData.sub) {
      doc.setFontSize(11); doc.setFont('helvetica', 'normal');
      doc.text(coverData.sub, 105, 90 + titleLines.length * 8 + 6, { align: 'center', maxWidth: 140 });
    }
    doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
    doc.text('Disusun oleh:', 105, 165, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30); doc.setFontSize(13);
    doc.text(coverData.author || 'Nama Mahasiswa', 105, 175, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(80, 80, 80);
    if (coverData.id) doc.text(`NIM: ${coverData.id}`, 105, 183, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(30, 30, 30);
    doc.text(coverData.year, 105, 250, { align: 'center' });
    doc.save(`Cover_Makalah.pdf`);
    await finalizeProcess();
  }, [coverData, finalizeProcess]);

  const handleIpkCalculator = useCallback(async () => {
    if (ipkCourses.length === 0) { showToast('Tambahkan minimal 1 mata kuliah!', 'error'); return; }
    const gradeMap: Record<string, number> = { 'A': 4, 'A-': 3.7, 'B+': 3.3, 'B': 3, 'B-': 2.7, 'C+': 2.3, 'C': 2, 'D': 1, 'E': 0 };
    const totalSks = ipkCourses.reduce((s, c) => s + (parseInt(c.credit) || 0), 0);
    const totalPoint = ipkCourses.reduce((s, c) => s + ((gradeMap[c.grade] ?? 0) * (parseInt(c.credit) || 0)), 0);
    const ipk = totalSks ? (totalPoint / totalSks).toFixed(2) : '0.00';
    const doc = new jsPDF();
    doc.setFillColor(220, 38, 38); doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.text('LAPORAN ESTIMASI IPK', 105, 20, { align: 'center' });
    doc.setFontSize(11); doc.text('ANAK KAMPUS — Kalkulator IPK', 105, 28, { align: 'center' });
    doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    let y = 50;
    ipkCourses.forEach((c, i) => {
      const bg = i % 2 === 0 ? 245 : 255;
      doc.setFillColor(bg, bg, bg); doc.rect(15, y - 5, 180, 9, 'F');
      doc.text(`${i + 1}. ${c.name}`, 18, y);
      doc.text(`Nilai: ${c.grade}`, 130, y);
      doc.text(`SKS: ${c.credit}`, 165, y);
      y += 10;
    });
    y += 5;
    doc.setFillColor(220, 38, 38); doc.rect(15, y, 180, 18, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(`Total SKS: ${totalSks}   |   IPK: ${ipk}`, 105, y + 12, { align: 'center' });
    doc.save('Estimasi_IPK.pdf');
    await finalizeProcess();
  }, [ipkCourses, finalizeProcess, showToast]);

  const handlePustakaGenerator = useCallback(async () => {
    if (pustakaEntries.length === 0) { showToast('Tambahkan minimal 1 referensi!', 'error'); return; }
    const content = pustakaEntries
      .sort((a, b) => a.author.localeCompare(b.author))
      .map(e => `${e.author}. (${e.year}). ${e.title}. ${e.pub}.`)
      .join('\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    await saveBlob(blob, 'Daftar_Pustaka_APA.txt');
  }, [pustakaEntries, saveBlob, showToast]);

  const handleSuratGenerator = useCallback(async () => {
    const doc = new jsPDF();
    doc.setFillColor(220, 38, 38); doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('times', 'bold'); doc.setFontSize(14);
    doc.text('SURAT KETERANGAN MAHASISWA', 105, 18, { align: 'center' });
    doc.setTextColor(30, 30, 30); doc.setFont('times', 'normal'); doc.setFontSize(12);
    doc.text(`Bekasi, ${suratData.date || new Date().toLocaleDateString('id-ID')}`, 150, 45);
    const text = suratData.type === 'IZIN'
      ? `Saya yang bertanda tangan di bawah ini:\n\nNama   : ${suratData.name}\nNIM    : ${suratData.id}\n\nDengan ini menyatakan bahwa saya tidak dapat mengikuti perkuliahan pada tanggal ${suratData.date} dikarenakan ${suratData.reason}.\n\nDemikian surat pernyataan ini saya buat dengan sebenar-benarnya. Atas perhatian Bapak/Ibu dosen, saya ucapkan terima kasih.`
      : `Kepada Yth.\nBapak/Ibu Dosen\nDi tempat\n\nDengan hormat,\n\nSaya yang bertanda tangan di bawah ini:\n\nNama   : ${suratData.name}\nNIM    : ${suratData.id}\n\nDengan ini memohon untuk ${suratData.reason}.\n\nDemikian permohonan ini saya sampaikan. Atas perhatian dan kebijaksanaan Bapak/Ibu, saya ucapkan terima kasih.`;
    const lines = doc.splitTextToSize(text, 170);
    doc.text(lines, 20, 60);
    const signY = 200;
    doc.text('Hormat saya,', 140, signY);
    doc.text('\n\n\n', 140, signY + 5);
    doc.text(`( ${suratData.name} )`, 140, signY + 30);
    doc.save(`Surat_${suratData.type}.pdf`);
    await finalizeProcess();
  }, [suratData, finalizeProcess]);

  const handleWordCounter = useCallback(() => {
    // Just display results inline, no download needed
    showToast('Analisis teks selesai!');
  }, [showToast]);

  const handleLoremIpsum = useCallback(async () => {
    const dummy = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.";
    const blob = new Blob([Array(loremCount).fill(dummy).join('\n\n')], { type: 'text/plain' });
    await saveBlob(blob, 'Lorem_Ipsum.txt');
  }, [loremCount, saveBlob]);

  const handleColorPicker = useCallback(async () => {
    await navigator.clipboard.writeText(pickedColor);
    setCopiedColor(pickedColor);
    setTimeout(() => setCopiedColor(''), 2000);
    showToast(`Warna ${pickedColor} disalin!`);
    await finalizeProcess();
  }, [pickedColor, finalizeProcess, showToast]);

  const handleQrCode = useCallback(async () => {
    if (!qrContent.trim()) { showToast('Isi konten QR!', 'error'); return; }
    const url = await QRCode.toDataURL(qrContent, { width: 400, margin: 2, color: { dark: '#000', light: '#fff' } });
    const link = document.createElement('a');
    link.href = url; link.download = 'ANAK_KAMPUS_QR.png'; link.click();
    await finalizeProcess();
  }, [qrContent, finalizeProcess, showToast]);

  const handleQrPreview = useCallback(async () => {
    if (!qrContent.trim()) return;
    setQrPreview(await QRCode.toDataURL(qrContent, { width: 200, margin: 2 }));
  }, [qrContent]);

  // ─── AI Handlers ──────────────────────────────────────────────────────────────
  const callAI = useCallback(async (mode: string, text: string): Promise<string> => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'AI error');
    return data.result as string;
  }, []);

  const handleAiSummarizer = useCallback(async () => {
    if (!singleFile) { showToast('Upload PDF dulu!', 'error'); return; }
    setAiResult('');
    setAiLoading(true);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      const pdf = await pdfjsLib.getDocument({ data: await singleFile.arrayBuffer() }).promise;
      const texts: string[] = [];
      const maxPages = Math.min(pdf.numPages, 15);
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        texts.push(content.items.map((x: any) => x.str).join(' '));
      }
      const fullText = texts.join('\n').slice(0, 12000);
      if (!fullText.trim()) { showToast('PDF tidak bisa dibaca (mungkin berbasis scan)', 'error'); return; }
      const result = await callAI('SUMMARIZE', fullText);
      setAiResult(result);
      showToast('Ringkasan selesai!');
    } catch (e: any) {
      showToast(e.message || 'Gagal meringkas PDF', 'error');
    } finally {
      setAiLoading(false);
    }
  }, [singleFile, callAI, showToast]);

  const handleAiParaphrase = useCallback(async () => {
    if (!aiParaphraseText.trim()) { showToast('Isi teks terlebih dahulu!', 'error'); return; }
    setAiResult('');
    setAiLoading(true);
    try {
      const result = await callAI('PARAPHRASE', aiParaphraseText);
      setAiResult(result);
      showToast('Parafrase selesai!');
    } catch (e: any) {
      showToast(e.message || 'Gagal memparafrase', 'error');
    } finally {
      setAiLoading(false);
    }
  }, [aiParaphraseText, callAI, showToast]);

  const handleAiTitleGen = useCallback(async () => {
    if (!aiTitleJurusan.trim()) { showToast('Isi jurusan dulu!', 'error'); return; }
    setAiResult('');
    setAiLoading(true);
    try {
      const prompt = `Jurusan: ${aiTitleJurusan}\nMinat / Topik: ${aiTitleMinat || 'umum'}`;
      const result = await callAI('TITLE_GEN', prompt);
      setAiResult(result);
      showToast('Judul berhasil digenerate!');
    } catch (e: any) {
      showToast(e.message || 'Gagal generate judul', 'error');
    } finally {
      setAiLoading(false);
    }
  }, [aiTitleJurusan, aiTitleMinat, callAI, showToast]);

  const copyAiResult = useCallback(() => {
    if (!aiResult) return;
    navigator.clipboard.writeText(aiResult).then(() => {
      setAiCopied(true);
      setTimeout(() => setAiCopied(false), 2000);
      showToast('Hasil disalin!');
    });
  }, [aiResult, showToast]);

  // ─── Reset ────────────────────────────────────────────────────────────────────
  const resetState = useCallback(() => {
    setImages([]); setSingleFile(null); setMultiFiles([]);
    setOcrResult(''); setOcrProgress(0); setSplitFrom(''); setSplitTo('');
    setWatermarkText(''); setPdfPassword(''); setQrContent(''); setQrPreview('');
    setPageNumberStart('1'); setPageNumberPos('bottom-center');
    setMetaTitle(''); setMetaAuthor(''); setMetaSubject(''); setMetaKeywords('');
    setOrganizerPages([]); setOrganizerLoaded(false); setSigFile(null);
    setCompressQuality(80); setTargetFormat('jpeg'); setResizeWidth('1080'); setResizeHeight(''); setResizeLock(true);
    setCoverData({ title: '', sub: '', author: '', id: '', uni: '', year: new Date().getFullYear().toString() });
    setIpkCourses([]); setPustakaEntries([]);
    setSuratData({ type: 'IZIN', name: '', id: '', reason: '', date: '' });
    setWordText(''); setLoremCount(3); setPickedColor('#EF4444');
    setIpkNew({ name: '', grade: 'A', sks: '3' });
    setPustakaNew({ author: '', year: '', title: '', pub: '' });
    setAiResult(''); setAiParaphraseText(''); setAiTitleJurusan(''); setAiTitleMinat('');
  }, []);

  const isReady = useCallback(() => {
    if (currentMode === 'PICTURE_TO_PDF') return images.length > 0;
    if (currentMode === 'PDF_MERGER') return multiFiles.length >= 2;
    if (currentMode === 'QR_CODE') return qrContent.trim().length > 0;
    if (currentMode === 'PAGE_ORGANIZER') return organizerLoaded && organizerPages.some(p => !p.deleted);
    if (currentMode === 'ADD_SIGNATURE') return singleFile !== null && sigFile !== null;
    if (currentMode === 'AI_SUMMARIZER') return singleFile !== null;
    if (currentMode === 'AI_PARAPHRASE') return aiParaphraseText.trim().length > 0;
    if (currentMode === 'AI_TITLE_GEN') return aiTitleJurusan.trim().length > 0;
    if (cfg.noFile) return true;
    return singleFile !== null;
  }, [currentMode, images.length, multiFiles.length, qrContent, organizerLoaded, organizerPages, singleFile, sigFile, cfg, aiParaphraseText, aiTitleJurusan]);

  const handleMainAction = useCallback(async () => {
    if (quotaFull) { openLoginModal('login'); return; }
    setIsProcessing(true);
    try {
      const map: Record<string, () => Promise<void> | void> = {
        PICTURE_TO_PDF: handlePictureToPdf, WORD_TO_PDF: handleWordToPdf, PDF_TO_WORD: handlePdfToWord,
        TO_EXCEL: handleToExcel, PDF_TO_IMAGE: handlePdfToImage, IMAGE_TO_EXCEL: handleImageToExcel,
        PDF_MERGER: handlePdfMerger, PDF_SPLITTER: handlePdfSplitter, PDF_COMPRESSOR: handlePdfCompressor,
        ADD_WATERMARK: handleAddWatermark, PROTECT_PDF: handleProtectPdf, PAGE_NUMBERING: handlePageNumbering,
        METADATA_EDITOR: handleMetadataEditor, PAGE_ORGANIZER: handlePageOrganizer,
        ADD_SIGNATURE: handleAddSignature, QR_CODE: handleQrCode, OCR: handleOcr,
        IMAGE_COMPRESSOR: handleImageCompressor, IMAGE_CONVERTER: handleImageConverter, IMAGE_RESIZER: handleImageResizer,
        COVER_GENERATOR: handleCoverGenerator, IPK_CALCULATOR: handleIpkCalculator,
        PUSTAKA_GENERATOR: handlePustakaGenerator, SURAT_GENERATOR: handleSuratGenerator,
        WORD_COUNTER: handleWordCounter, LOREM_IPSUM: handleLoremIpsum, COLOR_PICKER: handleColorPicker,
        AI_SUMMARIZER: handleAiSummarizer, AI_PARAPHRASE: handleAiParaphrase, AI_TITLE_GEN: handleAiTitleGen,
      };
      await map[currentMode]?.();
    } catch (e) {
      console.error(e);
      showToast('Terjadi kesalahan. Coba lagi!', 'error');
    } finally { setIsProcessing(false); }
  }, [quotaFull, openLoginModal, currentMode, handlePictureToPdf, handleWordToPdf, handlePdfToWord,
    handleToExcel, handlePdfToImage, handleImageToExcel, handlePdfMerger, handlePdfSplitter,
    handlePdfCompressor, handleAddWatermark, handleProtectPdf, handlePageNumbering, handleMetadataEditor,
    handlePageOrganizer, handleAddSignature, handleQrCode, handleOcr, handleImageCompressor,
    handleImageConverter, handleImageResizer, handleCoverGenerator, handleIpkCalculator,
    handlePustakaGenerator, handleSuratGenerator, handleWordCounter, handleLoremIpsum,
    handleColorPicker, handleAiSummarizer, handleAiParaphrase, handleAiTitleGen, showToast]);

  // ─── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('anak_kampus_quota');
    if (saved) setLocalCount(parseInt(saved));
    checkSession();
  }, [checkSession]);

  // ─── Word Counter Stats ───────────────────────────────────────────────────────
  const wordStats = useMemo(() => {
    if (!wordText.trim()) return { words: 0, chars: 0, sentences: 0, readTime: 0 };
    const words = wordText.trim().split(/\s+/).length;
    const chars = wordText.length;
    const sentences = wordText.split(/[.!?]+/).filter(s => s.trim()).length;
    const readTime = Math.ceil(words / 200);
    return { words, chars, sentences, readTime };
  }, [wordText]);

  if (!mounted) return null;

  // ─── Color helpers ────────────────────────────────────────────────────────────
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${r}, ${g}, ${b})`;
  };
  const hexToHsl = (hex: string) => {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  };

  // ─── UI Helpers ───────────────────────────────────────────────────────────────
  const inputCls = `w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border transition-colors duration-150
    ${isDark ? 'bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-600 focus:border-red-500'
      : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-red-500'}`;

  const labelCls = `block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`;

  const cardCls = `rounded-2xl border p-4 ${isDark ? 'bg-[#0C101C]/80 border-gray-800/60 shadow-lg shadow-black/20' : 'bg-white border-gray-100 shadow-sm'}`;

  // ─── Render Mode-Specific UI ──────────────────────────────────────────────────
  const renderModeUI = () => {
    switch (currentMode) {
      case 'PDF_SPLITTER':
        return (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div><label className={labelCls}>Dari Halaman</label>
              <input className={inputCls} type="number" min="1" placeholder="1" value={splitFrom} onChange={e => setSplitFrom(e.target.value)} /></div>
            <div><label className={labelCls}>Sampai Halaman</label>
              <input className={inputCls} type="number" min="1" placeholder="5" value={splitTo} onChange={e => setSplitTo(e.target.value)} /></div>
          </div>
        );
      case 'ADD_WATERMARK':
        return (
          <div className="mt-3"><label className={labelCls}>Teks Watermark</label>
            <input className={inputCls} placeholder="RAHASIA / DRAFT / nama kamu..." value={watermarkText} onChange={e => setWatermarkText(e.target.value)} /></div>
        );
      case 'PROTECT_PDF':
        return (
          <div className="mt-3"><label className={labelCls}>Password Proteksi</label>
            <input className={inputCls} type="password" placeholder="Masukkan password..." value={pdfPassword} onChange={e => setPdfPassword(e.target.value)} /></div>
        );
      case 'PAGE_NUMBERING':
        return (
          <div className="mt-3 space-y-3">
            <div><label className={labelCls}>Mulai dari nomor</label>
              <input className={inputCls} type="number" min="1" value={pageNumberStart} onChange={e => setPageNumberStart(e.target.value)} /></div>
            <div><label className={labelCls}>Posisi</label>
              <div className="grid grid-cols-3 gap-2">
                {(['bottom-left', 'bottom-center', 'bottom-right'] as const).map(pos => (
                  <button key={pos} onClick={() => setPageNumberPos(pos)}
                    className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${pageNumberPos === pos
                      ? 'bg-red-600 text-white border-red-600' : isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                    {pos === 'bottom-left' ? 'Kiri' : pos === 'bottom-center' ? 'Tengah' : 'Kanan'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case 'METADATA_EDITOR':
        return (
          <div className="mt-3 space-y-2.5">
            {[['Judul', metaTitle, setMetaTitle], ['Pengarang', metaAuthor, setMetaAuthor],
              ['Subjek', metaSubject, setMetaSubject], ['Kata Kunci', metaKeywords, setMetaKeywords]].map(([lbl, val, set]: any) => (
              <div key={lbl}><label className={labelCls}>{lbl}</label>
                <input className={inputCls} placeholder={`Masukkan ${lbl.toLowerCase()}...`} value={val} onChange={e => set(e.target.value)} /></div>
            ))}
          </div>
        );
      case 'PAGE_ORGANIZER':
        return organizerLoaded ? (
          <div className="mt-3 space-y-2">
            {organizerPages.map((pg, idx) => (
              <div key={idx} className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-sm ${pg.deleted
                ? isDark ? 'opacity-30 bg-red-900/20 border-red-800' : 'opacity-30 bg-red-50 border-red-100'
                : isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
                <span className={`text-xs font-bold w-6 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{idx + 1}</span>
                <span className="flex-1 text-xs font-medium">Halaman {pg.index + 1}</span>
                <button onClick={() => setOrganizerPages(prev => prev.map((p, i) => i === idx ? { ...p, rotation: (p.rotation + 90) % 360 } : p))}
                  className={`p-1.5 rounded-lg ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`} title={`Putar (${pg.rotation}°)`}>
                  <RotateCw size={13} />
                </button>
                <button onClick={() => setOrganizerPages(prev => prev.map((p, i) => i === idx ? { ...p, deleted: !p.deleted } : p))}
                  className={`p-1.5 rounded-lg ${pg.deleted ? 'text-red-500' : isDark ? 'text-gray-400 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : null;
      case 'ADD_SIGNATURE':
        return (
          <div className="mt-3 space-y-3">
            <div>
              <label className={labelCls}>Upload Gambar Tanda Tangan</label>
              <button onClick={() => sigInputRef.current?.click()}
                className={`w-full py-2.5 rounded-xl border text-xs font-bold text-left px-3.5 transition-colors ${isDark ? 'border-gray-700 text-gray-400 hover:border-gray-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {sigFile ? sigFile.name : '📎 Pilih file PNG/JPG...'}
              </button>
              <input ref={sigInputRef} type="file" hidden accept="image/*" onChange={e => setSigFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[['Halaman', sigPage, setSigPage], ['Lebar (px)', sigWidth, setSigWidth],
                ['X (px)', sigX, setSigX], ['Y (px)', sigY, setSigY]].map(([lbl, val, set]: any) => (
                <div key={lbl}><label className={labelCls}>{lbl}</label>
                  <input className={inputCls} type="number" value={val} onChange={e => set(e.target.value)} /></div>
              ))}
            </div>
          </div>
        );
      case 'IMAGE_COMPRESSOR':
        return (
          <div className="mt-3">
            <label className={labelCls}>Kualitas: {compressQuality}%</label>
            <input type="range" min="10" max="100" value={compressQuality} onChange={e => setCompressQuality(Number(e.target.value))}
              className="w-full accent-red-600 mt-1" />
            <div className={`flex justify-between text-[10px] mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              <span>Kecil</span><span>Besar</span>
            </div>
          </div>
        );
      case 'IMAGE_CONVERTER':
        return (
          <div className="mt-3"><label className={labelCls}>Format Tujuan</label>
            <div className="grid grid-cols-3 gap-2">
              {['jpeg', 'png', 'webp'].map(fmt => (
                <button key={fmt} onClick={() => setTargetFormat(fmt)}
                  className={`py-2 rounded-xl text-xs font-bold border uppercase transition-all ${targetFormat === fmt
                    ? 'bg-red-600 text-white border-red-600' : isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        );
      case 'IMAGE_RESIZER':
        return (
          <div className="mt-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Lebar (px)</label>
                <input className={inputCls} type="number" placeholder="1080" value={resizeWidth} onChange={e => setResizeWidth(e.target.value)} /></div>
              <div><label className={labelCls}>Tinggi (px)</label>
                <input className={inputCls} type="number" placeholder="auto" value={resizeHeight} onChange={e => setResizeHeight(e.target.value)} /></div>
            </div>
            <button onClick={() => setResizeLock(!resizeLock)}
              className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${resizeLock
                ? 'bg-red-600/10 border-red-500/30 text-red-500' : isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
              {resizeLock ? '🔒 Rasio dikunci' : '🔓 Rasio bebas'}
            </button>
          </div>
        );
      case 'QR_CODE':
        return (
          <div className="space-y-3">
            <div><label className={labelCls}>Konten QR</label>
              <textarea className={`${inputCls} resize-none`} rows={3} placeholder="URL, teks, nomor HP, dll..." value={qrContent} onChange={e => setQrContent(e.target.value)} /></div>
            <button onClick={handleQrPreview} disabled={!qrContent.trim()}
              className={`text-xs font-bold px-4 py-2 rounded-xl border transition-colors ${qrContent.trim() ? 'text-red-600 border-red-500/30 hover:bg-red-50 dark:hover:bg-red-900/20' : isDark ? 'text-gray-600 border-gray-800' : 'text-gray-300 border-gray-100'}`}>
              👁 Preview QR
            </button>
            {qrPreview && <img src={qrPreview} alt="QR Preview" className="w-32 h-32 rounded-xl border mx-auto block" />}
          </div>
        );
      case 'OCR':
        return ocrResult ? (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls}>Hasil OCR</label>
              <button onClick={() => navigator.clipboard.writeText(ocrResult).then(() => showToast('Teks disalin!'))}
                className="text-[10px] font-bold text-red-500 flex items-center gap-1"><Copy size={10} /> Salin</button>
            </div>
            <textarea readOnly className={`${inputCls} resize-none`} rows={6} value={ocrResult} />
          </div>
        ) : isProcessing && ocrProgress > 0 ? (
          <div className="mt-3">
            <div className="flex justify-between mb-1"><span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Memproses OCR...</span><span className="text-xs font-bold text-red-600">{ocrProgress}%</span></div>
            <div className={`w-full h-2 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div className="h-full bg-red-500 rounded-full transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
            </div>
          </div>
        ) : null;

      // ── STUDENT TOOLS ──────────────────────────────────────────────────────────
      case 'COVER_GENERATOR':
        return (
          <div className="space-y-2.5">
            {[
              ['Nama Universitas', coverData.uni, (v: string) => setCoverData(p => ({ ...p, uni: v })), 'Universitas Indonesia'],
              ['Judul Makalah *', coverData.title, (v: string) => setCoverData(p => ({ ...p, title: v })), 'Pengaruh AI Terhadap...'],
              ['Sub Judul', coverData.sub, (v: string) => setCoverData(p => ({ ...p, sub: v })), 'Opsional'],
              ['Nama Penulis *', coverData.author, (v: string) => setCoverData(p => ({ ...p, author: v })), 'Nama Lengkap'],
              ['NIM / NRP', coverData.id, (v: string) => setCoverData(p => ({ ...p, id: v })), '12345678'],
              ['Tahun', coverData.year, (v: string) => setCoverData(p => ({ ...p, year: v })), '2025'],
            ].map(([lbl, val, set, ph]: any) => (
              <div key={lbl}><label className={labelCls}>{lbl}</label>
                <input className={inputCls} placeholder={ph} value={val} onChange={e => set(e.target.value)} /></div>
            ))}
          </div>
        );
      case 'IPK_CALCULATOR': {
        const gradeMap: Record<string, number> = { 'A': 4, 'A-': 3.7, 'B+': 3.3, 'B': 3, 'B-': 2.7, 'C+': 2.3, 'C': 2, 'D': 1, 'E': 0 };
        const totalSks = ipkCourses.reduce((s, c) => s + (parseInt(c.credit) || 0), 0);
        const totalPt = ipkCourses.reduce((s, c) => s + ((gradeMap[c.grade] ?? 0) * (parseInt(c.credit) || 0)), 0);
        const ipkVal = totalSks ? (totalPt / totalSks).toFixed(2) : '—';
        return (
          <div className="space-y-3">
            {totalSks > 0 && (
              <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-red-900/20 border-red-800/50' : 'bg-red-50 border-red-100'}`}>
                <div className="text-2xl font-black text-red-600">{ipkVal}</div>
                <div className={`text-[10px] font-bold mt-0.5 ${isDark ? 'text-red-400' : 'text-red-400'}`}>{totalSks} SKS Total</div>
              </div>
            )}
            <div className="space-y-2">
              {ipkCourses.map((c, i) => (
                <div key={c.id} className={`flex items-center gap-2 p-2 rounded-xl border ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-100 bg-gray-50'}`}>
                  <span className="flex-1 text-xs font-medium truncate">{c.name}</span>
                  <span className="text-xs font-bold text-red-600">{c.grade}</span>
                  <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{c.credit} SKS</span>
                  <button onClick={() => setIpkCourses(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={12} /></button>
                </div>
              ))}
            </div>
            <div className={`p-3 rounded-xl border space-y-2 ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
              <div><label className={labelCls}>Mata Kuliah</label>
                <input className={inputCls} placeholder="Nama matkul..." value={ipkNew.name} onChange={e => setIpkNew(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls}>Nilai</label>
                  <select className={inputCls} value={ipkNew.grade} onChange={e => setIpkNew(p => ({ ...p, grade: e.target.value }))}>
                    {['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'E'].map(g => <option key={g}>{g}</option>)}
                  </select></div>
                <div><label className={labelCls}>SKS</label>
                  <input className={inputCls} type="number" min="1" max="6" value={ipkNew.sks} onChange={e => setIpkNew(p => ({ ...p, sks: e.target.value }))} /></div>
              </div>
              <button onClick={() => {
                if (!ipkNew.name.trim()) return;
                setIpkCourses(prev => [...prev, { id: Date.now().toString(), name: ipkNew.name, grade: ipkNew.grade, credit: ipkNew.sks }]);
                setIpkNew({ name: '', grade: 'A', sks: '3' });
              }} className="w-full py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5">
                <Plus size={13} /> Tambah Matkul
              </button>
            </div>
          </div>
        );
      }
      case 'PUSTAKA_GENERATOR':
        return (
          <div className="space-y-3">
            {pustakaEntries.length > 0 && (
              <div className="space-y-1.5">
                {pustakaEntries.map((e, i) => (
                  <div key={e.id} className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{e.author} ({e.year})</div>
                      <div className={`truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{e.title}</div>
                    </div>
                    <button onClick={() => setPustakaEntries(prev => prev.filter((_, j) => j !== i))} className="text-red-400 flex-shrink-0"><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className={`p-3 rounded-xl border space-y-2 ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
              {[['Nama Penulis', pustakaNew.author, (v: string) => setPustakaNew(p => ({ ...p, author: v })), 'Doe, J.'],
                ['Tahun', pustakaNew.year, (v: string) => setPustakaNew(p => ({ ...p, year: v })), '2024'],
                ['Judul', pustakaNew.title, (v: string) => setPustakaNew(p => ({ ...p, title: v })), 'Judul buku/artikel...'],
                ['Penerbit / Jurnal', pustakaNew.pub, (v: string) => setPustakaNew(p => ({ ...p, pub: v })), 'Gramedia / IEEE Journal']
              ].map(([lbl, val, set, ph]: any) => (
                <div key={lbl}><label className={labelCls}>{lbl}</label>
                  <input className={inputCls} placeholder={ph} value={val} onChange={e => set(e.target.value)} /></div>
              ))}
              <button onClick={() => {
                if (!pustakaNew.author || !pustakaNew.title) return;
                setPustakaEntries(prev => [...prev, { id: Date.now().toString(), ...pustakaNew, type: 'book' }]);
                setPustakaNew({ author: '', year: '', title: '', pub: '' });
              }} className="w-full py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5">
                <Plus size={13} /> Tambah Referensi
              </button>
            </div>
          </div>
        );
      case 'SURAT_GENERATOR':
        return (
          <div className="space-y-2.5">
            <div><label className={labelCls}>Jenis Surat</label>
              <div className="grid grid-cols-2 gap-2">
                {['IZIN', 'PERMOHONAN'].map(t => (
                  <button key={t} onClick={() => setSuratData(p => ({ ...p, type: t }))}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${suratData.type === t
                      ? 'bg-red-600 text-white border-red-600' : isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                    {t === 'IZIN' ? '🙏 Surat Izin' : '📝 Permohonan'}
                  </button>
                ))}
              </div>
            </div>
            {[['Nama Lengkap', 'name', suratData.name, 'Nama kamu...'],
              ['NIM / NRP', 'id', suratData.id, '12345678'],
              [suratData.type === 'IZIN' ? 'Alasan Tidak Hadir' : 'Keperluan / Permohonan', 'reason', suratData.reason, 'Sakit / keperluan keluarga...'],
              ['Tanggal', 'date', suratData.date, '']].map(([lbl, key, val, ph]: any) => (
              <div key={key}><label className={labelCls}>{lbl}</label>
                <input className={inputCls} type={key === 'date' ? 'date' : 'text'} placeholder={ph} value={val}
                  onChange={e => setSuratData(p => ({ ...p, [key]: e.target.value }))} /></div>
            ))}
          </div>
        );
      case 'WORD_COUNTER':
        return (
          <div className="space-y-3">
            <div><label className={labelCls}>Tempel Teks</label>
              <textarea className={`${inputCls} resize-none`} rows={6} placeholder="Tempel atau ketik teks di sini..."
                value={wordText} onChange={e => setWordText(e.target.value)} /></div>
            {wordText.trim() && (
              <div className="grid grid-cols-2 gap-2">
                {[['Kata', wordStats.words], ['Karakter', wordStats.chars],
                  ['Kalimat', wordStats.sentences], [`Baca ~${wordStats.readTime} mnt`, '']].map(([lbl, val]: any) => (
                  <div key={lbl} className={`p-2.5 rounded-xl border text-center ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="text-lg font-black text-red-600">{val}</div>
                    <div className={`text-[10px] font-bold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{lbl}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'LOREM_IPSUM':
        return (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Jumlah Paragraf: {loremCount}</label>
              <input type="range" min="1" max="20" value={loremCount} onChange={e => setLoremCount(Number(e.target.value))}
                className="w-full accent-red-600 mt-1" />
            </div>
            <div className={`p-3 rounded-xl border text-xs ${isDark ? 'border-gray-800 text-gray-500' : 'border-gray-100 text-gray-400'}`}>
              {loremCount} paragraf × ~60 kata = ~{loremCount * 60} kata
            </div>
          </div>
        );
      case 'COLOR_PICKER':
        return (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Pilih Warna</label>
              <div className="flex gap-3 items-center">
                <input type="color" value={pickedColor} onChange={e => setPickedColor(e.target.value)}
                  className="w-14 h-12 rounded-xl cursor-pointer border-0 p-0.5 bg-transparent" />
                <div className="flex-1 space-y-1.5">
                  {[['HEX', pickedColor], ['RGB', hexToRgb(pickedColor)], ['HSL', hexToHsl(pickedColor)]].map(([fmt, val]) => (
                    <button key={fmt} onClick={() => navigator.clipboard.writeText(val).then(() => { setCopiedColor(val); setTimeout(() => setCopiedColor(''), 2000); showToast(`${fmt} disalin!`); })}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${isDark ? 'border-gray-800 bg-gray-900 hover:border-gray-700' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                      <span className={`text-[10px] font-bold ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{fmt}</span>
                      <span>{val}</span>
                      {copiedColor === val ? <Check size={11} className="text-green-500" /> : <Copy size={11} className={isDark ? 'text-gray-600' : 'text-gray-300'} />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 h-10 rounded-xl border" style={{ backgroundColor: pickedColor }} />
            </div>
          </div>
        );
      // ── AI TOOLS ───────────────────────────────────────────────────────────────
      case 'AI_SUMMARIZER':
        return (
          <div className="space-y-4 mt-1">
            {/* AI badge */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
              ${isDark ? 'bg-purple-900/40 text-purple-400 border border-purple-800/50' : 'bg-purple-50 text-purple-600 border border-purple-100'}`}>
              <Sparkles size={10} /> Powered by Groq LLaMA 3.3 70B
            </div>
            {/* Result display */}
            {aiLoading && (
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className={`text-xs font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>AI sedang merangkum jurnal...</span>
                </div>
              </div>
            )}
            {aiResult && !aiLoading && (
              <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-purple-800/40 bg-purple-900/10' : 'border-purple-100 bg-purple-50/50'}`}>
                <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isDark ? 'border-purple-800/40 bg-purple-900/20' : 'border-purple-100 bg-purple-100/60'}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-500 flex items-center gap-1.5">
                    <Sparkles size={10} /> Hasil Ringkasan AI
                  </span>
                  <button onClick={copyAiResult}
                    className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors
                      ${aiCopied ? 'bg-green-500 text-white' : isDark ? 'bg-purple-900/40 text-purple-400 hover:bg-purple-900/60' : 'bg-white text-purple-600 hover:bg-purple-50'}`}>
                    {aiCopied ? <><Check size={10} /> Disalin!</> : <><Copy size={10} /> Salin</>}
                  </button>
                </div>
                <div className={`p-4 text-xs leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto
                  ${isDark ? 'text-gray-300' : 'text-gray-700'}
                  [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-purple-300`}>
                  {aiResult}
                </div>
              </div>
            )}
          </div>
        );

      case 'AI_PARAPHRASE':
        return (
          <div className="space-y-4 mt-1">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
              ${isDark ? 'bg-blue-900/40 text-blue-400 border border-blue-800/50' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
              <Sparkles size={10} /> AI Parafrase Anti-Plagiat
            </div>
            <div>
              <label className={labelCls}>Teks Asli <span className={`normal-case font-normal ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>(maks 5.000 karakter)</span></label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={6}
                placeholder="Tempel abstrak, paragraf, atau teks yang ingin diparafrase..."
                value={aiParaphraseText}
                onChange={e => setAiParaphraseText(e.target.value.slice(0, 5000))}
              />
              <div className={`text-right text-[10px] mt-1 ${aiParaphraseText.length > 4500 ? 'text-orange-500' : isDark ? 'text-gray-700' : 'text-gray-400'}`}>
                {aiParaphraseText.length}/5000
              </div>
            </div>
            {aiLoading && (
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className={`text-xs font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>AI sedang memparafrase...</span>
                </div>
              </div>
            )}
            {aiResult && !aiLoading && (
              <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-blue-800/40 bg-blue-900/10' : 'border-blue-100 bg-blue-50/50'}`}>
                <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isDark ? 'border-blue-800/40 bg-blue-900/20' : 'border-blue-100 bg-blue-100/60'}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-1.5">
                    <Sparkles size={10} /> Hasil Parafrase AI
                  </span>
                  <button onClick={copyAiResult}
                    className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors
                      ${aiCopied ? 'bg-green-500 text-white' : isDark ? 'bg-blue-900/40 text-blue-400 hover:bg-blue-900/60' : 'bg-white text-blue-600 hover:bg-blue-50'}`}>
                    {aiCopied ? <><Check size={10} /> Disalin!</> : <><Copy size={10} /> Salin</>}
                  </button>
                </div>
                <div className={`p-4 text-xs leading-relaxed whitespace-pre-wrap max-h-[350px] overflow-y-auto
                  ${isDark ? 'text-gray-300' : 'text-gray-700'}
                  [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-blue-300`}>
                  {aiResult}
                </div>
              </div>
            )}
          </div>
        );

      case 'AI_TITLE_GEN':
        return (
          <div className="space-y-4 mt-1">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
              ${isDark ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
              <Sparkles size={10} /> AI Generator Judul Skripsi
            </div>
            <div>
              <label className={labelCls}>Jurusan / Program Studi *</label>
              <input
                className={inputCls}
                placeholder="Contoh: Teknik Informatika, Manajemen, Psikologi..."
                value={aiTitleJurusan}
                onChange={e => setAiTitleJurusan(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Minat / Topik Penelitian <span className={`normal-case font-normal ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>(opsional)</span></label>
              <input
                className={inputCls}
                placeholder="Contoh: Machine Learning, UMKM, Kecemasan, IoT, Media Sosial..."
                value={aiTitleMinat}
                onChange={e => setAiTitleMinat(e.target.value)}
              />
            </div>
            {aiLoading && (
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className={`text-xs font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>AI sedang menganalisis dan membuat judul...</span>
                </div>
              </div>
            )}
            {aiResult && !aiLoading && (
              <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-emerald-800/40 bg-emerald-900/10' : 'border-emerald-100 bg-emerald-50/50'}`}>
                <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isDark ? 'border-emerald-800/40 bg-emerald-900/20' : 'border-emerald-100 bg-emerald-100/60'}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
                    <Sparkles size={10} /> 10 Ide Judul Skripsi
                  </span>
                  <button onClick={copyAiResult}
                    className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors
                      ${aiCopied ? 'bg-green-500 text-white' : isDark ? 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60' : 'bg-white text-emerald-600 hover:bg-emerald-50'}`}>
                    {aiCopied ? <><Check size={10} /> Disalin!</> : <><Copy size={10} /> Salin Semua</>}
                  </button>
                </div>
                <div className={`p-4 text-xs leading-relaxed whitespace-pre-wrap max-h-[450px] overflow-y-auto
                  ${isDark ? 'text-gray-300' : 'text-gray-700'}
                  [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-300`}>
                  {aiResult}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // ─── File Upload Area ─────────────────────────────────────────────────────────
  const renderUploadArea = () => {
    if (cfg.noFile) return null;
    const hasFiles = currentMode === 'PICTURE_TO_PDF' ? images.length > 0
      : currentMode === 'PDF_MERGER' ? multiFiles.length > 0
      : singleFile !== null;

    return (
      <div className="space-y-3">
        <input type="file" hidden multiple={cfg.multi} accept={cfg.accept} ref={fileInputRef} onChange={handleFileChange} />
        {!hasFiles ? (
          <button onClick={() => fileInputRef.current?.click()}
            className={`group w-full h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2.5 transition-all cursor-pointer
              ${isDark ? 'border-gray-800 hover:border-red-600/60 hover:bg-red-950/10 bg-gray-900/30'
                : 'border-gray-200 hover:border-red-400/60 hover:bg-red-50/50 bg-gray-50/50'}`}>
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:scale-110 transition-transform">
              <FileUp size={17} className="text-white" />
            </div>
            <div className="text-center">
              <p className={`text-xs font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{cfg.label}</p>
              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{cfg.accept || 'Semua format'}</p>
            </div>
          </button>
        ) : (
          <div className={`p-3 rounded-2xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-green-50 border-green-100'}`}>
            {currentMode === 'PICTURE_TO_PDF' ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{images.length} gambar dipilih</span>
                  <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold text-red-500 hover:text-red-600 flex items-center gap-1">
                    <Plus size={11} /> Tambah
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {images.map((img, i) => (
                    <div key={img.id} className="relative group">
                      <img src={img.src} alt="" className="w-full aspect-square object-cover rounded-lg" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                        <button onClick={() => setImages(prev => prev.filter(x => x.id !== img.id))} className="text-white"><X size={14} /></button>
                      </div>
                      <span className="absolute bottom-0.5 left-0.5 text-[8px] font-black text-white bg-black/50 px-1 rounded">{i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : currentMode === 'PDF_MERGER' ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{multiFiles.length} file dipilih</span>
                  <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold text-red-500 flex items-center gap-1"><Plus size={11} /> Tambah</button>
                </div>
                {multiFiles.map((f, i) => (
                  <div key={i} className={`flex items-center gap-2 py-1.5 text-xs ${i < multiFiles.length - 1 ? (isDark ? 'border-b border-gray-800' : 'border-b border-gray-100') : ''}`}>
                    <span className="font-bold text-red-600 w-5 text-center">{i + 1}</span>
                    <span className="flex-1 truncate font-medium">{f.name}</span>
                    <button onClick={() => setMultiFiles(prev => prev.filter((_, j) => j !== i))} className="text-red-400"><X size={12} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={16} className="text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{singleFile!.name}</p>
                  <p className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{(singleFile!.size / 1024).toFixed(0)} KB</p>
                </div>
                <button onClick={() => { setSingleFile(null); setOrganizerLoaded(false); setOrganizerPages([]); }}
                  className={`p-1.5 rounded-lg ${isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}><X size={14} /></button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── MAIN RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-200 ${isDark ? 'bg-[#060912] text-gray-100' : 'bg-[#f0f2f8] text-gray-900'}`}>

      {/* ── Toast ──────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-24 lg:bottom-6 right-4 z-[200] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl text-sm font-bold transition-all
          ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* ── Login Modal ──────────────────────────────────────────────────────────── */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className={`w-full max-w-sm rounded-3xl border shadow-2xl p-7 relative ${isDark ? 'bg-[#0C101C] border-gray-800' : 'bg-white border-gray-200'}`}>
            <button onClick={() => { setShowLoginModal(false); resetLoginForm(); }}
              className={`absolute top-4 right-4 p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`}><X size={15} /></button>
            <div className="flex items-center gap-2 mb-5">
              <div className="bg-red-600 p-1.5 rounded-xl shadow-lg shadow-red-600/30"><Zap size={14} className="text-white fill-current" /></div>
              <span className="text-sm font-black italic uppercase tracking-tighter">ANAK <span className="text-red-600">KAMPUS</span></span>
            </div>
            <h2 className="text-base font-black uppercase mb-1">{loginMode === 'login' ? 'Masuk Akun' : 'Buat Akun'}</h2>
            <p className={`text-[11px] mb-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {loginMode === 'login' ? 'Login untuk akses Premium 500 download' : 'Daftar gratis, upgrade kapan saja'}
            </p>
            <div className={`flex rounded-xl p-1 mb-5 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
              {(['login', 'register'] as const).map(m => (
                <button key={m} onClick={() => { setLoginMode(m); setLoginError(''); setLoginSuccess(''); }}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${loginMode === m ? 'bg-red-600 text-white shadow' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {m === 'login' ? 'Masuk' : 'Daftar'}
                </button>
              ))}
            </div>
            <div className="space-y-2.5">
              <div className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border transition-colors focus-within:border-red-500 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <UserCircle size={14} className="text-gray-400 flex-shrink-0" />
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Email kamu" className="flex-1 bg-transparent outline-none text-sm font-medium placeholder-gray-400" />
              </div>
              <div className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border transition-colors focus-within:border-red-500 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <Lock size={14} className="text-gray-400 flex-shrink-0" />
                <input type={showPass ? 'text' : 'password'} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLoginSubmit()} placeholder="Password" className="flex-1 bg-transparent outline-none text-sm font-medium placeholder-gray-400" />
                <button onClick={() => setShowPass(!showPass)} className="text-gray-400">{showPass ? <EyeOff size={14} /> : <Eye size={14} />}</button>
              </div>
              {loginError && <p className="text-red-500 text-[11px] font-bold bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl flex items-center gap-1.5"><AlertCircle size={12} />{loginError}</p>}
              {loginSuccess && <p className="text-green-600 text-[11px] font-bold bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-xl flex items-center gap-1.5"><CheckCircle2 size={12} />{loginSuccess}</p>}
              <button onClick={handleLoginSubmit} disabled={loginLoading}
                className={`w-full py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 ${loginLoading ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-red-600 text-white shadow-lg shadow-red-600/30 hover:scale-[1.02] active:scale-95'}`}>
                {loginLoading ? <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Memproses...</> : <>{loginMode === 'login' ? 'Masuk & Lanjut' : 'Buat Akun'}<ArrowRight size={13} /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar Overlay ────────────────────────────────────────────────────── */}
      {isSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
      <aside className={`flex-shrink-0 flex flex-col h-full z-50 w-64 border-r transition-all duration-300 ease-in-out
        ${isDark
          ? 'bg-gradient-to-b from-[#0a0e1a] via-[#0C101C] to-[#080b16] border-gray-800/60'
          : 'bg-gradient-to-b from-white via-white to-gray-50/80 border-gray-200/80 shadow-xl shadow-gray-200/50'}
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative inset-y-0 left-0`}>

        {/* Logo */}
        <div className={`flex-shrink-0 px-5 pt-6 pb-5 flex items-center gap-3 border-b
          ${isDark ? 'border-gray-800/60' : 'border-gray-100'}`}>
          <div className="relative">
            <div className="absolute inset-0 bg-red-600 rounded-xl blur-md opacity-50" />
            <div className="relative bg-gradient-to-br from-red-500 to-red-700 p-2 rounded-xl shadow-lg shadow-red-600/40">
              <Zap size={16} className="text-white fill-current" />
            </div>
          </div>
          <div>
            <span className="text-sm font-black italic uppercase tracking-tighter leading-none">
              ANAK <span className="text-red-500">KAMPUS</span>
            </span>
            <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Tools Mahasiswa</p>
          </div>
        </div>

        {/* Nav — ONLY this scrolls */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-5
          [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:transparent
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700">
          {MENU_GROUPS.map(group => (
            <div key={group.label}>
              <p className={`text-[9px] font-black uppercase tracking-widest px-2 mb-2 flex items-center gap-2
                ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                <span className="w-3 h-px bg-current rounded-full" />
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <button key={item.id} onClick={() => { setCurrentMode(item.id); resetState(); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-[11px] transition-all duration-150 group/item
                      ${currentMode === item.id
                        ? isDark
                          ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-600/30'
                          : 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25'
                        : isDark
                          ? 'text-gray-500 hover:bg-white/5 hover:text-gray-200'
                          : 'text-gray-500 hover:bg-gray-100/80 hover:text-gray-700'}`}>
                    <span className={`flex-shrink-0 transition-transform duration-150 ${currentMode === item.id ? 'scale-110' : 'group-hover/item:scale-105'}`}>
                      {getIcon(item.icon, 13)}
                    </span>
                    <span className="truncate">{item.name}</span>
                    {currentMode === item.id && <ChevronRight size={11} className="ml-auto opacity-70 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom — fixed, never scrolls */}
        <div className={`flex-shrink-0 p-3 border-t ${isDark ? 'border-gray-800/60' : 'border-gray-100'}`}>
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200
              ${isDark
                ? 'bg-white/5 hover:bg-white/10 text-gray-400 border border-gray-800/60'
                : 'bg-gray-100/80 hover:bg-gray-200/80 text-gray-600 border border-transparent'}`}>
            <span className="text-[9px] font-black uppercase tracking-widest">{isDark ? 'Mode Gelap' : 'Mode Terang'}</span>
            {isDark ? <Moon size={14} className="text-blue-400" /> : <Sun size={14} className="text-orange-400" />}
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className={`flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b backdrop-blur-xl z-30
          ${isDark ? 'bg-[#060912]/90 border-gray-800/60' : 'bg-white/90 border-gray-200/60 shadow-sm'}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`lg:hidden p-2 rounded-xl border transition-colors ${isDark ? 'border-gray-800 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              <Menu size={16} />
            </button>
            <div className="hidden lg:block w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
            <div>
              <h1 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                <span className="lg:hidden">{currentItem?.name ?? currentMode.replace(/_/g, ' ')}</span>
                <span className="hidden lg:inline">{currentItem?.name ?? currentMode.replace(/_/g, ' ')}</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5">
              <div className={`w-28 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <div className={`h-full rounded-full transition-all duration-700 ${isPremium ? 'bg-gradient-to-r from-orange-400 to-red-500' : quotaFull ? 'bg-red-600' : 'bg-red-500'}`} style={{ width: `${quotaPct}%` }} />
              </div>
              <span className={`text-[10px] font-black ${quotaFull ? 'text-red-500' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>{downloadCount}/{MAX_QUOTA}</span>
              {isPremium && <span className="text-[9px] font-black text-orange-500 bg-orange-50 dark:bg-orange-900/30 px-1.5 py-0.5 rounded-full">PRO</span>}
            </div>
            {isLoggedIn ? (
              <div className="flex items-center gap-1.5">
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold max-w-[130px] truncate
                  ${isDark ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-white border-gray-200 text-gray-700'}`}>
                  {isPremium ? <Crown size={12} className="text-orange-500 fill-current flex-shrink-0" /> : <UserCircle size={12} className="text-gray-400 flex-shrink-0" />}
                  <span className="truncate text-[11px]">{profile?.email?.split('@')[0]}</span>
                </div>
                <button onClick={handleLogout} className={`p-2 rounded-xl border transition-colors ${isDark ? 'bg-gray-900 border-gray-800 text-gray-400 hover:text-red-400' : 'bg-white border-gray-200 text-gray-400 hover:text-red-500'}`}><LogOut size={13} /></button>
              </div>
            ) : (
              <button onClick={() => openLoginModal('login')} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-colors ${isDark ? 'bg-gray-900 border-gray-800 text-gray-300 hover:border-red-500/50' : 'bg-white border-gray-200 text-gray-700 hover:border-red-400/50'}`}>
                <UserCircle size={13} /> Login
              </button>
            )}
          </div>
        </header>

        {/* Content — ONLY this area scrolls */}
        <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-5 pb-28 lg:pb-8 max-w-4xl w-full mx-auto">

          {/* Premium Banner */}
          {!isPremium && (
            <button onClick={() => isLoggedIn ? router.push('/upgrade') : openLoginModal('login')}
              className="w-full mb-5 group relative overflow-hidden rounded-2xl p-4 text-left transition-transform hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: 'linear-gradient(135deg, #dc2626, #ea580c)' }}>
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-500" />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="bg-white/20 p-2 rounded-xl"><Crown size={16} className="text-white fill-current" /></div>
                  <div>
                    <p className="text-white font-black text-sm">Upgrade Premium</p>
                    <p className="text-white/70 text-[10px]">500 download • Reset 15 hari • Rp 15.000 lifetime</p>
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-xl text-white text-[10px] font-black">
                  {isLoggedIn ? 'Upgrade' : 'Login'} <ArrowRight size={11} />
                </div>
              </div>
            </button>
          )}

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Left: Tool UI */}
            <div className="lg:col-span-3 space-y-4">
              <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#0C101C]/90 border-gray-800/60 shadow-xl shadow-black/30' : 'bg-white border-gray-100 shadow-md shadow-gray-200/60'}`}>
                <p className={`text-[9px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                  <span className="w-1 h-3 rounded-full bg-red-600 inline-block" />
                  {cfg.label}
                </p>
                {renderUploadArea()}
                {renderModeUI()}
              </div>

              {/* Tips */}
              <div className={`p-3.5 rounded-2xl border flex gap-2.5 ${isDark ? 'bg-gray-900/30 border-gray-800' : 'bg-amber-50 border-amber-100'}`}>
                <span className="text-base flex-shrink-0 mt-0.5">💡</span>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-gray-500' : 'text-amber-700'}`}>{cfg.tip}</p>
              </div>
            </div>

            {/* Right: Action Panel */}
            <div className="lg:col-span-2 space-y-3">
              {/* Quota Card */}
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#0C101C]/90 border-gray-800/60 shadow-xl shadow-black/30' : 'bg-white border-gray-100 shadow-md shadow-gray-200/60'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Kuota Download</span>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isPremium ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-500'}`}>
                    {isPremium ? '⭐ Premium' : 'Gratis'}
                  </span>
                </div>
                <div className={`w-full h-2 rounded-full overflow-hidden mb-1.5 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
                  <div className={`h-full rounded-full transition-all duration-700 ${isPremium ? 'bg-gradient-to-r from-orange-400 to-red-500' : quotaFull ? 'bg-red-600' : 'bg-red-500'}`} style={{ width: `${quotaPct}%` }} />
                </div>
                <div className="flex justify-between">
                  <span className={`text-[10px] font-black ${quotaFull ? 'text-red-500' : 'text-red-600'}`}>{downloadCount}/{MAX_QUOTA}</span>
                  {!isPremium && <span className={`text-[9px] ${isDark ? 'text-gray-700' : 'text-gray-400'}`}>Reset tiap 15 hari</span>}
                </div>
              </div>

              {/* Action Button */}
              <button disabled={(!isReady() && !quotaFull) || isProcessing} onClick={handleMainAction}
                className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 relative overflow-hidden
                  ${quotaFull
                    ? 'bg-gradient-to-r from-orange-500 via-red-500 to-red-600 text-white shadow-xl shadow-red-500/40 hover:scale-[1.02] hover:shadow-red-500/50'
                    : isReady() && !isProcessing
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-xl shadow-red-600/35 hover:scale-[1.02] hover:shadow-red-600/50 active:scale-95'
                      : isDark ? 'bg-gray-800/60 text-gray-600 cursor-not-allowed border border-gray-800' : 'bg-gray-100 text-gray-300 cursor-not-allowed border border-gray-200'}`}>
                {isProcessing ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Memproses...</>
                ) : quotaFull ? (
                  <><Crown size={14} className="fill-current" /> Kuota Habis — Upgrade</>
                ) : (
                  <>{currentMode === 'OCR' ? <><ScanText size={14} /> Scan OCR</> : currentMode === 'QR_CODE' ? <><QrCode size={14} /> Buat QR</> : currentMode === 'WORD_COUNTER' ? <><CheckCircle2 size={14} /> Analisis</> : currentMode === 'AI_SUMMARIZER' ? <><Sparkles size={14} /> Ringkas dengan AI</> : currentMode === 'AI_PARAPHRASE' ? <><Sparkles size={14} /> Parafrase dengan AI</> : currentMode === 'AI_TITLE_GEN' ? <><Sparkles size={14} /> Generate Judul</> : <><Download size={14} /> Proses & Unduh</>}</>
                )}
              </button>

              {/* Reset Button */}
              {(singleFile || images.length > 0 || multiFiles.length > 0 || ocrResult || organizerLoaded || wordText || aiResult || aiParaphraseText) && (
                <button onClick={resetState} className={`w-full py-2.5 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 ${isDark ? 'text-gray-600 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'}`}>
                  <Trash2 size={11} /> Reset
                </button>
              )}

              {/* Info Card */}
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-white/[0.02] border-gray-800/60' : 'bg-gray-50/80 border-gray-100'}`}>
                <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-gray-700' : 'text-gray-400'}`}>Cara Pakai</p>
                <div className="space-y-1.5">
                  {[
                    cfg.noFile ? 'Isi form yang tersedia' : `Upload ${cfg.multi ? 'beberapa file' : 'satu file'}`,
                    'Klik tombol proses di atas',
                    'File langsung terunduh otomatis',
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-red-600/20 text-red-600 text-[9px] font-black flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </main>

      {/* ── Mobile Bottom Nav ─────────────────────────────────────────────────── */}
      <nav className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t backdrop-blur-xl
        ${isDark ? 'bg-[#060912]/95 border-gray-800' : 'bg-white/95 border-gray-200'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch overflow-x-auto scrollbar-none">
          {MENU_GROUPS.map(group => {
            const isActive = group.items.some(i => i.id === currentMode);
            return (
              <button key={group.label} onClick={() => {
                const firstItem = group.items[0];
                setCurrentMode(firstItem.id); resetState(); setIsSidebarOpen(false);
              }}
                className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 py-2.5 px-1 relative transition-colors
                  ${isActive ? 'text-red-600' : isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-red-600 rounded-full" />}
                <span className="text-base">{group.label === 'Konversi' ? '🔄' : group.label === 'PDF Tools' ? '📄' : group.label === 'Gambar' ? '🖼️' : group.label === 'AI Tools' ? '🤖' : group.label === 'Mahasiswa' ? '🎓' : group.label === 'Teks & Warna' ? '✏️' : '✨'}</span>
                <span className="text-[8px] font-black uppercase tracking-wider truncate w-full text-center leading-tight">{group.label}</span>
              </button>
            );
          })}
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`flex-shrink-0 flex flex-col items-center gap-0.5 py-2.5 px-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            {isDark ? <Moon size={17} className="text-blue-400" /> : <Sun size={17} className="text-orange-400" />}
            <span className="text-[8px] font-black uppercase">Tema</span>
          </button>
        </div>
      </nav>
    </div>
  );
}