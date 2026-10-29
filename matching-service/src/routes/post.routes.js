const router = require('express').Router();
const ctrl = require('../controllers/post.controller');
const validateObjectId = require('../middlewares/validateObjectId');

router.route('/')
  .post(ctrl.createPost)        // Ajouter
  .get(ctrl.getAllPosts);       // Lister

// Métier (déclarées avant /:id)
router.get('/feed', ctrl.getFeed);                                      // Fil par popularité
router.get('/stats', ctrl.getStats);                                    // Statistiques
router.post('/from-match/:id', validateObjectId, ctrl.generateFromMatch); // Génération automatique
router.patch('/:id/publish', validateObjectId, ctrl.publishPost);       // BROUILLON → PUBLIÉ
router.patch('/:id/archive', validateObjectId, ctrl.archivePost);       // → ARCHIVÉ
router.post('/:id/like', validateObjectId, ctrl.toggleLike);            // J'aime / je n'aime plus
router.route('/:id/comments')
  .all(validateObjectId)
  .get(ctrl.getComments)                                                // Lister les commentaires
  .post(ctrl.addComment);                                               // Commenter
router.delete('/:id/comments/:commentId', validateObjectId, ctrl.deleteComment); // Supprimer un commentaire

router.route('/:id')
  .all(validateObjectId)
  .get(ctrl.getPostById)        // Rechercher par id
  .put(ctrl.updatePost)         // Modifier
  .delete(ctrl.deletePost);     // Supprimer

module.exports = router;
