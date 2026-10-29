const mongoose = require('mongoose');

/**
 * Entité 2 — MatchFeedback
 * Retour d'un utilisateur sur une correspondance proposée
 * (sert à améliorer la précision du matching — slide 10 « Limites actuelles »).
 */
const matchFeedbackSchema = new mongoose.Schema(
  {
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: [true, 'matchId est obligatoire'] },
    userId: { type: String, required: [true, 'userId est obligatoire'], trim: true },
    isCorrect: { type: Boolean, required: [true, 'isCorrect est obligatoire'] },
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MatchFeedback', matchFeedbackSchema);
