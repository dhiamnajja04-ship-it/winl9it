const Post = require('../models/Post');

/**
 * Règle métier : quand une correspondance est rejetée, ses publications
 * (brouillons et publiées) sont archivées automatiquement.
 */
async function archivePostsOfMatches(matchIds, reason) {
  if (!matchIds.length) return 0;
  const { modifiedCount } = await Post.updateMany(
    { matchId: { $in: matchIds }, status: { $ne: 'ARCHIVÉ' } },
    { $set: { status: 'ARCHIVÉ', archivedReason: reason } }
  );
  return modifiedCount;
}

module.exports = { archivePostsOfMatches };
