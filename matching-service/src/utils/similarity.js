/**
 * Calcul automatique des 4 critères du matching à partir des données brutes
 * d'un objet perdu et d'un objet retrouvé (use case « Calculer le score »).
 */

// Mots sans valeur pour comparer deux descriptions
const STOPWORDS = new Set((
  'le la les un une des de du d l a au aux et ou avec sans pour par sur sous dans en est sont ' +
  'son sa ses mon ma mes ton ta tes ce cet cette ces qui que quoi il elle je on y ' +
  'perdu perdue perdus trouve trouvee trouves objet pres vers'
).split(' '));

/** Découpe un texte en mots significatifs (minuscules, sans accents, sans mots vides) */
function tokenize(text = '') {
  return new Set(
    String(text)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w && !STOPWORDS.has(w))
  );
}

/** Similarité des descriptions (coefficient de Dice sur les mots), 0 – 100 */
function descriptionSimilarity(a, b) {
  const A = tokenize(a), B = tokenize(b);
  if (!A.size || !B.size) return { score: 0, commonWords: [] };
  const common = [...A].filter((w) => B.has(w));
  return { score: Math.round((200 * common.length) / (A.size + B.size)), commonWords: common };
}

/** Distance en km entre deux points GPS (formule de Haversine) */
function distanceKm(p1, p2) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(p2.lat - p1.lat), dLng = rad(p2.lng - p1.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(p1.lat)) * Math.cos(rad(p2.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Proximité géographique : 100 sur place, -5 points par km, 0 au-delà de 20 km */
function locationScore(km) {
  return Math.max(0, Math.round(100 - 5 * km));
}

/** Proximité des dates : 100 le même jour, -10 points par jour ; 0 si trouvé avant d'être perdu */
function dateScore(days) {
  if (days < 0) return 0;
  return Math.max(0, Math.round(100 - 10 * days));
}

/**
 * Calcule les 4 critères.
 * lost / found : { category, description, location: { lat, lng }, date }
 */
function computeCriteria(lost, found) {
  const desc = descriptionSimilarity(lost.description, found.description);
  const km = distanceKm(lost.location, found.location);
  const days = (new Date(found.date) - new Date(lost.date)) / 86400000;

  return {
    criteria: {
      categoryScore: lost.category === found.category ? 100 : 0,
      descriptionScore: desc.score,
      locationScore: locationScore(km),
      dateScore: dateScore(days),
    },
    details: {
      memeCategorie: lost.category === found.category,
      motsCommuns: desc.commonWords,
      distanceKm: Math.round(km * 100) / 100,
      ecartJours: Math.round(days * 10) / 10,
    },
  };
}

/** Vérifie les données d'un objet ; renvoie la liste des erreurs */
function validateItem(item, label) {
  const errors = [];
  if (!item || typeof item !== 'object') return [`${label} est obligatoire`];
  if (!item.id) errors.push(`${label}.id est obligatoire`);
  if (!item.category) errors.push(`${label}.category est obligatoire`);
  if (!item.description) errors.push(`${label}.description est obligatoire`);
  const { lat, lng } = item.location || {};
  if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    errors.push(`${label}.location { lat, lng } invalide`);
  }
  if (!item.date || isNaN(new Date(item.date))) errors.push(`${label}.date invalide`);
  return errors;
}

module.exports = { computeCriteria, validateItem, tokenize, distanceKm };
