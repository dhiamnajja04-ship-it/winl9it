const Match = require('../models/Match');
const MatchFeedback = require('../models/MatchFeedback');
const { computeScore, scoreLevel } = require('../utils/scoring');
const { TRANSITIONS, STATUSES, canTransition } = require('../utils/workflow');
const { computeCriteria, validateItem } = require('../utils/similarity');

// Champs modifiables par le client (score et dates sont calculés par le serveur)
const ALLOWED = ['lostItemId', 'foundItemId', 'category', 'criteria', 'status', 'notes'];
const pick = (body) =>
  Object.fromEntries(Object.entries(body || {}).filter(([k]) => ALLOWED.includes(k)));

/**
 * Règles métier d'un changement de statut.
 * Renvoie un message d'erreur (409) si le changement est interdit, sinon null.
 */
async function checkStatusChange(match, newStatus) {
  if (!canTransition(match.status, newStatus)) {
    const allowed = TRANSITIONS[match.status];
    return `Transition interdite : ${match.status} → ${newStatus}` +
      (allowed.length ? ` (autorisé : ${allowed.join(', ')})` : ` (${match.status} est un état final)`);
  }
  if (newStatus === 'CONFIRMÉ') {
    // Un objet ne peut appartenir qu'à une seule correspondance confirmée
    const conflict = await Match.exists({
      _id: { $ne: match._id },
      status: { $in: ['CONFIRMÉ', 'RESTITUÉ'] },
      $or: [{ lostItemId: match.lostItemId }, { foundItemId: match.foundItemId }],
    });
    if (conflict) return 'Cet objet fait déjà partie d\'une autre correspondance confirmée';
  }
  return null;
}

/** Après confirmation : les autres propositions sur le même objet sont rejetées automatiquement */
async function rejectConcurrentMatches(match) {
  const { modifiedCount } = await Match.updateMany(
    {
      _id: { $ne: match._id },
      status: 'PROPOSÉ',
      $or: [{ lostItemId: match.lostItemId }, { foundItemId: match.foundItemId }],
    },
    {
      $set: { status: 'REJETÉ' },
      $push: {
        history: {
          from: 'PROPOSÉ',
          to: 'REJETÉ',
          date: new Date(),
          comment: `Rejet automatique : objet confirmé dans la correspondance ${match._id}`,
        },
      },
    }
  );
  return modifiedCount;
}

