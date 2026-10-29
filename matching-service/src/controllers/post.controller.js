const mongoose = require('mongoose');
const Match = require('../models/Match');
const Post = require('../models/Post');
const { scoreLevel } = require('../utils/scoring');

// Champs modifiables par le client (statut, likes, vues, dates : gérés par le serveur)
const ALLOWED = ['matchId', 'authorId', 'title', 'content', 'tags'];
const pick = (body, keys = ALLOWED) =>
  Object.fromEntries(Object.entries(body || {}).filter(([k]) => keys.includes(k)));

// Seules les correspondances confirmées ou restituées peuvent être publiées
const PUBLISHABLE = ['CONFIRMÉ', 'RESTITUÉ'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const notFound = (res) => res.status(404).json({ success: false, message: 'Publication introuvable' });
const withCount = (p) => ({
  ...(p.toObject ? p.toObject() : p),
  likesCount: (p.likes || []).length,
  commentsCount: (p.comments || []).length,
});

async function findMatch(matchId) {
  if (!mongoose.Types.ObjectId.isValid(matchId)) return { error: [400, `matchId invalide : ${matchId}`] };
  const match = await Match.findById(matchId);
  if (!match) return { error: [404, 'Correspondance (matchId) introuvable'] };
  return { match };
}

/** POST /api/posts — Ajouter une publication (toujours créée en BROUILLON) */
exports.createPost = async (req, res, next) => {
  try {
    const data = pick(req.body);
    if (data.matchId) {
      const { match, error } = await findMatch(data.matchId);
      if (error) return res.status(error[0]).json({ success: false, message: error[1] });
      if (match.status === 'REJETÉ') {
        return res.status(409).json({ success: false, message: 'Impossible de publier sur une correspondance rejetée' });
      }
    }
    data.status = 'BROUILLON';
    const post = await Post.create(data);
    res.status(201).json({ success: true, message: 'Publication ajoutée (brouillon)', data: withCount(post) });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/posts — Lister avec filtres, recherche et pagination
 * ?matchId=&status=&authorId=&tag=&q=texte&page=1&limit=20
 */
exports.getAllPosts = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.matchId) filter.matchId = req.query.matchId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.authorId) filter.authorId = req.query.authorId;
    if (req.query.tag) filter.tags = String(req.query.tag).toLowerCase();
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
      filter.$or = [{ title: rx }, { content: rx }];
    }
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const [total, posts] = await Promise.all([
      Post.countDocuments(filter),
      Post.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    ]);
    res.json({
      success: true, count: posts.length, total, page, pages: Math.max(Math.ceil(total / limit), 1), limit,
      data: posts.map(withCount),
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/posts/:id — Rechercher par id (une publication publiée compte une vue) */
exports.getPostById = async (req, res, next) => {
  try {
    const post = await Post.findOneAndUpdate(
      { _id: req.params.id },
      [{ $set: { views: { $cond: [{ $eq: ['$status', 'PUBLIÉ'] }, { $add: ['$views', 1] }, '$views'] } } }],
      { new: true }
    ).populate('matchId', 'lostItemId foundItemId category score status');
    if (!post) return notFound(res);
    res.json({ success: true, data: withCount(post) });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/posts/:id — Modifier le titre, le contenu ou les tags */
exports.updatePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return notFound(res);
    if (post.status === 'ARCHIVÉ') {
      return res.status(409).json({ success: false, message: 'Une publication archivée ne peut plus être modifiée' });
    }
    post.set(pick(req.body, ['title', 'content', 'tags']));
    await post.save();
    res.json({ success: true, message: 'Publication modifiée', data: withCount(post) });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/posts/:id */
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) return notFound(res);
    res.json({ success: true, message: 'Publication supprimée', data: { id: post._id } });
  } catch (err) {
    next(err);
  }
};

/* ======================= Métier ======================= */

/** PATCH /api/posts/:id/publish — BROUILLON → PUBLIÉ (correspondance confirmée ou restituée uniquement) */
exports.publishPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return notFound(res);
    if (post.status !== 'BROUILLON') {
      return res.status(409).json({ success: false, message: `Seul un brouillon peut être publié (statut actuel : ${post.status})` });
    }
    const match = await Match.findById(post.matchId);
    if (!match || !PUBLISHABLE.includes(match.status)) {
      return res.status(409).json({
        success: false,
        message: `Publication impossible : la correspondance doit être CONFIRMÉ ou RESTITUÉ (actuellement ${match ? match.status : 'supprimée'})`,
      });
    }
    post.status = 'PUBLIÉ';
    post.publishedAt = new Date();
    await post.save();
    res.json({ success: true, message: 'Publication publiée', data: withCount(post) });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/posts/:id/archive — BROUILLON | PUBLIÉ → ARCHIVÉ */
exports.archivePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return notFound(res);
    if (post.status === 'ARCHIVÉ') {
      return res.status(409).json({ success: false, message: 'Publication déjà archivée' });
    }
    post.status = 'ARCHIVÉ';
    post.archivedReason = (req.body && req.body.reason) || 'Archivée manuellement';
    await post.save();
    res.json({ success: true, message: 'Publication archivée', data: withCount(post) });
  } catch (err) {
    next(err);
  }
};

