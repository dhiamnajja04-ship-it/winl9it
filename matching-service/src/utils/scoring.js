/**
 * Calcul du score de correspondance (use case « Calculer le score de correspondance »).
 * Poids des 4 critères présentés dans la slide 4.
 */
const WEIGHTS = {
  categoryScore: 0.3,
  descriptionScore: 0.3,
  locationScore: 0.2,
  dateScore: 0.2,
};

function computeScore(criteria = {}) {
  let total = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const value = Number(criteria[key]) || 0;
    total += Math.min(Math.max(value, 0), 100) * weight;
  }
  return Math.round(total * 100) / 100;
}

/** Niveau de confiance d'une correspondance selon son score */
function scoreLevel(score) {
  if (score >= 80) return 'FORT';
  if (score >= 50) return 'MOYEN';
  return 'FAIBLE';
}

module.exports = { computeScore, scoreLevel, WEIGHTS };
