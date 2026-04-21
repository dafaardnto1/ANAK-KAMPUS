"use client";
import { useState, useRef, useEffect } from 'react';
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
  Stamp, Lock, QrCode, ScanText, Plus, X,
  Hash, Info, Settings2, RotateCw, Table,
  Images, PenLine, LogOut, UserCircle,
  Eye, EyeOff, ArrowRight, Sparkles,
  Shrink, FileType, Maximize, GraduationCap,
  Calculator, BookOpen, CaseSensitive, Quote,
  Palette, Type, Clipboard, FileSignature
} from 'lucide-react';

interface ImageItem { id: string; src: string; name: string; rotation: number; }
interface PageItem  { index: number; rotation: number; deleted: boolean; }
interface IpkCourse { id: string; name: string; grade: string; credit: string; }
interface PustakaEntry { id: string; author: string; year: string; title: string; pub: string; type: string; }

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted]             = useState(false);
  const [profile, setProfile]             = useState<Profile | null>(null);
  const [localCount, setLocalCount]       = useState(0);

  // Login modal states
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMode, setLoginMode]           = useState<'login'|'register'>('login');
  const [loginEmail, setLoginEmail]         = useState('');
  const [loginPassword, setLoginPassword]   = useState('');
  const [loginError, setLoginError]         = useState('');
  const [loginSuccess, setLoginSuccess]     = useState('');
  const [loginLoading, setLoginLoading]     = useState(false);
  const [showPass, setShowPass]             = useState(false);

  const { setTheme, resolvedTheme }         = useTheme();
  const [currentMode, setCurrentMode]       = useState('PICTURE_TO_PDF');
  const [images, setImages]                 = useState<ImageItem[]>([]);
  const [singleFile, setSingleFile]         = useState<File | null>(null);
  const [multiFiles, setMultiFiles]         = useState<File[]>([]);
  const [isSidebarOpen, setIsSidebarOpen]   = useState(false);
  const [mobileCategory, setMobileCategory] = useState<string | null>(null);
  const [isProcessing, setIsProcessing]     = useState(false);
  const [ocrResult, setOcrResult]           = useState('');
  const [ocrProgress, setOcrProgress]       = useState(0);

  const [splitFrom, setSplitFrom]             = useState('');
  const [splitTo, setSplitTo]                 = useState('');
  const [watermarkText, setWatermarkText]     = useState('');
  const [pdfPassword, setPdfPassword]         = useState('');
  const [qrContent, setQrContent]             = useState('');
  const [qrPreview, setQrPreview]             = useState('');
  const [pageNumberPos, setPageNumberPos]     = useState<'bottom-center'|'bottom-right'|'bottom-left'>('bottom-center');
  const [pageNumberStart, setPageNumberStart] = useState('1');
  const [metaTitle, setMetaTitle]             = useState('');
  const [metaAuthor, setMetaAuthor]           = useState('');
  const [metaSubject, setMetaSubject]         = useState('');
  const [metaKeywords, setMetaKeywords]       = useState('');
  const [organizerPages, setOrganizerPages]   = useState<PageItem[]>([]);
  const [organizerLoaded, setOrganizerLoaded] = useState(false);
  const [sigFile, setSigFile]                 = useState<File | null>(null);
  const [sigPage, setSigPage]                 = useState('1');
  const [sigX, setSigX]                       = useState('50');
  const [sigY, setSigY]                       = useState('50');
  const [sigWidth, setSigWidth]               = useState('150');

  // ─── NEW FEATURES STATES ──────────────────────────────────────────────────
  // Image Tools
  const [compressQuality, setCompressQuality] = useState(80);
  const [targetFormat, setTargetFormat]       = useState('jpeg');
  const [resizeWidth, setResizeWidth]         = useState('1080');
  const [resizeHeight, setResizeHeight]       = useState('');
  const [resizeLock, setResizeLock]           = useState(true);

  // Student Tools
  const [coverData, setCoverData]             = useState({ title: '', sub: '', author: '', id: '', uni: '', year: new Date().getFullYear().toString() });
  const [ipkCourses, setIpkCourses]           = useState<IpkCourse[]>([]);
  const [pustakaEntries, setPustakaEntries]   = useState<PustakaEntry[]>([]);
  const [suratData, setSuratData]             = useState({ type: 'IZIN', name: '', id: '', reason: '', date: '' });

  // Text Tools
  const [wordText, setWordText]               = useState('');
  const [loremCount, setLoremCount]           = useState(3);
  const [pickedColor, setPickedColor]         = useState('#EF4444');

  // Temporary States for Inputs
  const [ipkNew, setIpkNew] = useState({ name: '', grade: 'A', sks: '3' });
  const [pustakaNew, setPustakaNew] = useState({ author: '', year: '', title: '', pub: '' });

  const fileInputRef      = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef       = useRef<HTMLInputElement>(null);

  // ─── DERIVED ────────────────────────────────────────────────────────────────
  const isLoggedIn    = profile !== null;
  const isPremium     = profile?.is_premium ?? false;
  const MAX_QUOTA     = isPremium ? 500 : 30;
  const LOCAL_KEY     = 'anak_kampus_quota';
  const downloadCount = isLoggedIn ? (profile?.download_count ?? 0) : localCount;
  const quotaFull     = downloadCount >= MAX_QUOTA;

  // ─── INIT ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(LOCAL_KEY);
    if (saved) setLocalCount(parseInt(saved));
    checkSession();
  }, []);

  const checkSession = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await loadProfile(user.id);
        await checkReset(user.id);
      }
    } catch (e) {
      console.warn('Supabase session check failed (offline mode):', e);
    }
  };

  const loadProfile = async (userId: string) => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (data) setProfile(data);
    } catch (e) {
      console.warn('Failed to load profile:', e);
    }
  };

  const checkReset = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles').select('last_reset, is_premium').eq('id', userId).single();
      if (!data) return;
      const diffDays = Math.floor(
        (new Date().getTime() - new Date(data.last_reset).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (!data.is_premium && diffDays >= 15) {
        await supabase.from('profiles')
          .update({ download_count: 0, last_reset: new Date().toISOString() })
          .eq('id', userId);
        await loadProfile(userId);
      }
    } catch (e) {
      console.warn('Failed to check reset:', e);
    }
  };

  // ─── AUTH ────────────────────────────────────────────────────────────────────
  const handleLoginSubmit = async () => {
    if (!loginEmail || !loginPassword) { setLoginError('Isi email dan password!'); return; }
    setLoginLoading(true); setLoginError(''); setLoginSuccess('');
    try {
      if (loginMode === 'register') {
        const { error } = await supabase.auth.signUp({ email: loginEmail, password: loginPassword });
        if (error) throw error;
        setLoginSuccess('Cek email untuk konfirmasi akun!');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail, password: loginPassword
        });
        if (error) throw error;
        if (data.user) {
          await loadProfile(data.user.id);
          await checkReset(data.user.id);
        }
        setShowLoginModal(false);
        resetLoginForm();
        // Setelah login langsung ke upgrade
        router.push('/upgrade');
      }
    } catch (e: any) {
      setLoginError(e.message || 'Terjadi error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Logout error:', e);
    }
    setProfile(null);
  };

  const resetLoginForm = () => {
    setLoginEmail(''); setLoginPassword('');
    setLoginError(''); setLoginSuccess('');
    setShowPass(false);
  };

  const openLoginModal = (mode: 'login'|'register' = 'login') => {
    setLoginMode(mode);
    resetLoginForm();
    setShowLoginModal(true);
  };

  // ─── FINALIZE ────────────────────────────────────────────────────────────────
  const finalizeProcess = async () => {
    if (isLoggedIn && profile) {
      const newCount = (profile.download_count ?? 0) + 1;
      try {
        await supabase.from('profiles').update({ download_count: newCount }).eq('id', profile.id);
      } catch (e) {
        console.warn('Failed to update download count:', e);
      }
      setProfile(prev => prev ? { ...prev, download_count: newCount } : null);
    } else {
      const newCount = localCount + 1;
      setLocalCount(newCount);
      localStorage.setItem(LOCAL_KEY, newCount.toString());
    }
    setImages([]); setSingleFile(null); setMultiFiles([]);
  };

  if (!mounted) return null;
  const isDark = resolvedTheme === 'dark';

  // ─── MENU ────────────────────────────────────────────────────────────────────
  const menuGroups = [
    {
      label: 'Konversi',
      items: [
        { id: 'PICTURE_TO_PDF',  name: 'Picture to PDF',       icon: <FileImage size={15}/> },
        { id: 'WORD_TO_PDF',     name: 'Word to PDF',          icon: <Layers size={15}/> },
        { id: 'PDF_TO_WORD',     name: 'PDF to Word',          icon: <FileText size={15}/> },
        { id: 'TO_EXCEL',        name: 'To Excel',             icon: <FileSpreadsheet size={15}/> },
        { id: 'PDF_TO_IMAGE',    name: 'PDF to Image',         icon: <Images size={15}/> },
        { id: 'IMAGE_TO_EXCEL',  name: 'Image to Excel (OCR)', icon: <Table size={15}/> },
      ]
    },
    {
      label: 'PDF Tools',
      items: [
        { id: 'PDF_MERGER',      name: 'PDF Merger',      icon: <Merge size={15}/> },
        { id: 'PDF_SPLITTER',    name: 'PDF Splitter',    icon: <Scissors size={15}/> },
        { id: 'PDF_COMPRESSOR',  name: 'PDF Compressor',  icon: <Minimize2 size={15}/> },
        { id: 'ADD_WATERMARK',   name: 'Add Watermark',   icon: <Stamp size={15}/> },
        { id: 'PROTECT_PDF',     name: 'Protect PDF',     icon: <Lock size={15}/> },
        { id: 'PAGE_NUMBERING',  name: 'Page Numbering',  icon: <Hash size={15}/> },
        { id: 'METADATA_EDITOR', name: 'Metadata Editor', icon: <Info size={15}/> },
        { id: 'PAGE_ORGANIZER',  name: 'Page Organizer',  icon: <Settings2 size={15}/> },
        { id: 'ADD_SIGNATURE',   name: 'Add Signature',   icon: <PenLine size={15}/> },
      ]
    },
    {
      label: 'Image Tools',
      items: [
        { id: 'IMAGE_COMPRESSOR', name: 'Kompres Gambar',   icon: <Shrink size={15}/> },
        { id: 'IMAGE_CONVERTER',  name: 'Format Converter', icon: <FileType size={15}/> },
        { id: 'IMAGE_RESIZER',    name: 'Resize Gambar',    icon: <Maximize size={15}/> },
      ]
    },
    {
      label: 'Student',
      items: [
        { id: 'COVER_GENERATOR',  name: 'Cover Makalah',     icon: <GraduationCap size={15}/> },
        { id: 'IPK_CALCULATOR',   name: 'Kalkulator IPK',   icon: <Calculator size={15}/> },
        { id: 'PUSTAKA_GENERATOR', name: 'Daftar Pustaka',   icon: <BookOpen size={15}/> },
        { id: 'SURAT_GENERATOR',  name: 'Surat Mahasiswa',  icon: <FileSignature size={15}/> },
      ]
    },
    {
      label: 'Text Tools',
      items: [
        { id: 'WORD_COUNTER',     name: 'Hitung Kata',      icon: <CaseSensitive size={15}/> },
        { id: 'LOREM_IPSUM',      name: 'Lorem Ipsum',      icon: <Type size={15}/> },
        { id: 'COLOR_PICKER',     name: 'Color Picker',     icon: <Palette size={15}/> },
      ]
    },
    {
      label: 'Ekstra',
      items: [
        { id: 'QR_CODE', name: 'QR Code Generator', icon: <QrCode size={15}/> },
        { id: 'OCR',     name: 'OCR Scan',           icon: <ScanText size={15}/> },
      ]
    }
  ];

  const modeConfig: Record<string, { accept: string; multi: boolean; label: string; tip: string }> = {
    PICTURE_TO_PDF:  { accept:"image/*",    multi:true,  label:"Upload gambar (bisa banyak)",         tip:"Urutan upload = urutan halaman PDF." },
    WORD_TO_PDF:     { accept:".docx",      multi:false, label:"Upload file .docx",                   tip:"Format tabel mungkin tidak terjaga." },
    PDF_TO_WORD:     { accept:".pdf",       multi:false, label:"Upload file .pdf",                    tip:"Kurang akurat untuk PDF berbasis scan/gambar." },
    TO_EXCEL:        { accept:".docx,.pdf", multi:false, label:"Upload .pdf atau .docx",              tip:"Cocok untuk dokumen teks berstruktur." },
    PDF_TO_IMAGE:    { accept:".pdf",       multi:false, label:"Upload file .pdf",                    tip:"Setiap halaman jadi JPG, didownload sebagai .zip." },
    IMAGE_TO_EXCEL:  { accept:"image/*",    multi:false, label:"Upload foto/screenshot tabel",        tip:"Foto terang & lurus = hasil lebih akurat." },
    PDF_MERGER:      { accept:".pdf",       multi:true,  label:"Upload beberapa PDF",                 tip:"Urutan di daftar = urutan merge." },
    PDF_SPLITTER:    { accept:".pdf",       multi:false, label:"Upload PDF yang mau dipotong",        tip:"Nomor halaman dimulai dari 1." },
    PDF_COMPRESSOR:  { accept:".pdf",       multi:false, label:"Upload PDF yang mau dikecilkan",      tip:"Kualitas diturunkan ke ~60% (lossy)." },
    ADD_WATERMARK:   { accept:".pdf",       multi:false, label:"Upload PDF",                          tip:"Watermark diagonal 20% opacity di tiap halaman." },
    PROTECT_PDF:     { accept:".pdf",       multi:false, label:"Upload PDF",                          tip:"Proteksi metadata. Enkripsi penuh butuh Acrobat." },
    PAGE_NUMBERING:  { accept:".pdf",       multi:false, label:"Upload PDF yang mau diberi nomor",    tip:"Nomor muncul di footer tiap halaman." },
    METADATA_EDITOR: { accept:".pdf",       multi:false, label:"Upload PDF yang mau diedit metadata", tip:"Author, judul, subjek, keyword bisa diubah." },
    PAGE_ORGANIZER:  { accept:".pdf",       multi:false, label:"Upload PDF untuk diatur halamannya",  tip:"Hapus atau putar halaman tertentu sebelum disimpan." },
    ADD_SIGNATURE:   { accept:".pdf",       multi:false, label:"Upload PDF untuk ditandatangani",     tip:"Gunakan PNG transparan untuk hasil terbaik." },
    QR_CODE:         { accept:"",          multi:false, label:"Tidak perlu upload file",             tip:"QR didownload sebagai PNG resolusi tinggi." },
    OCR:             { accept:"image/*",    multi:false, label:"Upload foto/screenshot teks",         tip:"Bahasa Indonesia & Inggris didukung." },
    
    // NEW
    IMAGE_COMPRESSOR: { accept:"image/*",   multi:false, label:"Upload gambar untuk dikompres",        tip:"Mendukung JPG, PNG, WebP." },
    IMAGE_CONVERTER:  { accept:"image/*",   multi:false, label:"Upload gambar untuk dikonversi",       tip:"Hasil bisa diunduh dalam berbagai format." },
    IMAGE_RESIZER:    { accept:"image/*",   multi:false, label:"Upload gambar untuk di-resize",        tip:"Masukkan lebar/tinggi dalam pixel." },
    COVER_GENERATOR:  { accept:"",          multi:false, label:"Isi form untuk buat cover",             tip:"Download langsung sebagai PDF A4." },
    IPK_CALCULATOR:   { accept:"",          multi:false, label:"Masukkan nilai matkul kamu",           tip:"IPK dihitung secara otomatis." },
    PUSTAKA_GENERATOR: { accept:"",          multi:false, label:"Input data sumber referensi",          tip:"Format APA otomatis siap copas." },
    SURAT_GENERATOR:  { accept:"",          multi:false, label:"Pilih template surat kamu",            tip:"PDF surat resmi mahasiswa." },
    WORD_COUNTER:     { accept:"",          multi:false, label:"Paste teks untuk dihitung",            tip:"Hitung kata, karakter, dan estimasi baca." },
    LOREM_IPSUM:      { accept:"",          multi:false, label:"Generate teks dummy",                  tip:"Atur jumlah paragraf yang dibutuhkan." },
    COLOR_PICKER:     { accept:"",          multi:false, label:"Pilih warna untuk desain",             tip:"Copy HEX, RGB, atau HSL dengan mudah." },
  };

  // ─── RESET ───────────────────────────────────────────────────────────────────
  const resetState = () => {
    setImages([]); setSingleFile(null); setMultiFiles([]);
    setOcrResult(''); setOcrProgress(0);
    setSplitFrom(''); setSplitTo('');
    setWatermarkText(''); setPdfPassword('');
    setQrContent(''); setQrPreview('');
    setPageNumberStart('1'); setPageNumberPos('bottom-center');
    setMetaTitle(''); setMetaAuthor(''); setMetaSubject(''); setMetaKeywords('');
    setOrganizerPages([]); setOrganizerLoaded(false);
    setSigFile(null); setSigPage('1'); setSigX('50'); setSigY('50'); setSigWidth('150');
    
    setCompressQuality(80); setTargetFormat('jpeg');
    setResizeWidth('1080'); setResizeHeight(''); setResizeLock(true);
    setCoverData({ title: '', sub: '', author: '', id: '', uni: '', year: new Date().getFullYear().toString() });
    setIpkCourses([]); setPustakaEntries([]);
    setSuratData({ type: 'IZIN', name: '', id: '', reason: '', date: '' });
    setWordText(''); setLoremCount(3); setPickedColor('#EF4444');
    setIpkNew({ name: '', grade: 'A', sks: '3' });
    setPustakaNew({ author: '', year: '', title: '', pub: '' });
  };

  // ─── FILE HANDLERS ───────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isMulti = false) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (currentMode === 'PICTURE_TO_PDF') {
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => setImages(prev => [...prev, {
          id: Math.random().toString(), src: reader.result as string, name: file.name, rotation: 0
        }]);
        reader.readAsDataURL(file);
      });
    } else if (isMulti || currentMode === 'PDF_MERGER') {
      setMultiFiles(prev => [...prev, ...files]);
    } else {
      setSingleFile(files[0]);
      if (currentMode === 'PAGE_ORGANIZER') loadOrganizerPages(files[0]);
    }
  };

  const loadOrganizerPages = async (file: File) => {
    const doc   = await PDFDocument.load(await file.arrayBuffer());
    const count = doc.getPageCount();
    setOrganizerPages(Array.from({ length: count }, (_, i) => ({ index: i, rotation: 0, deleted: false })));
    setOrganizerLoaded(true);
  };

  // ─── CONVERTERS ──────────────────────────────────────────────────────────────
  const handlePictureToPdf = async () => {
    const pdf = new jsPDF();
    images.forEach((img, i) => {
      if (i > 0) pdf.addPage();
      pdf.addImage(img.src, 'JPEG', 10, 10, 190, 0, undefined, 'FAST', img.rotation);
    });
    pdf.save('ANAK_KAMPUS_IMG.pdf');
    await finalizeProcess();
  };

  const handleWordToPdf = async () => {
    const result = await mammoth.extractRawText({ arrayBuffer: await singleFile!.arrayBuffer() });
    const pdf    = new jsPDF();
    pdf.text(pdf.splitTextToSize(result.value, 180), 15, 15);
    pdf.save('ANAK_KAMPUS_WORD.pdf');
    await finalizeProcess();
  };

  const handlePdfToWord = async () => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    const pdf   = await pdfjsLib.getDocument({ data: await singleFile!.arrayBuffer() }).promise;
    const lines: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const txt = await (await pdf.getPage(i)).getTextContent();
      lines.push(...txt.items.map((x: any) => x.str));
    }
    const doc  = new Document({ sections: [{ children: lines.map(l => new Paragraph({ children: [new TextRun(l)] })) }] });
    saveBlob(await Packer.toBlob(doc), 'ANAK_KAMPUS_CONVERTED.docx');
  };

  const handleToExcel = async () => {
    let text = '';
    if (singleFile!.name.endsWith('.docx')) {
      text = (await mammoth.extractRawText({ arrayBuffer: await singleFile!.arrayBuffer() })).value;
    } else {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      const pdf = await pdfjsLib.getDocument({ data: await singleFile!.arrayBuffer() }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const c = await (await pdf.getPage(i)).getTextContent();
        text   += c.items.map((x: any) => x.str).join(' ') + '\n';
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(text.split('\n').map(l => [l])), 'Data');
    XLSX.writeFile(wb, 'ANAK_KAMPUS_EXCEL.xlsx');
    await finalizeProcess();
  };

  const handlePdfToImage = async () => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    const pdf = await pdfjsLib.getDocument({ data: await singleFile!.arrayBuffer() }).promise;
    const zip = new JSZip();
    for (let i = 1; i <= pdf.numPages; i++) {
      const page     = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas   = document.createElement('canvas');
      canvas.width   = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
      const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.92));
      zip.file(`halaman-${String(i).padStart(3,'0')}.jpg`, blob);
    }
    saveBlob(await zip.generateAsync({ type: 'blob' }), 'ANAK_KAMPUS_PAGES.zip');
  };

  const handleImageToExcel = async () => {
    setOcrProgress(0);
    const Tesseract = await import('tesseract.js');
    const result    = await (Tesseract as any).recognize(singleFile!, 'ind+eng', {
      logger: (m: any) => { if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100)); }
    });
    const rows = (result.data.text as string).split('\n').filter((l: string) => l.trim())
      .map((l: string) => l.split(/\s{2,}|\t/).map((c: string) => c.trim()).filter(Boolean));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'OCR Result');
    XLSX.writeFile(wb, 'ANAK_KAMPUS_OCR_TABLE.xlsx');
    await finalizeProcess();
  };

  const handlePdfMerger = async () => {
    const merged = await PDFDocument.create();
    for (const file of multiFiles) {
      const doc   = await PDFDocument.load(await file.arrayBuffer());
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    }
    saveBlob(new Blob([await merged.save()], { type: 'application/pdf' }), 'ANAK_KAMPUS_MERGED.pdf');
  };

  const handlePdfSplitter = async () => {
    const from = parseInt(splitFrom) - 1, to = parseInt(splitTo) - 1;
    if (isNaN(from) || isNaN(to) || from < 0 || to < from) { alert('Nomor halaman tidak valid!'); return; }
    const src    = await PDFDocument.load(await singleFile!.arrayBuffer());
    const newDoc = await PDFDocument.create();
    const pages  = await newDoc.copyPages(src, Array.from({ length: to - from + 1 }, (_, i) => from + i));
    pages.forEach(p => newDoc.addPage(p));
    saveBlob(new Blob([await newDoc.save()], { type: 'application/pdf' }), 'ANAK_KAMPUS_SPLIT.pdf');
  };

  const handlePdfCompressor = async () => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    const src    = await pdfjsLib.getDocument({ data: await singleFile!.arrayBuffer() }).promise;
    const newDoc = await PDFDocument.create();
    for (let i = 1; i <= src.numPages; i++) {
      const page     = await src.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      const canvas   = document.createElement('canvas');
      canvas.width   = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
      const imgBytes = await fetch(canvas.toDataURL('image/jpeg', 0.6)).then(r => r.arrayBuffer());
      const img      = await newDoc.embedJpg(imgBytes);
      const pdfPage  = newDoc.addPage([viewport.width, viewport.height]);
      pdfPage.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height });
    }
    saveBlob(new Blob([await newDoc.save()], { type: 'application/pdf' }), 'ANAK_KAMPUS_COMPRESSED.pdf');
  };

  const handleAddWatermark = async () => {
    if (!watermarkText.trim()) { alert('Isi teks watermark!'); return; }
    const doc  = await PDFDocument.load(await singleFile!.arrayBuffer());
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    doc.getPages().forEach(page => {
      const { width, height } = page.getSize();
      page.drawText(watermarkText, {
        x: width / 2 - watermarkText.length * 12, y: height / 2,
        size: 48, font, color: rgb(0.8, 0.1, 0.1), opacity: 0.2, rotate: degrees(45),
      });
    });
    saveBlob(new Blob([await doc.save()], { type: 'application/pdf' }), 'ANAK_KAMPUS_WATERMARKED.pdf');
  };

  const handleProtectPdf = async () => {
    if (!pdfPassword.trim()) { alert('Isi password!'); return; }
    alert('⚠️ Enkripsi PDF penuh membutuhkan server-side. File akan disimpan dengan metadata proteksi.');
    const doc = await PDFDocument.load(await singleFile!.arrayBuffer());
    doc.setTitle(`PROTECTED - ${singleFile!.name}`);
    doc.setAuthor('ANAK KAMPUS');
    doc.setSubject(`Password hint: ${pdfPassword[0]}${'*'.repeat(pdfPassword.length - 1)}`);
    saveBlob(new Blob([await doc.save()], { type: 'application/pdf' }), 'ANAK_KAMPUS_PROTECTED.pdf');
  };

  const handlePageNumbering = async () => {
    const startNum = parseInt(pageNumberStart) || 1;
    const doc      = await PDFDocument.load(await singleFile!.arrayBuffer());
    const font     = await doc.embedFont(StandardFonts.Helvetica);
    doc.getPages().forEach((page, i) => {
      const { width } = page.getSize();
      const label  = String(startNum + i);
      const tWidth = font.widthOfTextAtSize(label, 11);
      const x = pageNumberPos === 'bottom-center' ? (width - tWidth) / 2
              : pageNumberPos === 'bottom-right'  ? width - tWidth - 30 : 30;
      page.drawText(label, { x, y: 22, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
    });
    saveBlob(new Blob([await doc.save()], { type: 'application/pdf' }), 'ANAK_KAMPUS_NUMBERED.pdf');
  };

  const handleMetadataEditor = async () => {
    const doc = await PDFDocument.load(await singleFile!.arrayBuffer());
    if (metaTitle.trim())    doc.setTitle(metaTitle.trim());
    if (metaAuthor.trim())   doc.setAuthor(metaAuthor.trim());
    if (metaSubject.trim())  doc.setSubject(metaSubject.trim());
    if (metaKeywords.trim()) doc.setKeywords([metaKeywords.trim()]);
    doc.setProducer('ANAK KAMPUS'); doc.setCreator('ANAK KAMPUS');
    saveBlob(new Blob([await doc.save()], { type: 'application/pdf' }), 'ANAK_KAMPUS_EDITED.pdf');
  };

  const handlePageOrganizer = async () => {
    const src    = await PDFDocument.load(await singleFile!.arrayBuffer());
    const newDoc = await PDFDocument.create();
    const active = organizerPages.filter(p => !p.deleted);
    const copied = await newDoc.copyPages(src, active.map(p => p.index));
    copied.forEach((page, i) => {
      if (active[i].rotation !== 0) page.setRotation(degrees(active[i].rotation));
      newDoc.addPage(page);
    });
    saveBlob(new Blob([await newDoc.save()], { type: 'application/pdf' }), 'ANAK_KAMPUS_ORGANIZED.pdf');
  };

  const handleAddSignature = async () => {
    if (!sigFile) { alert('Upload gambar tanda tangan dulu!'); return; }
    const sigUint8  = new Uint8Array(await sigFile.arrayBuffer());
    const isPng     = sigFile.type === 'image/png' || sigFile.name.endsWith('.png');
    const doc       = await PDFDocument.load(await singleFile!.arrayBuffer());
    const sigImg    = isPng ? await doc.embedPng(sigUint8) : await doc.embedJpg(sigUint8);
    const pages     = doc.getPages();
    const pageIndex = Math.min(Math.max(parseInt(sigPage) - 1, 0), pages.length - 1);
    const page      = pages[pageIndex];
    const { height } = page.getSize();
    const w = parseInt(sigWidth) || 150;
    page.drawImage(sigImg, {
      x: parseInt(sigX) || 50,
      y: height - (parseInt(sigY) || 50) - (w * sigImg.height / sigImg.width),
      width: w, height: w * sigImg.height / sigImg.width
    });
    saveBlob(new Blob([await doc.save()], { type: 'application/pdf' }), 'ANAK_KAMPUS_SIGNED.pdf');
  };

  const handleOcr = async () => {
    setOcrResult(''); setOcrProgress(0);
    const Tesseract = await import('tesseract.js');
    const result = await (Tesseract as any).recognize(singleFile!, 'ind+eng', { logger: (m: any) => setOcrProgress(Math.round(m.progress * 100)) });
    setOcrResult(result.data.text);
    await finalizeProcess('OCR');
  };

  const handleImageCompressor = async () => {
    if (!singleFile) return;
    const img = new Image();
    img.src = URL.createObjectURL(singleFile);
    await new Promise(resolve => img.onload = resolve);
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    canvas.getContext('2d')?.drawImage(img, 0, 0);
    canvas.toBlob(async (blob) => {
      if (blob) {
        await saveBlob(blob, `compressed_${singleFile.name.split('.')[0]}.jpg`);
        await finalizeProcess('IMAGE_COMPRESSOR');
      }
    }, 'image/jpeg', compressQuality / 100);
  };

  const handleImageConverter = async () => {
    if (!singleFile) return;
    const img = new Image();
    img.src = URL.createObjectURL(singleFile);
    await new Promise(resolve => img.onload = resolve);
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    canvas.getContext('2d')?.drawImage(img, 0, 0);
    const mime = `image/${targetFormat === 'jpg' ? 'jpeg' : targetFormat}`;
    canvas.toBlob(async (blob) => {
      if (blob) {
        await saveBlob(blob, `converted_${singleFile.name.split('.')[0]}.${targetFormat}`);
        await finalizeProcess('IMAGE_CONVERTER');
      }
    }, mime, 0.9);
  };

  const handleImageResizer = async () => {
    if (!singleFile) return;
    const img = new Image();
    img.src = URL.createObjectURL(singleFile);
    await new Promise(resolve => img.onload = resolve);
    const canvas = document.createElement('canvas');
    const w = parseInt(resizeWidth) || img.width;
    const h = parseInt(resizeHeight) || (resizeLock ? (img.height * w) / img.width : img.height);
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
    canvas.toBlob(async (blob) => {
      if (blob) {
        await saveBlob(blob, `resized_${singleFile.name}`);
        await finalizeProcess('IMAGE_RESIZER');
      }
    }, singleFile.type, 0.9);
  };

  const handleCoverGenerator = async () => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22); doc.text(coverData.uni.toUpperCase(), 105, 40, { align: 'center' });
    doc.setFontSize(18); doc.text('MAKALAH', 105, 80, { align: 'center' });
    doc.setLineWidth(0.5); doc.line(40, 85, 170, 85);
    doc.setFontSize(16); doc.text(coverData.title.toUpperCase(), 105, 100, { align: 'center', maxWidth: 140 });
    if (coverData.sub) { doc.setFontSize(12); doc.setFont('helvetica', 'normal'); doc.text(coverData.sub, 105, 115, { align: 'center', maxWidth: 140 }); }
    doc.setFont('helvetica', 'bold'); doc.text('DISUSUN OLEH:', 105, 160, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.text(`${coverData.author}\n(${coverData.id})`, 105, 170, { align: 'center' });
    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text(coverData.year, 105, 250, { align: 'center' });
    doc.save(`Cover_${coverData.title.substring(0,10)}.pdf`);
    await finalizeProcess('COVER_GENERATOR');
  };

  const handleIpkCalculator = async () => {
    const doc = new jsPDF();
    const totalCredit = ipkCourses.reduce((sum, c) => sum + (parseInt(c.credit) || 0), 0);
    const gradeMap: any = { 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'E': 0 };
    const totalPoint = ipkCourses.reduce((sum, c) => sum + (gradeMap[c.grade] * (parseInt(c.credit) || 0)), 0);
    const ipk = totalCredit ? (totalPoint / totalCredit).toFixed(2) : '0.00';
    doc.setFontSize(20); doc.text('LAPORAN ESTIMASI IPK', 105, 20, { align: 'center' });
    doc.setFontSize(12); let y = 40;
    ipkCourses.forEach((c, i) => { doc.text(`${i+1}. ${c.name} - Grade: ${c.grade} (${c.credit} SKS)`, 20, y); y += 10; });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(`TOTAL IPK: ${ipk}`, 20, y + 10);
    doc.save('Estimasi_IPK.pdf');
    await finalizeProcess('IPK_CALCULATOR');
  };

  const handlePustakaGenerator = async () => {
    const content = pustakaEntries.map(e => `${e.author}. (${e.year}). ${e.title}. ${e.pub}.`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    await saveBlob(blob, 'Daftar_Pustaka.txt');
    await finalizeProcess('PUSTAKA_GENERATOR');
  };

  const handleSuratGenerator = async () => {
    const doc = new jsPDF();
    doc.setFontSize(14); doc.setFont('times', 'bold');
    doc.text('SURAT KETERANGAN MAHASISWA', 105, 30, { align: 'center' });
    doc.setFont('times', 'normal'); doc.setFontSize(12);
    const text = suratData.type === 'IZIN' 
      ? `Saya yang bertanda tangan di bawah ini:\n\nNama: ${suratData.name}\nNIM: ${suratData.id}\n\nMenyatakan bahwa saya tidak dapat mengikuti perkuliahan pada tanggal ${suratData.date} dikarenakan ${suratData.reason}.\n\nDemikian surat ini saya buat dengan sebenar-benarnya.`
      : `Kepada Yth. Bagian Akademik,\n\nSaya ${suratData.name} (NIM: ${suratData.id}) memohon untuk ${suratData.reason}.\n\nTerima kasih atas perhatiannya.`;
    doc.text(doc.splitTextToSize(text, 170), 20, 50);
    doc.text(`Bekasi, ${new Date().toLocaleDateString('id-ID')}\n\n\n\n( ${suratData.name} )`, 130, 150);
    doc.save(`Surat_${suratData.type}.pdf`);
    await finalizeProcess('SURAT_GENERATOR');
  };

  const handleWordCounter = async () => {
    const blob = new Blob([`Statistik Teks:\n\n${wordText}\n\nKata: ${wordText.trim().split(/\s+/).length}\nKarakter: ${wordText.length}`], { type: 'text/plain' });
    await saveBlob(blob, 'Statistik_Teks.txt');
    await finalizeProcess('WORD_COUNTER');
  };

  const handleLoremIpsum = async () => {
    const dummy = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ";
    const content = Array(loremCount).fill(dummy).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    await saveBlob(blob, 'Lorem_Ipsum.txt');
    await finalizeProcess('LOREM_IPSUM');
  };

  const handleColorPicker = async () => {
    await navigator.clipboard.writeText(pickedColor);
    alert(`Warna ${pickedColor} berhasil disalin ke clipboard!`);
    await finalizeProcess('COLOR_PICKER');
  };

  const handleQrCode = async () => {
    if (!qrContent.trim()) { alert('Isi konten QR!'); return; }
    const url  = await QRCode.toDataURL(qrContent, { width: 400, margin: 2 });
    const link = document.createElement('a');
    link.href  = url; link.download = 'ANAK_KAMPUS_QR.png'; link.click();
    await finalizeProcess();
  };

  const handleQrPreview = async () => {
    if (!qrContent.trim()) return;
    setQrPreview(await QRCode.toDataURL(qrContent, { width: 200, margin: 2 }));
  };

  // ─── DISPATCHER ──────────────────────────────────────────────────────────────
  const handleMainAction = async () => {
    if (quotaFull) { openLoginModal('login'); return; }
    setIsProcessing(true);
    try {
      const map: Record<string, () => Promise<void>> = {
        PICTURE_TO_PDF: handlePictureToPdf, WORD_TO_PDF: handleWordToPdf,
        PDF_TO_WORD: handlePdfToWord,       TO_EXCEL: handleToExcel,
        PDF_TO_IMAGE: handlePdfToImage,     IMAGE_TO_EXCEL: handleImageToExcel,
        PDF_MERGER: handlePdfMerger,        PDF_SPLITTER: handlePdfSplitter,
        PDF_COMPRESSOR: handlePdfCompressor, ADD_WATERMARK: handleAddWatermark,
        PROTECT_PDF: handleProtectPdf,      PAGE_NUMBERING: handlePageNumbering,
        METADATA_EDITOR: handleMetadataEditor, PAGE_ORGANIZER: handlePageOrganizer,
        ADD_SIGNATURE: handleAddSignature,  QR_CODE: handleQrCode, OCR: handleOcr,
        IMAGE_COMPRESSOR: handleImageCompressor, IMAGE_CONVERTER: handleImageConverter, IMAGE_RESIZER: handleImageResizer,
        COVER_GENERATOR: handleCoverGenerator, IPK_CALCULATOR: handleIpkCalculator, PUSTAKA_GENERATOR: handlePustakaGenerator,
        SURAT_GENERATOR: handleSuratGenerator, WORD_COUNTER: handleWordCounter, LOREM_IPSUM: handleLoremIpsum,
        COLOR_PICKER: handleColorPicker,
      };
      await map[currentMode]?.();
    } catch (e) {
      console.error(e); alert('Terjadi error. Coba lagi!');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveBlob = async (blob: Blob, filename: string) => {
    const a = document.createElement('a');
    a.href  = URL.createObjectURL(blob);
    a.download = filename; a.click();
    await finalizeProcess();
  };

  const isReady = () => {
    if (currentMode === 'PICTURE_TO_PDF') return images.length > 0;
    if (currentMode === 'PDF_MERGER')     return multiFiles.length >= 2;
    if (currentMode === 'QR_CODE')        return qrContent.trim().length > 0;
    if (currentMode === 'PAGE_ORGANIZER') return organizerLoaded && organizerPages.some(p => !p.deleted);
    if (currentMode === 'ADD_SIGNATURE')  return singleFile !== null && sigFile !== null;
    if (['COVER_GENERATOR','IPK_CALCULATOR','PUSTAKA_GENERATOR','SURAT_GENERATOR','WORD_COUNTER','LOREM_IPSUM','COLOR_PICKER'].includes(currentMode)) return true;
    return singleFile !== null;
  };

  const cfg = modeConfig[currentMode];

  // ─── UI HELPERS ──────────────────────────────────────────────────────────────
  const Field = ({ label, value, onChange, placeholder, type = 'text' }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
  }) => (
    <div>
      <label className={`text-[9px] font-black uppercase tracking-widest block mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full px-4 py-3 rounded-2xl text-sm font-medium outline-none border duration-200 focus:border-red-500
          ${isDark ? 'bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'}`}/>
    </div>
  );

  const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`p-5 rounded-[2rem] border ${isDark ? 'bg-[#0B0F1A] border-gray-800' : 'bg-white border-gray-200'} ${className}`}>
      {children}
    </div>
  );

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className={`text-[9px] font-black uppercase tracking-widest mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{children}</p>
  );

  const DropZone = ({ onClick, label }: { onClick: () => void; label?: string }) => (
    <div onClick={onClick}
      className={`group h-52 rounded-[2.5rem] border-4 border-dashed flex flex-col items-center justify-center cursor-pointer duration-200 hover:border-red-500
        ${isDark ? 'bg-[#0B0F1A] border-gray-800 hover:bg-red-950/10' : 'bg-white border-gray-200 hover:bg-red-50/20'}`}>
      <div className="bg-red-600 p-4 rounded-2xl shadow-xl shadow-red-500/30 mb-3 text-white group-hover:scale-110 duration-200">
        <FileUp size={22}/>
      </div>
      <p className="font-black uppercase text-xs">{label ?? cfg.label}</p>
      <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{cfg.accept || 'no file needed'}</p>
    </div>
  );

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className={`flex min-h-screen duration-300 ${isDark ? 'bg-[#050810] text-gray-100' : 'bg-gray-50 text-gray-900'}`}>

      {/* ── LOGIN MODAL ───────────────────────────────────────────────────────── */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-[2.5rem] border shadow-2xl p-8 relative
            ${isDark ? 'bg-[#0B0F1A] border-gray-800' : 'bg-white border-gray-200'}`}>

            {/* CLOSE */}
            <button onClick={() => { setShowLoginModal(false); resetLoginForm(); }}
              className={`absolute top-5 right-5 p-2 rounded-xl duration-200
                ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X size={16}/>
            </button>

            {/* LOGO */}
            <div className="flex items-center gap-2.5 mb-6">
              <div className="bg-red-600 p-1.5 rounded-xl shadow-lg shadow-red-500/30">
                <Zap size={15} className="text-white fill-current"/>
              </div>
              <span className="text-sm font-black italic uppercase tracking-tighter">
                ANAK <span className="text-red-600">KAMPUS</span>
              </span>
            </div>

            <h2 className="text-base font-black uppercase tracking-tight mb-1">
              {loginMode === 'login' ? 'Masuk Akun' : 'Buat Akun'}
            </h2>
            <p className={`text-[11px] mb-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {loginMode === 'login'
                ? 'Login untuk lanjutkan ke Premium'
                : 'Daftar gratis, upgrade kapan saja'}
            </p>

            {/* TAB */}
            <div className={`flex rounded-2xl p-1 mb-5 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
              {(['login','register'] as const).map(m => (
                <button key={m} onClick={() => { setLoginMode(m); setLoginError(''); setLoginSuccess(''); }}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider duration-200
                    ${loginMode === m ? 'bg-red-600 text-white shadow-md' : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                  {m === 'login' ? 'Masuk' : 'Daftar'}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {/* EMAIL */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border duration-200 focus-within:border-red-500
                ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <UserCircle size={15} className="text-gray-400 flex-shrink-0"/>
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  placeholder="Email kamu"
                  className="flex-1 bg-transparent outline-none text-sm font-medium placeholder-gray-400"/>
              </div>

              {/* PASSWORD */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border duration-200 focus-within:border-red-500
                ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <Lock size={15} className="text-gray-400 flex-shrink-0"/>
                <input type={showPass ? 'text' : 'password'} value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLoginSubmit()}
                  placeholder="Password"
                  className="flex-1 bg-transparent outline-none text-sm font-medium placeholder-gray-400"/>
                <button onClick={() => setShowPass(!showPass)} className="text-gray-400 hover:text-gray-600 duration-200">
                  {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>

              {/* ERROR / SUCCESS */}
              {loginError   && <p className="text-red-500 text-[11px] font-bold bg-red-50 dark:bg-red-900/20 px-4 py-2.5 rounded-xl">{loginError}</p>}
              {loginSuccess && <p className="text-green-600 text-[11px] font-bold bg-green-50 dark:bg-green-900/20 px-4 py-2.5 rounded-xl">{loginSuccess}</p>}

              {/* SUBMIT */}
              <button onClick={handleLoginSubmit} disabled={loginLoading}
                className={`w-full py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest duration-200 flex items-center justify-center gap-2
                  ${loginLoading ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-red-600 text-white shadow-xl shadow-red-500/30 hover:scale-[1.02] active:scale-95'}`}>
                {loginLoading
                  ? <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Memproses...</>
                  : <>{loginMode === 'login' ? 'Masuk & Lanjut ke Premium' : 'Buat Akun'} <ArrowRight size={13}/></>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {isSidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setIsSidebarOpen(false)}/>}

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r duration-300
        ${isDark ? 'bg-[#0B0F1A] border-gray-800/60' : 'bg-white border-gray-200'}
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
        <div className="p-5 flex flex-col h-full overflow-y-auto">

          <div className="flex items-center gap-2.5 mb-7 text-base font-black italic uppercase tracking-tighter">
            <div className="bg-red-600 p-1.5 rounded-xl shadow-lg shadow-red-500/30"><Zap size={16} className="text-white fill-current"/></div>
            ANAK <span className="text-red-600">KAMPUS</span>
          </div>

          <nav className="flex-1 space-y-5">
            {menuGroups.map(group => (
              <div key={group.label}>
                <p className={`text-[8px] font-black uppercase tracking-widest mb-1.5 px-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <button key={item.id}
                      onClick={() => { setCurrentMode(item.id); resetState(); setIsSidebarOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-[11px] duration-150
                        ${currentMode === item.id
                          ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
                          : isDark ? 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}>
                      {item.icon} {item.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className={`mt-5 pt-4 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl duration-200 hover:ring-2 ring-red-500/20
                ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-100 text-gray-800'}`}>
              <span className="text-[9px] font-black uppercase tracking-widest">{isDark ? 'Mode Malam' : 'Mode Terang'}</span>
              {isDark ? <Moon size={14} className="text-blue-400"/> : <Sun size={14} className="text-orange-400"/>}
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 p-5 md:p-9 overflow-y-auto pb-36 lg:pb-9">
        <div className="max-w-4xl mx-auto">

          {/* ── TOPBAR ──────────────────────────────────────────────────────── */}
          <header className="flex items-center justify-between mb-5 lg:mb-7">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`hidden lg:hidden p-2.5 rounded-xl border ${isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-200'}`}>
                <Menu size={17}/>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg lg:hidden ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    {menuGroups.flatMap(g => g.items).find(i => i.id === currentMode)?.icon}
                  </div>
                  <h1 className="text-base lg:text-lg font-black uppercase italic tracking-tight">{currentMode.replace(/_/g,' ')}</h1>
                </div>
                <p className={`text-[11px] mt-0.5 hidden lg:block ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{cfg.label}</p>
              </div>
            </div>

            {/* LOGIN / USER BUTTON — pojok kanan atas */}
            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs font-bold
                    ${isDark ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-white border-gray-200 text-gray-700'}`}>
                    {isPremium
                      ? <Crown size={13} className="text-orange-500 fill-current"/>
                      : <UserCircle size={13} className="text-gray-400"/>
                    }
                    <span className="max-w-[100px] truncate">{profile?.email?.split('@')[0]}</span>
                    {isPremium && <span className="text-[9px] text-orange-500 font-black">PRO</span>}
                  </div>
                  <button onClick={handleLogout}
                    className={`p-2 rounded-xl border duration-200 hover:text-red-500
                      ${isDark ? 'bg-gray-900 border-gray-800 text-gray-400' : 'bg-white border-gray-200 text-gray-500'}`}>
                    <LogOut size={14}/>
                  </button>
                </div>
              ) : (
                <button onClick={() => openLoginModal('login')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider border duration-200 hover:border-red-500 hover:text-red-600
                    ${isDark ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-white border-gray-200 text-gray-700'}`}>
                  <UserCircle size={14}/> Login
                </button>
              )}
            </div>
          </header>

          {/* ── MOBILE QUOTA BAR ─────────────────────────────────────────── */}
          <div className={`lg:hidden mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl border
            ${isDark ? 'bg-[#0B0F1A] border-gray-800' : 'bg-white border-gray-200'}`}>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Kuota</span>
                <span className={`text-[9px] font-black ${quotaFull ? 'text-red-500' : 'text-red-600'}`}>{downloadCount}/{MAX_QUOTA}</span>
              </div>
              <div className={`w-full h-1 rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <div className={`h-full duration-700 rounded-full ${quotaFull ? 'bg-red-600' : 'bg-red-500'}`}
                  style={{ width: `${Math.min((downloadCount/MAX_QUOTA)*100,100)}%` }}/>
              </div>
            </div>
            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full
              ${isPremium ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' : isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-500'}`}>
              {isPremium ? '⭐ PRO' : 'Free'}
            </span>
          </div>

          {/* ── PREMIUM BANNER — selalu tampil untuk non-premium ────────────── */}
          {!isPremium && (
            <button
              onClick={() => isLoggedIn ? router.push('/upgrade') : openLoginModal('login')}
              className="w-full mb-6 group relative overflow-hidden rounded-[2rem] p-5 text-left duration-200 hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ea580c 50%, #d97706 100%)' }}
            >
              {/* BG DECORATION */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 group-hover:scale-110 duration-500"/>
              <div className="absolute bottom-0 left-1/3 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 group-hover:scale-125 duration-700"/>

              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 backdrop-blur p-2.5 rounded-2xl">
                    <Crown size={18} className="text-white fill-current"/>
                  </div>
                  <div>
                    <p className="text-white font-black uppercase text-sm tracking-tight flex items-center gap-2">
                      Upgrade ke Premium
                      <Sparkles size={13} className="text-yellow-300"/>
                    </p>
                    <p className="text-white/70 text-[11px] font-medium mt-0.5">
                      500 download • Reset 15 hari • Semua fitur • Rp 15.000 lifetime
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1.5 bg-white/20 backdrop-blur px-4 py-2 rounded-2xl text-white text-xs font-black uppercase tracking-wider group-hover:bg-white/30 duration-200">
                  {isLoggedIn ? 'Upgrade' : 'Login dulu'} <ArrowRight size={12}/>
                </div>
              </div>
            </button>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* ── LEFT ──────────────────────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-4">
              {/* IMAGE TOOLS UI */}
              {currentMode === 'IMAGE_COMPRESSOR' && (
                <div className="space-y-4">
                  <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handleFileChange}/>
                  <DropZone onClick={() => fileInputRef.current?.click()} label={singleFile ? singleFile.name : 'Upload Gambar'}/>
                  {singleFile && (
                    <Card className="space-y-3">
                      <SectionLabel>Kualitas Kompresi: {compressQuality}%</SectionLabel>
                      <input type="range" min="10" max="100" value={compressQuality} onChange={e => setCompressQuality(parseInt(e.target.value))}
                        className="w-full accent-red-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"/>
                      <p className="text-[10px] text-gray-400 italic">Semakin rendah kualitas, semakin kecil ukuran file.</p>
                    </Card>
                  )}
                </div>
              )}

              {currentMode === 'IMAGE_CONVERTER' && (
                <div className="space-y-4">
                  <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handleFileChange}/>
                  <DropZone onClick={() => fileInputRef.current?.click()} label={singleFile ? singleFile.name : 'Upload Gambar'}/>
                  {singleFile && (
                    <Card className="space-y-4">
                      <SectionLabel>Pilih Format Tujuan</SectionLabel>
                      <div className="grid grid-cols-3 gap-2">
                        {['jpeg', 'png', 'webp'].map(fmt => (
                          <button key={fmt} onClick={() => setTargetFormat(fmt)}
                            className={`py-2 rounded-xl text-xs font-bold uppercase duration-200 border
                              ${targetFormat === fmt ? 'bg-red-600 text-white border-red-600 shadow-lg' : 'bg-transparent border-gray-200 text-gray-400 hover:border-red-500'}`}>
                            {fmt}
                          </button>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {currentMode === 'IMAGE_RESIZER' && (
                <div className="space-y-4">
                  <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handleFileChange}/>
                  <DropZone onClick={() => fileInputRef.current?.click()} label={singleFile ? singleFile.name : 'Upload Gambar'}/>
                  {singleFile && (
                    <Card className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Lebar (px)" value={resizeWidth} onChange={setResizeWidth} placeholder="1080"/>
                        <Field label="Tinggi (px)" value={resizeHeight} onChange={setResizeHeight} placeholder="Auto"/>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={resizeLock} onChange={e => setResizeLock(e.target.checked)} className="accent-red-600"/>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Kunci Aspek Rasio</span>
                      </label>
                    </Card>
                  )}
                </div>
              )}

              {/* STUDENT TOOLS UI */}
              {currentMode === 'COVER_GENERATOR' && (
                <Card className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2"><SectionLabel>Informasi Makalah</SectionLabel></div>
                  <Field label="Judul Makalah" value={coverData.title} onChange={v => setCoverData({...coverData, title: v})} placeholder="Contoh: Analisis Algoritma"/>
                  <Field label="Sub-Judul (Optional)" value={coverData.sub} onChange={v => setCoverData({...coverData, sub: v})} placeholder="Mata Kuliah: Struktur Data"/>
                  <Field label="Nama Penyusun" value={coverData.author} onChange={v => setCoverData({...coverData, author: v})} placeholder="Dafa Ardian"/>
                  <Field label="NIM / ID" value={coverData.id} onChange={v => setCoverData({...coverData, id: v})} placeholder="20210801001"/>
                  <Field label="Universitas / Instansi" value={coverData.uni} onChange={v => setCoverData({...coverData, uni: v})} placeholder="Universitas Esa Unggul"/>
                  <Field label="Tahun" value={coverData.year} onChange={v => setCoverData({...coverData, year: v})} placeholder="2024"/>
                </Card>
              )}

              {currentMode === 'IPK_CALCULATOR' && (
                <Card className="space-y-4">
                  <SectionLabel>Daftar Mata Kuliah</SectionLabel>
                  <div className="space-y-2">
                    {ipkCourses.map(c => (
                      <div key={c.id} className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                        <div className="flex-1">
                          <p className="text-xs font-black truncate">{c.name || 'Matakuliah'}</p>
                          <p className="text-[10px] text-gray-400">{c.grade} • {c.credit} SKS</p>
                        </div>
                        <button onClick={() => setIpkCourses(ipkCourses.filter(x => x.id !== c.id))} className="text-red-500 p-1.5 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-12 gap-2 p-3 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                    <div className="col-span-5">
                      <input type="text" placeholder="Nama MK" value={ipkNew.name} onChange={e => setIpkNew({...ipkNew, name: e.target.value})} className="w-full bg-transparent text-xs font-bold outline-none"/>
                    </div>
                    <div className="col-span-3">
                      <select value={ipkNew.grade} onChange={e => setIpkNew({...ipkNew, grade: e.target.value})} className="w-full bg-transparent text-xs font-bold outline-none">
                        {['A','B','C','D','E'].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input type="number" placeholder="SKS" value={ipkNew.sks} onChange={e => setIpkNew({...ipkNew, sks: e.target.value})} className="w-full bg-transparent text-xs font-bold outline-none"/>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <button onClick={() => {
                        if (ipkNew.name) {
                          setIpkCourses([...ipkCourses, { id: Date.now().toString(), name: ipkNew.name, grade: ipkNew.grade, credit: ipkNew.sks }]);
                          setIpkNew({ name: '', grade: 'A', sks: '3' });
                        }
                      }} className="bg-red-600 text-white p-1.5 rounded-lg shadow-md"><Plus size={14}/></button>
                    </div>
                  </div>
                </Card>
              )}

              {currentMode === 'PUSTAKA_GENERATOR' && (
                <Card className="space-y-4">
                  <SectionLabel>Data Referensi (APA Style)</SectionLabel>
                  <div className="space-y-3">
                    {pustakaEntries.map(e => (
                      <div key={e.id} className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 group relative">
                        <p className="text-xs italic text-gray-600 dark:text-gray-400">
                          {e.author}. ({e.year}). <span className="font-bold">{e.title}</span>. {e.pub}.
                        </p>
                        <button onClick={() => setPustakaEntries(pustakaEntries.filter(x => x.id !== e.id))} 
                          className="absolute right-2 top-2 text-red-500 opacity-0 group-hover:opacity-100 duration-200">
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <Field label="Penulis" placeholder="Contoh: Doe, J." value={pustakaNew.author} onChange={(v:any) => setPustakaNew({...pustakaNew, author: v})}/>
                    <Field label="Tahun" placeholder="2023" value={pustakaNew.year} onChange={(v:any) => setPustakaNew({...pustakaNew, year: v})}/>
                    <div className="col-span-2">
                      <Field label="Judul Buku/Artikel" placeholder="Studi Kasus..." value={pustakaNew.title} onChange={(v:any) => setPustakaNew({...pustakaNew, title: v})}/>
                    </div>
                    <div className="col-span-2 flex items-end gap-3">
                      <div className="flex-1">
                        <Field label="Penerbit / Jurnal" placeholder="Gramedia" value={pustakaNew.pub} onChange={(v:any) => setPustakaNew({...pustakaNew, pub: v})}/>
                      </div>
                      <button onClick={() => {
                        if (pustakaNew.author && pustakaNew.title) {
                          setPustakaEntries([...pustakaEntries, { id: Date.now().toString(), ...pustakaNew, type: 'BOOK' }]);
                          setPustakaNew({ author: '', year: '', title: '', pub: '' });
                        }
                      }} className="bg-gray-800 text-white px-4 h-[42px] rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg">Tambah</button>
                    </div>
                  </div>
                </Card>
              )}

              {currentMode === 'SURAT_GENERATOR' && (
                <Card className="space-y-4">
                  <SectionLabel>Konfigurasi Surat</SectionLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <SectionLabel className="text-[9px] mb-2">TIPE SURAT</SectionLabel>
                      <div className="flex gap-2">
                        {['IZIN', 'PERMOHONAN'].map(t => (
                          <button key={t} onClick={() => setSuratData({...suratData, type: t})}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold duration-200 border
                              ${suratData.type === t ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-transparent border-gray-200 text-gray-400 hover:border-red-500'}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Field label="Nama Lengkap" value={suratData.name} onChange={v => setSuratData({...suratData, name: v})} placeholder="Dafa Ardian"/>
                    <Field label="NIM" value={suratData.id} onChange={v => setSuratData({...suratData, id: v})} placeholder="20210801001"/>
                    <Field label="Tanggal Kejadian" value={suratData.date} onChange={v => setSuratData({...suratData, date: v})} placeholder="20 April 2024"/>
                    <div className="col-span-2">
                      <Field label="Alasan / Keperluan" value={suratData.reason} onChange={v => setSuratData({...suratData, reason: v})} placeholder="Sakit / Cuti / Pengambilan Ijazah"/>
                    </div>
                  </div>
                </Card>
              )}

              {/* TEXT TOOLS UI */}
              {currentMode === 'WORD_COUNTER' && (
                <Card className="space-y-4">
                  <SectionLabel>Tempel Teks di Sini</SectionLabel>
                  <textarea value={wordText} onChange={e => setWordText(e.target.value)}
                    placeholder="Ketik atau tempel teks tugasmu di sini untuk dianalisis..." rows={8}
                    className={`w-full px-4 py-3 rounded-2xl text-sm font-medium outline-none border resize-none focus:border-red-500 duration-200
                      ${isDark ? 'bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-800'}`}/>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-center">
                      <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Kata</p>
                      <p className="text-lg font-black text-red-600">{wordText.trim() ? wordText.trim().split(/\s+/).length : 0}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-center">
                      <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Karakter</p>
                      <p className="text-lg font-black text-red-600">{wordText.length}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-center">
                      <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Waktu Baca</p>
                      <p className="text-lg font-black text-red-600">{Math.ceil((wordText.trim().split(/\s+/).length) / 200)}m</p>
                    </div>
                  </div>
                </Card>
              )}

              {currentMode === 'LOREM_IPSUM' && (
                <Card className="space-y-4 text-center">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 mb-2">
                    <Type size={24}/>
                  </div>
                  <SectionLabel>Jumlah Paragraf: {loremCount}</SectionLabel>
                  <input type="range" min="1" max="10" value={loremCount} onChange={e => setLoremCount(parseInt(e.target.value))}
                    className="w-full accent-red-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"/>
                  <p className="text-xs text-gray-400">Generate teks dummy untuk placeholder tugas desain kamu.</p>
                </Card>
              )}

              {currentMode === 'COLOR_PICKER' && (
                <Card className="space-y-4">
                  <SectionLabel>Pilih Warna</SectionLabel>
                  <div className="flex flex-col items-center gap-6 py-4">
                    <div className="relative group">
                      <input type="color" value={pickedColor} onChange={e => setPickedColor(e.target.value)}
                        className="w-32 h-32 rounded-full cursor-pointer border-8 border-white dark:border-gray-800 shadow-2xl overflow-hidden"/>
                      <div className="absolute inset-0 rounded-full pointer-events-none border border-black/5"/>
                    </div>
                    <div className="w-full space-y-3">
                      <div className="flex items-center gap-2 p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                        <p className="text-xs font-black flex-1 font-mono uppercase">{pickedColor}</p>
                        <button onClick={() => { navigator.clipboard.writeText(pickedColor); alert('HEX Copied!'); }}
                          className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:scale-105 active:scale-95 duration-200">
                          <Clipboard size={14} className="text-gray-400"/>
                        </button>
                      </div>
                      <div className="flex justify-center gap-2">
                        {['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'].map(c => (
                          <button key={c} onClick={() => setPickedColor(c)} style={{ backgroundColor: c }}
                            className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 shadow-sm hover:scale-125 duration-200"/>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {currentMode === 'QR_CODE' && (
                <Card className="space-y-4">
                  <SectionLabel>Isi QR Code</SectionLabel>
                  <textarea value={qrContent} onChange={e => { setQrContent(e.target.value); setQrPreview(''); }}
                    placeholder="URL, nama, NIM, atau teks apapun..." rows={4}
                    className={`w-full px-4 py-3 rounded-2xl text-sm font-medium outline-none border resize-none focus:border-red-500 duration-200
                      ${isDark ? 'bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-800'}`}/>
                  <button onClick={handleQrPreview} disabled={!qrContent.trim()}
                    className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider duration-200
                      ${qrContent.trim() ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                    Preview QR
                  </button>
                  {qrPreview && (
                    <div className="flex justify-center pt-2">
                      <div className={`p-3 rounded-2xl border ${isDark ? 'border-gray-700 bg-white' : 'border-gray-200'}`}>
                        <img src={qrPreview} alt="QR" className="w-32 h-32"/>
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {currentMode === 'OCR' && (
                <div className="space-y-4">
                  <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handleFileChange}/>
                  <DropZone onClick={() => fileInputRef.current?.click()} label={singleFile ? singleFile.name : 'Upload Foto / Screenshot'}/>
                  {ocrProgress > 0 && ocrProgress < 100 && (
                    <Card>
                      <p className="text-[10px] font-black uppercase mb-2">Memproses... {ocrProgress}%</p>
                      <div className={`w-full h-1.5 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                        <div className="bg-red-600 h-full rounded-full duration-300" style={{ width: `${ocrProgress}%` }}/>
                      </div>
                    </Card>
                  )}
                  {ocrResult && (
                    <Card className="space-y-3">
                      <div className="flex items-center justify-between">
                        <SectionLabel>Hasil OCR</SectionLabel>
                        <button onClick={() => { navigator.clipboard.writeText(ocrResult); alert('Disalin!'); }}
                          className="text-[9px] font-black uppercase bg-red-600 text-white px-3 py-1.5 rounded-xl hover:bg-red-700 duration-200">Copy</button>
                      </div>
                      <textarea readOnly value={ocrResult} rows={10}
                        className={`w-full px-4 py-3 rounded-2xl text-xs font-mono outline-none border resize-none
                          ${isDark ? 'bg-gray-900 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'}`}/>
                    </Card>
                  )}
                </div>
              )}

              {currentMode === 'PDF_MERGER' && (
                <div className="space-y-4">
                  <input type="file" hidden multiple accept=".pdf" ref={multiFileInputRef} onChange={e => handleFileChange(e, true)}/>
                  <div onClick={() => multiFileInputRef.current?.click()}
                    className={`h-40 rounded-[2.5rem] border-4 border-dashed flex flex-col items-center justify-center cursor-pointer duration-200 hover:border-red-500
                      ${isDark ? 'bg-[#0B0F1A] border-gray-800' : 'bg-white border-gray-200'}`}>
                    <div className="bg-red-600 p-3 rounded-2xl shadow-lg text-white mb-2"><Plus size={20}/></div>
                    <p className="font-black uppercase text-xs">Tambah PDF</p>
                    <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{multiFiles.length} file</p>
                  </div>
                  {multiFiles.length > 0 && (
                    <div className="space-y-2">
                      {multiFiles.map((f, i) => (
                        <div key={i} className={`flex items-center gap-3 p-3 rounded-2xl border ${isDark ? 'bg-[#0B0F1A] border-gray-800' : 'bg-white border-gray-200'}`}>
                          <div className="bg-red-100 dark:bg-red-900/20 p-1.5 rounded-lg"><FileText size={13} className="text-red-600"/></div>
                          <span className={`flex-1 text-xs font-bold truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{f.name}</span>
                          <span className={`text-[9px] font-black ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>#{i+1}</span>
                          <button onClick={() => setMultiFiles(multiFiles.filter((_,j)=>j!==i))} className="text-red-500 p-1 rounded-lg hover:bg-red-50"><X size={13}/></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {currentMode === 'PDF_SPLITTER' && (
                <div className="space-y-4">
                  <input type="file" hidden accept=".pdf" ref={fileInputRef} onChange={handleFileChange}/>
                  <DropZone onClick={() => fileInputRef.current?.click()} label={singleFile ? singleFile.name : 'Upload PDF'}/>
                  <Card className="space-y-4">
                    <SectionLabel>Range Halaman</SectionLabel>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Dari Halaman" value={splitFrom} onChange={setSplitFrom} placeholder="1" type="number"/>
                      <Field label="Sampai Halaman" value={splitTo} onChange={setSplitTo} placeholder="5" type="number"/>
                    </div>
                  </Card>
                </div>
              )}

              {currentMode === 'PAGE_NUMBERING' && (
                <div className="space-y-4">
                  <input type="file" hidden accept=".pdf" ref={fileInputRef} onChange={handleFileChange}/>
                  <DropZone onClick={() => fileInputRef.current?.click()} label={singleFile ? singleFile.name : 'Upload PDF'}/>
                  <Card className="space-y-4">
                    <SectionLabel>Pengaturan Nomor Halaman</SectionLabel>
                    <Field label="Mulai dari nomor" value={pageNumberStart} onChange={setPageNumberStart} placeholder="1" type="number"/>
                    <div>
                      <label className={`text-[9px] font-black uppercase tracking-widest block mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Posisi</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['bottom-left','bottom-center','bottom-right'] as const).map(pos => (
                          <button key={pos} onClick={() => setPageNumberPos(pos)}
                            className={`py-2.5 rounded-xl text-[10px] font-black uppercase duration-150
                              ${pageNumberPos === pos ? 'bg-red-600 text-white' : isDark ? 'bg-gray-900 text-gray-400 hover:bg-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                            {pos === 'bottom-left' ? 'Kiri' : pos === 'bottom-center' ? 'Tengah' : 'Kanan'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {currentMode === 'METADATA_EDITOR' && (
                <div className="space-y-4">
                  <input type="file" hidden accept=".pdf" ref={fileInputRef} onChange={handleFileChange}/>
                  <DropZone onClick={() => fileInputRef.current?.click()} label={singleFile ? singleFile.name : 'Upload PDF'}/>
                  <Card className="space-y-4">
                    <SectionLabel>Edit Metadata PDF</SectionLabel>
                    <Field label="Judul" value={metaTitle} onChange={setMetaTitle} placeholder="Judul dokumen"/>
                    <Field label="Author / Penulis" value={metaAuthor} onChange={setMetaAuthor} placeholder="Nama kamu"/>
                    <Field label="Subjek" value={metaSubject} onChange={setMetaSubject} placeholder="Misal: Laporan PKL"/>
                    <Field label="Keywords" value={metaKeywords} onChange={setMetaKeywords} placeholder="kata kunci, dipisah koma"/>
                  </Card>
                </div>
              )}

              {currentMode === 'PAGE_ORGANIZER' && (
                <div className="space-y-4">
                  <input type="file" hidden accept=".pdf" ref={fileInputRef} onChange={handleFileChange}/>
                  {!organizerLoaded
                    ? <DropZone onClick={() => fileInputRef.current?.click()} label="Upload PDF untuk diatur"/>
                    : (
                      <Card className="space-y-3">
                        <SectionLabel>Halaman ({organizerPages.filter(p=>!p.deleted).length} aktif)</SectionLabel>
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                          {organizerPages.map((p, i) => (
                            <div key={i} className={`flex items-center gap-3 p-3 rounded-2xl border duration-150
                              ${p.deleted
                                ? isDark ? 'bg-gray-900/40 border-gray-800 opacity-40' : 'bg-gray-50 border-gray-100 opacity-40'
                                : isDark ? 'bg-gray-900/60 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                              <span className={`text-[10px] font-black w-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>P{p.index+1}</span>
                              <span className={`flex-1 text-xs font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Halaman {p.index + 1}
                                {p.rotation !== 0 && <span className="ml-2 text-red-500 text-[10px]">{p.rotation}°</span>}
                              </span>
                              <button disabled={p.deleted}
                                onClick={() => setOrganizerPages(prev => prev.map((pg,j) => j===i ? { ...pg, rotation: (pg.rotation + 90) % 360 } : pg))}
                                className={`p-1.5 rounded-lg duration-150 ${p.deleted ? 'cursor-not-allowed opacity-30' : 'text-blue-500 hover:bg-blue-50'}`}>
                                <RotateCw size={14}/>
                              </button>
                              <button
                                onClick={() => setOrganizerPages(prev => prev.map((pg,j) => j===i ? { ...pg, deleted: !pg.deleted } : pg))}
                                className={`p-1.5 rounded-lg duration-150 ${p.deleted ? 'text-green-500 hover:bg-green-50' : 'text-red-500 hover:bg-red-50'}`}>
                                {p.deleted ? <Plus size={14}/> : <X size={14}/>}
                              </button>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )
                  }
                </div>
              )}

              {currentMode === 'ADD_SIGNATURE' && (
                <div className="space-y-4">
                  <input type="file" hidden accept=".pdf" ref={fileInputRef} onChange={handleFileChange}/>
                  <input type="file" hidden accept="image/png,image/jpeg" ref={sigInputRef} onChange={e => setSigFile(e.target.files?.[0] ?? null)}/>
                  <DropZone onClick={() => fileInputRef.current?.click()} label={singleFile ? singleFile.name : 'Upload PDF'}/>
                  <Card className="space-y-4">
                    <SectionLabel>Upload Gambar Tanda Tangan</SectionLabel>
                    <div onClick={() => sigInputRef.current?.click()}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed cursor-pointer duration-200 hover:border-red-500
                        ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                      <div className={`p-2 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}><PenLine size={16} className="text-red-600"/></div>
                      <span className={`text-xs font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {sigFile ? sigFile.name : 'Klik untuk upload PNG/JPG tanda tangan'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Halaman ke-" value={sigPage} onChange={setSigPage} placeholder="1" type="number"/>
                      <Field label="Lebar (px)" value={sigWidth} onChange={setSigWidth} placeholder="150" type="number"/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Posisi X (dari kiri)" value={sigX} onChange={setSigX} placeholder="50" type="number"/>
                      <Field label="Posisi Y (dari atas)" value={sigY} onChange={setSigY} placeholder="50" type="number"/>
                    </div>
                    <p className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>💡 Gunakan PNG transparan untuk hasil tanpa background putih.</p>
                  </Card>
                </div>
              )}

              {currentMode === 'ADD_WATERMARK' && (
                <div className="space-y-4">
                  <input type="file" hidden accept=".pdf" ref={fileInputRef} onChange={handleFileChange}/>
                  <DropZone onClick={() => fileInputRef.current?.click()} label={singleFile ? singleFile.name : 'Upload PDF'}/>
                  <Card><Field label="Teks Watermark" value={watermarkText} onChange={setWatermarkText} placeholder="Nama / NIM / RAHASIA"/></Card>
                </div>
              )}

              {currentMode === 'PROTECT_PDF' && (
                <div className="space-y-4">
                  <input type="file" hidden accept=".pdf" ref={fileInputRef} onChange={handleFileChange}/>
                  <DropZone onClick={() => fileInputRef.current?.click()} label={singleFile ? singleFile.name : 'Upload PDF'}/>
                  <Card className="space-y-3">
                    <Field label="Password" value={pdfPassword} onChange={setPdfPassword} placeholder="Password rahasia" type="password"/>
                    <p className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>⚠️ Metadata-only di browser. Enkripsi penuh butuh Acrobat.</p>
                  </Card>
                </div>
              )}

              {currentMode === 'IMAGE_TO_EXCEL' && (
                <div className="space-y-4">
                  <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handleFileChange}/>
                  <DropZone onClick={() => fileInputRef.current?.click()} label={singleFile ? singleFile.name : 'Upload Foto Tabel'}/>
                  {ocrProgress > 0 && ocrProgress < 100 && (
                    <Card>
                      <p className="text-[10px] font-black uppercase mb-2">OCR... {ocrProgress}%</p>
                      <div className={`w-full h-1.5 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                        <div className="bg-red-600 h-full rounded-full duration-300" style={{ width: `${ocrProgress}%` }}/>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {!['QR_CODE','OCR','PDF_MERGER','PDF_SPLITTER','PAGE_NUMBERING','METADATA_EDITOR',
                'PAGE_ORGANIZER','ADD_SIGNATURE','IMAGE_COMPRESSOR','IMAGE_CONVERTER','IMAGE_RESIZER',
                'COVER_GENERATOR','IPK_CALCULATOR','PUSTAKA_GENERATOR','SURAT_GENERATOR',
                'WORD_COUNTER','LOREM_IPSUM','COLOR_PICKER','ADD_WATERMARK','PROTECT_PDF','IMAGE_TO_EXCEL'].includes(currentMode) && (
                <div className="space-y-4">
                  <input type="file" hidden multiple={cfg.multi} accept={cfg.accept} ref={fileInputRef} onChange={handleFileChange}/>
                  <DropZone onClick={() => fileInputRef.current?.click()} label={singleFile ? singleFile.name : images.length > 0 ? `${images.length} gambar dipilih` : undefined}/>
                  {currentMode === 'PICTURE_TO_PDF' && images.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {images.map((img, i) => (
                        <div key={img.id} className={`flex items-center gap-3 p-3 rounded-[1.75rem] border ${isDark ? 'bg-[#0B0F1A] border-gray-800' : 'bg-white border-gray-200'}`}>
                          <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700">
                            <img src={img.src} className="w-full h-full object-cover" alt=""/>
                          </div>
                          <span className={`flex-1 text-[10px] font-black uppercase truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Hal {i+1}</span>
                          <button onClick={e => { e.stopPropagation(); setImages(images.filter(x=>x.id!==img.id)); }}
                            className="text-red-500 p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={13}/></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── RIGHT ─────────────────────────────────────────────────────── */}
            <div className="space-y-4">
              <div className={`p-6 rounded-[2.5rem] border shadow-xl ${isDark ? 'bg-[#0B0F1A] border-gray-800' : 'bg-white border-gray-100'}`}>

                {/* QUOTA */}
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-2">
                    <p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Kuota</p>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full
                      ${isPremium ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' : isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-500'}`}>
                      {isPremium ? '⭐ Premium' : 'Free'}
                    </span>
                  </div>
                  <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
                    <div className={`h-full duration-700 ${isPremium ? 'bg-gradient-to-r from-orange-400 to-red-600' : quotaFull ? 'bg-red-600' : 'bg-red-500'}`}
                      style={{ width: `${Math.min((downloadCount/MAX_QUOTA)*100,100)}%` }}/>
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <p className={`text-[9px] font-black ${quotaFull ? 'text-red-500' : 'text-red-600'}`}>{downloadCount}/{MAX_QUOTA}</p>
                    {!isPremium && <p className={`text-[8px] ${isDark ? 'text-gray-700' : 'text-gray-400'}`}>Reset 15 hari</p>}
                  </div>
                </div>

                {/* ACTION BUTTON */}
                <button
                  disabled={(!isReady() && !quotaFull) || isProcessing}
                  onClick={handleMainAction}
                  className={`w-full py-4 rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest duration-200
                    ${quotaFull
                      ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-xl shadow-red-500/30 hover:scale-105 active:scale-95'
                      : isReady() && !isProcessing
                        ? 'bg-red-600 text-white shadow-xl shadow-red-500/30 hover:scale-105 active:scale-95'
                        : isDark ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Memproses...
                    </span>
                  ) : quotaFull ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Crown size={13} className="fill-current"/> Kuota Habis — Upgrade
                    </span>
                  ) : (
                    <>
                      <Download size={14} className="inline mr-1.5 mb-0.5"/>
                      {currentMode === 'OCR' ? 'Mulai Scan' : currentMode === 'QR_CODE' ? 'Generate QR' : 'Download'}
                    </>
                  )}
                </button>

                {/* RESET */}
                {(singleFile || images.length > 0 || multiFiles.length > 0 || ocrResult || organizerLoaded) && (
                  <button onClick={resetState}
                    className={`w-full mt-2.5 py-3 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest duration-200
                      ${isDark ? 'bg-gray-900 text-gray-500 hover:text-gray-300' : 'bg-gray-50 text-gray-400 hover:text-gray-600'}`}>
                    <Trash2 size={11} className="inline mr-1.5 mb-0.5"/> Reset
                  </button>
                )}
              </div>

              {/* TIP CARD */}
              <div className={`p-4 rounded-[2rem] border ${isDark ? 'bg-[#0B0F1A] border-gray-800' : 'bg-white border-gray-100'}`}>
                <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Tips</p>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{cfg.tip}</p>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* ── MOBILE FLOATING ACTION ──────────────────────────────────────── */}
      {(isReady() || quotaFull) && (
        <div className="fixed bottom-[4.25rem] left-0 right-0 z-40 px-4 lg:hidden">
          <div className={`p-1.5 rounded-[1.25rem] backdrop-blur-xl shadow-2xl border
            ${isDark ? 'bg-[#0B0F1A]/95 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
            <button onClick={handleMainAction} disabled={(!isReady() && !quotaFull) || isProcessing}
              className={`w-full py-3.5 rounded-2xl font-black uppercase text-[11px] tracking-widest duration-200 flex items-center justify-center gap-2
                ${quotaFull
                  ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-red-500/30'
                  : isReady() && !isProcessing
                    ? 'bg-red-600 text-white shadow-lg shadow-red-500/30 active:scale-95'
                    : isDark ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
              {isProcessing ? (
                <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Memproses...</>
              ) : quotaFull ? (
                <><Crown size={13} className="fill-current"/> Kuota Habis — Upgrade</>
              ) : (
                <><Download size={14}/> {currentMode === 'OCR' ? 'Mulai Scan' : currentMode === 'QR_CODE' ? 'Generate QR' : 'Download'}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM SHEET ─────────────────────────────────────────── */}
      {mobileCategory && (
        <>
          <div className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileCategory(null)}/>
          <div className={`fixed bottom-[4rem] left-0 right-0 z-[56] rounded-t-[2rem] overflow-hidden lg:hidden
            ${isDark ? 'bg-[#0B0F1A] border-t border-gray-800' : 'bg-white border-t border-gray-200'}`}>
            <div className="p-5 pb-6">
              <div className={`w-10 h-1 rounded-full mx-auto mb-4 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`}/>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{mobileCategory}</p>
              <div className="grid grid-cols-3 gap-2 max-h-[45vh] overflow-y-auto">
                {menuGroups.find(g => g.label === mobileCategory)?.items.map(item => (
                  <button key={item.id}
                    onClick={() => { setCurrentMode(item.id); resetState(); setMobileCategory(null); }}
                    className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl duration-150
                      ${currentMode === item.id
                        ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
                        : isDark ? 'bg-gray-900/80 text-gray-400 active:bg-gray-800' : 'bg-gray-50 text-gray-500 active:bg-gray-100'}`}>
                    {item.icon}
                    <span className="text-[9px] font-bold text-center leading-tight">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MOBILE BOTTOM NAV ──────────────────────────────────────────── */}
      <nav className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t backdrop-blur-xl
        ${isDark ? 'bg-[#0B0F1A]/95 border-gray-800' : 'bg-white/95 border-gray-200'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch">
          {menuGroups.map(group => {
            const isActive = group.items.some(i => i.id === currentMode);
            const isOpen = mobileCategory === group.label;
            return (
              <button key={group.label}
                onClick={() => setMobileCategory(isOpen ? null : group.label)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 relative duration-150
                  ${isActive ? 'text-red-600' : isOpen ? (isDark ? 'text-gray-200' : 'text-gray-700') : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-red-600 rounded-full"/>}
                {group.label === 'Konversi' ? <FileImage size={19}/> : group.label === 'PDF Tools' ? <Layers size={19}/> : <Sparkles size={19}/>}
                <span className="text-[8px] font-black uppercase tracking-wider">{group.label}</span>
              </button>
            );
          })}
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`px-5 flex flex-col items-center gap-0.5 py-2.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {isDark ? <Moon size={19} className="text-blue-400"/> : <Sun size={19} className="text-orange-400"/>}
            <span className="text-[8px] font-black uppercase tracking-wider">Tema</span>
          </button>
        </div>
      </nav>
    </div>
  );
}