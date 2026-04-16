require('dotenv').config();
const express = require('express');
const { genereerCoachReactie } = require('./coach');

const app = express();
app.use(express.json());

// Test endpoint
app.get('/', (req, res) => {
  res.json({ status: 'Coach is online!' });
});

// Check-in endpoint
app.post('/check-in', async (req, res) => {
  const { naam, streak, stemming, tijd } = req.body;

  if (!naam || !stemming) {
    return res.status(400).json({ fout: 'naam en stemming zijn verplicht' });
  }

  try {
    const reactie = await genereerCoachReactie({
      naam,
      streak: streak || 0,
      stemming,
      tijd: tijd || 10,
    });
    res.json(reactie);
  } catch (err) {
    console.error(err);
    res.status(500).json({ fout: 'Coach kon geen reactie genereren' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Coach server draait op poort ${PORT}`);
});