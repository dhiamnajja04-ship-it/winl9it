const router = require('express').Router();
const ctrl = require('../controllers/match.controller');
const validateObjectId = require('../middlewares/validateObjectId');

router.route('/')
  .post(ctrl.createMatch)       // Ajouter
  .get(ctrl.getAllMatches);     // Lister

// Métier (déclarées avant /:id)
router.get('/stats', ctrl.getStats);                              // Tableau de bord
router.get('/suggestions/:lostItemId', ctrl.getSuggestions);      // Meilleures propositions
router.patch('/:id/status', validateObjectId, ctrl.changeStatus); // Cycle de vie

router.route('/:id')
  .all(validateObjectId)
  .get(ctrl.getMatchById)       // Rechercher par id
  .put(ctrl.updateMatch)        // Modifier
  .delete(ctrl.deleteMatch);    // Supprimer

module.exports = router;
