const express = require('express');
const router = express.Router();
const { Commande } = require('../services/mongodb');
const redis = require('../services/redis');
const { publierCommande } = require('../services/rabbitmq');

const INSTANCE = process.env.INSTANCE || 'Instance-?';
const TTL = Number(process.env.REDIS_TTL || 30);

function getCacheKey(id) {
  return `commande:${id}`;
}

router.post('/', async (req, res) => {
  try {
    const { produit, quantite, client } = req.body;

    if (!produit || !client || !Number.isInteger(quantite) || quantite <= 0) {
      return res.status(400).json({ erreur: 'Champs invalides' });
    }

    const commande = new Commande({ produit, quantite, client });
    await commande.save();

    await redis.del('toutes_commandes', getCacheKey(commande._id));

    publierCommande({
      id: commande._id.toString(),
      produit,
      quantite,
      client
    });

    res.status(201).json({
      message: 'Commande creee',
      commande,
      traitee_par: INSTANCE
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const cached = await redis.get('toutes_commandes');

    if (cached) {
      return res.json({
        source: 'CACHE Redis',
        traitee_par: INSTANCE,
        commandes: JSON.parse(cached)
      });
    }

    const commandes = await Commande.find().sort({ date: -1 });
    await redis.setex('toutes_commandes', TTL, JSON.stringify(commandes));

    res.json({
      source: 'MongoDB',
      traitee_par: INSTANCE,
      commandes
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = getCacheKey(id);
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.json({
        source: 'CACHE Redis',
        traitee_par: INSTANCE,
        commande: JSON.parse(cached)
      });
    }

    const commande = await Commande.findById(id);
    if (!commande) {
      return res.status(404).json({ erreur: 'Commande introuvable' });
    }

    await redis.setex(cacheKey, TTL, JSON.stringify(commande));

    res.json({
      source: 'MongoDB',
      traitee_par: INSTANCE,
      commande
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
