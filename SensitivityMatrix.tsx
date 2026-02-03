import React from 'react';
import { SiteData, AnalysisResult } from '../types';
import { CONSTANTS } from '../constants';

// Re-implement calculation logic locally for the matrix to avoid circular dependency or passing big functions
const calculateLocalAnalysis = (site: SiteData, sensitivityAdr: number, sensitivityOcc: number): AnalysisResult => {
  const adr = sensitivityAdr;
  const occ = sensitivityOcc;

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

  // --- NEW AGD SCORING LOGIC (v1.5) MATCHING APP.TSX ---
  
  // 1. FINANCIAL (30%)
  let finScore = 0;
  if (cocReturn > 27) finScore = 30;
  else if (cocReturn > 24) finScore = 25;
  else if (cocReturn > 21) finScore = 20;
  else if (cocReturn > 18) finScore = 15;
  else if (cocReturn > 15) finScore = 10;
  else if (cocReturn > 12) finScore = 5;
  else finScore = 0;

  // 2. EFFICIENCY (30%)
  let effScore = 0;
  if (landCapexRatio <= 15) effScore = 30;
  else if (landCapexRatio <= 20) effScore = 25;
  else if (landCapexRatio <= 25) effScore = 20;
  else if (landCapexRatio <= 30) effScore = 15;
  else if (landCapexRatio <= 35) effScore = 10;
  else effScore = 0;

  // 3. EXPERIENCE (30%)
  let expScore = 0;
  if (site.marketType === 'Unremarkable') {
    expScore = 5; 
  } else {
    const totalExpPoints = (site.viewScore || 3) + (site.centralityScore || 3);
    expScore = (totalExpPoints / 10) * 30;
  }

  // 4. MARKET (10%)
  const marketScore = Math.min((site.marketOcc / 0.70) * 10, 10);

  let airroiScore = finScore + effScore + expScore + marketScore;
  airroiScore = Math.min(Math.max(airroiScore, 0), 100);

  let verdict: any = 'NO-GO';
  let verdictReason = "";
  if (cocReturn >= 18) verdict = 'GO';
  else if (cocReturn >= 12) verdict = 'GO CONDITIONAL';
  if (landCapexRatio > 35 && verdict === 'GO') verdict = 'GO CONDITIONAL';

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

export const SensitivityMatrix = ({ site }: { site: SiteData }) => {
  const adrSteps = [-20, -10, 0, 10, 20]; 
  const occSteps = [-0.10, -0.05, 0, 0.05, 0.10]; 

  return (
    <div className="overflow-x-auto rounded border border-slate-700 print:border-gray-400">
      <table className="w-full text-[10px] text-center border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-slate-400 bg-slate-800 print:bg-gray-100 print:text-black font-bold border-b border-r border-slate-700 print:border-gray-400 whitespace-nowrap">Occ \ ADR</th>
            {adrSteps.map(step => (
              <th key={step} className="p-2 text-slate-300 bg-slate-800 print:bg-gray-100 print:text-black border-b border-slate-700 print:border-gray-400 min-w-[50px]">
                 ${(site.marketAdr * (1 + step/100)).toFixed(0)} <br/>
                 <span className={`text-[9px] ${step > 0 ? 'text-emerald-500 print:text-black' : step < 0 ? 'text-rose-500 print:text-black' : 'text-slate-500 print:text-black'}`}>
                    {step > 0 ? '+' : ''}{step}%
                 </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {occSteps.map(occStep => {
            const testOcc = Math.min(Math.max(site.marketOcc + occStep, 0.1), 0.95);
            return (
              <tr key={occStep}>
                <td className="p-2 font-bold text-slate-300 bg-slate-800 print:bg-gray-100 print:text-black border-r border-slate-700 print:border-gray-400">
                  {(testOcc * 100).toFixed(0)}%
                </td>
                {adrSteps.map(adrStep => {
                  const testAdr = site.marketAdr * (1 + adrStep/100);
                  const result = calculateLocalAnalysis(site, testAdr, testOcc);
                  
                  let bgClass = "bg-rose-500/10 text-rose-300 print:bg-transparent print:text-black";
                  if (result.verdict === 'GO') bgClass = "bg-emerald-500/10 text-emerald-300 print:bg-transparent print:text-black";
                  if (result.verdict === 'GO CONDITIONAL') bgClass = "bg-amber-500/10 text-amber-300 print:bg-transparent print:text-black";
                  
                  const isCurrent = adrStep === 0 && occStep === 0;
                  const cellClass = isCurrent 
                    ? "ring-1 ring-inset ring-white print:ring-black font-black z-10" 
                    : "border border-slate-700/50 print:border-gray-400";

                  return (
                    <td key={adrStep} className={`p-2 ${bgClass} ${cellClass}`}>
                      {result.cocReturn.toFixed(1)}%
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};