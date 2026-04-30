/**
 * Simuleert het 28-daagse programma voor 3 gebruikersprofielen.
 * Roept de live /inquiry endpoint aan voor elke dag.
 *
 * Gebruik: node scripts/simuleer_programma.js
 * Output: scripts/rapport_<profiel>_<timestamp>.md
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');

const API_URL = process.env.COACH_API_URL || 'https://meditatie-coach.onrender.com';

// ─── Programma-definities ────────────────────────────────────────────────────

const FASE_PER_WEEK = ['lichaam', 'adem', 'gedachten', 'stilte'];
const DUUR_PER_FASE = { lichaam: 5, adem: 10, gedachten: 15, stilte: 20 };

function getFase(dag) {
  const week = Math.ceil(dag / 7);
  return FASE_PER_WEEK[Math.min(week - 1, 3)];
}

function isRustdag(dag) {
  return dag % 7 === 0;
}

// ─── Gebruikersprofielen ─────────────────────────────────────────────────────

const PROFIELEN = {
  enthousiast: {
    naam: 'Sara',
    beschrijving: 'Enthousiaste beginner — elke dag aanwezig, deelt veel, groeit zichtbaar',
    genereertInput(dag, fase, duur, vroegGestopt) {
      const inputs = {
        lichaam: [
          'Het was rustiger dan ik dacht. Ik merkte pas na 2 minuten dat mijn schouders gespannen waren.',
          'Mijn rug deed een beetje pijn maar daarna vergat ik het.',
          'Vandaag voelde ik mijn handen echt — alsof ze leefden.',
          'Zo veel gedachten vandaag! Maar ik bleef toch zitten.',
          'Ik viel bijna in slaap. Was dat erg?',
          'Kort maar goed. Ik merk dat ik er naar uitkijk.',
        ],
        adem: [
          'Tellen hielp. Ik raakte de tel kwijt maar begon gewoon opnieuw.',
          'Mijn adem werd vanzelf rustiger. Dat verraste me.',
          'Ik merkte dat ik vlak adem als ik gespannen ben.',
          'Vandaag lukte het beter om steeds terug te komen.',
          'Ik dacht aan mijn to-do lijst maar de adem bracht me terug.',
          'Het voelde vandaag bijna meditatief. Dat klinkt gek.',
        ],
        gedachten: [
          'De gedachten als wolken zien — dat hielp vandaag écht.',
          'Ik merkte dat ik steeds hetzelfde gedachtenpatroon heb.',
          'Een gedachte over werk bleef maar terugkomen. Maar ik liet hem.',
          'Ik zat 15 minuten! Dat had ik nooit gedacht.',
          'Vandaag waren de gedachten rustiger. Toeval?',
          'Ik merkte voor het eerst dat ik gedachten *zie* in plaats van erin zit.',
        ],
        stilte: [
          '20 minuten is lang. Maar ergens in het midden werd het lichter.',
          'Ik had geen doel meer. Dat was vreemd maar ook fijn.',
          'Stilte is niet leeg. Dat ontdekte ik vandaag.',
          'Soms weet ik niet waar ik begin en de stilte eindigt.',
          'Het makkelijkste en moeilijkste wat ik ooit deed.',
          'Week 4. Ik kan niet geloven dat ik dit volhoud.',
        ],
      };
      const opties = inputs[fase] || inputs.lichaam;
      const tekst = opties[dag % opties.length];
      if (vroegGestopt) return `Ik stopte na ${Math.floor(duur / 2)} minuten. ${tekst}`;
      return tekst;
    },
    slaFasDagen: [], // slaat nooit dagen over
  },

  twijfelaar: {
    naam: 'Tom',
    beschrijving: 'Twijfelaar — slaat soms een dag over, vraagt zich af of het werkt, maar blijft proberen',
    genereertInput(dag, fase, duur, vroegGestopt) {
      const inputs = [
        'Ik weet niet of ik het goed doe. Moet er iets voelen?',
        `${dag === 1 ? 'Eerste dag. Sceptisch.' : 'Weer een dag. Hmm.'}`,
        'Mijn hoofd stond er niet naar. Maar ik deed het toch.',
        'Eerlijk? Ik denk soms: wat heeft dit voor zin.',
        'Vandaag voelde het minder als verplicht. Beetje.',
        `Dag ${dag}. Halverwege. Ik ben er nog.`,
        'Ik vroeg me af of ik het aan een vriend zou aanraden. Misschien.',
        'Het wordt wel iets rustiger in mijn hoofd, moet ik toegeven.',
        'Ik sla dit weekend over. Maandag begin ik opnieuw.',
        'Ik merk dat ik het mis als ik het niet doe. Dat is nieuw.',
        `Week ${Math.ceil(dag / 7)}. Beter dan week ervoor.`,
        'Vandaag was het gewoon lekker. Geen twijfel.',
      ];
      const tekst = inputs[dag % inputs.length];
      if (vroegGestopt) return `Ik hield het ${Math.floor(duur * 0.6)} minuten vol. ${tekst}`;
      return tekst;
    },
    slaFasDagen: [6, 7, 13, 20], // slaat dag 6, 7, 13, 20 over
  },

  inconsistent: {
    naam: 'Roos',
    beschrijving: 'Inconsistente gebruiker — lange pauzes, dan enthousiast terug, haalt achterstand in',
    genereertInput(dag, fase, duur, vroegGestopt) {
      const inputs = [
        'Ik was er een week niet. Maar ik ben er weer.',
        'Drukke week gehad. Dit is mijn rustpunt.',
        `Twee weken overgeslagen. Dag ${dag} voelt als opnieuw beginnen.`,
        'Vandaag echt geen tijd maar deed het toch in de trein.',
        'Ik ben blij dat ik niet gestopt ben.',
        'Mijn hoofd was vol maar na afloop voelde ik meer ruimte.',
        'Ik heb dit gemist. Serieus.',
        'Vandaag moeizaam. Maar klaar is klaar.',
        `${fase} is mijn favoriet tot nu toe. Verrassend.`,
        'Ik heb de app aan mijn zus aangeraden.',
        'Soms vraag ik me af waarom ik steeds stop. En begin.',
        'Vandaag echt goed. Geen woorden voor.',
      ];
      const tekst = inputs[dag % inputs.length];
      if (vroegGestopt) return `Stoppen voelde goed vandaag. ${tekst}`;
      return tekst;
    },
    slaFasDagen: [3, 4, 5, 11, 12, 13, 14, 21, 22], // meerdere pauzeperiodes
  },
};

// ─── API-aanroep ─────────────────────────────────────────────────────────────

async function roepInquiryAan(dag, fase, duur, gebruikerInput, gesprekHistorie) {
  const starttijd = Date.now();

  // Bouw berichten op: één ronde gebruiker→coach
  const berichten = [
    ...gesprekHistorie,
    { role: 'user', content: gebruikerInput },
  ];

  const body = JSON.stringify({
    berichten,
    tijd: duur,
    type: fase,
    gestopt: false,
  });

  const response = await fetch(`${API_URL}/inquiry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const responstijd = Date.now() - starttijd;
  const data = await response.json();

  return {
    coachBericht: data.bericht || data.fout || '(geen bericht)',
    responstijd,
    promptTokens: Math.round(JSON.stringify(berichten).length / 4), // schatting
    totaalTekens: berichten.reduce((s, b) => s + b.content.length, 0),
  };
}

// ─── Simulatie per profiel ────────────────────────────────────────────────────

async function simuleerProfiel(profiel) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Profiel: ${profiel.naam} — ${profiel.beschrijving}`);
  console.log('═'.repeat(60));

  const resultaten = [];
  const gesprekHistorie = []; // cumulatief over 28 dagen

  for (let dag = 1; dag <= 28; dag++) {
    const fase = getFase(dag);
    const duur = DUUR_PER_FASE[fase];
    const rustdag = isRustdag(dag);
    const overgeslagen = profiel.slaFasDagen.includes(dag);

    if (rustdag || overgeslagen) {
      const reden = rustdag ? 'rustdag' : 'overgeslagen';
      console.log(`  Dag ${String(dag).padStart(2, '0')} [${fase.padEnd(9)}] — ${reden}`);
      resultaten.push({ dag, fase, duur, reden, coachBericht: null, responstijd: null });
      continue;
    }

    const vroegGestopt = [5, 16, 23].includes(dag); // vaste vroeg-stop dagen
    const gebruikerInput = profiel.genereertInput(dag, fase, duur, vroegGestopt);

    process.stdout.write(`  Dag ${String(dag).padStart(2, '0')} [${fase.padEnd(9)}] — aanroepen... `);

    try {
      const { coachBericht, responstijd, promptTokens, totaalTekens } = await roepInquiryAan(
        dag, fase, duur, gebruikerInput, gesprekHistorie
      );

      // Voeg toe aan cumulatieve historie (max laatste 6 uitwisselingen bewaren)
      gesprekHistorie.push({ role: 'user', content: gebruikerInput });
      gesprekHistorie.push({ role: 'assistant', content: coachBericht });
      if (gesprekHistorie.length > 12) gesprekHistorie.splice(0, 2);

      console.log(`${responstijd}ms`);
      resultaten.push({
        dag, fase, duur, vroegGestopt,
        gebruikerInput, coachBericht, responstijd, promptTokens, totaalTekens,
      });

      // Kleine pauze om rate limiting te vermijden
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.log(`FOUT: ${e.message}`);
      resultaten.push({ dag, fase, duur, reden: `fout: ${e.message}`, coachBericht: null });
    }
  }

  return resultaten;
}

// ─── Analyse ─────────────────────────────────────────────────────────────────

function analyseer(resultaten, profiel) {
  const actief = resultaten.filter(r => r.coachBericht);

  // Verwijst coach naar eerdere dagen?
  const verwijzingen = actief.filter(r =>
    /eerder|vorige|gisteren|week \d|dag \d|de laatste|net als|je zei|je noemde/i.test(r.coachBericht)
  );

  // Inconsistenties of herhalingen (zelfde zin >1x)
  const zinnen = actief.flatMap(r => r.coachBericht.split(/[.!?]/).map(s => s.trim().toLowerCase()).filter(s => s.length > 20));
  const dubbelen = zinnen.filter((z, i) => zinnen.indexOf(z) !== i);

  // Toonverschil vroeg vs laat (simpel: aantal woorden)
  const vroeg = actief.filter(r => r.dag <= 7);
  const laat = actief.filter(r => r.dag >= 22);
  const gemWoorden = (arr) => arr.length
    ? Math.round(arr.reduce((s, r) => s + r.coachBericht.split(' ').length, 0) / arr.length)
    : 0;

  // Responstijden
  const tijden = actief.map(r => r.responstijd).filter(Boolean);
  const gemTijd = tijden.length ? Math.round(tijden.reduce((a, b) => a + b, 0) / tijden.length) : 0;
  const maxTijd = tijden.length ? Math.max(...tijden) : 0;

  // Promptgroei
  const promptGroei = actief.map(r => ({ dag: r.dag, tekens: r.totaalTekens }));

  return { verwijzingen, dubbelen, vroeg, laat, gemWoorden, gemTijd, maxTijd, promptGroei };
}

// ─── Rapport genereren ────────────────────────────────────────────────────────

function genereeerRapport(profiel, resultaten) {
  const analyse = analyseer(resultaten, profiel);
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'u');
  const bestandsnaam = path.join(__dirname, `rapport_${profiel.naam.toLowerCase()}_${timestamp}.md`);

  const regels = [];
  regels.push(`# Simulatierapport — ${profiel.naam}`);
  regels.push(`**Profiel:** ${profiel.beschrijving}`);
  regels.push(`**Gegenereerd:** ${new Date().toLocaleString('nl-NL')}`);
  regels.push(`**API:** ${API_URL}`);
  regels.push('');

  // Samenvatting
  const actief = resultaten.filter(r => r.coachBericht);
  const overgeslagen = resultaten.filter(r => r.reden === 'overgeslagen').length;
  regels.push('## Samenvatting');
  regels.push(`| | |`);
  regels.push(`|---|---|`);
  regels.push(`| Actieve dagen gesimuleerd | ${actief.length}/24 |`);
  regels.push(`| Overgeslagen | ${overgeslagen} |`);
  regels.push(`| Vroeg gestopt | ${actief.filter(r => r.vroegGestopt).length} |`);
  regels.push(`| Gem. responstijd | ${analyse.gemTijd}ms |`);
  regels.push(`| Max responstijd | ${analyse.maxTijd}ms |`);
  regels.push(`| Gem. woorden coach (week 1) | ${analyse.gemWoorden(analyse.vroeg)} |`);
  regels.push(`| Gem. woorden coach (week 4) | ${analyse.gemWoorden(analyse.laat)} |`);
  regels.push('');

  // Analyse
  regels.push('## Analyse');
  regels.push('');
  regels.push('### Verwijst de coach naar eerdere dagen?');
  if (analyse.verwijzingen.length > 0) {
    regels.push(`Ja — ${analyse.verwijzingen.length}x gevonden:`);
    analyse.verwijzingen.forEach(r => {
      regels.push(`- **Dag ${r.dag}:** "${r.coachBericht.slice(0, 120)}..."`);
    });
  } else {
    regels.push('Nee — geen expliciete verwijzingen naar eerdere dagen gevonden.');
    regels.push('> ⚠️ De coach onthoudt de context niet over sessies heen. Elke dag start met een schone lei.');
  }
  regels.push('');

  regels.push('### Past de toon zich aan op voortgang?');
  const wVroeg = analyse.gemWoorden(analyse.vroeg);
  const wLaat = analyse.gemWoorden(analyse.laat);
  regels.push(`Gemiddeld ${wVroeg} woorden in week 1 vs ${wLaat} woorden in week 4.`);
  if (Math.abs(wVroeg - wLaat) > 5) {
    regels.push(wLaat > wVroeg
      ? '→ Coach wordt uitgebreider naarmate het programma vordert.'
      : '→ Coach wordt beknopter naarmate het programma vordert.');
  } else {
    regels.push('→ Woordlengte blijft consistent — toon past zich niet meetbaar aan.');
  }
  regels.push('');

  regels.push('### Herhalingen');
  if (analyse.dubbelen.length > 0) {
    regels.push(`${analyse.dubbelen.length} dubbele zinnen gevonden:`);
    [...new Set(analyse.dubbelen)].slice(0, 5).forEach(z => regels.push(`- "${z}"`));
  } else {
    regels.push('Geen letterlijke herhalingen gevonden. ✅');
  }
  regels.push('');

  regels.push('### Promptgroei over tijd');
  regels.push('| Dag | Cumulatieve tekens in context |');
  regels.push('|-----|-------------------------------|');
  analyse.promptGroei.forEach(({ dag, tekens }) => regels.push(`| ${dag} | ${tekens} |`));
  regels.push('');

  // Alle responses
  regels.push('---');
  regels.push('## Alle 28 dagen');
  regels.push('');

  resultaten.forEach(r => {
    const faseLabel = r.fase ? `[${r.fase}, ${r.duur}min]` : '';
    regels.push(`### Dag ${r.dag} ${faseLabel}`);
    if (r.reden) {
      regels.push(`*${r.reden}*`);
    } else {
      regels.push(`**Gebruiker${r.vroegGestopt ? ' (vroeg gestopt)' : ''}:** ${r.gebruikerInput}`);
      regels.push('');
      regels.push(`**Coach:** ${r.coachBericht}`);
      regels.push('');
      regels.push(`*${r.responstijd}ms · ~${r.promptTokens} tokens*`);
    }
    regels.push('');
  });

  fs.writeFileSync(bestandsnaam, regels.join('\n'), 'utf8');
  return bestandsnaam;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`ZIT — Programma-simulatie`);
  console.log(`API: ${API_URL}`);
  console.log(`Start: ${new Date().toLocaleString('nl-NL')}\n`);

  // Controleer of API bereikbaar is
  try {
    const check = await fetch(`${API_URL}/`);
    const data = await check.json();
    console.log(`✅ API online: ${data.status}\n`);
  } catch (e) {
    console.error(`❌ API niet bereikbaar: ${e.message}`);
    process.exit(1);
  }

  const profielNamen = Object.keys(PROFIELEN);

  for (const naam of profielNamen) {
    const profiel = PROFIELEN[naam];
    const resultaten = await simuleerProfiel(profiel);
    const bestand = genereeerRapport(profiel, resultaten);
    console.log(`\n✅ Rapport opgeslagen: ${path.basename(bestand)}`);
  }

  console.log('\nKlaar.');
}

main().catch(console.error);
