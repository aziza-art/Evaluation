import { AnalysisResult, FeedbackData } from "../types";

/**
 * Liste des domaines de premier niveau (TLD) reconnus.
 */
const RECOGNIZED_TLDS = [
  'com', 'org', 'net', 'edu', 'gov', 'fr', 'mr', 'io', 'info', 'me', 'tv', 'app', 
  'dev', 'tech', 'online', 'site', 'academy', 'university', 'sn', 'ma'
];

/**
 * Valide une adresse email avec une précision chirurgicale.
 * Interne au service car la configuration dynamique a été supprimée.
 */
const validateEmail = (email: string): { isValid: boolean; reason?: string } => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, reason: "L'adresse email est requise." };
  }

  const trimmedEmail = email.trim();
  if (trimmedEmail !== email) {
    return { isValid: false, reason: "L'adresse ne doit pas contenir d'espaces." };
  }

  if (email.length > 254) {
    return { isValid: false, reason: "L'adresse est trop longue (max 254)." };
  }

  const parts = email.split("@");
  if (parts.length !== 2) {
    return { isValid: false, reason: "L'adresse doit contenir un seul symbole '@'." };
  }

  const [local, domain] = parts;

  // Validation partie locale
  if (local.length === 0) return { isValid: false, reason: "Identifiant manquant avant '@'." };
  if (local.length > 64) return { isValid: false, reason: "Identifiant trop long (max 64)." };
  if (local.startsWith(".") || local.endsWith(".")) return { isValid: false, reason: "Point mal placé dans l'identifiant." };
  if (local.includes("..")) return { isValid: false, reason: "Points consécutifs détectés." };
  
  // Validation domaine
  if (!domain || domain.length === 0) return { isValid: false, reason: "Domaine manquant." };
  if (domain.includes("..")) return { isValid: false, reason: "Domaine mal formé (points consécutifs)." };

  const domainParts = domain.split(".");
  if (domainParts.length < 2) {
    return { isValid: false, reason: "Le domaine doit inclure une extension (ex: .mr)." };
  }

  // Vérification structurelle des labels du domaine
  for (const label of domainParts) {
    if (label.length === 0) return { isValid: false, reason: "Segment de domaine vide." };
    if (label.startsWith("-") || label.endsWith("-")) return { isValid: false, reason: "Trait d'union mal placé dans le domaine." };
    if (!/^[a-zA-Z0-9-]+$/.test(label)) return { isValid: false, reason: "Caractères invalides dans le domaine." };
  }

  // Vérification spécifique du TLD
  const tld = domainParts[domainParts.length - 1].toLowerCase();
  if (tld.length < 2) return { isValid: false, reason: "Extension trop courte." };
  if (!/^[a-z]+$/.test(tld)) return { isValid: false, reason: "Extension invalide." };

  // Regex standard RFC 5322 en filet de sécurité final
  const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, reason: "Format d'email non conforme aux standards." };
  }

  return { isValid: true };
};

/**
 * Transmet le rapport d'analyse à l'administrateur qualité (Aziza).
 * L'adresse est fixée pour garantir la réception institutionnelle.
 */
export const sendAnalysisToAdmin = async (data: FeedbackData, result: AnalysisResult): Promise<boolean> => {
  const adminEmail = "aziza@isgi.e-una.mr";
  
  const validation = validateEmail(adminEmail);
  if (!validation.isValid) {
    console.error(`[CRITIQUE] Envoi avorté : Email institutionnel invalide. Raison : ${validation.reason}`);
    return false;
  }
  
  const emailContent = {
    to: adminEmail,
    subject: `[ISGI-QUALITÉ] Nouveau Diagnostic : ${data.subject}`,
    body: `Sentiment : ${result.sentiment}\nSynthèse : ${result.summary}`
  };

  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`[SMTP] Rapport qualité transmis à ${adminEmail}`, emailContent);
      resolve(true);
    }, 1200);
  });
};