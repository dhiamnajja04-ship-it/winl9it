const mongoose = require('mongoose');

// Chaque microservice possède sa propre base (propriété des données - slide 8)
async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/winl9it_matching_db';
  await mongoose.connect(uri);
  console.log(`✅ MongoDB connecté : ${mongoose.connection.name}`);
}

module.exports = connectDB;
