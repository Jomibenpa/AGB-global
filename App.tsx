import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MapPin, 
  Activity, 
  LayoutDashboard, 
  Plus, 
  ArrowLeft,
  Building,
  Maximize,
  DollarSign,
  UploadCloud,
  RefreshCw,
  Printer,
  Menu,
  X,
  Globe,
  Download,
  XCircle,
  Search,
  Calculator
} from 'lucide-react';

import { CONSTANTS, DEFAULT_SITES } from './constants';
import { SiteData, AnalysisResult, MarketType, Verdict } from './types';
import { VerdictBadge, ScoreGauge } from './components/UIComponents';
import { SensitivityMatrix } from './components/SensitivityMatrix';
import { GeminiInsights } from './components/GeminiInsights';
import { MapView } from './components/MapView';

/**
 * AGD - AIR GLOBAL DASHBOARD SYSTEM
 * Ported to React/Tailwind with Gemini Maps Grounding
 */

// --- LOGIC ---

const calculateAnalysis = (site: SiteData, sensitivityAdr?: number, sensitivityOcc?: number): AnalysisResult => {
  const adr = sensitivityAdr ?? site.marketAdr;
  const occ = sensitivityOcc ?? site.marketOcc;

  // CAPEX
  const totalBuiltM2 = (site.units * CONSTANTS.AREA_PER_UNIT) + CONSTANTS.COMMON_AREA_M2 + CONSTANTS.SERVICES_M2;
  const constructionCapex = totalBuiltM2 * CONSTANTS.CONSTRUCTION_COST_PER_M2;
  const ffe = (CONSTANTS.FF_E_BASE / CONSTANTS.BASE_UNITS) * site.units;
  const totalCapex = site.landPrice + constructionCapex + ffe + CONSTANTS.ENGINEERING_FEES + CONSTANTS.URBANIZATION + CONSTANTS.CONTINGENCY;
  const landCapexRatio = totalCapex > 0 ? (site.landPrice / totalCapex) * 100 : 0;

  // REVENUE
  let realOccupancy = occ * CONSTANTS.EFFICIENCY_FACTOR;
  if (realOccupancy > 0.85) realOccupancy = 0.85; 
  const annualGrossRevenueRooms = (adr * realOccupancy * 365 * site.units);
  const platformFees = annualGrossRevenueRooms * CONSTANTS.PLATFORM_FEE;
  const otherIncome = (CONSTANTS.OTHER_INCOME_MONTHLY * (site.units / CONSTANTS.BASE_UNITS)) * 12;
  const netRevenue = annualGrossRevenueRooms - platformFees + otherIncome;

  // OPEX
  const reductionRatio = site.units < CONSTANTS.BASE_UNITS 
    ? (CONSTANTS.BASE_UNITS - site.units) / CONSTANTS.BASE_UNITS 
    : 0;
  const adjustedPlanilla = CONSTANTS.BASE_PLANILLA_MONTHLY * (1 - (0.5 * reductionRatio));
  const totalFixedAnnual = (adjustedPlanilla + CONSTANTS.OTHER_FIXED_MONTHLY) * 12;
  const nightsOccupied = (realOccupancy * 365 * site.units);
  const variableOpexAnnual = nightsOccupied * CONSTANTS.VARIABLE_OPEX_PER_NIGHT;
  const totalOpex = totalFixedAnnual + variableOpexAnnual;

  // FINANCIALS
  const uai = netRevenue - totalOpex; 
  const tax = uai * site.taxRate;
  const netFlow = uai - tax;
  const cocReturn = totalCapex > 0 ? (netFlow / totalCapex) * 100 : 0;

  // --- NEW AGD SCORING LOGIC (v1.5) ---
  
  // 1. FINANCIAL SCORE (30%) - Based on ROI ranges
  let finScore = 0;
  if (cocReturn > 27) finScore = 30;
  else if (cocReturn > 24) finScore = 25;
  else if (cocReturn > 21) finScore = 20;
  else if (cocReturn > 18) finScore = 15;
  else if (cocReturn > 15) finScore = 10;
  else if (cocReturn > 12) finScore = 5;
  else finScore = 0;

  // 2. EFFICIENCY SCORE (30%) - Based on Land/Capex Ratio
  // Lower ratio is better.
  let effScore = 0;
  if (landCapexRatio <= 15) effScore = 30;
  else if (landCapexRatio <= 20) effScore = 25;
  else if (landCapexRatio <= 25) effScore = 20;
  else if (landCapexRatio <= 30) effScore = 15;
  else if (landCapexRatio <= 35) effScore = 10;
  else effScore = 0;

  // 3. EXPERIENCE SCORE (30%) - Based on View + Centrality
  let expScore = 0;
  if (site.marketType === 'Unremarkable') {
    expScore = 5; // Fixed penalty score
  } else {
    // Normal calculation: Scale of (View + Centrality) out of 10, mapped to 30 points
    const totalExpPoints = (site.viewScore || 3) + (site.centralityScore || 3); // Max 10
    expScore = (totalExpPoints / 10) * 30;
  }

  // 4. MARKET SCORE (10%) - Residual weight for raw market potential
  // Normalized occupancy score (0.7 occ = max)
  const marketScore = Math.min((site.marketOcc / 0.70) * 10, 10);

  // TOTAL
  let airroiScore = finScore + effScore + expScore + marketScore;
  airroiScore = Math.min(Math.max(airroiScore, 0), 100);

  // VERDICT LOGIC
  let verdict: Verdict = 'NO-GO';
  let verdictReason = "Retorno inferior al 12%. Riesgo financiero elevado.";

  if (cocReturn >= 18) {
    verdict = 'GO';
    verdictReason = "Retorno excelente (>18%). Proyecto altamente viable.";
  } else if (cocReturn >= 15) {
    verdict = 'GO';
    verdictReason = "Retorno saludable (>15%). Proyecto viable.";
  } else if (cocReturn >= 12) {
    verdict = 'GO CONDITIONAL';
    verdictReason = "Retorno moderado (12-15%). Requiere optimizar CAPEX.";
  }

  if (landCapexRatio > 35 && verdict === 'GO') {
    verdict = 'GO CONDITIONAL';
    verdictReason = "Riesgo por sobrecosto de tierra (>35% CAPEX) a pesar del retorno.";
  }

  if (site.marketType === 'Unremarkable' && verdict !== 'NO-GO') {
     verdictReason += " Nota: Ubicación 'Unremarkable' limita el potencial de apreciación.";
  }

  return {
    totalCapex,
    landCapexRatio,
    grossRevenue: annualGrossRevenueRooms + otherIncome,
    netRevenue,
    opex: totalOpex,
    netFlow,
    cocReturn,
    score: airroiScore,
    verdict,
    verdictReason
  };
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
};

