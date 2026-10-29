// Gestion centralisée des erreurs (validation Mongoose, doublons, erreurs serveur)
module.exports = function errorHandler(err, req, res, next) {
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: 'Données invalides', errors });
  }
  if (err.code === 11000) {
    const isFeedback = err.keyPattern && 'userId' in err.keyPattern;
    return res.status(409).json({
      success: false,
      message: isFeedback
        ? 'Cet utilisateur a déjà donné son avis sur cette correspondance'
        : 'Cette correspondance (lostItemId + foundItemId) existe déjà',
    });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Valeur invalide pour ${err.path}` });
  }
  console.error(err);
  res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
};
