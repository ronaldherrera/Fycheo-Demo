
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getProductivityTip = async (hoursWorked: number) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `El usuario ha trabajado ${hoursWorked} horas hoy. Dame un consejo de productividad corto y motivador en español. Responde solo con el texto del consejo.`,
      config: {
        temperature: 0.7,
        maxOutputTokens: 100,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "¡Sigue así! Mantén el foco y recuerda tomar descansos breves.";
  }
};
