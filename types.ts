export type MarketType = 'Ocean View' | 'Lake View' | 'Volcano View' | 'Mountain View' | 'Turistic Location' | 'Historic Location' | 'Unremarkable';
export type OperationModel = 'Entire Place' | 'Private Room' | 'Hybrid';
export type Verdict = 'GO' | 'GO CONDITIONAL' | 'NO-GO';

export interface SiteData {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  imageUrl?: string; 
  marketType: MarketType;
  landPrice: number;      
  landArea: number;       
  usablePercent: number;  
  marketAdr: number;      
  marketOcc: number;      
  taxRate: number;        
  units: number;
  model: OperationModel;
  viewScore: number;      
  centralityScore: number;
}

export interface AnalysisResult {
  totalCapex: number;
  landCapexRatio: number;
  grossRevenue: number;
  netRevenue: number;
  opex: number;
  netFlow: number;
  cocReturn: number;      
  score: number;          
  verdict: Verdict;
  verdictReason: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    placeAnswerSources?: {
      placeId: string;
    }[];
    title: string;
    uri: string;
  };
}