import { SiteData } from "./types";

export const CONSTANTS = {
  CONSTRUCTION_COST_PER_M2: 650, 
  AREA_PER_UNIT: 40,             
  COMMON_AREA_M2: 165,           
  SERVICES_M2: 130,              
  FF_E_BASE: 100000,             
  BASE_UNITS: 14,                
  ENGINEERING_FEES: 30000,
  URBANIZATION: 45000,
  CONTINGENCY: 20000,
  EFFICIENCY_FACTOR: 1.176,      
  PLATFORM_FEE: 0.15,            
  OTHER_INCOME_MONTHLY: 6000,    
  BASE_PLANILLA_MONTHLY: 2500,   
  OTHER_FIXED_MONTHLY: 1450,     
  VARIABLE_OPEX_PER_NIGHT: 15,   
  REFERENCE_LAND_AREA: 1449,
  REFERENCE_UNITS: 14,
  FACTOR_ENTIRE_PLACE: 2.5,      
  FACTOR_HYBRID: 1.75            
};

export const DEFAULT_SITES: SiteData[] = [
    {
      id: 'elp-001',
      name: 'El Paredón Centro',
      country: 'Guatemala',
      lat: 13.918,
      lng: -91.075,
      imageUrl: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?q=80&w=600&auto=format&fit=crop', 
      marketType: 'Ocean View',
      landPrice: 275000,
      landArea: 1449,
      usablePercent: 100, 
      marketAdr: 115,
      marketOcc: 0.43, 
      taxRate: 0.07,
      units: 14,
      model: 'Private Room',
      viewScore: 4,
      centralityScore: 5
    },
    {
      id: 'ati-002',
      name: 'Santa Catarina Palopó',
      country: 'Guatemala',
      lat: 14.711, 
      lng: -91.133,
      imageUrl: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?q=80&w=600&auto=format&fit=crop', 
      marketType: 'Lake View',
      landPrice: 180000,
      landArea: 800,
      usablePercent: 85,
      marketAdr: 140,
      marketOcc: 0.50, 
      taxRate: 0.07,
      units: 6,
      model: 'Entire Place',
      viewScore: 5,
      centralityScore: 3
    }
];