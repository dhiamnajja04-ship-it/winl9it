# WinL9it

Plateforme intelligente pour les objets perdus et retrouvés — projet ESPRIT.
Architecture microservices : Node.js · Express · MongoDB · RabbitMQ · Docker · Swagger.

| Membre | Microservice | Branche |
|---|---|---|
| Adem Nekaies | User Service | |
| Feres Ajili | Lost Item Service | |
| Aymen Manai | Found Item Service | |
| Dhia Mnajja | Matching Service | `matching-service` |
| Yassine Ghali | Vérification Service | |

## Organisation du dépôt

- Chaque membre travaille **dans son propre dossier** (ex. `matching-service/`) et sur **sa propre branche**.
- `main` contient la version commune : on y fusionne une branche quand le service est terminé et testé.
- Ne jamais modifier le dossier d'un autre membre, ne jamais faire `git push --force`.
- Chaque service a son propre `README.md`, sa propre base MongoDB et son propre port.
- Ne pas committer `node_modules/` ni `.env` (déjà dans `.gitignore`) : fournir un `.env.example`.

## Prérequis communs

- **Node.js 18+** et npm
- **MongoDB** en local sur `localhost:27017` (service Windows « MongoDB »)
- **Postman** (ou `npx newman`) pour les tests

---

## Matching Service — Dhia Mnajja

Dossier : [`matching-service/`](matching-service/) · Branche : `matching-service` · Port : **3004**
· Base : `winl9it_matching_db` · Détails complets : [matching-service/README.md](matching-service/README.md)

Rôle : gérer les **correspondances** entre un objet perdu (Lost Item Service) et un objet
retrouvé (Found Item Service). Les objets sont référencés par leur id (`lostItemId`,
`foundItemId`) : le service ne lit pas les bases des autres.

**Entités**

| Entité | CRUD | Métier |
|---|---|---|
| **Match** | `/api/matches` (POST, GET, GET :id, PUT, DELETE) — liste avec recherche `q`, tri `sort`, pagination `page`/`limit` | Score sur 4 critères (catégorie 30 %, description 30 %, lieu 20 %, date 20 %) · **matching automatique** (`POST /auto` : le serveur calcule les critères depuis les descriptions, la distance GPS et les dates) · cycle de vie `PROPOSÉ → CONFIRMÉ → RESTITUÉ` / `REJETÉ` (`PATCH /:id/status`) · **historique des statuts** (`/:id/history`) · confirmer rejette les propositions concurrentes · suggestions par objet perdu · tableau de bord (`/stats`) |
| **MatchFeedback** | `/api/feedbacks` (POST, GET, GET :id, PUT, DELETE) | 1 avis par utilisateur et par correspondance · rejet automatique si ≥ 3 avis et < 50 % positifs · fiabilité d'une correspondance (`/stats/:matchId`) · précision globale (`/stats`) |
| **Post** | `/api/posts` (POST, GET, GET :id, PUT, DELETE) — filtres `matchId`, `status`, `tag`, recherche `q`, pagination | Publication d'une correspondance · cycle `BROUILLON → PUBLIÉ → ARCHIVÉ` (`PATCH /:id/publish`, `/:id/archive`) · publication réservée aux correspondances confirmées / restituées · j'aime (`POST /:id/like`), **commentaires** (`/:id/comments`) et vues · fil par popularité (`/feed`) · **génération automatique** depuis une correspondance (`POST /from-match/:matchId`) · statistiques (`/stats`) · archivage automatique si la correspondance est rejetée |

**Lancer**

```bash
cd matching-service
npm install
copy .env.example .env     # PORT=3004, MONGO_URI=mongodb://localhost:27017/winl9it_matching_db
npm run dev
```

| URL | Rôle |
|---|---|
| http://localhost:3004 | Interface web (ajout, recherche par id, modification, suppression, matching automatique, liste paginée, historique, tableau de bord, avis, publications) |
| http://localhost:3004/api-docs | Swagger |
| http://localhost:3004/health | Health check |

**Tester** — collection et environnement dans `matching-service/postman/` (environnement « WinL9it - Local ») :

```bash
npx newman run postman/WinL9it-Matching-Service.postman_collection.json -e postman/WinL9it-Local.postman_environment.json
```

→ 107 requêtes, 172 assertions (CRUD + métier des 3 entités).

L'interface a une barre latérale « Services » qui mène aux pages des autres membres : les adresses
sont dans `matching-service/public/services.json` (User 3001, Lost Item 3002, Found Item 3003,
Matching 3004, Vérification 3005). **Prévenez Dhia si votre service utilise un autre port.**

**Pour les autres services** : le Matching Service attend les ids d'objets fournis par
Lost Item Service et Found Item Service, et un `userId` du User Service pour les avis, les auteurs
de publications et les j'aime.

---

## User Service — Adem Nekaies

> _À compléter par Adem : dossier, branche, port, base, entités (CRUD + métier), commandes pour lancer et tester._

---

## Lost Item Service — Feres Ajili

> _À compléter par Feres : dossier, branche, port, base, entités (CRUD + métier), commandes pour lancer et tester._

---

## Found Item Service — Aymen Manai

> _À compléter par Aymen : dossier, branche, port, base, entités (CRUD + métier), commandes pour lancer et tester._

---

## Vérification Service — Yassine Ghali

> _À compléter par Yassine : dossier, branche, port, base, entités (CRUD + métier), commandes pour lancer et tester._
