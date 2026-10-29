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
  },
  { timestamps: true }
);

// Une même paire perdu/retrouvé ne peut être enregistrée qu'une seule fois
matchSchema.index({ lostItemId: 1, foundItemId: 1 }, { unique: true });

module.exports = mongoose.model('Match', matchSchema);
