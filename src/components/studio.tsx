"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Aperture, ArrowDownToLine, ArrowRight, Check, ChevronDown, Clapperboard, Compass, Cpu, Expand, Film, FolderOpen, Globe2, Image as ImageIcon, Layers3, LoaderCircle, Plus, Radio, RefreshCw, Search, Settings2, SlidersHorizontal, Sparkles, Trash2, Video, WandSparkles, X, Upload, Edit2, ZoomIn } from "lucide-react";
import { cameraMoves, getModel, looks, models, presets, type MediaKind } from "@/lib/catalog";
import type { Connection, GenerationInput, Job } from "@/lib/contracts";
import { generationSchema } from "@/lib/contracts";
import { Scenery } from "./scenery";

type View = "discover" | "studio" | "library" | "models";
type Locale = "en" | "ar";
type EditMode = "none" | "inpaint" | "upscale";
const initialInput: GenerationInput = { project: "Untitled film", prompt: "", modelId: "wan-5b", aspect: "16:9", duration: 5, seed: 42, camera: "static", look: "natural", action: "draft" };

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export function Studio() {
  const [view, setView] = useState<View>("discover");
  const [locale, setLocale] = useState<Locale>("en");
  const [input, setInput] = useState<GenerationInput>(initialInput);
  const [loaded, setLoaded] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [checking, setChecking] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [scene, setScene] = useState("dunes");
  const [editMode, setEditMode] = useState<EditMode>("none");
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editMask, setEditMask] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const t = (en: string, ar: string) => locale === "ar" ? ar : en;
  const kind = getModel(input.modelId)?.kind || "video";
  const ready = connection?.models.find(model => model.id === input.modelId)?.ready;
  const activeCount = jobs.filter(job => ["queued", "submitting"].includes(job.status)).length;
  const isEditingModel = input.modelId === "flux-inpaint" || input.modelId === "flux-upscale";
  const update = <K extends keyof GenerationInput>(key: K, value: GenerationInput[K]) => setInput(current => ({ ...current, [key]: value }));

  const refreshConnection = useCallback(async () => {
    setChecking(true);
    try { setConnection(await api<Connection>("/api/connection")); }
    catch (error) { setNotice({ text: error instanceof Error ? error.message : "Connection check failed", error: true }); }
    finally { setChecking(false); }
  }, []);

  const refreshJobs = useCallback(async () => {
    const data = await api<{ jobs: Job[] }>("/api/jobs");
    setJobs(data.jobs);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("contigoo-composer");
      if (stored) {
        const value = JSON.parse(stored);
        const parsed = generationSchema.safeParse({ ...value, prompt: value.prompt || "Temporary empty draft" });
        if (parsed.success) setInput({ ...parsed.data, prompt: value.prompt || "" });
      }
      if (localStorage.getItem("contigoo-locale") === "ar") setLocale("ar");
    } catch { /* Storage can be unavailable in private browser contexts. */ }
    setLoaded(true);
    void refreshConnection();
    void refreshJobs().catch(() => setNotice({ text: "Could not load your library. Refresh to retry.", error: true }));
  }, [refreshConnection, refreshJobs]);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem("contigoo-composer", JSON.stringify(input)); } catch { /* Explicit save remains available. */ }
    }, 350);
    return () => clearTimeout(timer);
  }, [input, loaded]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    if (loaded) { try { localStorage.setItem("contigoo-locale", locale); } catch { /* Nonessential preference. */ } }
  }, [locale, loaded]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.error ? 12000 : 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (settings) dialog.current?.showModal();
    else dialog.current?.close();
  }, [settings]);

  useEffect(() => {
    const queued = jobs.filter(job => job.status === "queued");
    if (!queued.length) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await Promise.allSettled(queued.map(job => api<{ job: Job }>(`/api/jobs/${job.id}`)));
      if (cancelled) return;
      const updates = results.flatMap(result => result.status === "fulfilled" ? [result.value.job] : []);
      setJobs(current => current.map(job => updates.find(update => update.id === job.id) || job));
      setSelected(current => current ? updates.find(update => update.id === current.id) || current : null);
      if (results.some(result => result.status === "rejected")) setNotice({ text: "Worker status is temporarily unavailable. Your queued shots are saved; checking again shortly.", error: true });
    }, 5000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [jobs]);

  function changeKind(next: MediaKind) {
    setInput(current => ({ ...current, modelId: next === "video" ? "wan-5b" : "flux-schnell", aspect: next === "video" && current.aspect === "1:1" ? "16:9" : current.aspect }));
  }

  function usePreset(preset: typeof presets[number]) {
    setInput(current => ({ ...current, prompt: preset.prompt, camera: preset.camera, look: preset.look }));
    setScene(preset.scene);
    setSelected(null);
    setView("studio");
    setNotice({ text: t("Shot direction loaded. Make it your own.", "تم تحميل إعدادات اللقطة. أضف رؤيتك الخاصة.") });
  }

  async function submit(action: "draft" | "generate") {
    setBusy(true);
    try {
      const { job } = await api<{ job: Job }>("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, action }) });
      setJobs(current => [job, ...current]);
      setSelected(job);
      setView(action === "draft" ? "library" : "studio");
      setNotice({ text: action === "draft" ? t("Shot saved to your library.", "تم حفظ اللقطة في مكتبتك.") : t("Shot sent to your GPU worker.", "تم إرسال اللقطة إلى خادم المعالجة.") });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Could not save this shot.", error: true });
      void refreshJobs().catch(() => undefined);
    } finally { setBusy(false); }
  }

  async function removeJob(job: Job) {
    if (!window.confirm(t("Remove this shot from the library? Worker output files will be kept.", "هل تريد إزالة اللقطة من المكتبة؟ سيتم الاحتفاظ بملفات المعالجة."))) return;
    try {
      await api(`/api/jobs/${job.id}`, { method: "DELETE" });
      setJobs(current => current.filter(item => item.id !== job.id));
      if (selected?.id === job.id) setSelected(null);
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "Could not remove shot", error: true }); }
  }

  function handleImageUpload(file: File, setter: (value: string | null) => void) {
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  }

  function startEdit(job: Job, mode: EditMode) {
    if (!job.assets[0]) return;
    setEditMode(mode);
    setEditImage(`/api/media/${job.id}/0`);
    if (mode === "inpaint") setEditMask(null);
    setInput(current => ({
      ...current,
      modelId: mode === "inpaint" ? "flux-inpaint" : "flux-upscale",
      prompt: "",
      init_image: `/api/media/${job.id}/0`,
      mask: undefined,
    }));
    setSelected(job);
    setView("studio");
    setNotice({ text: mode === "inpaint" ? t("Upload a mask to define the edit region.", "ارفع قناعاً لتحديد منطقة التعديل.") : t("Ready to upscale. Adjust prompt if desired.", "جاهز للتصغير. عدل الوصف إذا أردت.") });
  }

  function clearEditMode() {
    setEditMode("none");
    setEditImage(null);
    setEditMask(null);
    setInput(current => ({ ...current, init_image: undefined, mask: undefined }));
  }

  function exportShots() {
    const blob = new Blob([JSON.stringify({ studio: "Contigoo Cinematic Studio", exportedAt: new Date().toISOString(), shots: jobs }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "contigoo-shot-list.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const visiblePresets = presets.filter(preset => (filter === "All" || preset.category === filter) && `${preset.title} ${preset.category} ${preset.prompt}`.toLowerCase().includes(search.toLowerCase()));
  const visibleJobs = jobs.filter(job => `${job.input.project} ${job.input.prompt} ${getModel(job.input.modelId)?.name}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Contigoo Cinematic Studio"><span className="brand-mark"><Aperture size={28}/></span><span>contigoo<span className="brand-sub">CINEMATIC STUDIO</span></span></a>
      <div className="workspace-label"><span className="workspace-avatar">C</span><span>{t("Contigoo workspace", "مساحة كونتيجو")}<small>{t("Independent by design", "استقلالية منذ البداية")}</small></span><span className="small-dot"/></div>
      <span className="nav-caption">{t("WORKSPACE", "مساحة العمل")}</span>
      <nav aria-label={t("Main navigation", "التنقل الرئيسي")}>
        {([
          ["discover", Compass, t("Discover", "استكشف")],
          ["studio", Clapperboard, t("Cinema studio", "الاستوديو السينمائي")],
          ["library", FolderOpen, t("My library", "مكتبتي")],
          ["models", Cpu, t("Model library", "مكتبة النماذج")],
        ] as const).map(([id, Icon, label]) => <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => { setView(id); setSearch(""); }} aria-current={view === id ? "page" : undefined}><Icon size={18}/><span>{label}</span>{id === "library" && jobs.length > 0 && <span className="nav-count">{jobs.length}</span>}{id === "studio" && <span className="new-pill">BETA</span>}</button>)}
      </nav>
      <div className="sidebar-divider"/>
      <span className="nav-caption">{t("CREATE SOMETHING", "ابتكر شيئاً")}</span>
      <button className="nav-item" onClick={() => { changeKind("video"); setView("studio"); }}><Video size={18}/>{t("Generate video", "إنشاء فيديو")}</button>
      <button className="nav-item" onClick={() => { changeKind("image"); setView("studio"); }}><ImageIcon size={18}/>{t("Generate image", "إنشاء صورة")}</button>
      <div className="sidebar-bottom">
        <div className="own-models"><span className="outline-icon"><Layers3 size={20}/></span><h3>{t("Your vision. Your models.", "رؤيتك. نماذجك.")}</h3><p>{t("An open creative toolkit. A world of possibilities.", "أدوات إبداعية مفتوحة. عالم من الإمكانيات.")}</p><button onClick={() => setView("models")}>{t("Explore the models", "استكشف النماذج")}<ArrowRight size={14}/></button></div>
        <button className="nav-item settings-link" onClick={() => setSettings(true)}><Settings2 size={17}/>{t("Studio settings", "إعدادات الاستوديو")}</button>
        <div className="profile"><span className="profile-avatar">C</span><span>Contigoo<small>{t("Local workspace", "مساحة عمل محلية")}</small></span><span className="version">v0.1</span></div>
      </div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">{t("Workspace", "مساحة العمل")}<span>/</span><strong>{view === "discover" ? t("Discover", "استكشف") : view === "studio" ? t("Cinema studio", "الاستوديو السينمائي") : view === "library" ? t("My library", "مكتبتي") : t("Model library", "مكتبة النماذج")}</strong></div><div className="top-actions"><button className={`worker-status ${connection?.connected ? "online" : ""}`} onClick={() => setSettings(true)}><span/>{connection?.connected ? t("Worker connected", "الخادم متصل") : t("Connect GPU worker", "توصيل خادم المعالجة")}</button><button className="icon-button language" title={t("Switch to Arabic", "Switch to English")} aria-label="Switch language" onClick={() => setLocale(locale === "en" ? "ar" : "en")}><Globe2 size={17}/><span>{locale === "en" ? "العربية" : "EN"}</span></button></div></header>

      <div className={`content-layout ${view === "library" || view === "models" ? "wide" : ""}`}>
        <main id="main-content" className="main-content">
          {view === "discover" && <>
            <div className="page-intro"><div><div className="eyebrow"><span/>{t("A NEW FRAME OF POSSIBILITY", "أفق جديد للإبداع")}</div><h1>{t("Make the extraordinary.", "ابتكر ما هو استثنائي.")}</h1><p>{t("From the first spark to the final frame. Your story starts here.", "من الفكرة الأولى إلى الإطار الأخير. قصتك تبدأ هنا.")}</p></div><span className="edition">THE OPEN STUDIO<br/><b>VOL. 001 — 2026</b></span></div>
            <section className="hero">
              <Scenery/>
              <div className="hero-shade"/>
              <div className="hero-top"><span className="glass-tag"><Aperture size={13}/>{t("CONTIGOO ORIGINAL CONCEPT", "تصور أصلي من كونتيجو")}</span><span className="hero-frame">01 / 04</span></div>
              <div className="hero-content"><span className="hero-kicker">{t("IMAGINATION, IN MOTION", "خيال ينبض بالحركة")}</span><h2>{t("Every great film", "كل فيلم عظيم")}<br/><em>{t("starts with a vision.", "يبدأ برؤية.")}</em></h2><p>{t("Direct the light. Shape the atmosphere.\nBring the scene in your head to life.", "أخرج الضوء. شكّل الأجواء.\nامنح المشهد في خيالك حياة.")}</p><button className="primary light" onClick={() => usePreset(presets[0])}>{t("Create your first shot", "ابتكر لقطتك الأولى")}<ArrowRight size={16}/></button></div>
              <div className="hero-footer"><span>DESERT REVERIE</span><span>{t("Illustrated concept · not generated output", "تصور مرسوم · ليس نتيجة توليد")}</span></div>
            </section>
            <div className="quick-tools"><button onClick={() => { changeKind("video"); setView("studio"); }}><span className="tool-icon peach"><Video size={20}/></span><span><b>{t("Create a video", "أنشئ فيديو")}</b><small>{t("Turn an idea into a scene", "حوّل فكرة إلى مشهد")}</small></span><ArrowRight size={16}/></button><button onClick={() => { changeKind("image"); setView("studio"); }}><span className="tool-icon lavender"><ImageIcon size={20}/></span><span><b>{t("Create an image", "أنشئ صورة")}</b><small>{t("Find your visual language", "اكتشف لغتك البصرية")}</small></span><ArrowRight size={16}/></button></div>
            <section className="inspiration"><div className="section-heading"><div><h2>{t("A little direction. Infinite possibility.", "قليل من التوجيه. إمكانيات لا نهائية.")}</h2><p>{t("Original shot recipes to make your own.", "وصفات لقطات أصلية لتضيف رؤيتك الخاصة.")}</p></div><Sparkles size={18}/></div><div className="filter-row"><div className="chips">{["All", "Landscape", "Urban", "Nature", "Experimental"].map((category, index) => <button key={category} className={filter === category ? "selected" : ""} onClick={() => setFilter(category)}>{locale === "en" ? category : ["الكل", "مناظر", "مدن", "طبيعة", "تجريبي"][index]}</button>)}</div></div><div className="preset-grid">{visiblePresets.map((preset, index) => <button className="preset-card" key={preset.id} onClick={() => usePreset(preset)}><div className="preset-art"><Scenery scene={preset.scene}/><span className="preset-number">0{index + 1}</span><span className="preset-arrow"><ArrowRight size={17}/></span></div><div className="preset-details"><h3>{preset.title}</h3><span>{preset.category} <span>↗</span></span></div></button>)}</div></section>
            <div className="bottom-note"><Aperture size={14}/>{t("Built for imagination. Powered by open models.", "صُمم للخيال. يعمل بنماذج مفتوحة.")}<span>CONTIGOO © 2026</span></div>
          </>}

          {view === "studio" && <>
            <div className="page-intro"><div><div className="eyebrow"><span/>{t("THE DIRECTOR’S WORKSPACE", "مساحة المخرج")}</div><h1>{t("Set the scene.", "اصنع المشهد.")}</h1><p>{t("One idea. A thousand ways to see it.", "فكرة واحدة. ألف طريقة لرؤيتها.")}</p></div><button className="secondary" onClick={() => { setInput(initialInput); setSelected(null); }}><Plus size={16}/>{t("New shot", "لقطة جديدة")}</button></div>
            <div className="preview-panel" ref={preview}>
              {selected?.status === "completed" && selected.assets[0] ? <div className="generated-preview">{selected.assets[0].kind === "video" ? <video src={`/api/media/${selected.id}/0`} controls playsInline/> : <img src={`/api/media/${selected.id}/0`} alt={selected.input.prompt}/>}</div> : <><Scenery scene={scene}/><div className="viewfinder"><span/><span/><span/><span/></div><div className="preview-label"><span className="record-dot"/>{selected?.status === "queued" ? t("QUEUED ON WORKER", "في قائمة المعالجة") : t("CONCEPT VIEWFINDER", "معاينة التصور")}</div><div className="preview-center">{selected?.status === "queued" ? <LoaderCircle className="spin" size={30}/> : <Aperture size={34}/>}<h2>{selected?.status === "failed" ? t("This shot needs another take.", "تحتاج اللقطة إلى محاولة أخرى.") : selected?.status === "queued" ? t("Your vision is in the queue.", "رؤيتك في قائمة المعالجة.") : t("The next frame is yours.", "الإطار التالي لك.")}</h2><p>{selected?.error || t("Describe your shot, choose a model, and bring it to life.", "صِف لقطتك، اختر نموذجاً، وامنحها الحياة.")}</p></div><span className="concept-disclaimer">{t("Illustrated reference · no AI output yet", "مرجع مرسوم · لا توجد نتيجة توليد بعد")}</span></>}
              <div className="preview-controls"><span>{selected ? getModel(selected.input.modelId)?.name : getModel(input.modelId)?.name}</span><span>{selected?.input.aspect || input.aspect}</span><button className="icon-button" aria-label={t("Fullscreen preview", "معاينة بملء الشاشة")} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void preview.current?.requestFullscreen().catch(() => setNotice({ text: "Fullscreen is unavailable in this browser.", error: true })); }}><Expand size={16}/></button></div>
            </div>
            <div className="direction-note"><SlidersHorizontal size={18}/><p><b>{t("You’re in the director’s chair.", "أنت في مقعد المخرج.")}</b> {t("Camera and look presets enrich your prompt. Exact motion and consistency depend on the model and workflow.", "إعدادات الكاميرا والمظهر تثري الوصف. دقة الحركة والاتساق تعتمد على النموذج ومسار العمل.")}</p></div>
            {selected?.status === "completed" && <a className="primary output-download" href={`/api/media/${selected.id}/0?download=1`}><ArrowDownToLine size={16}/>{t("Download original", "تنزيل الأصل")}</a>}
            <section className="inspiration"><div className="section-heading"><h2>{t("Start with a feeling", "ابدأ بإحساس")}</h2><span className="muted">{t("SHOT RECIPES", "وصفات اللقطات")}</span></div><div className="preset-grid">{presets.map(preset => <button className="preset-card" key={preset.id} onClick={() => usePreset(preset)}><div className="preset-art"><Scenery scene={preset.scene}/><span className="preset-arrow"><ArrowRight size={16}/></span></div><div className="preset-details"><h3>{preset.title}</h3><span>{preset.category}</span></div></button>)}</div></section>
          </>}

          {view === "library" && <>
            <div className="page-intro"><div><div className="eyebrow"><span/>{t("YOUR CREATIVE ARCHIVE", "أرشيفك الإبداعي")}</div><h1>{t("Every shot, a possibility.", "كل لقطة، فرصة جديدة.")}</h1><p>{t("Saved ideas, works in progress, and the frames worth keeping.", "أفكار محفوظة، أعمال قيد التنفيذ، وإطارات تستحق الاحتفاظ بها.")}</p></div><button className="secondary" onClick={exportShots} disabled={!jobs.length}><ArrowDownToLine size={16}/>{t("Export shot list", "تصدير قائمة اللقطات")}</button></div>
            <div className="library-toolbar"><span>{jobs.length} {t("shots", "لقطات")} <span className="muted">/ {activeCount} {t("active", "نشطة")}</span></span><label className="search-box"><Search size={16}/><input aria-label={t("Search library", "بحث في المكتبة")} placeholder={t("Find a shot or project…", "ابحث عن لقطة أو مشروع…")} value={search} onChange={event => setSearch(event.target.value)}/></label></div>
            {!visibleJobs.length ? <div className="empty-state"><span><FolderOpen size={32}/></span><h2>{search ? t("No matching shots.", "لا توجد لقطات مطابقة.") : t("Great stories start with one shot.", "القصص العظيمة تبدأ بلقطة.")}</h2><p>{t("Save a shot from the composer. Your prompts and settings stay in this workspace.", "احفظ لقطة من لوحة الإنشاء. ستبقى أوصافك وإعداداتك في مساحة العمل.")}</p><button className="primary" onClick={() => setView("studio")}><Plus size={16}/>{t("Create a shot", "ابتكر لقطة")}</button></div> : <div className="library-grid">{visibleJobs.map(job => <article key={job.id} className="job-card"><button className="job-preview" onClick={() => { setSelected(job); setInput(job.input); setView("studio"); }}>{job.assets[0]?.kind === "image" ? <img src={`/api/media/${job.id}/0`} alt={job.input.prompt}/> : job.assets[0]?.kind === "video" ? <video src={`/api/media/${job.id}/0`} muted preload="metadata"/> : <div className="draft-art"><Clapperboard size={32}/><span>{t("SHOT NOTES", "ملاحظات اللقطة")}</span></div>}<span className={`status-tag ${job.status}`}>{job.status}</span></button><div className="job-content"><div className="job-project">{job.input.project}<small>{new Date(job.createdAt).toLocaleDateString(locale === "ar" ? "ar" : "en", { month: "short", day: "numeric" })}</small></div><p dir="auto">{job.input.prompt}</p><div className="job-meta">{getModel(job.input.modelId)?.name} · {job.input.aspect}</div>{job.error && <p className="job-error">{job.error}</p>}<div className="job-actions"><button onClick={() => { setInput(job.input); setSelected(job); setView("studio"); }}><WandSparkles size={14}/>{t("Open shot", "فتح اللقطة")}</button>{job.assets.length > 0 && <a href={`/api/media/${job.id}/0?download=1`} aria-label="Download output"><ArrowDownToLine size={15}/></a>}<button className="delete-button" disabled={["queued", "submitting"].includes(job.status)} onClick={() => void removeJob(job)} aria-label={t("Delete shot", "حذف اللقطة")}><Trash2 size={15}/></button></div></div></article>)}</div>}
          </>}

          {view === "models" && <>
            <div className="page-intro"><div><div className="eyebrow"><span/>{t("OPEN BY CHOICE", "مفتوح باختيارنا")}</div><h1>{t("Meet your creative engines.", "تعرّف على محركات إبداعك.")}</h1><p>{t("A considered collection of Apache-2.0 image and video models.", "مجموعة مختارة من نماذج الصور والفيديو بترخيص Apache-2.0.")}</p></div><button className="secondary" onClick={() => void refreshConnection()} disabled={checking}><RefreshCw size={16} className={checking ? "spin" : ""}/>{t("Check worker", "فحص الخادم")}</button></div>
            <div className="model-banner"><Layers3 size={25}/><div><h3>{t("The studio is yours. So is the infrastructure.", "الاستوديو لك. وكذلك البنية التحتية.")}</h3><p>{t("Connect your own ComfyUI worker on local or rented GPU hardware. No proprietary generation APIs are integrated.", "وصّل خادم ComfyUI على عتاد محلي أو مستأجر. لا توجد واجهات توليد احتكارية مدمجة.")}</p></div><span>APACHE 2.0</span></div>
            <div className="model-grid">{models.map(model => { const state = connection?.models.find(item => item.id === model.id); return <article className="model-card" key={model.id}><div className="model-top"><span className={`model-symbol ${model.color}`}>{model.kind === "image" ? <ImageIcon size={24}/> : <Video size={24}/>}</span><span className={`model-state ${state?.ready ? "ready" : ""}`}>{state?.ready ? t("Available", "متاح") : state?.configured ? t("Worker required", "يتطلب خادماً") : t("Workflow required", "يتطلب مسار عمل")}</span></div><small>{model.maker}</small><h2>{model.name}</h2><span className="model-tag">{model.tag}</span><p>{model.description}</p><div className="hardware-note"><Cpu size={15}/><span>{model.hardware}</span></div><div className="model-actions"><a href={model.source} target="_blank" rel="noreferrer">{t("Model & license", "النموذج والترخيص")} ↗</a><button onClick={() => { setInput(current => ({ ...current, modelId: model.id, aspect: model.kind === "video" && current.aspect === "1:1" ? "16:9" : current.aspect })); setView("studio"); }}>{t("Use model", "استخدم النموذج")}<ArrowRight size={14}/></button></div></article>; })}</div><div className="direction-note"><Aperture size={18}/><p>{t("Quality is earned through testing. We make no percentage-parity claims against closed models. Image editing, reference uploads, motion transfer, and a manual timeline editor are planned follow-up work.", "تُثبت الجودة بالاختبار. لا ندّعي نسب تكافؤ مع النماذج المغلقة. تحرير الصور ورفع المراجع ونقل الحركة والمونتاج اليدوي ضمن المراحل القادمة.")}</p></div>
          </>}
        </main>

        {(view === "discover" || view === "studio") && <aside className="composer" aria-label={t("Shot composer", "لوحة إنشاء اللقطة")}>
          {isEditingModel && (
            <div className="edit-mode-banner">
              <button className="clear-edit" onClick={clearEditMode}><X size={16}/>{t("Exit edit mode", "الخروج من وضع التعديل")}</button>
              <div className="edit-preview">
                <div><strong>{t("Source image", "الصورة المصدر")}</strong>{editImage && <img src={editImage} alt={t("Source", "المصدر")}/>}</div>
                {editMode === "inpaint" && (
                  <div>
                    <strong>{t("Mask (paint edit region)", "القناع (منطقة التعديل)")}</strong>
                    <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, setEditMask); }}/>
                    {editMask && <img src={editMask} alt={t("Mask", "القناع")}/>}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="composer-heading"><div><Sparkles size={17}/><h2>{t("Let's create", "لنبتكر")}</h2></div><span>STUDIO / 01</span></div>
          <div className="mode-switch"><button className={kind === "video" ? "active" : ""} onClick={() => changeKind("video")}><Video size={16}/>{t("Video", "فيديو")}</button><button className={kind === "image" ? "active" : ""} onClick={() => changeKind("image")}><ImageIcon size={16}/>{t("Image", "صورة")}</button></div>
          <label className="field"><span>{t("Project", "المشروع")}</span><div className="input-wrap"><FolderOpen size={15}/><input value={input.project} maxLength={100} onChange={event => update("project", event.target.value)} aria-label={t("Project name", "اسم المشروع")}/></div></label>
          <label className="field"><span>{t("Model", "النموذج")}<span className="tiny-label">OPEN MODEL</span></span><div className="select-wrap model-select"><Cpu size={17}/><select value={input.modelId} onChange={event => update("modelId", event.target.value)} aria-label={t("Generation model", "نموذج التوليد")}>{models.filter(model => model.kind === kind).map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select><ChevronDown size={14}/></div></label>
          <label className="field prompt-field"><span>{t("Your vision", "رؤيتك")}<span className="muted">{input.prompt.length} / 4000</span></span><textarea dir="auto" aria-label={t("Your vision", "رؤيتك")} placeholder={t("A lone traveler, an endless desert. The last light of day catches the dunes…\n\nDescribe the scene you imagine.", "مسافر وحيد في صحراء لا نهاية لها. آخر ضوء للنهار يلامس الكثبان…\n\nصِف المشهد الذي تتخيله.")} maxLength={4000} value={input.prompt} onChange={event => update("prompt", event.target.value)}/><button className="prompt-inspire" onClick={() => { const preset = presets[Math.floor(Math.random() * presets.length)]; update("prompt", preset.prompt); setScene(preset.scene); }}><WandSparkles size={13}/>{t("Inspire me", "ألهمني")}</button></label>
          <div className="field"><span>{t("Aspect ratio", "نسبة الأبعاد")}</span><div className="aspect-options">{(["16:9", "9:16", "1:1"] as const).filter(aspect => kind === "image" || aspect !== "1:1").map(aspect => <button key={aspect} className={input.aspect === aspect ? "active" : ""} onClick={() => update("aspect", aspect)} aria-pressed={input.aspect === aspect}><span className={`ratio-icon ratio-${aspect.replace(":", "-")}`}/>{aspect}</button>)}</div></div>
          {kind === "video" && <div className="field"><span>{t("Shot length", "مدة اللقطة")}<small className="muted">24 FPS</small></span><div className="duration-options">{([3, 5] as const).map(duration => <button key={duration} className={input.duration === duration ? "active" : ""} onClick={() => update("duration", duration)}>{duration}{t(" seconds", " ثوانٍ")}</button>)}</div></div>}
          <div className="composer-divider"/>
          <div className="director-label"><Clapperboard size={15}/>{t("Director’s controls", "أدوات المخرج")}<span>{t("PROMPT PRESETS", "إعدادات الوصف")}</span></div>
          {kind === "video" && <label className="field"><span>{t("Camera movement", "حركة الكاميرا")}</span><div className="select-wrap"><Film size={15}/><select value={input.camera} onChange={event => update("camera", event.target.value as keyof typeof cameraMoves)} aria-label={t("Camera movement", "حركة الكاميرا")}>{Object.keys(cameraMoves).map((key, index) => <option value={key} key={key}>{locale === "en" ? ["Static · locked-off", "Dolly in", "Orbit", "Crane up", "Handheld"][index] : ["ثابتة", "اقتراب تدريجي", "دوران", "ارتفاع", "محمولة باليد"][index]}</option>)}</select><ChevronDown size={14}/></div></label>}
          <label className="field"><span>{t("Visual tone", "المظهر البصري")}</span><div className="select-wrap"><span className={`tone-swatch ${input.look}`}/><select value={input.look} onChange={event => update("look", event.target.value as keyof typeof looks)} aria-label={t("Visual tone", "المظهر البصري")}>{Object.keys(looks).map((key, index) => <option value={key} key={key}>{locale === "en" ? ["Natural cinema", "Golden hour", "Midnight noir", "Soft dream"][index] : ["سينما طبيعية", "الساعة الذهبية", "ليل سينمائي", "حلم ناعم"][index]}</option>)}</select><ChevronDown size={14}/></div></label>
          <button className="advanced-toggle" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}><SlidersHorizontal size={14}/>{t("Advanced settings", "إعدادات متقدمة")}<ChevronDown size={14} className={advanced ? "rotated" : ""}/></button>
          {advanced && <label className="field"><span>{t("Seed", "بذرة التوليد")}<button className="text-button" onClick={() => update("seed", Math.floor(Math.random() * 2147483647))}>{t("Randomize", "عشوائي")}</button></span><input type="number" min={0} max={2147483647} value={input.seed} onChange={event => update("seed", Number(event.target.value))}/><small className="muted">{t("The same seed helps compare prompt variations.", "البذرة الثابتة تساعد على مقارنة الأوصاف.")}</small></label>}
          <div className="generate-area">{!ready && <button className="connection-hint" onClick={() => setSettings(true)}><span className="small-dot"/>{checking ? t("Checking worker…", "فحص الخادم…") : t("Connect a workflow to generate", "وصّل مسار عمل لبدء التوليد")}<ArrowRight size={13}/></button>}<button className="primary generate-button" disabled={busy || input.prompt.trim().length < 3 || !input.project.trim() || !ready} onClick={() => void submit("generate")}>{busy ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={18}/>}<span>{kind === "video" ? t("Generate video", "إنشاء فيديو") : t("Generate image", "إنشاء صورة")}</span><ArrowRight size={17}/></button><button className="save-draft" disabled={busy || input.prompt.trim().length < 3 || !input.project.trim()} onClick={() => void submit("draft")}><Plus size={14}/>{t("Save shot to library", "حفظ اللقطة في المكتبة")}</button><p className="composer-footnote"><Layers3 size={11}/>{t("Your hardware. Open models. No API credits.", "عتادك. نماذج مفتوحة. بلا أرصدة API.")}</p></div>
        </aside>}
      </div>
    </div>

    {notice && <div className={`toast ${notice.error ? "error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.error ? <Radio size={17}/> : <Check size={17}/>}<span>{notice.text}</span><button aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={15}/></button></div>}
    <dialog ref={dialog} className="settings-dialog" onCancel={() => setSettings(false)} onClose={() => setSettings(false)}><div className="dialog-heading"><span className="model-symbol peach"><Cpu size={23}/></span><button className="icon-button" aria-label="Close settings" onClick={() => setSettings(false)}><X size={20}/></button></div><div className="eyebrow">{t("YOUR INFRASTRUCTURE", "بنيتك التحتية")}</div><h2>{t("Connect your creative engine.", "وصّل محرك إبداعك.")}</h2><p>{t("Run ComfyUI on your GPU machine, configure the server environment, then check the connection.", "شغّل ComfyUI على جهاز المعالجة، اضبط إعدادات الخادم، ثم افحص الاتصال.")}</p><div className={`connection-box ${connection?.connected ? "connected" : ""}`}><Radio size={18}/><div><b>{connection?.connected ? t("Worker connected", "الخادم متصل") : t("Worker not connected", "الخادم غير متصل")}</b><p>{connection?.message || t("Checking connection…", "جارٍ فحص الاتصال…")}</p></div></div><ol className="setup-steps"><li>{t("Create studio/.env.local and set:", "أنشئ studio/.env.local واضبط:")}<code dir="ltr">COMFYUI_URL=http://127.0.0.1:8188</code></li><li>{t("Install model weights and configure workflows/profiles.json. A FLUX.1 Schnell starter graph is included.", "ثبّت أوزان النموذج واضبط workflows/profiles.json. يتوفر مسار أولي لنموذج FLUX.1 Schnell.")}</li><li>{t("Restart the web app. Full instructions: workflows/README.md.", "أعد تشغيل التطبيق. التعليمات الكاملة: workflows/README.md.")}</li></ol><div className="workflow-list">{connection?.models.map(state => <div key={state.id}><span className={state.ready ? "ready-dot" : "small-dot"}/><div><b>{getModel(state.id)?.name}</b><small>{state.detail}</small></div></div>)}</div><button className="primary" onClick={() => void refreshConnection()} disabled={checking}><RefreshCw className={checking ? "spin" : ""} size={16}/>{t("Check connection", "فحص الاتصال")}</button><p className="settings-footnote">{t("This version is a single-user local workspace. Model installation and GPU inference are separate from the web app.", "هذا الإصدار مساحة محلية لمستخدم واحد. تثبيت النماذج وتشغيلها منفصلان عن تطبيق الويب.")}</p></dialog>
  </div>;
}
