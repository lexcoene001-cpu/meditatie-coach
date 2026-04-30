require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const API_URL = 'https://meditatie-coach.onrender.com';

const GESPREKKEN = [
  { input: 'Mijn rug deed pijn maar daarna vergat ik het.', type: 'lichaam', tijd: 5 },
  { input: 'Vandaag voelde ik mijn handen echt — alsof ze leefden.', type: 'lichaam', tijd: 5 },
  { input: 'Zo veel gedachten! Maar ik bleef toch zitten.', type: 'lichaam', tijd: 5 },
  { input: 'Tellen hielp. Ik raakte de tel kwijt maar begon opnieuw.', type: 'adem', tijd: 10 },
  { input: 'Mijn adem werd vanzelf rustiger. Dat verraste me.', type: 'adem', tijd: 10 },
  { input: 'De gedachten als wolken zien — dat hielp vandaag écht.', type: 'gedachten', tijd: 15 },
  { input: '20 minuten is lang. Maar ergens in het midden werd het lichter.', type: 'stilte', tijd: 20 },
  { input: 'Stilte is niet leeg. Dat ontdekte ik vandaag.', type: 'stilte', tijd: 20 },
];

async function roep(berichten, type, tijd) {
  const r = await fetch(`${API_URL}/inquiry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ berichten, type, tijd }),
  });
  const d = await r.json();
  return d.bericht;
}

async function simuleerGesprek(g, nr) {
  // Bouw een gesprek van 4 uitwisselingen op, dan de afsluitzin
  const berichten = [{ role: 'user', content: g.input }];

  for (let ronde = 0; ronde < 3; ronde++) {
    const coach = await roep(berichten, g.type, g.tijd);
    berichten.push({ role: 'assistant', content: coach });
    berichten.push({ role: 'user', content: 'Ja, dat klopt wel. Ik merk het ook.' });
    await new Promise(r => setTimeout(r, 400));
  }

  // Vierde uitwisseling — hier zou de afsluitzin moeten vallen
  const afsluiting = await roep(berichten, g.type, g.tijd);
  return afsluiting;
}

async function main() {
  console.log('Afsluitzin variatie-check — 8 gesprekken\n');
  const resultaten = [];

  for (let i = 0; i < GESPREKKEN.length; i++) {
    process.stdout.write(`Gesprek ${i + 1}/8 [${GESPREKKEN[i].type}]... `);
    try {
      const afsluiting = await simuleerGesprek(GESPREKKEN[i], i + 1);
      resultaten.push(afsluiting);
      console.log('klaar');
    } catch (e) {
      console.log(`FOUT: ${e.message}`);
      resultaten.push('(fout)');
    }
    await new Promise(r => setTimeout(r, 600));
  }

  console.log('\n── Afsluitzinnen ──────────────────────────────────────────');
  resultaten.forEach((z, i) => console.log(`\n${i + 1}. [${GESPREKKEN[i].type}]\n   ${z}`));

  const uniek = new Set(resultaten.filter(z => z !== '(fout)').map(z => z.toLowerCase().trim()));
  console.log(`\n─────────────────────────────────────────────────────────`);
  console.log(`${uniek.size}/${resultaten.length} unieke afsluitingen`);
  console.log(uniek.size >= 5 ? '✅ Voldoende variatie' : '⚠️  Te weinig variatie');
}

main().catch(console.error);
