import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';

export const getLocalInsights = async (lat: number, lng: number, placeName: string) => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Actúa como un analista de inversión inmobiliaria experto. 
      Analiza la ubicación: ${placeName} (Lat: ${lat}, Lng: ${lng}).
      
      Proporciona un resumen ejecutivo de 3 puntos sobre:
      1. Principales atracciones turísticas cercanas (distancia aproximada).
      2. Restaurantes o cafeterías populares cercanos.
      3. Veredicto sobre la viabilidad para rentas vacacionales (Airbnb) basado en la ubicación.
      
      Sé conciso y profesional.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lng
            }
          }
        }
      }
    });
    return response;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};