/** POST /api/posts/:id/like — J'aime / je n'aime plus (un seul « j'aime » par utilisateur) */
exports.toggleLike = async (req, res, next) => {
  try {
    const userId = req.body && String(req.body.userId || '').trim();
    if (!userId) return res.status(400).json({ success: false, message: 'userId est obligatoire' });
    const post = await Post.findById(req.params.id);
    if (!post) return notFound(res);
    if (post.status !== 'PUBLIÉ') {
      return res.status(409).json({ success: false, message: 'Seule une publication publiée peut être aimée' });
    }
    const liked = !post.likes.includes(userId);
    // Opération atomique : pas de doublon même si deux requêtes arrivent en même temps
    const updated = await Post.findByIdAndUpdate(
      post._id,
      liked ? { $addToSet: { likes: userId } } : { $pull: { likes: userId } },
      { new: true }
    );
    res.json({
      success: true,
      message: liked ? 'Publication aimée' : 'J\'aime retiré',
      liked,
      likesCount: updated.likes.length,
      data: withCount(updated),
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/posts/:id/comments — Commentaires d'une publication (du plus ancien au plus récent) */
exports.getComments = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).select('comments status');
    if (!post) return notFound(res);
    const comments = [...post.comments].sort((a, b) => a.createdAt - b.createdAt);
    res.json({ success: true, count: comments.length, data: comments });
  } catch (err) {
    next(err);
  }
};

/** POST /api/posts/:id/comments — Commenter une publication (publiée uniquement) */
exports.addComment = async (req, res, next) => {
  try {
    const authorId = String((req.body && req.body.authorId) || '').trim();
    const content = String((req.body && req.body.content) || '').trim();
    const errors = [];
    if (!authorId) errors.push('authorId est obligatoire');
    if (!content) errors.push('Le commentaire est vide');
    if (content.length > 500) errors.push('Commentaire trop long (500 caractères max)');
    if (errors.length) return res.status(400).json({ success: false, message: 'Données invalides', errors });

    const post = await Post.findById(req.params.id);
    if (!post) return notFound(res);
    if (post.status !== 'PUBLIÉ') {
      return res.status(409).json({ success: false, message: 'Seule une publication publiée peut être commentée' });
    }
    // Anti-doublon : le même auteur ne peut pas envoyer deux fois de suite le même commentaire
    const last = post.comments[post.comments.length - 1];
    if (last && last.authorId === authorId && last.content === content) {
      return res.status(409).json({ success: false, message: 'Commentaire identique déjà envoyé' });
    }
    post.comments.push({ authorId, content });
    await post.save();
    const comment = post.comments[post.comments.length - 1];
    res.status(201).json({ success: true, message: 'Commentaire ajouté', data: comment, commentsCount: post.comments.length });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/posts/:id/comments/:commentId?authorId=… — Supprimer un commentaire
 * Autorisé à l'auteur du commentaire ou à l'auteur de la publication (403 sinon).
 */
exports.deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ success: false, message: `Id invalide : ${commentId}` });
    }
    const requester = String(req.query.authorId || (req.body && req.body.authorId) || '').trim();
    if (!requester) return res.status(400).json({ success: false, message: 'authorId est obligatoire' });

    const post = await Post.findById(req.params.id);
    if (!post) return notFound(res);
    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Commentaire introuvable' });
    if (requester !== comment.authorId && requester !== post.authorId) {
      return res.status(403).json({ success: false, message: 'Seul l\'auteur du commentaire ou de la publication peut le supprimer' });
    }
    comment.deleteOne();
    await post.save();
    res.json({ success: true, message: 'Commentaire supprimé', data: { id: commentId }, commentsCount: post.comments.length });
  } catch (err) {
    next(err);
  }
};

