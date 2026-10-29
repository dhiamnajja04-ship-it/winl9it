/**
 * Règles métier du cycle de vie d'une correspondance.
 *
 *   PROPOSÉ ──► CONFIRMÉ ──► RESTITUÉ
 *      │            │
 *      └──► REJETÉ ◄┘
 *
 * REJETÉ et RESTITUÉ sont des états finaux.
 */
const TRANSITIONS = {
  PROPOSÉ: ['CONFIRMÉ', 'REJETÉ'],
  CONFIRMÉ: ['RESTITUÉ', 'REJETÉ'],
  REJETÉ: [],
  RESTITUÉ: [],
};

const STATUSES = Object.keys(TRANSITIONS);

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

module.exports = { TRANSITIONS, STATUSES, canTransition };
