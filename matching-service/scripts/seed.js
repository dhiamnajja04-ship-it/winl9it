/**
 * Charge un jeu de données de démonstration EN PASSANT PAR L'API
 * (le serveur doit être démarré) : toutes les règles métier s'appliquent
 * (score automatique, cycle de vie, rejets automatiques, historique, avis).
 *
 *   npm run seed            → ajoute les données DEMO-*
 *   npm run seed -- --reset → supprime d'abord les anciennes données DEMO-*
 *
 * Seules les correspondances dont les ids commencent par « DEMO- » sont touchées.
 */
require('dotenv').config();

const BASE = `http://localhost:${process.env.PORT || 3004}/api`;

async function call(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

// Lieux (lat, lng)
const P = {
  esprit: { lat: 36.8992, lng: 10.1894 },
  espritBlocB: { lat: 36.9001, lng: 10.1889 },
  espritParking: { lat: 36.8985, lng: 10.1902 },
  ghazala: { lat: 36.8936, lng: 10.1871 },
  ariana: { lat: 36.8625, lng: 10.1956 },
  tunis: { lat: 36.8008, lng: 10.18 },
  lacTunis: { lat: 36.8325, lng: 10.2333 },
  marsa: { lat: 36.8782, lng: 10.3247 },
  carthage: { lat: 36.8528, lng: 10.3233 },
  aeroport: { lat: 36.851, lng: 10.2272 },
};

const item = (id, category, description, location, date) => ({ id, category, description, location, date });

// [clé, objet perdu, objet retrouvé, notes]
const PAIRS = [
  ['iphone', item('DEMO-L01', 'Électronique', 'iPhone 13 bleu avec coque noire, perdu à la cafétéria', P.esprit, '2026-10-20'),
    item('DEMO-F01', 'Électronique', 'iPhone bleu coque noire trouvé sur une table de la cafétéria', P.esprit, '2026-10-20'), 'Téléphone — cafétéria ESPRIT'],
  ['iphoneBis', item('DEMO-L01', 'Électronique', 'iPhone 13 bleu avec coque noire, perdu à la cafétéria', P.esprit, '2026-10-20'),
    item('DEMO-F02', 'Électronique', 'Samsung bleu écran fissuré trouvé au bloc B', P.espritBlocB, '2026-10-22'), 'Autre téléphone bleu trouvé sur le campus'],
  ['sac', item('DEMO-L02', 'Accessoires', 'Sac à dos noir Eastpak avec ordinateur et cahiers', P.esprit, '2026-10-14'),
    item('DEMO-F03', 'Accessoires', 'Sac à dos Eastpak noir trouvé à la bibliothèque, contient des cahiers', P.espritBlocB, '2026-10-14'), 'Sac à dos — bibliothèque'],
  ['cles', item('DEMO-L03', 'Clés', 'Clés de voiture Peugeot avec porte-clés rouge', P.espritParking, '2026-10-21'),
    item('DEMO-F04', 'Clés', 'Trousseau clés Peugeot porte-clés rouge trouvé au parking', P.espritParking, '2026-10-22'), 'Clés — parking'],
  ['portefeuille', item('DEMO-L04', 'Portefeuille', 'Portefeuille en cuir marron avec carte identité', P.tunis, '2026-10-10'),
    item('DEMO-F05', 'Portefeuille', 'Portefeuille cuir marron trouvé dans le métro, carte identité dedans', P.lacTunis, '2026-10-12'), 'Portefeuille — métro'],
  ['carte', item('DEMO-L05', 'Documents', 'Carte étudiant ESPRIT au nom de Sami', P.esprit, '2026-10-18'),
    item('DEMO-F06', 'Documents', 'Carte étudiant ESPRIT Sami trouvée dans un amphi', P.espritBlocB, '2026-10-18'), 'Carte étudiant — amphi'],
  ['airpods', item('DEMO-L06', 'Électronique', 'Écouteurs AirPods Pro boîtier blanc', P.ghazala, '2026-10-05'),
    item('DEMO-F07', 'Électronique', 'Écouteurs blancs sans boîtier trouvés dans le bus', P.marsa, '2026-10-09'), 'Écouteurs — bus 20'],
  ['veste', item('DEMO-L07', 'Vêtements', 'Veste en jean bleue taille M', P.ariana, '2026-10-16'),
    item('DEMO-F08', 'Vêtements', 'Veste jean bleue trouvée à la salle de sport', P.ariana, '2026-10-17'), 'Veste — salle de sport Ariana'],
  ['montre', item('DEMO-L08', 'Accessoires', 'Montre Casio noire bracelet plastique', P.marsa, '2026-09-28'),
    item('DEMO-F09', 'Accessoires', 'Montre Casio noire trouvée sur la plage', P.marsa, '2026-09-29'), 'Montre — plage de La Marsa'],
  ['pc', item('DEMO-L09', 'Électronique', 'Ordinateur portable HP gris avec autocollants', P.espritBlocB, '2026-10-23'),
    item('DEMO-F10', 'Électronique', 'PC portable HP gris autocollants trouvé en salle B12', P.espritBlocB, '2026-10-23'), 'Ordinateur — salle B12'],
  ['lunettes', item('DEMO-L10', 'Accessoires', 'Lunettes de vue monture noire dans un étui bleu', P.ariana, '2026-10-02'),
    item('DEMO-F11', 'Autre', 'Étui bleu vide trouvé dans un café', P.tunis, '2026-10-08'), 'Lunettes — café'],
  ['passeport', item('DEMO-L11', 'Documents', 'Passeport tunisien couverture verte', P.aeroport, '2026-10-19'),
    item('DEMO-F12', 'Documents', 'Passeport tunisien trouvé au comptoir enregistrement', P.aeroport, '2026-10-19'), 'Passeport — aéroport Tunis-Carthage'],
  ['clesMaison', item('DEMO-L12', 'Clés', 'Deux clés de maison avec anneau métal', P.ariana, '2026-10-11'),
    item('DEMO-F13', 'Électronique', 'Clé USB 32 Go noire trouvée au café', P.tunis, '2026-10-15'), 'Clés maison — proposition douteuse'],
  ['echarpe', item('DEMO-L13', 'Vêtements', 'Écharpe en laine grise', P.carthage, '2026-10-06'),
    item('DEMO-F14', 'Vêtements', 'Écharpe rouge en laine trouvée à la gare', P.tunis, '2026-10-09'), 'Écharpe — gare'],
  ['calculatrice', item('DEMO-L14', 'Électronique', 'Calculatrice Casio fx-991 avec nom gravé', P.esprit, '2026-10-24'),
    item('DEMO-F15', 'Électronique', 'Calculatrice Casio fx-991 trouvée en salle examen', P.espritBlocB, '2026-10-24'), 'Calculatrice — examen'],
  ['sacBis', item('DEMO-L02', 'Accessoires', 'Sac à dos noir Eastpak avec ordinateur et cahiers', P.esprit, '2026-10-14'),
    item('DEMO-F16', 'Accessoires', 'Sac noir Nike trouvé devant le foyer', P.ghazala, '2026-10-16'), 'Autre sac noir trouvé'],
];

// Changements de statut (dans l'ordre) : [clé, statut, commentaire]
const STATUS_CHANGES = [
  ['iphone', 'CONFIRMÉ', 'Propriétaire identifié par le code de déverrouillage'],
  ['sac', 'CONFIRMÉ', 'Contenu du sac décrit par le propriétaire'],
  ['sac', 'RESTITUÉ', 'Sac remis à l\'accueil le 15/10'],
  ['carte', 'CONFIRMÉ', 'Nom et photo vérifiés'],
  ['montre', 'CONFIRMÉ', 'Photo de la montre fournie'],
  ['montre', 'RESTITUÉ', 'Remise en main propre'],
  ['pc', 'CONFIRMÉ', 'Numéro de série vérifié'],
  ['clesMaison', 'REJETÉ', 'Catégories incompatibles'],
];

// Avis : [clé, userId, isCorrect, note, commentaire]
const FEEDBACKS = [
  ['iphone', 'USER-001', true, 5, 'C\'est bien mon téléphone, merci !'],
  ['iphone', 'USER-014', true, 4],
  ['cles', 'USER-003', true, 5, 'Mes clés, porte-clés rouge'],
  ['cles', 'USER-021', true, 4],
  ['portefeuille', 'USER-004', true, 4, 'Le bon portefeuille'],
  ['portefeuille', 'USER-009', false, 2],
  ['portefeuille', 'USER-012', true, 4],
  ['airpods', 'USER-006', false, 2, 'Les miens avaient un boîtier'],
  ['airpods', 'USER-017', false, 1],
  ['airpods', 'USER-022', false, 2],               // 3e avis négatif → rejet automatique
  ['veste', 'USER-007', true, 5],
  ['passeport', 'USER-011', true, 5, 'Mon passeport'],
  ['calculatrice', 'USER-015', true, 4],
  ['calculatrice', 'USER-018', false, 3],
  ['calculatrice', 'USER-019', true, 5],
  ['echarpe', 'USER-013', false, 2, 'La mienne est grise'],
];

(async () => {
  const health = await fetch(BASE.replace('/api', '/health')).catch(() => null);
  if (!health || !health.ok) {
    console.error('❌ Le serveur ne répond pas sur ' + BASE + ' — lancez d\'abord « npm run dev ».');
    process.exit(1);
  }

  if (process.argv.includes('--reset')) {
    const { body } = await call('GET', '/matches?q=DEMO-&limit=100');
    for (const m of body.data || []) await call('DELETE', `/matches/${m._id}`);
    console.log(`🧹 ${(body.data || []).length} ancienne(s) correspondance(s) DEMO supprimée(s) (avec leurs avis)`);
  }

  const ids = {};
  let created = 0, skipped = 0;
  for (const [key, lost, found, notes] of PAIRS) {
    const r = await call('POST', '/matches/auto', { lost, found, notes });
    if (r.status === 201) {
      ids[key] = r.body.data._id;
      created++;
      console.log(`✅ ${lost.id} ↔ ${found.id}  score ${String(r.body.data.score).padStart(5)}  ${r.body.niveau.padEnd(6)} ${notes}`);
    } else if (r.status === 409) {
      skipped++;
      const { body } = await call('GET', `/matches?q=${encodeURIComponent(found.id)}&limit=1`);
      ids[key] = body.data[0] && body.data[0]._id;
      console.log(`↷  ${lost.id} ↔ ${found.id}  existe déjà (relancer avec --reset pour repartir de zéro)`);
    } else {
      console.log(`❌ ${lost.id} ↔ ${found.id}  ${r.status} ${r.body.message}`);
    }
  }

  for (const [key, status, comment] of STATUS_CHANGES) {
    const r = await call('PATCH', `/matches/${ids[key]}/status`, { status, comment });
    const extra = r.body.autresRejetees ? ` (+${r.body.autresRejetees} proposition(s) concurrente(s) rejetée(s))` : '';
    console.log(`${r.status === 200 ? '🔁' : '⚠️ '} ${key.padEnd(13)} → ${status}${r.status === 200 ? extra : ' : ' + r.body.message}`);
  }

  let fbOk = 0;
  for (const [key, userId, isCorrect, rating, comment] of FEEDBACKS) {
    const r = await call('POST', '/feedbacks', { matchId: ids[key], userId, isCorrect, rating, comment });
    if (r.status === 201) fbOk++;
    if (r.status === 201 && r.body.matchStatus === 'REJETÉ' && /automatiquement/.test(r.body.message)) {
      console.log(`🤖 ${key} rejetée automatiquement après les avis (${r.body.stats.tauxPrecision} % positifs)`);
    } else if (r.status !== 201) {
      console.log(`⚠️  avis ${userId} sur ${key} : ${r.status} ${r.body.message}`);
    }
  }

  const { body: stats } = await call('GET', '/matches/stats');
  console.log(`\n📦 ${created} correspondance(s) créée(s), ${skipped} déjà présente(s), ${fbOk} avis ajouté(s)`);
  console.log('📊', JSON.stringify(stats.data.parStatut), `· score moyen ${stats.data.scoreMoyen} · restitution ${stats.data.tauxRestitution} %`);
})().catch((e) => { console.error(e); process.exit(1); });
