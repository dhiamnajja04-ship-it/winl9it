const Match = require('../models/Match');
const MatchFeedback = require('../models/MatchFeedback');
const { computeScore } = require('../utils/scoring');

// Champs modifiables par le client (score et dates sont calculés par le serveur)
const ALLOWED = ['lostItemId', 'foundItemId', 'category', 'criteria', 'status', 'notes'];
const pick = (body) =>
  Object.fromEntries(Object.entries(body || {}).filter(([k]) => ALLOWED.includes(k)));

/** POST /api/matches — Ajouter une correspondance */
exports.createMatch = async (req, res, next) => {
  try {
    const data = pick(req.body);
    data.score = computeScore(data.criteria);
    const match = await Match.create(data);
    res.status(201).json({ success: true, message: 'Correspondance ajoutée', data: match });
  } catch (err) {
    next(err);
  }
};

/** GET /api/matches — Lister (filtres optionnels : status, category, minScore) */
exports.getAllMatches = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.minScore) filter.score = { $gte: Number(req.query.minScore) };

    // Classement des correspondances : meilleur score en premier
    const matches = await Match.find(filter).sort({ score: -1, createdAt: -1 });
    res.json({ success: true, count: matches.length, data: matches });
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
    if (data.criteria) {
      // Fusion : on peut ne modifier qu'un seul critère
      data.criteria = { ...match.criteria.toObject(), ...data.criteria };
    }
    match.set(data);
    match.score = computeScore(match.criteria);
    await match.save(); // save() déclenche les validateurs du schéma

    res.json({ success: true, message: 'Correspondance modifiée', data: match });
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
