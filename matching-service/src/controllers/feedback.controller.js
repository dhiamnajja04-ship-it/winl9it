const Match = require('../models/Match');
const MatchFeedback = require('../models/MatchFeedback');

const ALLOWED = ['matchId', 'userId', 'isCorrect', 'rating', 'comment'];
const pick = (body) =>
  Object.fromEntries(Object.entries(body || {}).filter(([k]) => ALLOWED.includes(k)));

/** POST /api/feedbacks */
exports.createFeedback = async (req, res, next) => {
  try {
    const data = pick(req.body);
    if (data.matchId && !(await Match.exists({ _id: data.matchId }))) {
      return res.status(404).json({ success: false, message: 'Correspondance (matchId) introuvable' });
    }
    const feedback = await MatchFeedback.create(data);
    res.status(201).json({ success: true, message: 'Feedback ajouté', data: feedback });
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
