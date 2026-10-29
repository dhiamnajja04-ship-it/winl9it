require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 3004;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Matching Service démarré sur http://localhost:${PORT}`);
      console.log(`🖥️  Interface : http://localhost:${PORT}`);
      console.log(`📘 Swagger   : http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((err) => {
    console.error('❌ Connexion MongoDB impossible :', err.message);
    process.exit(1);
  });