const parseCoordinates = (input: string): { lat: number, lng: number } | null => {
  if (!input) return null;
  const cleanInput = input.trim();
  
  // Try matching standard "lat, lng"
  const decimalPattern = /(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/;
  const decimalMatch = cleanInput.match(decimalPattern);
  
  // If it's a Google Maps URL, it often has @lat,lng
  if (cleanInput.includes('@')) {
    const urlPattern = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const urlMatch = cleanInput.match(urlPattern);
    if (urlMatch) return { lat: parseFloat(urlMatch[1]), lng: parseFloat(urlMatch[2]) };
  }
  
  // If we found a simple decimal match (even if inside text)
  if (decimalMatch) return { lat: parseFloat(decimalMatch[1]), lng: parseFloat(decimalMatch[2]) };
  
  return null;
};

// --- MAIN APP ---

export default function App() {
  
  // Persistence
  const [sites, setSites] = useState<SiteData[]>(() => {
      try {
          const saved = localStorage.getItem('agd_sites_v1_4');
          if (saved) return JSON.parse(saved);
      } catch (e) { console.error("Load error", e); }
      return DEFAULT_SITES;
  });

  useEffect(() => {
      localStorage.setItem('agd_sites_v1_4', JSON.stringify(sites));
  }, [sites]);

  // UI State
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mapFilter, setMapFilter] = useState<MarketType | 'All'>('All');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 

  // Form
  const initialFormState: Partial<SiteData> = {
    country: 'Guatemala',
    taxRate: 0.07,
    units: 12,
    model: 'Hybrid',
    marketType: 'Ocean View',
    viewScore: 3,
    centralityScore: 3,
    lat: 14.634, 
    lng: -90.506,
    usablePercent: 100,
    marketOcc: 0.45 
  };
  const [formData, setFormData] = useState<Partial<SiteData>>(initialFormState);
  const [coordInput, setCoordInput] = useState(""); 
  
  const jsonImportRef = useRef<HTMLInputElement>(null);

  // Simulation
  const [simAdr, setSimAdr] = useState<number>(0);
  const [simOcc, setSimOcc] = useState<number>(0);

  // Computed
  const activeSite = useMemo(() => sites.find(s => s.id === selectedSiteId), [sites, selectedSiteId]);
  
  const activeAnalysis = useMemo(() => {
    if (!activeSite) return null;
    return calculateAnalysis(activeSite, simAdr || activeSite.marketAdr, simOcc || activeSite.marketOcc);
  }, [activeSite, simAdr, simOcc]);

  const suggestedUnits = useMemo(() => {
    if (!formData.landArea || !formData.model) return 0;
    
    const densityPrivate = CONSTANTS.REFERENCE_LAND_AREA / CONSTANTS.REFERENCE_UNITS; 
    let targetDensity = densityPrivate; 

    if (formData.model === 'Entire Place') {
        targetDensity = densityPrivate * CONSTANTS.FACTOR_ENTIRE_PLACE; 
    } else if (formData.model === 'Hybrid') {
        targetDensity = densityPrivate * CONSTANTS.FACTOR_HYBRID; 
    }

    const usablePercentage = formData.usablePercent || 100;
    const effectiveLandArea = formData.landArea * (usablePercentage / 100);

    return Math.floor(effectiveLandArea / targetDensity);
  }, [formData.landArea, formData.model, formData.usablePercent]);

  useEffect(() => {
    if (activeSite) {
      setSimAdr(activeSite.marketAdr);
      setSimOcc(activeSite.marketOcc);
    }
  }, [activeSite]);

  // Handlers
  const openNewSiteModal = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setCoordInput("");
    setIsModalOpen(true);
    setIsSidebarOpen(false);
  };

  const openEditSiteModal = (e: React.MouseEvent, site: SiteData) => {
    e.stopPropagation();
    setEditingId(site.id);
    setFormData({ ...site });
    setCoordInput(""); // Clear paste input
    setIsModalOpen(true);
  };

  const handleCoordPaste = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCoordInput(val);
    const parsed = parseCoordinates(val);
    if (parsed) {
      setFormData(prev => ({ ...prev, lat: parsed.lat, lng: parsed.lng }));
    }
  };

  const handleSaveSite = () => {
    if (!formData.name || !formData.landPrice) {
        alert("Faltan datos obligatorios.");
        return;
    }
    
    const finalLat = formData.lat || 14.634;
    const finalLng = formData.lng || -90.506;
    const finalOcc = formData.marketOcc || 0.45;

    const siteDataToSave = {
        ...formData,
        lat: finalLat,
        lng: finalLng,
        marketOcc: finalOcc
    } as SiteData;

    if (editingId) {
      setSites(sites.map(s => s.id === editingId ? { ...s, ...siteDataToSave } : s));
    } else {
      const site: SiteData = {
        ...siteDataToSave,
        id: Math.random().toString(36).substr(2, 9),
      };
      setSites([...sites, site]);
      setSelectedSiteId(site.id);
    }
    setIsModalOpen(false);
  };

  const exportData = () => {
    const dataStr = JSON.stringify(sites, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AGD_Backup.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedSites = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedSites)) {
          if(window.confirm(`¿Cargar ${importedSites.length} propiedades?`)) {
              setSites(importedSites);
              setSelectedSiteId(null);
          }
        }
      } catch (err) { alert("Error JSON"); }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const resetData = () => {
      if(window.confirm("¿Restaurar todo?")) {
          setSites(DEFAULT_SITES);
          setSelectedSiteId(null);
      }
  };

  const marketTypesList: MarketType[] = ['Ocean View', 'Lake View', 'Volcano View', 'Mountain View', 'Turistic Location', 'Historic Location', 'Unremarkable'];

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200 font-sans overflow-hidden selection:bg-emerald-500/30 print:bg-white print:text-black print:overflow-visible print:h-auto print:block">
      
      {/* Print Engine Styles */}
      <style>{`
        @media print {
          @page { margin: 1cm; size: landscape; }
          html, body, #root, .flex-col, main { 
            height: auto !important; 
            overflow: visible !important; 
            display: block !important; 
            background: white !important;
            color: black !important;
          }
          .no-print, header, nav, button, .w-80, .fixed { display: none !important; }
          h1, h2, h3, p, span { color: black !important; text-shadow: none !important; }
          .text-slate-400, .text-slate-500 { color: #444 !important; }
          .text-white { color: black !important; }
          .bg-slate-900, .bg-slate-950, .bg-slate-800 { 
            background: transparent !important; 
            border: 1px solid #ccc !important; 
            box-shadow: none !important;
          }
          .grid { display: grid !important; page-break-inside: avoid; }
          .p-8 { padding: 0 !important; }
          ::-webkit-scrollbar { display: none; }
        }
      `}</style>

      {/* HEADER */}
      <header className="flex items-center justify-between px-4 md:px-6 py-4 bg-slate-950 border-b border-slate-800 shadow-md z-20 no-print">
        <div className="flex items-center gap-3">
          <div className="md:hidden">
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-white">
                {isSidebarOpen ? <X className="w-6 h-6"/> : <Menu className="w-6 h-6"/>}
             </button>
          </div>
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-2 rounded-lg shadow-lg shadow-emerald-900/50 hidden md:block">
            <Globe className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight text-white flex items-center gap-2">
              AGD <span className="text-emerald-500">GLOBAL</span>
            </h1>
            <p className="text-[8px] md:text-[10px] text-slate-500 tracking-[0.2em] font-bold">SYSTEM v1.4</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-800 mr-2 hidden md:flex">
             <button onClick={exportData} className="p-2 text-slate-400 hover:text-emerald-400 transition-all"><Download className="w-4 h-4" /></button>
             <button onClick={() => jsonImportRef.current?.click()} className="p-2 text-slate-400 hover:text-blue-400 transition-all"><UploadCloud className="w-4 h-4" /></button>
             <button onClick={resetData} className="p-2 text-slate-400 hover:text-rose-400 transition-all"><RefreshCw className="w-4 h-4" /></button>
             <input type="file" ref={jsonImportRef} className="hidden" accept=".json" onChange={importData} />
          </div>
          <button onClick={openNewSiteModal} className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs md:text-sm font-bold shadow-lg transition-all whitespace-nowrap">
            <Plus className="w-4 h-4" /> <span className="hidden md:inline">Nuevo</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* SIDEBAR */}
        <div className={`
            absolute md:relative z-30 h-full w-80 bg-slate-950 border-r border-slate-800 flex flex-col no-print transition-transform duration-300
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="p-4 border-b border-slate-800">
            <div className="flex gap-2 mb-2 flex-wrap">
              <button onClick={() => setMapFilter('All')} className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wide transition-all ${mapFilter === 'All' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/50' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>All</button>
              {marketTypesList.map(filter => (
                <button key={filter} onClick={() => setMapFilter(filter as any)} className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wide transition-all ${mapFilter === filter ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/50' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>{filter}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {sites.filter(s => mapFilter === 'All' || s.marketType === mapFilter).map(site => {
                const analysis = calculateAnalysis(site);
                
                // Color Semaphore Logic
                let verdictColor = "text-rose-500";
                if (analysis.verdict === 'GO') verdictColor = "text-emerald-400";
                else if (analysis.verdict === 'GO CONDITIONAL') verdictColor = "text-amber-400";

                return (
                  <div 
                    key={site.id} 
                    onClick={() => { setSelectedSiteId(site.id); setIsSidebarOpen(false); }} 
                    className={`p-4 border-b border-slate-800/50 cursor-pointer hover:bg-slate-900 transition-all ${selectedSiteId === site.id ? 'bg-slate-900 border-l-4 border-l-emerald-500' : 'border-l-4 border-l-transparent'}`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="overflow-hidden pr-2">
                        <h3 className={`font-bold text-sm truncate ${selectedSiteId === site.id ? 'text-white' : 'text-slate-400'}`}>{site.name}</h3>
                        <span className="text-[10px] text-slate-500 block truncate">{site.marketType}</span>
                      </div>
                      <div className="text-right whitespace-nowrap pl-2">
                        <span className={`block font-black text-sm ${verdictColor}`}>AGD: {analysis.score.toFixed(0)}</span>
                        <span className="block text-[10px] text-slate-500 font-mono mt-0.5">ROI: {analysis.cocReturn.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                );
            })}
          </div>
        </div>

        {/* OVERLAY */}
        {isSidebarOpen && (
            <div className="absolute inset-0 bg-black/50 z-20 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>
        )}

        {/* MAIN CONTENT */}
        <main className="flex-1 relative bg-slate-900 overflow-y-auto custom-scrollbar">
          
          {/* MAP */}
          {!selectedSiteId && !isModalOpen && (
             <div className="absolute inset-0 z-0 bg-slate-900 no-print">
                 <MapView sites={sites} onSelectSite={setSelectedSiteId} calculateAnalysis={calculateAnalysis} />
                 
                 {/* Map Overlay Title */}
                 <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-slate-950/80 backdrop-blur px-6 py-3 rounded-full border border-slate-800 pointer-events-none z-[1000] shadow-2xl">
                    <h2 className="text-xl font-thin text-slate-300">AGD <strong className="text-emerald-500">MAP</strong></h2>
                 </div>
             </div>
          )}

          {/* DETAIL VIEW */}
          {activeSite && activeAnalysis && !isModalOpen && (
            <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 pb-20 print:p-4">
              
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-4 no-print">
                <button onClick={() => setSelectedSiteId(null)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
                  <ArrowLeft className="w-4 h-4" /> Volver
                </button>
                <div className="flex gap-2">
                    <button onClick={(e) => openEditSiteModal(e, activeSite)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs rounded font-bold transition-colors">
                        Editar
                    </button>
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs rounded font-bold transition-colors">
                    <Printer className="w-4 h-4"/> <span className="hidden md:inline">IMPRIMIR REPORTE</span>
                    </button>
                </div>
              </div>

              {/* 1. HERO SECTION */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative">
                 {/* Background Image Layer */}
                 <div className="absolute inset-0 h-48 md:h-64 z-0 no-print">
                    {activeSite.imageUrl ? (
                      <img src={activeSite.imageUrl} className="w-full h-full object-cover opacity-30 mask-image-b" alt={activeSite.name} />
                    ) : <div className="w-full h-full bg-slate-800" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent" />
                 </div>

                 <div className="relative z-10 p-6 md:p-8 pt-24 md:pt-32 print:p-6 print:pt-6">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                        <div className="w-full">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded border border-emerald-500/30 print:border-black print:text-black">{activeSite.model}</span>
                                <span className="text-slate-400 text-xs flex items-center gap-1 print:text-gray-600"><MapPin className="w-3 h-3"/> {activeSite.country}</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2 leading-none print:text-black">{activeSite.name}</h1>
                            <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm text-slate-400 print:text-gray-600">
                                <span className="flex items-center gap-1.5"><Maximize className="w-4 h-4 text-slate-500"/> {activeSite.landArea} m²</span>
                                <span className="flex items-center gap-1.5"><Building className="w-4 h-4 text-slate-500"/> {activeSite.units} Unidades</span>
                                <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-slate-500"/> {formatCurrency(activeSite.landPrice)} Terreno</span>
                            </div>
                        </div>
                        
                        {/* GAUGE & VERDICT */}
                        <div className="w-full lg:w-auto flex items-center justify-between lg:justify-end gap-6 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 backdrop-blur-sm print:bg-transparent print:border-none">
                            <div className="text-left lg:text-right">
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Dictamen AGD</p>
                                <VerdictBadge verdict={activeAnalysis.verdict} />
                            </div>
                            <div className="h-12 w-px bg-slate-800 no-print"></div>
                            <ScoreGauge score={activeAnalysis.score} />
                        </div>
                    </div>
                 </div>

                 {/* 2. KPI GRID */}
                 <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-slate-800 bg-slate-900/50 print:bg-white print:border-t print:border-gray-200">
                    <div className="p-6 border-b border-r border-slate-800 print:border-gray-200">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">CAPEX Total</p>
                        <p className="text-xl md:text-2xl font-black text-white tracking-tight">{formatCurrency(activeAnalysis.totalCapex)}</p>
                    </div>
                    <div className="p-6 border-b lg:border-r border-slate-800 print:border-gray-200">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Flujo Neto Anual</p>
                        <p className="text-xl md:text-2xl font-black text-emerald-400 tracking-tight">{formatCurrency(activeAnalysis.netFlow)}</p>
                    </div>
                    <div className="p-6 border-r border-slate-800 relative bg-emerald-900/5 print:bg-gray-50 print:border-gray-200">
                        <p className="text-[10px] text-emerald-500/70 uppercase font-bold tracking-wider mb-2">AGD Score</p>
                        <p className="text-2xl md:text-3xl font-black text-emerald-400 tracking-tight">{activeAnalysis.score.toFixed(0)}</p>
                    </div>
                    <div className="p-6 border-slate-800 print:border-gray-200">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Estimated ROI</p>
                        <p className="text-xl md:text-2xl font-black text-white tracking-tight">{activeAnalysis.cocReturn.toFixed(1)}%</p>
                    </div>
                 </div>
              </div>

              {/* 3. LOWER SECTION */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                 
                 {/* Main Column */}
                 <div className="lg:col-span-2 space-y-6">
                    
                    {/* Gemini AI Insights */}
                    <GeminiInsights site={activeSite} />

                    {/* Stress Lab */}
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-lg print:border-gray-300 print:shadow-none">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-white flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-500"/> Laboratorio de Estrés</h3>
                            <span className="text-[10px] text-slate-500 border border-slate-700 px-2 py-1 rounded">SIMULACIÓN</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                            <div>
                                <div className="flex justify-between text-xs mb-2">
                                    <span className="text-slate-400">Base: ${activeSite.marketAdr}</span>
                                    <span className="text-white font-mono bg-slate-800 px-2 rounded print:text-black print:bg-gray-100">${simAdr.toFixed(0)}</span>
                                </div>
                                <input type="range" min={activeSite.marketAdr * 0.5} max={activeSite.marketAdr * 1.5} value={simAdr} onChange={(e) => setSimAdr(Number(e.target.value))} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 touch-none no-print" />
                            </div>
                            <div>
                                <div className="flex justify-between text-xs mb-2">
                                    <span className="text-slate-400">Base: {(activeSite.marketOcc * 100).toFixed(0)}%</span>
                                    <span className="text-white font-mono bg-slate-800 px-2 rounded print:text-black print:bg-gray-100">{(simOcc * 100).toFixed(0)}%</span>
                                </div>
                                <input type="range" min={0.1} max={0.9} step={0.01} value={simOcc} onChange={(e) => setSimOcc(Number(e.target.value))} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 touch-none no-print" />
                            </div>
                        </div>

                        <div className="mb-6 overflow-x-auto">
                            <h4 className="text-xs font-bold text-slate-500 mb-3">Matriz de Sensibilidad (ROI %)</h4>
                            <SensitivityMatrix site={activeSite} />
                        </div>
                    </div>
                 </div>

                 {/* Financials & Verdict Text */}
                 <div className="space-y-6">
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 print:border-gray-300">
                        <h3 className="font-bold text-white mb-4 text-sm">Desglose Financiero</h3>
                        <div className="space-y-3 text-xs">
                            <div className="flex justify-between py-2 border-b border-slate-800/50 print:border-gray-200">
                                <span className="text-slate-400">Ingresos Brutos</span>
                                <span className="text-white font-mono">{formatCurrency(activeAnalysis.grossRevenue)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-800/50 print:border-gray-200">
                                <span className="text-slate-400">OPEX Total</span>
                                <span className="text-rose-400 font-mono">-{formatCurrency(activeAnalysis.opex)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-800/50 print:border-gray-200">
                                <span className="text-slate-400">Impuestos</span>
                                <span className="text-rose-400 font-mono">-{formatCurrency((activeAnalysis.netFlow/(1-activeSite.taxRate)) * activeSite.taxRate)}</span>
                            </div>
                            <div className="flex justify-between py-3">
                                <span className="text-emerald-400 font-bold">Flujo Neto</span>
                                <span className="text-emerald-400 font-bold font-mono text-sm">{formatCurrency(activeAnalysis.netFlow)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 print:border-gray-300">
                        <h3 className="font-bold text-slate-400 mb-2 text-xs uppercase">Dictamen del Sistema</h3>
                        <p className="text-sm text-slate-300 leading-relaxed italic">
                            "{activeAnalysis.verdictReason}"
                        </p>
                    </div>
                 </div>

              </div>

            </div>
          )}

          {/* ADD/EDIT MODAL */}
          {isModalOpen && (
             <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto no-print">
               <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden my-8">
                 <div className="p-4 md:p-6 border-b border-slate-800 flex justify-between bg-slate-900 sticky top-0 z-10">
                   <h2 className="text-lg font-bold text-white">Gestión de Propiedad</h2>
                   <button onClick={() => setIsModalOpen(false)}><XCircle className="text-slate-500 hover:text-white" /></button>
                 </div>
                 <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="md:col-span-2">
                        <label className="text-xs text-slate-400 block mb-1">Nombre</label>
                        <input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none transition-colors" placeholder="Nombre del Proyecto" />
                    </div>
                    
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Tipo de Terreno</label>
                        <select 
                            value={formData.marketType || 'Unremarkable'} 
                            onChange={e => setFormData({...formData, marketType: e.target.value as any})} 
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                        >
                            <option value="Ocean View">Ocean View</option>
                            <option value="Lake View">Lake View</option>
                            <option value="Volcano View">Volcano View</option>
                            <option value="Mountain View">Mountain View</option>
                            <option value="Turistic Location">Turistic Location</option>
                            <option value="Historic Location">Historic Location</option>
                            <option value="Unremarkable">Unremarkable</option>
                        </select>
                    </div>

                    {/* Land Section */}
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Precio Terreno ($)</label>
                        <input type="number" value={formData.landPrice || ''} onChange={e => setFormData({...formData, landPrice: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none transition-colors" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Área (m²)</label>
                            <input type="number" value={formData.landArea || ''} onChange={e => setFormData({...formData, landArea: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none transition-colors" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">% Utilizable</label>
                            <input type="number" value={formData.usablePercent || ''} onChange={e => setFormData({...formData, usablePercent: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none transition-colors" placeholder="100" />
                        </div>
                    </div>

                    {/* Market Section */}
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">ADR Promedio Mercado ($)</label>
                        <input type="number" value={formData.marketAdr || ''} onChange={e => setFormData({...formData, marketAdr: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none transition-colors" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Ocupación Promedio Mercado (%)</label>
                        <input type="number" value={formData.marketOcc ? Math.round(formData.marketOcc * 100) : ''} onChange={e => setFormData({...formData, marketOcc: Number(e.target.value) / 100})} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none transition-colors" placeholder="Ej. 45" />
                    </div>

                    {/* Unit Calc Section */}
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Modelo de Operación</label>
                        <select value={formData.model} onChange={e => setFormData({...formData, model: e.target.value as any})} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none transition-colors">
                            <option value="Private Room">Private Room</option>
                            <option value="Entire Place">Entire Place</option>
                            <option value="Hybrid">Hybrid</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Unidades Proyectadas</label>
                        <div className="flex gap-2 items-center">
                            <input type="number" value={formData.units || ''} onChange={e => setFormData({...formData, units: Number(e.target.value)})} className="w-24 bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm font-bold focus:border-emerald-500 outline-none transition-colors" />
                            
                            {suggestedUnits > 0 && (
                                <button onClick={() => setFormData({...formData, units: suggestedUnits})} className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] py-2 rounded border border-slate-700 transition-all group">
                                    <Calculator className="w-3 h-3 text-emerald-500" />
                                    <span>Sugerido por densidad: <strong className="text-white group-hover:text-emerald-400">{suggestedUnits}</strong></span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Coordinates Section */}
                    <div className="md:col-span-2 border-t border-slate-800 pt-4 mt-2">
                        <label className="text-xs text-slate-400 block mb-2 font-bold uppercase">Ubicación Geográfica</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="md:col-span-2 relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                <input 
                                    value={coordInput}
                                    onChange={handleCoordPaste}
                                    className="w-full bg-slate-950 border border-slate-800 rounded pl-9 p-2 text-white text-sm focus:border-blue-500 outline-none transition-colors placeholder:text-slate-600" 
                                    placeholder="Pegar coordenadas o link de Google Maps (Ej. 14.55, -90.55)"
                                />
                             </div>
                             <div>
                                <label className="text-[10px] text-slate-500 block mb-1">Latitud</label>
                                <input type="number" step="any" value={formData.lat || ''} onChange={e => setFormData({...formData, lat: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-300 text-xs" />
                             </div>
                             <div>
                                <label className="text-[10px] text-slate-500 block mb-1">Longitud</label>
                                <input type="number" step="any" value={formData.lng || ''} onChange={e => setFormData({...formData, lng: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-300 text-xs" />
                             </div>
                        </div>
                    </div>
                    
                    <div className="md:col-span-2 pt-4">
                        <button onClick={handleSaveSite} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded text-white font-bold text-sm shadow-lg active:scale-95 transition-all">Guardar Análisis</button>
                    </div>
                 </div>
               </div>
             </div>
          )}

        </main>
      </div>
    </div>
  );
}