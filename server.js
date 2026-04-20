require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// CORS must come before routes so preflight OPTIONS requests are handled
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  credentials: true,
}));

app.use(express.static(path.join(__dirname)));

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith('sk_test_YOUR') || key.startsWith('sk_live_YOUR')) {
    throw new Error('STRIPE_SECRET_KEY is missing or still a placeholder in .env');
  }
  const Stripe = require('stripe');
  return new Stripe(key);
}

// POST /create-checkout-session
app.post('/create-checkout-session', async (req, res) => {
  try {
    const stripe   = getStripe();
    const baseUrl  = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const amount   = parseInt(process.env.PAYMENT_AMOUNT_CENTS || '199', 10);
    const currency = (process.env.PAYMENT_CURRENCY || 'usd').toLowerCase();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],   // valid for Checkout Sessions
      line_items: [{
        price_data: {
          currency,
          product_data: {
            name: 'PDF Merger — Unlimited',
            description: 'Merge more than 3 PDFs in one session (valid 24 hours)',
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/cancel.html`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[checkout]', err.message);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// GET /verify-session?session_id=xxx
app.get('/verify-session', async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'Missing session_id' });

  try {
    const stripe  = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);
    res.json({ paid: session.payment_status === 'paid' });
  } catch (err) {
    console.error('[verify]', err.message);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Global error handler — always returns JSON
app.use((err, req, res, _next) => {
  console.error('[unhandled]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PDF Merger → http://localhost:${PORT}`));
