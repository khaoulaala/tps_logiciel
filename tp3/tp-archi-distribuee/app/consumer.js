const amqp = require('amqplib');
const { connectMongo, Commande } = require('./services/mongodb');
const redis = require('./services/redis');
const { getQueueName } = require('./services/rabbitmq');

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectConsumerRabbitMQ() {
  const rabbitUri = process.env.RABBITMQ_URI || 'amqp://admin:admin@rabbitmq:5672';
  const retries = Number(process.env.RABBITMQ_RETRIES || 10);
  const delay = Number(process.env.RABBITMQ_RETRY_DELAY_MS || 3000);
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await amqp.connect(rabbitUri);
    } catch (error) {
      lastError = error;
      console.warn(`Tentative consumer RabbitMQ ${attempt}/${retries} echouee: ${error.message}`);
      if (attempt < retries) {
        await wait(delay);
      }
    }
  }

  throw lastError;
}

async function startConsumer() {
  await connectMongo();

  const conn = await connectConsumerRabbitMQ();
  const channel = await conn.createChannel();
  const queue = getQueueName();

  await channel.assertQueue(queue, { durable: true });
  channel.prefetch(1);

  console.log('Consumer en attente des messages...');

  channel.consume(queue, async (msg) => {
    if (!msg) {
      return;
    }

    try {
      const commande = JSON.parse(msg.content.toString());
      console.log('Nouvelle commande recue:', commande.id);

      const updatedCommande = await Commande.findByIdAndUpdate(
        commande.id,
        {
          statut: 'traitee',
          dateTraitement: new Date()
        },
        { new: true }
      );

      await redis.del('toutes_commandes', `commande:${commande.id}`);

      if (!updatedCommande) {
        console.warn(`Commande ${commande.id} introuvable`);
      }

      channel.ack(msg);
    } catch (error) {
      console.error('Erreur consumer:', error.message);
      channel.nack(msg, false, false);
    }
  });
}

setTimeout(() => {
  startConsumer().catch((error) => {
    console.error('Echec du demarrage du consumer:', error.message);
    process.exit(1);
  });
}, 5000);
