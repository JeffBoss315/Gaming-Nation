/* ============================================================
   Smoke test — the flag on a delivery card is the right flag.

     npm run smoke:country

   The Discord card shows a flag either end of the route. The
   country comes from the city's lat/lon, because the city table
   holds nothing else, and a single rectangle per country does not
   survive Europe: the French bounding box swallows Belgium and
   Luxembourg whole, Aachen sits inside the German, Dutch AND
   Belgian ones at once, and Lille sits inside Belgium's.

   Two obvious tie-breaks were tried and both put a wrong flag on
   a real city — nearest-centroid gave Aachen to the Netherlands,
   deepest-containment gave Liège and Luxembourg to France. What
   works is several tight boxes per country in a deliberate order,
   and that only stays working if something checks it.

   So: cities hand-checked against what they actually are, chosen
   for the borders rather than the capitals. A WRONG answer fails
   the run; "no answer" only warns, because a missing flag is a
   blemish and a wrong one is a lie on a card the whole crew reads.

   Add a country to COUNTRY_AREAS and you must add cities here too.
   A box that swallows a neighbour's city is invisible until
   somebody drives that run.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

/* map-data.js is a browser file and wants Leaflet in scope */
global.L = { latLng: (a, b) => [a, b] };
const EXPORTS = '\nglobal.C = countryOfCity; global.G = geoFor;';
(new Function('global',
  fs.readFileSync(path.join(ROOT, 'map-data.js'), 'utf8') + EXPORTS))(global);

/* Hand-checked. The border cases that broke the earlier attempts come first:
   every one of these was wrong at some point during the work. */
const CASES = [
  ['Aachen', 'DE'], ['Liege', 'BE'], ['Lille', 'FR'], ['Luxembourg', 'LU'],
  ['Trieste', 'IT'], ['Szczecin', 'PL'], ['Dresden', 'DE'], ['Bratislava', 'SK'],
  ['Zagreb', 'HR'], ['Split', 'HR'], ['Ancona', 'IT'], ['Timisoara', 'RO'],
  ['Gothenburg', 'SE'], ['Malmo', 'SE'], ['Turku', 'FI'], ['Belfast', 'GB'],
  ['Dublin', 'IE'], ['Munich', 'DE'], ['Strasbourg', 'FR'], ['Metz', 'FR'],
  ['Saarbrucken', 'DE'], ['Basel', 'CH'], ['Nice', 'FR'], ['Klagenfurt', 'AT'],

  /* and a spread of ordinary ones, so a fix for a border does not quietly
     break the middle of a country */
  ['Brussels', 'BE'], ['Antwerp', 'BE'], ['Rotterdam', 'NL'], ['Groningen', 'NL'],
  ['Calais', 'FR'], ['Paris', 'FR'], ['Lyon', 'FR'], ['Bordeaux', 'FR'],
  ['Marseille', 'FR'], ['Geneva', 'CH'], ['Zurich', 'CH'], ['Salzburg', 'AT'],
  ['Innsbruck', 'AT'], ['Graz', 'AT'], ['Vienna', 'AT'], ['Frankfurt', 'DE'],
  ['Hamburg', 'DE'], ['Berlin', 'DE'], ['Cologne', 'DE'], ['Rostock', 'DE'],
  ['Prague', 'CZ'], ['Brno', 'CZ'], ['Kosice', 'SK'], ['Budapest', 'HU'],
  ['Debrecen', 'HU'], ['Ljubljana', 'SI'], ['Rijeka', 'HR'], ['Osijek', 'HR'],
  ['Belgrade', 'RS'], ['Novi Sad', 'RS'], ['Sarajevo', 'BA'], ['Milan', 'IT'],
  ['Rome', 'IT'], ['Venice', 'IT'], ['Naples', 'IT'], ['Palermo', 'IT'],
  ['Barcelona', 'ES'], ['Madrid', 'ES'], ['Valencia', 'ES'], ['Bilbao', 'ES'],
  ['Lisbon', 'PT'], ['Porto', 'PT'], ['Faro', 'PT'], ['London', 'GB'],
  ['Edinburgh', 'GB'], ['Glasgow', 'GB'], ['Cardiff', 'GB'], ['Cork', 'IE'],
  ['Copenhagen', 'DK'], ['Aalborg', 'DK'], ['Odense', 'DK'], ['Oslo', 'NO'],
  ['Bergen', 'NO'], ['Trondheim', 'NO'], ['Stockholm', 'SE'], ['Helsinki', 'FI'],
  ['Tallinn', 'EE'], ['Riga', 'LV'], ['Vilnius', 'LT'], ['Warsaw', 'PL'],
  ['Krakow', 'PL'], ['Katowice', 'PL'], ['Gdansk', 'PL'], ['Wroclaw', 'PL'],
  ['Bucharest', 'RO'], ['Constanta', 'RO'], ['Sofia', 'BG'], ['Varna', 'BG'],
  ['Athens', 'GR'], ['Istanbul', 'TR'], ['Kyiv', 'UA'],
];

let ok = 0, wrong = 0, unknown = 0;
const notes = [];

for (const [city, want] of CASES) {
  const got = global.C('ets2', city);
  if (got === want) { ok++; continue; }
  if (got === null) {
    unknown++;
    notes.push('  ? ' + city.padEnd(14) + 'no answer — expected ' + want
      + ' (is it in the city table under this name?)');
    continue;
  }
  wrong++;
  notes.push('! ' + city.padEnd(15) + got + ' — should be ' + want);
}

/* how much of the map gets an answer at all, which is not the same question */
const coverage = ['ets2', 'ats'].map((g) => {
  const names = Object.keys(global.G(g));
  const hit = names.filter((n) => global.C(g, n)).length;
  return '  ' + g + ': ' + hit + ' of ' + names.length + ' cities resolve';
});

console.log('\nthe flag on a delivery card is the right flag');
console.log('  ' + CASES.length + ' hand-checked cities: '
  + ok + ' correct, ' + unknown + ' unanswered, ' + wrong + ' WRONG');
console.log(coverage.join('\n'));
if (notes.length) console.log(notes.join('\n'));
console.log(wrong ? '\n' + wrong + ' problem(s)' : '\nclean');
process.exit(wrong ? 1 : 0);
