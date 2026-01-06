
import { AnalysisResult, FeedbackData } from "../types";

/**
 * Valide une adresse email selon les standards RFC 5321/5322.
 * Cette implémentation vérifie la structure, les longueurs limites et les contraintes de domaine.
 */
const validateEmail = (email: string): { isValid: boolean; reason?: string } => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, reason: "L'adresse email doit être une chaîne de caractères non nulle." };
  }

  const trimmedEmail = email.trim();
  if (trimmedEmail !== email) {
    return { isValid: false, reason: "L'adresse email ne doit pas contenir d'espaces blancs en début ou fin de chaîne." };
  }

  // Longueur maximale totale selon RFC
  if (email.length > 254) {
    return { isValid: false, reason: "L'adresse email est trop longue (limite RFC de 254 caractères dépassée)." };
  }

  const parts = email.split("@");
  if (parts.length !== 2) {
    return { isValid: false, reason: "Format invalide : l'email doit contenir exactement un symbole '@'." };
  }

  const [local, domain] = parts;

  // Validation de la partie locale (avant le @)
  if (local.length === 0) {
    return { isValid: false, reason: "La partie locale de l'email est manquante." };
  }
  if (local.length > 64) {
    return { isValid: false, reason: "La partie locale est trop longue (limite de 64 caractères dépassée)." };
  }

  // Validation du domaine (après le @)
  if (domain.length === 0) {
    return { isValid: false, reason: "Le nom de domaine de l'email est manquant." };
  }
  if (domain.length > 255) {
    return { isValid: false, reason: "Le nom de domaine est trop long (limite de 255 caractères dépassée)." };
  }

  const domainParts = domain.split(".");
  if (domainParts.length < 2) {
    return { isValid: false, reason: "Le domaine doit posséder une extension valide (ex: .mr)." };
  }

  // Vérification des segments de domaine (labels)
  for (const label of domainParts) {
    if (label.length === 0) {
      return { isValid: false, reason: "Le domaine contient des points consécutifs ou commence/finit par un point." };
    }
    if (label.length > 63) {
      return { isValid: false, reason: "Un segment du domaine dépasse la limite de 63 caractères." };
    }
    if (label.startsWith("-") || label.endsWith("-")) {
      return { isValid: false, reason: "Un segment du domaine ne peut pas commencer ou se terminer par un trait d'union." };
    }
  }

  // Regex de validation structurelle conforme RFC 5322 (standard de l'industrie)
  const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  
  if (!emailRegex.test(email)) {
    return { isValid: false, reason: "L'adresse contient des caractères non autorisés ou une structure syntaxique invalide." };
  }

  return { isValid: true };
};

/**
 * Simule l'envoi d'un rapport d'analyse à l'administrateur qualité.
 * Inclut une validation stricte de l'adresse destinataire.
 */
export const sendAnalysisToAdmin = async (data: FeedbackData, result: AnalysisResult): Promise<boolean> => {
  // L'adresse officielle de l'administration IUP
  const adminEmail = "aziza@iup.e-una.mr";
  
  // Exécution de la validation robuste avant toute opération
  const validation = validateEmail(adminEmail);
  
  if (!validation.isValid) {
    console.error(`[SYSTÈME QUALITÉ] ERREUR DE VALIDATION CRITIQUE : ${validation.reason}`);
    console.error(`Cible rejetée : "${adminEmail}"`);
    // Dans un environnement de production, nous lancerions une exception ou notifierions un service de monitoring.
    return false;
  }
  
  console.log(`[SERVICE QUALITÉ] Préparation de la transmission sécurisée vers : ${adminEmail}...`);
  
  const emailContent = {
    to: adminEmail,
    subject: `[IUP-QUALITÉ] Nouveau Diagnostic de Module : ${data.subject}`,
    body: `
      ---------------------------------------------------------
      RAPPORT DE DIAGNOSTIC - INSTITUT DE GÉNIE INDUSTRIEL
      ---------------------------------------------------------
      Matière : ${data.subject}
      Catégorie : ${data.type.toUpperCase()}
      Date d'émission : ${new Date().toLocaleString('fr-FR')}
      
      RÉSUMÉ DE L'ANALYSE IA :
      -------------------------
      Sentiment global : ${result.sentiment.toUpperCase()}
      Synthèse : ${result.summary}
      Recommandations : ${result.recommendations.join(' | ')}
      
      MÉTRIQUES COLLECTÉES :
      ---------------------
      - Pédagogie (Objectifs) : ${data.q1 ?? 'N/A'}%
      - Pédagogie (Échanges) : ${data.q2 ?? 'N/A'}%
      - Pédagogie (Soutien) : ${data.q3 ?? 'N/A'}%
      - Pédagogie (Supports) : ${data.q4 ?? 'N/A'}%
      - Pédagogie (Évaluation) : ${data.q5 ?? 'N/A'}%
      - Orientation Professionnelle : ${data.q6 ?? 'N/A'}%
      - Infrastructures (Salles) : ${data.q7_salles ?? 'N/A'}%
      - Ressources (Connectivité) : ${data.q7_ressources ?? 'N/A'}%
      - Équipement (Possession PC) : ${data.q7_pc === 100 ? 'OUI' : 'NON'}
      - Logistique (Transport) : ${data.q7_transport || "Non spécifié"}
      
      COMMENTAIRES BRUTS :
      -------------------
      "${data.comments || "Aucune observation supplémentaire fournie."}"
      
      ---------------------------------------------------------
      FIN DU RAPPORT - TRANSMISSION AUTOMATISÉE
    `
  };

  // Simulation d'un envoi via protocole SMTP asynchrone
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("[SMTP SIMULATOR] Transmission réussie au serveur mail de l'IUP.", emailContent);
      resolve(true);
    }, 1500);
  });
};
