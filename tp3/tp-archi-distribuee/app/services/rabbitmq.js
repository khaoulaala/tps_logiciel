const amqp = require('amqplib');

let channel;
const QUEUE = 'commandes';

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectRabbitMQ() {
  const rabbitUri = process.env.RABBITMQ_URI || 'amqp://admin:admin@rabbitmq:5672';
  const retries = Number(process.env.RABBITMQ_RETRIES || 10);
  const delay = Number(process.env.RABBITMQ_RETRY_DELAY_MS || 3000);
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const conn = await amqp.connect(rabbitUri);
      channel = await conn.createChannel();
      await channel.assertQueue(QUEUE, { durable: true });
      console.log('RabbitMQ connecte');
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Tentative RabbitMQ ${attempt}/${retries} echouee: ${error.message}`);
      if (attempt < retries) {
        await wait(delay);
      }
    }
  }

  throw lastError;
}

function publierCommande(commande) {
  if (!channel) {
    throw new Error('Canal RabbitMQ indisponible');
  }

  const msg = JSON.stringify(commande);
  channel.sendToQueue(QUEUE, Buffer.from(msg), { persistent: true });
  console.log('Message envoye a RabbitMQ');
}

function getQueueName() {
  return QUEUE;
}

module.exports = { connectRabbitMQ, publierCommande, getQueueName };
