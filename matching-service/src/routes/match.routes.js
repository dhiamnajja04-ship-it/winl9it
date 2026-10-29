const router = require('express').Router();
const ctrl = require('../controllers/match.controller');
const validateObjectId = require('../middlewares/validateObjectId');

router.route('/')
  .post(ctrl.createMatch)       // Ajouter
  .get(ctrl.getAllMatches);     // Lister

router.route('/:id')
  .all(validateObjectId)
  .get(ctrl.getMatchById)       // Rechercher par id
  .put(ctrl.updateMatch)        // Modifier
  .delete(ctrl.deleteMatch);    // Supprimer

module.exports = router;