const SORTS = {
  '-score': { score: -1, createdAt: -1 },
  score: { score: 1, createdAt: -1 },
  '-createdAt': { createdAt: -1 },
  createdAt: { createdAt: 1 },
};
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** POST /api/matches — Ajouter une correspondance */
exports.createMatch = async (req, res, next) => {
  try {
    const data = pick(req.body);
    data.status = 'PROPOSÉ'; // toute nouvelle correspondance commence à l'état PROPOSÉ
    data.score = computeScore(data.criteria);
    const match = await Match.create(data);
    res.status(201).json({ success: true, message: 'Correspondance ajoutée', data: match });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/matches — Lister avec filtres, recherche, tri et pagination
 * ?status=&category=&minScore=&q=texte&sort=-score|score|-createdAt|createdAt&page=1&limit=20
 */
exports.getAllMatches = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.minScore) filter.score = { $gte: Number(req.query.minScore) };
    if (req.query.q) {
      // Recherche texte dans les ids d'objets et les notes (insensible à la casse)
      const rx = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
      filter.$or = [{ lostItemId: rx }, { foundItemId: rx }, { notes: rx }];
    }

    const sortKey = req.query.sort || '-score'; // par défaut : meilleur score en premier
    if (!SORTS[sortKey]) {
      return res.status(400).json({ success: false, message: `Tri invalide (attendu : ${Object.keys(SORTS).join(', ')})` });
    }
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const [total, matches] = await Promise.all([
      Match.countDocuments(filter),
      Match.find(filter).select('-history').sort(SORTS[sortKey]).skip((page - 1) * limit).limit(limit),
    ]);
    res.json({
      success: true,
      count: matches.length,
      total,
      page,
      pages: Math.max(Math.ceil(total / limit), 1),
      limit,
      data: matches,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/matches/:id — Rechercher une correspondance par son id */
exports.getMatchById = async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Correspondance introuvable' });
    }
    res.json({ success: true, data: match });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/matches/:id — Modifier une correspondance (le score est recalculé) */
exports.updateMatch = async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Correspondance introuvable' });
    }

    const data = pick(req.body);
    const statusChanged = data.status && data.status !== match.status;
    if (statusChanged) {
      const error = await checkStatusChange(match, data.status);
      if (error) return res.status(409).json({ success: false, message: error });
    }
    if (statusChanged) match.setStatus(data.status, 'Modification de la correspondance');
    delete data.status;
    if (data.criteria) {
      // Fusion : on peut ne modifier qu'un seul critère
      data.criteria = { ...match.criteria.toObject(), ...data.criteria };
    }
    match.set(data);
    match.score = computeScore(match.criteria);
    await match.save(); // save() déclenche les validateurs du schéma

    const rejected = statusChanged && match.status === 'CONFIRMÉ' ? await rejectConcurrentMatches(match) : 0;
    res.json({ success: true, message: 'Correspondance modifiée', data: match, autresRejetees: rejected });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/matches/:id — Supprimer une correspondance (et ses feedbacks) */
exports.deleteMatch = async (req, res, next) => {
  try {
    const match = await Match.findByIdAndDelete(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Correspondance introuvable' });
    }
    const { deletedCount } = await MatchFeedback.deleteMany({ matchId: match._id });
    res.json({
      success: true,
      message: 'Correspondance supprimée',
      data: { id: match._id, feedbacksSupprimes: deletedCount },
    });
  } catch (err) {
    next(err);
  }
};

/* ======================= Métier ======================= */

/** PATCH /api/matches/:id/status — Faire avancer une correspondance dans son cycle de vie */
exports.changeStatus = async (req, res, next) => {
  try {
    const { status, comment } = req.body || {};
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Statut invalide (attendu : ${STATUSES.join(', ')})` });
    }
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Correspondance introuvable' });
    }
    const error = await checkStatusChange(match, status);
    if (error) return res.status(409).json({ success: false, message: error });

    const previous = match.status;
    match.setStatus(status, comment);
    await match.save();
    const rejected = status === 'CONFIRMÉ' ? await rejectConcurrentMatches(match) : 0;

    res.json({
      success: true,
      message: `Statut : ${previous} → ${status}`,
      data: match,
      autresRejetees: rejected,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/matches/stats — Tableau de bord du matching */
exports.getStats = async (req, res, next) => {
  try {
    const [global] = await Match.aggregate([
      { $group: { _id: null, total: { $sum: 1 }, scoreMoyen: { $avg: '$score' } } },
    ]);
    const byStatus = await Match.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const byCategory = await Match.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 }, scoreMoyen: { $avg: '$score' } } },
      { $sort: { count: -1 } },
    ]);

    const total = global ? global.total : 0;
    const parStatut = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    byStatus.forEach((s) => (parStatut[s._id] = s.count));
    const round = (n) => Math.round((n || 0) * 100) / 100;

    res.json({
      success: true,
      data: {
        total,
        scoreMoyen: round(global && global.scoreMoyen),
        parStatut,
        // Part des correspondances qui ont abouti à une restitution
        tauxRestitution: total ? round((parStatut['RESTITUÉ'] / total) * 100) : 0,
        parCategorie: byCategory.map((c) => ({ category: c._id, count: c.count, scoreMoyen: round(c.scoreMoyen) })),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/matches/auto — Matching automatique
 * Le serveur calcule lui-même les 4 critères à partir des deux objets puis crée la correspondance.
 * ?preview=true : calcule seulement, sans enregistrer.
 */
exports.autoMatch = async (req, res, next) => {
  try {
    const { lost, found, notes } = req.body || {};
    const errors = [...validateItem(lost, 'lost'), ...validateItem(found, 'found')];
    if (errors.length) return res.status(400).json({ success: false, message: 'Données invalides', errors });

    const { criteria, details } = computeCriteria(lost, found);
    const score = computeScore(criteria);
    const result = { criteria, score, niveau: scoreLevel(score), details };

    if (req.query.preview === 'true') {
      return res.json({ success: true, message: 'Aperçu du score (non enregistré)', data: result });
    }
    const match = await Match.create({
      lostItemId: lost.id,
      foundItemId: found.id,
      category: lost.category,
      criteria,
      score,
      notes,
    });
    res.status(201).json({ success: true, message: 'Correspondance calculée et ajoutée', data: match, details, niveau: result.niveau });
  } catch (err) {
    next(err);
  }
};

/** GET /api/matches/:id/history — Historique des changements de statut */
exports.getHistory = async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id).select('status history');
    if (!match) {
      return res.status(404).json({ success: false, message: 'Correspondance introuvable' });
    }
    res.json({ success: true, count: match.history.length, status: match.status, data: match.history });
  } catch (err) {
    next(err);
  }
};

/** GET /api/matches/suggestions/:lostItemId — Meilleures correspondances pour un objet perdu */
exports.getSuggestions = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);
    const matches = await Match.find({
      lostItemId: req.params.lostItemId,
      status: { $in: ['PROPOSÉ', 'CONFIRMÉ'] },
    })
      .sort({ score: -1, createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      count: matches.length,
      data: matches.map((m) => ({ ...m.toObject(), niveau: scoreLevel(m.score) })),
    });
  } catch (err) {
    next(err);
  }
};
