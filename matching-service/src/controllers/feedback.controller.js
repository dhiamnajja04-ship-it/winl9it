const mongoose = require('mongoose');
const Match = require('../models/Match');
const MatchFeedback = require('../models/MatchFeedback');

const ALLOWED = ['matchId', 'userId', 'isCorrect', 'rating', 'comment'];
const pick = (body) =>
  Object.fromEntries(Object.entries(body || {}).filter(([k]) => ALLOWED.includes(k)));

// Seuils de la règle de rejet automatique
const MIN_FEEDBACKS = 3;
const MIN_PRECISION = 50;

const round = (n) => Math.round(n * 100) / 100;

/** Calcule la précision (avis positifs) d'un ensemble de feedbacks */
function summarize({ total = 0, positifs = 0, noteMoyenne = null } = {}) {
  const tauxPrecision = total ? round((positifs / total) * 100) : 0;
  let verdict = 'MITIGÉ';
  if (total < MIN_FEEDBACKS) verdict = 'INSUFFISANT';
  else if (tauxPrecision >= 70) verdict = 'FIABLE';
  else if (tauxPrecision < MIN_PRECISION) verdict = 'DOUTEUX';
  return {
    total,
    positifs,
    negatifs: total - positifs,
    tauxPrecision,
    noteMoyenne: noteMoyenne == null ? null : round(noteMoyenne),
    verdict,
  };
}

const GROUP_STAGE = {
  total: { $sum: 1 },
  positifs: { $sum: { $cond: ['$isCorrect', 1, 0] } },
  noteMoyenne: { $avg: '$rating' },
};

async function statsForMatch(matchId) {
  const [s] = await MatchFeedback.aggregate([
    { $match: { matchId: new mongoose.Types.ObjectId(String(matchId)) } },
    { $group: { _id: null, ...GROUP_STAGE } },
  ]);
  return summarize(s);
}

/** POST /api/feedbacks */
exports.createFeedback = async (req, res, next) => {
  try {
    const data = pick(req.body);
    let match = null;
    if (data.matchId) {
      if (!mongoose.Types.ObjectId.isValid(data.matchId)) {
        return res.status(400).json({ success: false, message: `matchId invalide : ${data.matchId}` });
      }
      match = await Match.findById(data.matchId);
      if (!match) {
        return res.status(404).json({ success: false, message: 'Correspondance (matchId) introuvable' });
      }
      // Règle métier : on ne donne pas d'avis sur une correspondance déjà rejetée
      if (match.status === 'REJETÉ') {
        return res.status(409).json({ success: false, message: 'Impossible de donner un avis sur une correspondance rejetée' });
      }
    }
    const feedback = await MatchFeedback.create(data);

    // Règle métier : trop d'avis négatifs → la proposition est rejetée automatiquement
    const stats = await statsForMatch(match._id);
    let autoRejected = false;
    if (match.status === 'PROPOSÉ' && stats.total >= MIN_FEEDBACKS && stats.tauxPrecision < MIN_PRECISION) {
      match.status = 'REJETÉ';
      await match.save();
      autoRejected = true;
    }

    res.status(201).json({
      success: true,
      message: autoRejected ? 'Feedback ajouté — correspondance rejetée automatiquement' : 'Feedback ajouté',
      data: feedback,
      matchStatus: match.status,
      stats,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/feedbacks?matchId=... */
exports.getAllFeedbacks = async (req, res, next) => {
  try {
    const filter = req.query.matchId ? { matchId: req.query.matchId } : {};
    const feedbacks = await MatchFeedback.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: feedbacks.length, data: feedbacks });
  } catch (err) {
    next(err);
  }
};

/** GET /api/feedbacks/:id */
exports.getFeedbackById = async (req, res, next) => {
  try {
    const feedback = await MatchFeedback.findById(req.params.id).populate('matchId');
    if (!feedback) return res.status(404).json({ success: false, message: 'Feedback introuvable' });
    res.json({ success: true, data: feedback });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/feedbacks/:id */
exports.updateFeedback = async (req, res, next) => {
  try {
    const data = pick(req.body);
    delete data.matchId; // un feedback reste attaché à sa correspondance
    delete data.userId;  // ... et à son auteur
    const feedback = await MatchFeedback.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!feedback) return res.status(404).json({ success: false, message: 'Feedback introuvable' });
    res.json({ success: true, message: 'Feedback modifié', data: feedback });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/feedbacks/:id */
exports.deleteFeedback = async (req, res, next) => {
  try {
    const feedback = await MatchFeedback.findByIdAndDelete(req.params.id);
    if (!feedback) return res.status(404).json({ success: false, message: 'Feedback introuvable' });
    res.json({ success: true, message: 'Feedback supprimé', data: { id: feedback._id } });
  } catch (err) {
    next(err);
  }
};

/* ======================= Métier ======================= */

/** GET /api/feedbacks/stats — Précision globale du matching, et par catégorie */
exports.getGlobalStats = async (req, res, next) => {
  try {
    const [global] = await MatchFeedback.aggregate([{ $group: { _id: null, ...GROUP_STAGE } }]);
    const byCategory = await MatchFeedback.aggregate([
      { $lookup: { from: Match.collection.name, localField: 'matchId', foreignField: '_id', as: 'match' } },
      { $unwind: '$match' },
      { $group: { _id: '$match.category', ...GROUP_STAGE } },
      { $sort: { total: -1 } },
    ]);
    res.json({
      success: true,
      data: {
        ...summarize(global),
        parCategorie: byCategory.map((c) => ({ category: c._id, ...summarize(c) })),
      },
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/feedbacks/stats/:id — Fiabilité d'une correspondance d'après les avis (id = matchId) */
exports.getMatchStats = async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ success: false, message: 'Correspondance introuvable' });
    res.json({
      success: true,
      data: { matchId: match._id, matchStatus: match.status, score: match.score, ...(await statsForMatch(match._id)) },
    });
  } catch (err) {
    next(err);
  }
};
