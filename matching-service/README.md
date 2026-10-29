# WinL9it — Matching Service

Microservice **Matching Service** du projet WinL9it (ESPRIT).
Responsable : **Dhia Eddine Mnajja**. Entités : **Match** et **MatchFeedback** (slide 9).

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

### Entité 2 — MatchFeedback

| Règle / fonctionnalité | Endpoint |
|---|---|
| **Un seul avis** par utilisateur et par correspondance (`409` sinon) | `POST /api/feedbacks` |
| Pas d'avis sur une correspondance `REJETÉ` (`409`) | `POST /api/feedbacks` |
| **Rejet automatique** : dès 3 avis, si moins de 50 % sont positifs, la correspondance `PROPOSÉ` passe à `REJETÉ` (réponse : `matchStatus`, `stats`) | `POST /api/feedbacks` |
| **Fiabilité d'une correspondance** : nb d'avis, précision, note moyenne, verdict `FIABLE` / `MITIGÉ` / `DOUTEUX` / `INSUFFISANT` | `GET /api/feedbacks/stats/:matchId` |
| **Précision globale du matching**, et par catégorie | `GET /api/feedbacks/stats` |

Dans l'interface web : tableau de bord en haut, et dans le détail d'une correspondance
(Rechercher par id) les boutons **Confirmer / Rejeter / Marquer restitué** et la zone **Avis des utilisateurs**.

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
| GET | `/api/matches` | Lister (filtres : `status`, `category`, `minScore`) |
| GET | `/api/matches/:id` | Rechercher par id |
| PUT | `/api/matches/:id` | Modifier (score recalculé) |
| DELETE | `/api/matches/:id` | Supprimer (+ ses feedbacks) |
| POST / GET / GET :id / PUT / DELETE | `/api/feedbacks` | CRUD MatchFeedback |
| PATCH | `/api/matches/:id/status` | Métier — changer le statut |
| GET | `/api/matches/suggestions/:lostItemId` | Métier — suggestions |
| GET | `/api/matches/stats` | Métier — tableau de bord |
| GET | `/api/feedbacks/stats` | Métier — précision globale |
| GET | `/api/feedbacks/stats/:matchId` | Métier — fiabilité d'une correspondance |

La collection Postman contient 5 dossiers (Health, CRUD Match, CRUD MatchFeedback,
Match — Métier, MatchFeedback — Métier) : **38 requêtes, 58 assertions**.

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
    ├── models/                # Match, MatchFeedback
    ├── controllers/           # CRUD + métier
    ├── routes/
    ├── middlewares/           # Validation d'id, gestion des erreurs
    ├── utils/scoring.js       # Calcul du score + niveau de confiance
    ├── utils/workflow.js      # Cycle de vie (transitions autorisées)
    └── docs/swagger.json
```
