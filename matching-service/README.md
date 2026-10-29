<p align="center"><img src="public/logo-full.svg" alt="WinL9it — Matching Service" width="320" /></p>

# WinL9it — Matching Service

Microservice **Matching Service** du projet WinL9it (ESPRIT).
Responsable : **Dhia Eddine Mnajja**. Entités : **Match**, **MatchFeedback** et **Post**.

Le service gère les **correspondances** entre une annonce d'objet perdu (Lost Item Service)
et une annonce d'objet retrouvé (Found Item Service), avec un score calculé sur les
4 critères de la slide 4 :

| Critère | Poids |
|---|---|
| Catégorie | 30 % |
| Similarité des descriptions | 30 % |
| Proximité géographique | 20 % |
| Proximité des dates | 20 % |

## Ce que demande le prof → ce qui est fait

| Demande | Réalisation |
|---|---|
| Afficher l'interface d'ajout | Page web `http://localhost:3004` (formulaire d'ajout) + `POST /api/matches` |
| Rechercher par id | Champ « Rechercher par id » + `GET /api/matches/:id` |
| Supprimer | Bouton « Supprimer » + `DELETE /api/matches/:id` |
| Modifier | Bouton « Modifier » (le formulaire passe en mode modification) + `PUT /api/matches/:id` |

Le même CRUD existe pour la 2ᵉ entité : `/api/feedbacks`.

## Métier

### Entité 1 — Match

| Règle / fonctionnalité | Endpoint |
|---|---|
| **Cycle de vie** : `PROPOSÉ → CONFIRMÉ → RESTITUÉ`, ou `→ REJETÉ`. `REJETÉ` et `RESTITUÉ` sont finaux. Toute transition interdite → `409` (aussi via `PUT`) | `PATCH /api/matches/:id/status` |
| Une nouvelle correspondance commence toujours à `PROPOSÉ` | `POST /api/matches` |
| **Exclusivité** : confirmer une correspondance rejette automatiquement les autres propositions sur le même objet perdu ou retrouvé ; un objet déjà confirmé ailleurs ne peut pas être reconfirmé (`409`) | `PATCH /api/matches/:id/status` |
| **Suggestions** : meilleures correspondances d'un objet perdu, triées par score, avec niveau de confiance `FORT` (≥ 80) / `MOYEN` (≥ 50) / `FAIBLE` | `GET /api/matches/suggestions/:lostItemId?limit=5` |
| **Tableau de bord** : total, score moyen, répartition par statut et par catégorie, taux de restitution | `GET /api/matches/stats` |
| **Matching automatique** : le serveur calcule les 4 critères à partir des 2 objets (catégorie identique, mots communs des descriptions, distance GPS en km, écart en jours) puis crée la correspondance. `?preview=true` = calcul sans enregistrer | `POST /api/matches/auto` |
| **Historique des statuts** : chaque changement (création, PATCH, PUT, rejets automatiques) est enregistré avec date et commentaire | `GET /api/matches/:id/history` |
| **Recherche, tri, pagination** : `q` (ids, notes), `sort` (`-score`, `score`, `-createdAt`, `createdAt`), `page`, `limit` (20 par défaut, 100 max) | `GET /api/matches` |

Calcul du matching automatique :

| Critère | Règle |
|---|---|
| Catégorie | 100 si identique, sinon 0 |
| Description | similarité des mots (coefficient de Dice), sans accents ni mots vides |
| Lieu | distance GPS (Haversine) : 100 − 5 points par km (0 au-delà de 20 km) |
| Date | 100 − 10 points par jour d'écart ; 0 si l'objet est « trouvé » avant d'être perdu |

Exemple (`postman/` → « Match — Nouvelles API ») : iPhone perdu / trouvé à 0,21 km et 1 jour d'écart
→ critères 100 / 91 / 99 / 90 → **score 95,1 (FORT)**.

### Entité 2 — MatchFeedback

| Règle / fonctionnalité | Endpoint |
|---|---|
| **Un seul avis** par utilisateur et par correspondance (`409` sinon) | `POST /api/feedbacks` |
| Pas d'avis sur une correspondance `REJETÉ` (`409`) | `POST /api/feedbacks` |
| **Rejet automatique** : dès 3 avis, si moins de 50 % sont positifs, la correspondance `PROPOSÉ` passe à `REJETÉ` (réponse : `matchStatus`, `stats`) | `POST /api/feedbacks` |
| **Fiabilité d'une correspondance** : nb d'avis, précision, note moyenne, verdict `FIABLE` / `MITIGÉ` / `DOUTEUX` / `INSUFFISANT` | `GET /api/feedbacks/stats/:matchId` |
| **Précision globale du matching**, et par catégorie | `GET /api/feedbacks/stats` |

### Entité 3 — Post (publication)

Publication liée à une correspondance : `matchId`, `authorId`, `title`, `content`, `tags`,
`status` (`BROUILLON` → `PUBLIÉ` → `ARCHIVÉ`), `likes`, `views`, `publishedAt`, `archivedReason`,
`comments` (sous-documents : `authorId`, `content`, `createdAt`).
CRUD : `POST`, `GET`, `GET /:id`, `PUT /:id`, `DELETE /:id` sur `/api/posts` (filtres `matchId`, `status`, `authorId`, `tag`, `q`, pagination).

| Règle / fonctionnalité | Endpoint |
|---|---|
| Toute publication est créée en `BROUILLON` ; impossible sur une correspondance `REJETÉ` (`409`) | `POST /api/posts` |
| **Publication réservée** aux correspondances `CONFIRMÉ` ou `RESTITUÉ` (`409` sinon) | `PATCH /api/posts/:id/publish` |
| **Archivage** ; une publication archivée ne peut plus être modifiée ni aimée (`409`) | `PATCH /api/posts/:id/archive` |
| **J'aime / je n'aime plus** (bascule, un seul j'aime par utilisateur, publications `PUBLIÉ` uniquement) | `POST /api/posts/:id/like` |
| **Vues** : consulter une publication publiée incrémente son compteur | `GET /api/posts/:id` |
| **Fil** des publications classées par popularité (j'aime × 3 + vues), avec leur correspondance | `GET /api/posts/feed` |
| **Génération automatique** du titre, du contenu et des tags à partir d'une correspondance (`?publish=true`) | `POST /api/posts/from-match/:matchId` |
| **Commentaires** : commenter une publication `PUBLIÉ` (anti-doublon), lister, supprimer (auteur du commentaire ou de la publication, `403` sinon) | `GET` · `POST /api/posts/:id/comments` · `DELETE /api/posts/:id/comments/:commentId?authorId=` |
| **Statistiques** : total, par statut, j'aime, commentaires, vues, top 3 | `GET /api/posts/stats` |
| **Archivage automatique** quand la correspondance est rejetée (manuellement, par concurrence ou par les avis) ; **suppression en cascade** avec la correspondance | — |

Dans l'interface web : tableau de bord en haut, carte **Matching automatique** (Calculer le score / Créer),
liste avec **recherche, tri et pagination**, et dans le détail d'une correspondance (Rechercher par id)
les boutons **Confirmer / Rejeter / Marquer restitué**, l'**historique des statuts**, la zone **Avis des utilisateurs**
et ses **Publications** (« Générer et publier », « Rédiger »). La section **Publications** affiche le fil
(j'aime, commentaires, vues), les brouillons et les archivées.

**Barre latérale « Services »** (onglet sur le bord gauche, le menu du haut est inchangé) : bascule vers
les pages des autres microservices de l'équipe, avec un indicateur en ligne / hors ligne.
Les adresses sont dans [`public/services.json`](public/services.json) (ports 3001 à 3005 par défaut,
à adapter si un membre utilise un autre port). Lien direct : `http://localhost:3004/?services`.

## Technologies (slide 8)

Node.js · Express.js · MongoDB (Mongoose) · Swagger / OpenAPI · Postman

## Environnement de travail

Prérequis : **Node.js 18+**, **MongoDB** lancé en local (port 27017), **Postman**.

```bash
cd matching-service
npm install
cp .env.example .env      # Windows : copy .env.example .env
npm run dev               # ou : npm start
```

`.env`
```
PORT=3004
MONGO_URI=mongodb://localhost:27017/winl9it_matching_db
```

| URL | Rôle |
|---|---|
| http://localhost:3004 | Interface web (ajout, recherche, modification, suppression) |
| http://localhost:3004/api-docs | Documentation Swagger |
| http://localhost:3004/health | Health check |

## Données de démonstration et vérification de la base

```bash
npm run seed -- --reset   # (serveur démarré) charge 16 correspondances DEMO-* et 16 avis via l'API
npm run check-db          # vérifie l'intégrité des données directement dans MongoDB
```

- `seed` passe par l'API : toutes les règles métier s'appliquent (score automatique, confirmations
  qui rejettent les propositions concurrentes, restitutions, rejet automatique par les avis, historique).
  `--reset` supprime d'abord uniquement les anciennes correspondances `DEMO-*` (et leurs avis).
- `check-db` contrôle : index uniques, score = moyenne pondérée des critères, statuts valides,
  historique cohérent avec le cycle de vie, exclusivité des objets confirmés, aucun avis orphelin
  ni en double, règle du rejet automatique, agrégations.

## Tests avec Postman

1. Postman → **Import** → les 2 fichiers du dossier `postman/` :
   - `WinL9it-Matching-Service.postman_collection.json`
   - `WinL9it-Local.postman_environment.json`
2. En haut à droite, choisir l'environnement **WinL9it - Local**.
3. Lancer les requêtes dans l'ordre (ou **Run collection**).
   La requête « Ajouter » enregistre automatiquement l'id créé dans `{{matchId}}`,
   réutilisé par Rechercher / Modifier / Supprimer.

### Endpoints

| Méthode | URL | Action |
|---|---|---|
| POST | `/api/matches` | Ajouter une correspondance |
| GET | `/api/matches` | Lister (filtres `status`, `category`, `minScore` · recherche `q` · `sort` · `page`, `limit`) |
| GET | `/api/matches/:id` | Rechercher par id |
| PUT | `/api/matches/:id` | Modifier (score recalculé) |
| DELETE | `/api/matches/:id` | Supprimer (+ ses feedbacks) |
| POST / GET / GET :id / PUT / DELETE | `/api/feedbacks` | CRUD MatchFeedback |
| POST | `/api/matches/auto` | Métier — matching automatique (`?preview=true` : aperçu) |
| PATCH | `/api/matches/:id/status` | Métier — changer le statut (`comment` optionnel) |
| GET | `/api/matches/:id/history` | Métier — historique des statuts |
| GET | `/api/matches/suggestions/:lostItemId` | Métier — suggestions |
| GET | `/api/matches/stats` | Métier — tableau de bord |
| GET | `/api/feedbacks/stats` | Métier — précision globale |
| GET | `/api/feedbacks/stats/:matchId` | Métier — fiabilité d'une correspondance |
| POST / GET / GET :id / PUT / DELETE | `/api/posts` | CRUD Post |
| PATCH | `/api/posts/:id/publish` · `/api/posts/:id/archive` | Métier — publier / archiver |
| POST | `/api/posts/:id/like` | Métier — j'aime |
| GET | `/api/posts/feed` · `/api/posts/stats` | Métier — fil, statistiques |
| POST | `/api/posts/from-match/:matchId` | Métier — génération automatique |
| GET / POST · DELETE | `/api/posts/:id/comments` · `/api/posts/:id/comments/:commentId` | Métier — commentaires |

La collection Postman contient 9 dossiers (Health, CRUD Match, CRUD MatchFeedback,
Match — Métier, MatchFeedback — Métier, Match — Nouvelles API, Post (Entité 3), Post — Métier,
Post — Commentaires) : **107 requêtes, 172 assertions**.

Exemple de corps pour l'ajout :
```json
{
  "lostItemId": "LOST-001",
  "foundItemId": "FOUND-001",
  "category": "Accessoires",
  "criteria": { "categoryScore": 100, "descriptionScore": 85, "locationScore": 90, "dateScore": 75 },
  "notes": "Sac à dos noir Eastpak — bibliothèque universitaire"
}
```
→ score = 100×0,3 + 85×0,3 + 90×0,2 + 75×0,2 = **88,5**

Codes d'erreur : `400` données ou id invalides · `404` introuvable · `409` doublon ou règle métier non respectée.

## Structure

```
matching-service/
├── public/index.html          # Interface web CRUD
├── postman/                   # Collection + environnement Postman
└── src/
    ├── server.js              # Démarrage + connexion MongoDB
    ├── app.js                 # Express, routes, Swagger
    ├── config/db.js
    ├── models/                # Match, MatchFeedback, Post
    ├── controllers/           # CRUD + métier
    ├── routes/
    ├── middlewares/           # Validation d'id, gestion des erreurs
    ├── utils/scoring.js       # Calcul du score + niveau de confiance
    ├── utils/similarity.js    # Matching automatique (texte, distance GPS, dates)
    ├── utils/workflow.js      # Cycle de vie (transitions autorisées)
    ├── utils/postSync.js      # Archivage des publications d'une correspondance rejetée
    └── docs/swagger.json
```
