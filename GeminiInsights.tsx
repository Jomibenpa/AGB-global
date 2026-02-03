import React, { useState, useEffect } from 'react';
import { Sparkles, MapPin, ExternalLink, Loader2, Info } from 'lucide-react';
import { getLocalInsights } from '../services/geminiService';
import { SiteData, GroundingChunk } from '../types';

interface GeminiInsightsProps {
  site: SiteData;
}

export const GeminiInsights: React.FC<GeminiInsightsProps> = ({ site }) => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [chunks, setChunks] = useState<GroundingChunk[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Clear state when site changes
  useEffect(() => {
    setResponse(null);
    setChunks([]);
    setError(null);
  }, [site.id]);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getLocalInsights(site.lat, site.lng, site.name);
      setResponse(res.text || "No hay análisis disponible.");
      
      const groundingMetadata = res.candidates?.[0]?.groundingMetadata;
      if (groundingMetadata?.groundingChunks) {
          // Cast to unknown first if strict typing issues occur with the SDK version, 
          // but assuming aligned types based on prompt instructions.
          setChunks(groundingMetadata.groundingChunks as GroundingChunk[]);
      }
    } catch (err) {
      setError("Error al conectar con Gemini AI. Verifica tu API Key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-lg print:border-gray-300 print:shadow-none mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          Inteligencia Artificial Local
        </h3>
        <span className="text-[10px] text-purple-300 bg-purple-900/30 border border-purple-700/50 px-2 py-1 rounded flex items-center gap-1">
           <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
           GEMINI 2.5 FLASH
        </span>
      </div>

      {!response && !loading && (
        <div className="text-center py-8 bg-slate-950/50 rounded-lg border border-slate-800/50 border-dashed">
            <p className="text-slate-400 text-sm mb-4">Genera un análisis de ubicación en tiempo real utilizando Google Maps y Gemini.</p>
            <button 
                onClick={handleAnalyze}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-purple-900/20 transition-all flex items-center gap-2 mx-auto"
            >
                <Sparkles className="w-4 h-4" /> Analizar Ubicación
            </button>
        </div>
      )}

      {loading && (
        <div className="py-8 flex flex-col items-center justify-center text-purple-400">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <span className="text-xs animate-pulse">Analizando entorno con Google Maps...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-900/20 border border-rose-800/50 rounded-lg text-rose-300 text-sm flex items-center gap-2">
            <Info className="w-4 h-4" />
            {error}
        </div>
      )}

      {response && (
        <div className="animate-in fade-in duration-500">
            <div className="prose prose-invert prose-sm max-w-none text-slate-300 text-sm leading-relaxed whitespace-pre-wrap mb-6">
                {response}
            </div>

            {chunks.length > 0 && (
                <div className="border-t border-slate-800 pt-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Fuentes de Google Maps</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {chunks.map((chunk, idx) => {
                            // Extract URI and Title prioritizing Maps then Web
                            const uri = chunk.maps?.uri || chunk.web?.uri;
                            const title = chunk.maps?.title || chunk.web?.title || "Fuente de Mapa";
                            
                            if (!uri) return null;

                            return (
                                <a 
                                    key={idx} 
                                    href={uri} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded transition-colors group"
                                >
                                    <div className="bg-slate-900 p-1.5 rounded text-slate-400 group-hover:text-white transition-colors">
                                        <MapPin className="w-3 h-3" />
                                    </div>
                                    <span className="text-xs text-slate-400 group-hover:text-emerald-400 truncate flex-1">{title}</span>
                                    <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-slate-400" />
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
};