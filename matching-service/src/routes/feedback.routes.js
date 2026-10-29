const router = require('express').Router();
const ctrl = require('../controllers/feedback.controller');
const validateObjectId = require('../middlewares/validateObjectId');

router.route('/')
  .post(ctrl.createFeedback)
  .get(ctrl.getAllFeedbacks);

router.route('/:id')
  .all(validateObjectId)
  .get(ctrl.getFeedbackById)
  .put(ctrl.updateFeedback)
  .delete(ctrl.deleteFeedback);

module.exports = router;
