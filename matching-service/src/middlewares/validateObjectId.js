const mongoose = require('mongoose');

// Vérifie que :id est un ObjectId MongoDB valide avant d'interroger la base
module.exports = function validateObjectId(req, res, next) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: `Id invalide : ${req.params.id}` });
  }
  next();
};