/** GET /api/posts/feed — Fil des publications publiées, classées par popularité */
exports.getFeed = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const posts = await Post.aggregate([
      { $match: { status: 'PUBLIÉ' } },
      { $addFields: { likesCount: { $size: '$likes' }, commentsCount: { $size: { $ifNull: ['$comments', []] } } } },
      // Popularité : un « j'aime » vaut 3 vues, un commentaire vaut 2 vues
      { $addFields: { popularite: { $add: [{ $multiply: ['$likesCount', 3] }, { $multiply: ['$commentsCount', 2] }, '$views'] } } },
      { $sort: { popularite: -1, publishedAt: -1 } },
      { $limit: limit },
      { $lookup: { from: Match.collection.name, localField: 'matchId', foreignField: '_id', as: 'match' } },
      { $unwind: { path: '$match', preserveNullAndEmptyArrays: true } },
      { $project: { 'match.history': 0, 'match.criteria': 0, 'match.__v': 0 } },
    ]);
    res.json({ success: true, count: posts.length, data: posts });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/posts/from-match/:id — Génère automatiquement une publication à partir d'une correspondance
 * (titre, contenu et tags rédigés selon le statut et le score). ?publish=true pour publier directement.
 */
exports.generateFromMatch = async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ success: false, message: 'Correspondance introuvable' });
    if (match.status === 'REJETÉ') {
      return res.status(409).json({ success: false, message: 'Impossible de publier sur une correspondance rejetée' });
    }
    const TITLES = {
      PROPOSÉ: `Correspondance possible : ${match.category}`,
      CONFIRMÉ: `Objet retrouvé : ${match.category} — propriétaire identifié`,
      RESTITUÉ: `Objet restitué à son propriétaire : ${match.category}`,
    };
    const content = [
      `L'objet perdu ${match.lostItemId} a été rapproché de l'objet retrouvé ${match.foundItemId}.`,
      `Score de correspondance : ${match.score}/100 (confiance ${scoreLevel(match.score).toLowerCase()}).`,
      match.notes ? `Détails : ${match.notes}.` : null,
      match.status === 'RESTITUÉ'
        ? 'Merci à la communauté WinL9it pour son aide !'
        : 'Si cet objet vous appartient, contactez l\'équipe WinL9it.',
    ].filter(Boolean).join('\n');

    const post = new Post({
      matchId: match._id,
      authorId: (req.body && req.body.authorId) || 'SYSTEM',
      title: TITLES[match.status],
      content,
      tags: [match.category, match.status].map((t) => t.toLowerCase()),
    });
    const wantPublish = req.query.publish === 'true';
    if (wantPublish && PUBLISHABLE.includes(match.status)) {
      post.status = 'PUBLIÉ';
      post.publishedAt = new Date();
    }
    await post.save();
    res.status(201).json({
      success: true,
      message: post.status === 'PUBLIÉ' ? 'Publication générée et publiée' : 'Publication générée (brouillon)',
      data: withCount(post),
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/posts/stats — Statistiques des publications */
exports.getStats = async (req, res, next) => {
  try {
    const [byStatus, [totals = {}], top] = await Promise.all([
      Post.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Post.aggregate([{ $group: {
        _id: null, total: { $sum: 1 }, likes: { $sum: { $size: '$likes' } }, vues: { $sum: '$views' },
        commentaires: { $sum: { $size: { $ifNull: ['$comments', []] } } },
      } }]),
      Post.aggregate([
        { $match: { status: 'PUBLIÉ' } },
        { $addFields: { likesCount: { $size: '$likes' } } },
        { $sort: { likesCount: -1, views: -1 } },
        { $limit: 3 },
        { $project: { title: 1, likesCount: 1, views: 1 } },
      ]),
    ]);
    const parStatut = { BROUILLON: 0, PUBLIÉ: 0, ARCHIVÉ: 0 };
    byStatus.forEach((s) => (parStatut[s._id] = s.n));
    res.json({
      success: true,
      data: {
        total: totals.total || 0, parStatut, totalLikes: totals.likes || 0, totalVues: totals.vues || 0,
        totalCommentaires: totals.commentaires || 0, top,
      },
    });
  } catch (err) {
    next(err);
  }
};
