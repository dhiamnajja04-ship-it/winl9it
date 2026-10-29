/**
 * Vérifie l'intégrité des données DIRECTEMENT dans MongoDB (sans passer par l'API) :
 * index, scores, statuts, historique, avis, règles métier.
 *
 *   npm run check-db
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../src/models/Match');
const MatchFeedback = require('../src/models/MatchFeedback');
const { computeScore } = require('../src/utils/scoring');
const { STATUSES, canTransition } = require('../src/utils/workflow');

let failures = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

(async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/winl9it_matching_db';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(`🔌 Connecté à ${uri}\n`);

  // ---------- Collections et index ----------
  const collections = (await db.listCollections().toArray()).map((c) => c.name);
  check(collections.includes('matches') && collections.includes('matchfeedbacks'), 'collections matches et matchfeedbacks présentes', collections.join(', '));

  const hasUnique = (indexes, keys) => indexes.some((i) => i.unique && JSON.stringify(Object.keys(i.key)) === JSON.stringify(keys));
  const mIdx = await Match.collection.indexes();
  const fIdx = await MatchFeedback.collection.indexes();
  check(hasUnique(mIdx, ['lostItemId', 'foundItemId']), 'index unique (lostItemId, foundItemId) sur matches');
  check(hasUnique(fIdx, ['matchId', 'userId']), 'index unique (matchId, userId) sur matchfeedbacks');

  const matches = await Match.find().lean();
  const feedbacks = await MatchFeedback.find().lean();
  console.log(`\n📦 ${matches.length} correspondance(s), ${feedbacks.length} avis en base\n`);

  // ---------- Correspondances ----------
  const badScore = matches.filter((m) => m.score !== computeScore(m.criteria));
  check(!badScore.length, 'score = moyenne pondérée des 4 critères pour chaque correspondance', badScore.map((m) => m.lostItemId).join(', '));

  const badCrit = matches.filter((m) => Object.values(m.criteria || {}).some((v) => v < 0 || v > 100));
  check(!badCrit.length, 'tous les critères sont entre 0 et 100');

  const badStatus = matches.filter((m) => !STATUSES.includes(m.status));
  check(!badStatus.length, 'statuts valides (PROPOSÉ, CONFIRMÉ, REJETÉ, RESTITUÉ)');

  const pairs = new Set(matches.map((m) => `${m.lostItemId}|${m.foundItemId}`));
  check(pairs.size === matches.length, 'aucune paire perdu/retrouvé en double');

  // Historique : commence à la création, suit le cycle de vie, finit sur le statut actuel
  const badHistory = matches.filter((m) => {
    const h = m.history || [];
    if (!h.length || h[0].from !== null || h[0].to !== 'PROPOSÉ') return true;
    for (let i = 1; i < h.length; i++) {
      if (h[i].from !== h[i - 1].to || !canTransition(h[i].from, h[i].to)) return true;
    }
    return h[h.length - 1].to !== m.status;
  });
  check(!badHistory.length, 'historique cohérent (création → transitions autorisées → statut actuel)', badHistory.map((m) => m.lostItemId).join(', '));

  const restituees = matches.filter((m) => m.status === 'RESTITUÉ');
  check(restituees.every((m) => m.history.some((h) => h.to === 'CONFIRMÉ')), 'toute correspondance RESTITUÉ est passée par CONFIRMÉ');

  // Exclusivité : un objet n'appartient qu'à une seule correspondance confirmée / restituée
  const active = matches.filter((m) => ['CONFIRMÉ', 'RESTITUÉ'].includes(m.status));
  const dup = (field) => active.map((m) => m[field]).filter((v, i, a) => a.indexOf(v) !== i);
  check(!dup('lostItemId').length && !dup('foundItemId').length, 'un objet n\'est confirmé que dans une seule correspondance', [...dup('lostItemId'), ...dup('foundItemId')].join(', '));

  // Les propositions concurrentes d'un objet confirmé ont bien été rejetées
  const leftover = matches.filter((m) => m.status === 'PROPOSÉ' && active.some((a) => a.lostItemId === m.lostItemId || a.foundItemId === m.foundItemId));
  check(!leftover.length, 'aucune proposition encore ouverte sur un objet déjà confirmé', leftover.map((m) => `${m.lostItemId}↔${m.foundItemId}`).join(', '));

  // ---------- Avis ----------
  const matchIds = new Set(matches.map((m) => String(m._id)));
  const orphans = feedbacks.filter((f) => !matchIds.has(String(f.matchId)));
  check(!orphans.length, 'aucun avis orphelin (chaque avis pointe vers une correspondance existante)', `${orphans.length} orphelin(s)`);

  const fbKeys = feedbacks.map((f) => `${f.matchId}|${f.userId}`);
  check(new Set(fbKeys).size === fbKeys.length, 'un seul avis par utilisateur et par correspondance');

  check(feedbacks.every((f) => f.rating == null || (f.rating >= 1 && f.rating <= 5)), 'notes entre 1 et 5');

  // Règle du rejet automatique : aucune correspondance PROPOSÉ avec ≥ 3 avis et < 50 % positifs
  const byMatch = {};
  feedbacks.forEach((f) => { const k = String(f.matchId); (byMatch[k] = byMatch[k] || []).push(f); });
  const shouldBeRejected = matches.filter((m) => {
    const fb = byMatch[String(m._id)] || [];
    return m.status === 'PROPOSÉ' && fb.length >= 3 && (fb.filter((f) => f.isCorrect).length / fb.length) * 100 < 50;
  });
  check(!shouldBeRejected.length, 'règle du rejet automatique respectée (≥ 3 avis et < 50 % positifs → REJETÉ)');

  const autoRejected = matches.filter((m) => (m.history || []).some((h) => /Rejet automatique/.test(h.comment || '')));
  console.log(`   ↳ ${autoRejected.length} rejet(s) automatique(s) tracé(s) dans l'historique`);

  // ---------- Cohérence avec l'API (agrégations MongoDB) ----------
  const agg = await Match.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  const parStatut = Object.fromEntries(STATUSES.map((s) => [s, (agg.find((a) => a._id === s) || {}).n || 0]));
  check(Object.values(parStatut).reduce((a, b) => a + b, 0) === matches.length, 'agrégation par statut = nombre total de documents');

  console.log('\n📊 Répartition :', JSON.stringify(parStatut));
  const byCat = await Match.aggregate([{ $group: { _id: '$category', n: { $sum: 1 }, avg: { $avg: '$score' } } }, { $sort: { n: -1 } }]);
  console.log('📊 Par catégorie :', byCat.map((c) => `${c._id} ${c.n} (moy. ${Math.round(c.avg * 10) / 10})`).join(' · '));

  console.log(failures ? `\n❌ ${failures} vérification(s) en échec` : '\n✅ Base de données cohérente : toutes les vérifications passent');
  await mongoose.disconnect();
  process.exit(failures ? 1 : 0);
})().catch(async (e) => { console.error('❌', e.message); await mongoose.disconnect(); process.exit(1); });
