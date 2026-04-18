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
import { supabase } from './lib/supabase';
import type { Profile } from './lib/supabase';
import {
  FileImage, FileUp, Trash2, Download, Zap,
  FileText, FileSpreadsheet, Layers, Menu, Crown,
  Moon, Sun, Merge, Scissors, Minimize2,
  Stamp, Lock, QrCode, ScanText, Plus, X,
  Hash, Info, Settings2, RotateCw, Table,
  Images, PenLine, LogOut, UserCircle,
  Eye, EyeOff, ArrowRight, Sparkles
} from 'lucide-react';

interface ImageItem { id: string; src: string; name: string; rotation: number; }
interface PageItem  { index: number; rotation: number; deleted: boolean; }

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
  const [isSidebarOpen, setIsSidebarOpen]   = useState(true);
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
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await loadProfile(user.id);
      await checkReset(user.id);
    }
  };

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  };

  const checkReset = async (userId: string) => {
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
    await supabase.auth.signOut();
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
      await supabase.from('profiles').update({ download_count: newCount }).eq('id', profile.id);
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
    const result    = await (Tesseract as any).recognize(singleFile!, 'ind+eng', {
      logger: (m: any) => { if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100)); }
    });
    setOcrResult(result.data.text);
    setIsProcessing(false);
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
      <main className="flex-1 p-5 md:p-9 overflow-y-auto">
        <div className="max-w-4xl mx-auto">

          {/* ── TOPBAR ──────────────────────────────────────────────────────── */}
          <header className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`lg:hidden p-2.5 rounded-xl border ${isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-200'}`}>
                <Menu size={17}/>
              </button>
              <div>
                <h1 className="text-lg font-black uppercase italic tracking-tight">{currentMode.replace(/_/g,' ')}</h1>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{cfg.label}</p>
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

              {/* QUOTA INFO — hanya tampil kalau sudah hampir habis */}
              {downloadCount > 0 && (
                <div className="relative mt-3 pt-3 border-t border-white/20">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-white/70 text-[10px] font-bold uppercase">Kuota gratis kamu</span>
                    <span className="text-white text-[10px] font-black">{downloadCount}/{MAX_QUOTA}</span>
                  </div>
                  <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full duration-700"
                      style={{ width: `${Math.min((downloadCount / MAX_QUOTA) * 100, 100)}%` }}/>
                  </div>
                </div>
              )}
            </button>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── LEFT ──────────────────────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-4">

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
                 'PAGE_ORGANIZER','ADD_SIGNATURE','ADD_WATERMARK','PROTECT_PDF','IMAGE_TO_EXCEL'].includes(currentMode) && (
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
    </div>
  );
}