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

Codes d'erreur : `400` données ou id invalides · `404` introuvable · `409` correspondance déjà existante.

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
    ├── controllers/           # Logique CRUD
    ├── routes/
    ├── middlewares/           # Validation d'id, gestion des erreurs
    ├── utils/scoring.js       # Calcul du score de correspondance
    └── docs/swagger.json
```
