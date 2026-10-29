const path = require('path');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./docs/swagger.json');

const matchRoutes = require('./routes/match.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

// Interface web : ajout / recherche par id / modification / suppression
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check (utile pour l'API Gateway et Docker)
app.get('/health', (req, res) =>
  res.json({ service: 'matching-service', status: 'UP', timestamp: new Date().toISOString() })
);

app.use('/api/matches', matchRoutes);
app.use('/api/feedbacks', feedbackRoutes);

// Documentation Swagger / OpenAPI (slide 8)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use((req, res) => res.status(404).json({ success: false, message: `Route introuvable : ${req.originalUrl}` }));
app.use(errorHandler);

module.exports = app;
