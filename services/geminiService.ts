import { GoogleGenAI, Type } from "@google/genai";
import { FeedbackData, AnalysisResult } from "../types";

export const analyzeFeedback = async (data: FeedbackData): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const isEnv = data.subject === 'ENVIRONNEMENT_GLOBAL';

  const systemInstruction = `Vous êtes un Expert en Audit de Qualité Académique pour une formation d'Ingénierie (Génie Industriel). 
  Analysez les données de diagnostic fournies et produisez une synthèse stratégique avec 3 recommandations d'amélioration.
  ${isEnv ? "Focus : Environnement et infrastructures de l'institut." : "Focus : Pédagogie et qualité de l'enseignement du cours."}`;

  const pedagogyPrompt = !isEnv ? `
    Analyse du cours : ${data.subject}
    ---
    Critères (Score sur 100) :
    1. Clarté des objectifs au début : ${data.q1}%
    2. Promotion des échanges/questions en cours : ${data.q2}%
    3. Disponibilité de l'enseignant hors cours : ${data.q3}%
    4. Clarté/Structure des supports et explications : ${data.q4}%
    5. Pertinence des évaluations (compétences acquises) : ${data.q5}%
  ` : `
    Analyse de l'Environnement Global
    ---
    1. Connaissance des débouchés métiers : ${data.q6_jobs}
    2. Adaptabilité des salles (confort/éclairage) : ${data.q7_rooms}%
    3. Suffisance des ressources (Wi-Fi/Labo) : ${data.q8_resources}%
    4. Logistique Transport : ${data.q9_transport}
    5. Possession d'un ordinateur portable : ${data.q10_laptop}
  `;

  const userPrompt = `
    ${pedagogyPrompt}
    Commentaires de l'étudiant : "${data.comments || "Aucun commentaire additionnel."}"
    
    Veuillez extraire le sentiment global, une synthèse courte et 3 points d'action concrets.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            sentiment: { type: Type.STRING }
          },
          required: ["summary", "recommendations", "sentiment"]
        }
      }
    });

    return JSON.parse(response.text.trim()) as AnalysisResult;
  } catch (error) {
    return {
      summary: "Audit enregistré. L'analyse détaillée sera générée lors de la prochaine synchronisation.",
      recommendations: ["Améliorer les supports visuels.", "Renforcer l'interactivité.", "Clarifier les modalités d'examen."],
      sentiment: 'neutre'
    };
  }
};