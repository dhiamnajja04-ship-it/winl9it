const router = require('express').Router();
const ctrl = require('../controllers/feedback.controller');
const validateObjectId = require('../middlewares/validateObjectId');

router.route('/')
  .post(ctrl.createFeedback)
  .get(ctrl.getAllFeedbacks);

// Métier (déclarées avant /:id)
router.get('/stats', ctrl.getGlobalStats);                       // Précision globale du matching
router.get('/stats/:id', validateObjectId, ctrl.getMatchStats);  // Fiabilité d'une correspondance

router.route('/:id')
  .all(validateObjectId)
  .get(ctrl.getFeedbackById)
  .put(ctrl.updateFeedback)
  .delete(ctrl.deleteFeedback);

module.exports = router;
