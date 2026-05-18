import 'dotenv/config';

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

// Coloque aqui seu número pessoal (o mesmo que você adicionou no painel do Meta como destinatário)
const TEST_PHONE = '+5511940176230';

async function sendHelloWorld() {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_ACCESS_TOKEN precisam estar no .env');
  }

  const response = await fetch(
    `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: TEST_PHONE,
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: 'en_US' },
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error('Erro da API do Meta:', JSON.stringify(data, null, 2));
    throw new Error(`HTTP ${response.status}`);
  }

  console.log('Mensagem enviada com sucesso!');
  console.log('Message ID:', data.messages?.[0]?.id);
}

sendHelloWorld().catch((err) => console.error('Erro:', err.message));
