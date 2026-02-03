import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { SiteData, AnalysisResult } from '../types';

interface MapViewProps {
  sites: SiteData[];
  onSelectSite: (id: string) => void;
  calculateAnalysis: (site: SiteData) => AnalysisResult;
}

export const MapView: React.FC<MapViewProps> = ({ sites, onSelectSite, calculateAnalysis }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // CartoDB Dark Matter Tiles (Free, nice looking for dark UI)
      const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      });

      // Default view (will be overridden by bounds)
      const map = L.map(mapContainerRef.current, {
        center: [14.634, -90.506],
        zoom: 6,
        zoomControl: false,
        attributionControl: false
      });

      darkLayer.addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      
      mapInstanceRef.current = map;
    }

    return () => {
      // Cleanup on unmount handled by ref check, usually kept alive for performance in SPAs
      // but if we wanted full cleanup: mapInstanceRef.current?.remove();
    };
  }, []);

  // Update Markers when sites change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const bounds = L.latLngBounds([]);

    sites.forEach(site => {
      if (!site.lat || !site.lng) return;

      const analysis = calculateAnalysis(site);
      
      // Determine Color based on Verdict (Semaphore Logic)
      // Green = GO, Amber = GO CONDITIONAL, Red = NO-GO
      let colorClass = "text-rose-500";
      let glowClass = "shadow-rose-500/50";
      
      if (analysis.verdict === 'GO') {
        colorClass = "text-emerald-400";
        glowClass = "shadow-emerald-500/50";
      } else if (analysis.verdict === 'GO CONDITIONAL') {
        colorClass = "text-amber-400";
        glowClass = "shadow-amber-500/50";
      }

      // Custom HTML Marker using SVG string
      // Note: We use a string for the icon html because L.divIcon expects HTML string
      const iconHtml = `
        <div class="relative group cursor-pointer transition-transform hover:scale-110">
           <div class="absolute -inset-2 rounded-full blur-md opacity-40 bg-current ${colorClass}"></div>
           <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="relative z-10 w-8 h-8 drop-shadow-lg ${colorClass} fill-slate-900/80">
             <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
             <circle cx="12" cy="10" r="3"/>
           </svg>
           <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 border border-slate-700 text-white text-[10px] font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
             ${site.name}
           </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'bg-transparent border-none',
        html: iconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 32], // Bottom tip of the pin
      });

      const marker = L.marker([site.lat, site.lng], { icon: customIcon })
        .addTo(map)
        .on('click', () => onSelectSite(site.id));

      markersRef.current.push(marker);
      bounds.extend([site.lat, site.lng]);
    });

    // Fit bounds if we have sites
    if (sites.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [sites, onSelectSite, calculateAnalysis]);

  return <div ref={mapContainerRef} className="w-full h-full z-0" />;
};