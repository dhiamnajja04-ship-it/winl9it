const mongoose = require('mongoose');

/**
 * Entité 3 — Post
 * Publication liée à une correspondance (ex. « Objet retrouvé ! Contactez le propriétaire »).
 * Cycle de vie : BROUILLON → PUBLIÉ → ARCHIVÉ.
 */
const postSchema = new mongoose.Schema(
  {
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: [true, 'matchId est obligatoire'] },
    authorId: { type: String, required: [true, 'authorId est obligatoire'], trim: true },
    title: { type: String, required: [true, 'Le titre est obligatoire'], trim: true, maxlength: [120, 'Titre trop long (120 caractères max)'] },
    content: { type: String, required: [true, 'Le contenu est obligatoire'], trim: true, maxlength: [2000, 'Contenu trop long (2000 caractères max)'] },
    tags: [{ type: String, trim: true, lowercase: true }],
    status: {
      type: String,
      enum: { values: ['BROUILLON', 'PUBLIÉ', 'ARCHIVÉ'], message: 'Statut invalide : {VALUE}' },
      default: 'BROUILLON',
    },
    // Utilisateurs qui aiment la publication (un seul « j'aime » par utilisateur)
    likes: [{ type: String, trim: true }],
    views: { type: Number, default: 0, min: 0 },
    publishedAt: { type: Date, default: null },
    archivedReason: { type: String, trim: true },
  },
  { timestamps: true }
);

postSchema.index({ matchId: 1 });
postSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model('Post', postSchema);
