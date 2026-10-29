const mongoose = require('mongoose');

/**
 * Entité 1 — Match
 * Une correspondance entre une annonce d'objet perdu (Lost Item Service)
 * et une annonce d'objet retrouvé (Found Item Service).
 * Les objets ne sont référencés que par leur id : chaque microservice
 * reste propriétaire de ses propres données.
 */
const matchSchema = new mongoose.Schema(
  {
    lostItemId: { type: String, required: [true, 'lostItemId est obligatoire'], trim: true },
    foundItemId: { type: String, required: [true, 'foundItemId est obligatoire'], trim: true },

    category: {
      type: String,
      required: [true, 'La catégorie est obligatoire'],
      enum: {
        values: ['Accessoires', 'Clés', 'Électronique', 'Documents', 'Vêtements', 'Portefeuille', 'Autre'],
        message: 'Catégorie invalide : {VALUE}',
      },
    },

    // Les 4 critères du matching intelligent (slide 4 « Notre innovation »)
    criteria: {
      categoryScore: { type: Number, min: 0, max: 100, default: 0 },
      descriptionScore: { type: Number, min: 0, max: 100, default: 0 },
      locationScore: { type: Number, min: 0, max: 100, default: 0 },
      dateScore: { type: Number, min: 0, max: 100, default: 0 },
    },

    // Score global calculé (moyenne pondérée des critères)
    score: { type: Number, min: 0, max: 100, default: 0 },

    status: {
      type: String,
      enum: ['PROPOSÉ', 'CONFIRMÉ', 'REJETÉ', 'RESTITUÉ'],
      default: 'PROPOSÉ',
    },

    notes: { type: String, trim: true, maxlength: 500 },

    // Historique des changements de statut (traçabilité)
    history: [
      {
        _id: false,
        from: { type: String, default: null },
        to: { type: String, required: true },
        date: { type: Date, default: Date.now },
        comment: { type: String, trim: true, maxlength: 300 },
      },
    ],
  },
  { timestamps: true }
);

// Une même paire perdu/retrouvé ne peut être enregistrée qu'une seule fois
matchSchema.index({ lostItemId: 1, foundItemId: 1 }, { unique: true });

// Première entrée de l'historique à la création
matchSchema.pre('save', function (next) {
  if (this.isNew && !this.history.length) {
    this.history.push({ from: null, to: this.status, comment: 'Création de la correspondance' });
  }
  next();
});

/** Change le statut en l'enregistrant dans l'historique (sans sauvegarder) */
matchSchema.methods.setStatus = function (to, comment) {
  this.history.push({ from: this.status, to, comment });
  this.status = to;
};

module.exports = mongoose.model('Match', matchSchema);
