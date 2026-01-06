
import { GoogleGenAI, Type } from "@google/genai";
import { FeedbackData, AnalysisResult } from "../types";

export const analyzeFeedback = async (data: FeedbackData): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let systemInstruction = "";
  let userPrompt = "";
  
  // Set context and persona via systemInstruction config for better results
  if (data.type === 'module') {
    systemInstruction = "Vous êtes un Expert en Pédagogie GI. Analysez le feedback d'un module et générez un résumé ainsi que 3 recommandations constructives pour l'enseignant.";
    userPrompt = `
      Module: ${data.subject}
      Scores: Objectifs: ${data.q1}% | Échanges: ${data.q2}% | Soutien: ${data.q3}% | Structure: ${data.q4}% | Éval: ${data.q5}%
      Commentaire: ${data.comments || "N/A"}
    `;
  } else if (data.type === 'global_orientation') {
    systemInstruction = "Vous êtes un Expert en Stratégie Académique. Analysez ce diagnostic sur l'orientation professionnelle et générez une synthèse institutionnelle ainsi que 2 pistes d'amélioration.";
    userPrompt = `
      Diagnostic : Orientation Professionnelle
      Satisfaction: ${data.q6}%
      Commentaire: ${data.comments || "N/A"}
    `;
  } else if (data.type === 'global_env') {
    systemInstruction = "Vous êtes un Expert en Logistique et Vie Étudiante. Analysez le diagnostic ressources pour évaluer l'impact des infrastructures sur les conditions d'étude.";
    userPrompt = `
      Diagnostic Ressources :
      - Salles: ${data.q7_salles}%
      - Accès Numérique: ${data.q7_ressources}%
      - Possession PC: ${data.q7_pc}%
      - Transport: ${data.q7_transport}
      Commentaire: ${data.comments || "N/A"}
    `;
  }

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
            summary: { 
              type: Type.STRING,
              description: 'Une synthèse courte et professionnelle.'
            },
            recommendations: { 
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Liste de recommandations actionnables.'
            },
            sentiment: { 
              type: Type.STRING,
              description: 'Sentiment global de l\'étudiant (positive, neutral, negative).'
            }
          },
          required: ["summary", "recommendations", "sentiment"],
          propertyOrdering: ["summary", "recommendations", "sentiment"]
        }
      }
    });

    // Directly access text property as recommended by the SDK guidelines
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr) as AnalysisResult;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      summary: "Diagnostic enregistré. L'analyse IA détaillée sera traitée par l'administration.",
      recommendations: ["Vérifier la qualité des infrastructures.", "Évaluer les besoins en équipements mobiles."],
      sentiment: 'neutral'
    };
  }
};
