const mongoose = require('mongoose');

const CommandeSchema = new mongoose.Schema({
  produit: String,
  quantite: Number,
  client: String,
  statut: { type: String, default: 'en_attente' },
  date: { type: Date, default: Date.now },
  dateTraitement: { type: Date, default: null }
});

const Commande = mongoose.model('Commande', CommandeSchema);

async function connectMongo() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/boutique';
  await mongoose.connect(mongoUri);
  console.log('MongoDB connecte');
}

module.exports = { connectMongo, Commande };
