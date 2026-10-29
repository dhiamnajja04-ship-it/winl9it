const router = require('express').Router();
const ctrl = require('../controllers/match.controller');
const validateObjectId = require('../middlewares/validateObjectId');

router.route('/')
  .post(ctrl.createMatch)       // Ajouter
  .get(ctrl.getAllMatches);     // Lister

// Métier (déclarées avant /:id)
router.get('/stats', ctrl.getStats);                              // Tableau de bord
router.get('/suggestions/:lostItemId', ctrl.getSuggestions);      // Meilleures propositions
router.post('/auto', ctrl.autoMatch);                             // Matching automatique
router.patch('/:id/status', validateObjectId, ctrl.changeStatus); // Cycle de vie
router.get('/:id/history', validateObjectId, ctrl.getHistory);    // Historique des statuts

router.route('/:id')
  .all(validateObjectId)
  .get(ctrl.getMatchById)       // Rechercher par id
  .put(ctrl.updateMatch)        // Modifier
  .delete(ctrl.deleteMatch);    // Supprimer

module.exports = router;
