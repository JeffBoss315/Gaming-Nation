/* ============================================================
   GAMING NATION — THE GAME MAP
   ------------------------------------------------------------
   The road network of Euro Truck Simulator 2 and American Truck
   Simulator: every city with its real coordinates, the roads between
   them, the seams between the games' map regions, and the projection
   that puts all of it on screen.

   This is pure data and pure functions — no application state — so
   the web platform and the tracking client can both draw the same map
   from the same source rather than keeping a copy each.

   Loaded before script.js and tracker.js. Needs Leaflet for the two
   helpers at the bottom that hand back L.latLng values.
   ============================================================ */

/* ---------- schematic maps ---------- */
/* Positions are laid out to mirror the real geography of each game's
   map. They are a diagram, not a survey — good enough to show where a
   driver is and which city they are near. */
const CITY_GEO = {
  /* real lat/lon for every city the games and their map DLC ship. A third
     value of 1 marks a city big enough to keep its label at every zoom. */
  ets2: {
    'A Coruna': [43.36, -8.41], 'Aachen': [50.78, 6.08], 'Aalborg': [57.05, 9.92],
    'Aarhus': [56.16, 10.20], 'Aberdeen': [57.15, -2.09], 'Agrinio': [38.62, 21.41],
    'Ajaccio': [41.93, 8.74], 'Albacete': [38.99, -1.86], 'Alessandria': [44.91, 8.62],
    'Alesund': [62.47, 6.15], 'Alexandroupoli': [40.85, 25.87], 'Algeciras': [36.13, -5.45],
    'Alicante': [38.35, -0.48], 'Almeria': [36.84, -2.46], 'Alta': [69.97, 23.27],
    'Amiens': [49.89, 2.30], 'Amsterdam': [52.37, 4.90, 1], 'Ancona': [43.62, 13.51],
    'Andenes': [69.32, 16.12], 'Andorra la Vella': [42.51, 1.52], 'Angers': [47.47, -0.55],
    'Ankara': [39.93, 32.86], 'Annecy': [45.90, 6.13], 'Antwerp': [51.22, 4.40],
    'Aosta': [45.73, 7.32], 'Arad': [46.19, 21.31], 'Athens': [37.98, 23.73, 1],
    'Augsburg': [48.37, 10.90], 'Aveiro': [40.64, -8.65], 'Avignon': [43.95, 4.81],
    'Bacau': [46.57, 26.91], 'Badajoz': [38.88, -6.97], 'Balti': [47.76, 27.93],
    'Banja Luka': [44.77, 17.19], 'Banska Bystrica': [48.74, 19.15], 'Bar': [42.10, 19.10],
    'Barcelona': [41.39, 2.17, 1], 'Bari': [41.12, 16.87], 'Basel': [47.56, 7.59],
    'Bastia': [42.70, 9.45], 'Belfast': [54.60, -5.93], 'Belgrade': [44.79, 20.45, 1],
    'Bergen': [60.39, 5.32], 'Berlin': [52.52, 13.40, 1], 'Bern': [46.95, 7.45],
    'Besancon': [47.24, 6.02], 'Bialystok': [53.13, 23.16], 'Bielefeld': [52.02, 8.53],
    'Bilbao': [43.26, -2.93], 'Birmingham': [52.48, -1.90, 1], 'Bitola': [41.03, 21.34],
    'Blagoevgrad': [42.02, 23.09], 'Bodo': [67.28, 14.40], 'Bologna': [44.49, 11.34],
    'Bolzano': [46.50, 11.35], 'Bordeaux': [44.84, -0.58, 1], 'Borlange': [60.48, 15.44],
    'Bourges': [47.08, 2.40], 'Braganca': [41.81, -6.76], 'Brasov': [45.66, 25.61],
    'Bratislava': [48.15, 17.11], 'Braunschweig': [52.27, 10.52], 'Bregenz': [47.50, 9.75],
    'Bremen': [53.08, 8.80], 'Brescia': [45.54, 10.22], 'Brest': [48.39, -4.49],
    'Brindisi': [40.63, 17.94], 'Bristol': [51.45, -2.59], 'Brno': [49.20, 16.61],
    'Bruges': [51.21, 3.22], 'Brussels': [50.85, 4.35, 1], 'Bryansk': [53.24, 34.36],
    'Bucharest': [44.43, 26.10, 1], 'Budapest': [47.50, 19.04, 1], 'Burgas': [42.51, 27.47],
    'Burgos': [42.34, -3.70], 'Bursa': [40.18, 29.07], 'Bydgoszcz': [53.12, 18.00],
    'Caceres': [39.48, -6.37], 'Cadiz': [36.53, -6.29], 'Caen': [49.18, -0.37],
    'Cagliari': [39.22, 9.12], 'Calafat': [43.99, 22.94], 'Calais': [50.95, 1.86, 1],
    'Cambridge': [52.20, 0.12], 'Canakkale': [40.15, 26.41], 'Cardiff': [51.48, -3.18],
    'Carlisle': [54.89, -2.93], 'Cartagena': [37.61, -0.99], 'Cassino': [41.49, 13.83],
    'Castellon': [39.99, -0.04], 'Catania': [37.51, 15.08], 'Catanzaro': [38.91, 16.59],
    'Ceske Budejovice': [48.97, 14.47], 'Chania': [35.51, 24.02], 'Charleroi': [50.41, 4.44],
    'Chemnitz': [50.83, 12.92], 'Cherbourg': [49.64, -1.62], 'Chernivtsi': [48.29, 25.94],
    'Chernyakhovsk': [54.63, 21.82], 'Chios': [38.37, 26.14], 'Chisinau': [47.01, 28.86],
    'Chur': [46.85, 9.53], 'Ciudad Real': [38.99, -3.93], 'Civaux': [46.45, 0.65],
    'Clermont-Ferrand': [45.78, 3.09], 'Cluj-Napoca': [46.77, 23.60], 'Coimbra': [40.21, -8.43],
    'Cologne': [50.94, 6.96, 1], 'Constanta': [44.18, 28.65], 'Copenhagen': [55.68, 12.57, 1],
    'Cordoba': [37.89, -4.78], 'Corfu': [39.62, 19.92], 'Cork': [51.90, -8.47],
    'Cosenza': [39.30, 16.25], 'Cottbus': [51.76, 14.33], 'Craiova': [44.32, 23.80],
    'Czestochowa': [50.81, 19.12], 'Daugavpils': [55.87, 26.52], 'Debrecen': [47.53, 21.63],
    'Den Haag': [52.08, 4.31], 'Dijon': [47.32, 5.04], 'Dnipro': [48.46, 35.05],
    'Dombas': [62.07, 9.12], 'Dortmund': [51.51, 7.47], 'Dover': [51.13, 1.31],
    'Dresden': [51.05, 13.74], 'Dublin': [53.35, -6.26, 1], 'Dubrovnik': [42.65, 18.09],
    'Duisburg': [51.43, 6.76], 'Dunkerque': [51.03, 2.38], 'Durres': [41.32, 19.45],
    'Dusseldorf': [51.23, 6.78], 'Edinburgh': [55.95, -3.19, 1], 'Edirne': [41.68, 26.56],
    'Eindhoven': [51.44, 5.48], 'El Ejido': [36.78, -2.81], 'Erfurt': [50.98, 11.03],
    'Esbjerg': [55.47, 8.45], 'Essen': [51.46, 7.01], 'Evora': [38.57, -7.91],
    'Falkenberg': [56.90, 12.49], 'Faro': [37.02, -7.93], 'Felixstowe': [51.96, 1.35],
    'Florence': [43.77, 11.26], 'Foggia': [41.46, 15.55], 'Frankfurt': [50.11, 8.68, 1],
    'Frederikshavn': [57.44, 10.54], 'Freiburg': [47.99, 7.85], 'Galati': [45.44, 28.05],
    'Gallivare': [67.14, 20.66], 'Galway': [53.27, -9.06], 'Gavle': [60.67, 17.14],
    'Gdansk': [54.35, 18.65], 'Gdynia': [54.52, 18.53], 'Gedser': [54.58, 11.93],
    'Geneva': [46.20, 6.14], 'Genoa': [44.41, 8.93], 'Ghent': [51.05, 3.72],
    'Gijon': [43.54, -5.66], 'Girona': [41.98, 2.82], 'Giurgiu': [43.90, 25.97],
    'Glasgow': [55.86, -4.25], 'Golfech': [44.11, 0.85], 'Gothenburg': [57.71, 11.97],
    'Granada': [37.18, -3.60], 'Graz': [47.07, 15.44], 'Grenoble': [45.19, 5.72],
    'Grimsby': [53.57, -0.08], 'Groningen': [53.22, 6.57], 'Guarda': [40.54, -7.27],
    'Gyor': [47.69, 17.63], 'Halmstad': [56.67, 12.86], 'Hamburg': [53.55, 9.99, 1],
    'Hameenlinna': [60.99, 24.46], 'Hammerfest': [70.66, 23.68], 'Hanko': [59.83, 22.97],
    'Hannover': [52.38, 9.73], 'Haparanda': [65.84, 24.14], 'Harstad': [68.80, 16.54],
    'Helsingborg': [56.05, 12.69], 'Helsingor': [56.04, 12.61], 'Helsinki': [60.17, 24.94, 1],
    'Heraklion': [35.34, 25.13], 'Hirtshals': [57.59, 9.96], 'Holyhead': [53.31, -4.63],
    'Homel': [52.43, 30.99], 'Honningsvag': [70.98, 25.97], 'Hrodna': [53.68, 23.83],
    'Huelva': [37.26, -6.95], 'Iasi': [47.16, 27.59], 'Igoumenitsa': [39.50, 20.27],
    'Innsbruck': [47.27, 11.39], 'Ioannina': [39.66, 20.85], 'Istanbul': [41.01, 28.98, 1],
    'Ivalo': [68.66, 27.54], 'Ivanovo': [57.00, 40.97], 'Izmir': [38.42, 27.14],
    'Izmit': [40.77, 29.92], 'Jerez': [36.69, -6.14], 'Joensuu': [62.60, 29.76],
    'Jonkoping': [57.78, 14.16], 'Jyvaskyla': [62.24, 25.75], 'Kajaani': [64.23, 27.73],
    'Kalamata': [37.04, 22.11], 'Kaliningrad': [54.71, 20.51], 'Kalmar': [56.66, 16.36],
    'Kaluga': [54.51, 36.26], 'Kapellskar': [59.72, 19.07], 'Kardzhali': [41.65, 25.37],
    'Karesuando': [68.44, 22.49], 'Karlskrona': [56.16, 15.59], 'Karlsruhe': [49.01, 8.40],
    'Karlstad': [59.38, 13.50], 'Kassel': [51.31, 9.50], 'Katowice': [50.26, 19.02],
    'Kaunas': [54.90, 23.90], 'Kavala': [40.94, 24.41], 'Kecskemet': [46.90, 19.69],
    'Kemi': [65.74, 24.56], 'Kharkiv': [49.99, 36.23], 'Kherson': [46.64, 32.61],
    'Kiel': [54.32, 10.14], 'Kielce': [50.87, 20.63], 'Kiruna': [67.86, 20.23],
    'Klagenfurt': [46.62, 14.31], 'Klaipeda': [55.71, 21.14], 'Koblenz': [50.36, 7.59],
    'Kokkola': [63.84, 23.13], 'Kolding': [55.49, 9.47], 'Koper': [45.55, 13.73],
    'Kosice': [48.72, 21.26], 'Kostroma': [57.77, 40.93], 'Kotka': [60.47, 26.94],
    'Kouvola': [60.87, 26.70], 'Kragujevac': [44.01, 20.91], 'Krakow': [50.06, 19.94, 1],
    'Kristiansand': [58.15, 7.99], 'Kristiansund': [63.11, 7.73], 'Kumanovo': [42.13, 21.72],
    'Kuopio': [62.89, 27.68], 'Kursk': [51.73, 36.19], 'Kyiv': [50.45, 30.52, 1],
    'La Rochelle': [46.16, -1.15], 'La Spezia': [44.11, 9.83], 'Lahti': [60.98, 25.66],
    'Lamia': [38.90, 22.43], 'Lappeenranta': [61.06, 28.19], 'Larissa': [39.64, 22.42],
    'Lausanne': [46.52, 6.63], 'Le Havre': [49.49, 0.11], 'Le Mans': [48.00, 0.20],
    'Lecce': [40.35, 18.17], 'Leeds': [53.80, -1.55], 'Leipzig': [51.34, 12.37],
    'Leon': [42.60, -5.57], 'Liberec': [50.77, 15.06], 'Liege': [50.63, 5.57],
    'Liepaja': [56.51, 21.01], 'Lille': [50.63, 3.06], 'Limoges': [45.83, 1.26],
    'Linkoping': [58.41, 15.62], 'Linz': [48.31, 14.29], 'Lipetsk': [52.61, 39.59],
    'Lisbon': [38.72, -9.14, 1], 'Liverpool': [53.41, -2.98], 'Livorno': [43.55, 10.31],
    'Ljubljana': [46.06, 14.51], 'Lleida': [41.62, 0.62], 'Lodz': [51.76, 19.46],
    'Logrono': [42.47, -2.44], 'London': [51.51, -0.13, 1], 'Lorient': [47.75, -3.37],
    'Loviisa': [60.46, 26.23], 'Lubeck': [53.87, 10.69], 'Lublin': [51.25, 22.57],
    'Luga': [58.74, 29.85], 'Lugano': [46.00, 8.95], 'Lulea': [65.58, 22.15],
    'Luxembourg': [49.61, 6.13], 'Lviv': [49.84, 24.03], 'Lyon': [45.76, 4.84, 1],
    'Madrid': [40.42, -3.70, 1], 'Magdeburg': [52.13, 11.63], 'Malaga': [36.72, -4.42],
    'Malmo': [55.60, 13.00], 'Manchester': [53.48, -2.24, 1], 'Mangalia': [43.82, 28.58],
    'Mannheim': [49.49, 8.47], 'Maribor': [46.56, 15.65], 'Marseille': [43.30, 5.37, 1],
    'Merida': [38.92, -6.34], 'Messina': [38.19, 15.55], 'Metz': [49.12, 6.18],
    'Mikkeli': [61.69, 27.27], 'Milan': [45.46, 9.19, 1], 'Minsk': [53.90, 27.56],
    'Miskolc': [48.10, 20.79], 'Mo i Rana': [66.31, 14.14], 'Modena': [44.65, 10.93],
    'Montpellier': [43.61, 3.88], 'Moscow': [55.76, 37.62, 1], 'Mostar': [43.34, 17.81],
    'Mulhouse': [47.75, 7.34], 'Munich': [48.14, 11.58, 1], 'Munster': [51.96, 7.63],
    'Murcia': [37.98, -1.13], 'Mykolaiv': [46.98, 32.00], 'Mytilene': [39.11, 26.55],
    'Nancy': [48.69, 6.18], 'Nantes': [47.22, -1.55], 'Naples': [40.85, 14.27, 1],
    'Narbonne': [43.18, 3.00], 'Narva': [59.38, 28.19], 'Narvik': [68.44, 17.43],
    'Newcastle-upon-Tyne': [54.98, -1.61], 'Nice': [43.70, 7.27], 'Niksic': [42.77, 18.94],
    'Nimes': [43.84, 4.36], 'Nis': [43.32, 21.90], 'Nitra': [48.31, 18.09],
    'Nizhny Novgorod': [56.33, 44.00], 'Norrkoping': [58.59, 16.19], 'Nottingham': [52.95, -1.15],
    'Novi Sad': [45.27, 19.83], 'Novo Mesto': [45.80, 15.17], 'Nuremberg': [49.45, 11.08],
    'Nyiregyhaza': [47.96, 21.72], 'Nynashamn': [58.90, 17.95], 'Odense': [55.40, 10.39],
    'Odesa': [46.48, 30.73], 'Olbia': [40.92, 9.50], 'Olhao': [37.03, -7.84],
    'Olomouc': [49.59, 17.25], 'Olsztyn': [53.78, 20.49], 'Oradea': [47.07, 21.93],
    'Orebro': [59.27, 15.21], 'Orleans': [47.90, 1.90], 'Ornskoldsvik': [63.29, 18.72],
    'Oryol': [52.97, 36.06], 'Osijek': [45.55, 18.69], 'Oslo': [59.91, 10.75, 1],
    'Osnabruck': [52.28, 8.05], 'Ostend': [51.23, 2.92], 'Ostersund': [63.18, 14.64],
    'Ostrava': [49.84, 18.29], 'Oulu': [65.01, 25.47], 'Ourense': [42.34, -7.86],
    'Padova': [45.41, 11.88], 'Palermo': [38.12, 13.36], 'Pamplona': [42.81, -1.65],
    'Panevezys': [55.73, 24.35], 'Paris': [48.86, 2.35, 1], 'Parma': [44.80, 10.33],
    'Parnu': [58.39, 24.50], 'Passau': [48.57, 13.43], 'Patra': [38.25, 21.73],
    'Pecs': [46.07, 18.23], 'Perpignan': [42.70, 2.90], 'Perugia': [43.11, 12.39],
    'Pescara': [42.46, 14.22], 'Pisa': [43.72, 10.40], 'Pitesti': [44.86, 24.87],
    'Pleven': [43.42, 24.62], 'Ploiesti': [44.94, 26.02], 'Plovdiv': [42.14, 24.75],
    'Plymouth': [50.37, -4.14], 'Plzen': [49.75, 13.38], 'Podgorica': [42.44, 19.26],
    'Poitiers': [46.58, 0.34], 'Pori': [61.49, 21.80], 'Porto': [41.15, -8.61],
    'Poznan': [52.41, 16.93], 'Prague': [50.08, 14.44, 1], 'Pristina': [42.66, 21.17],
    'Prizren': [42.21, 20.74], 'Pskov': [57.82, 28.33], 'Puertollano': [38.69, -4.11],
    'Radom': [51.40, 21.15], 'Regensburg': [49.01, 12.10], 'Reggio Calabria': [38.11, 15.65],
    'Reims': [49.26, 4.03], 'Rennes': [48.11, -1.68], 'Rezekne': [56.51, 27.33],
    'Rhodes': [36.43, 28.22], 'Riga': [56.95, 24.11, 1], 'Rijeka': [45.33, 14.44],
    'Rimini': [44.06, 12.57], 'Rivne': [50.62, 26.25], 'Rodbyhavn': [54.65, 11.35],
    'Rome': [41.90, 12.50, 1], 'Roscoff': [48.72, -3.98], 'Rostock': [54.09, 12.14],
    'Rotterdam': [51.92, 4.48, 1], 'Rouen': [49.44, 1.10], 'Rovaniemi': [66.50, 25.73],
    'Ruse': [43.86, 25.97], 'Ryazan': [54.63, 39.74], 'Rzeszow': [50.04, 22.00],
    'Saarbrucken': [49.24, 6.99], 'Sagunto': [39.68, -0.27],
    'Saint Petersburg': [59.93, 30.34, 1], 'Saint-Etienne': [45.44, 4.39],
    'Saint-Laurent': [45.26, -0.66], 'Saint-Nazaire': [47.27, -2.21], 'Salamanca': [40.97, -5.66],
    'Salerno': [40.68, 14.77], 'Salzburg': [47.81, 13.04], 'San Sebastian': [43.32, -1.98],
    'Sankt Polten': [48.20, 15.62], 'Santander': [43.46, -3.81], 'Sarajevo': [43.86, 18.41],
    'Sassari': [40.73, 8.56], 'Savona': [44.31, 8.48], 'Savonlinna': [61.87, 28.88],
    'Schwerin': [53.63, 11.41], 'Setubal': [38.52, -8.89], 'Seville': [37.39, -5.98],
    'Sheffield': [53.38, -1.47], 'Shkoder': [42.07, 19.51], 'Siauliai': [55.93, 23.32],
    'Sibiu': [45.79, 24.15], 'Sines': [37.95, -8.87], 'Skelleftea': [64.75, 20.95],
    'Skopje': [41.99, 21.43], 'Smolensk': [54.78, 32.05], 'Sodankyla': [67.42, 26.60],
    'Soderhamn': [61.30, 17.06], 'Sodertalje': [59.20, 17.63], 'Sofia': [42.70, 23.32, 1],
    'Soria': [41.76, -2.47], 'Sosnovy Bor': [59.90, 29.08], 'Southampton': [50.90, -1.40],
    'Sovetsk': [55.08, 21.88], 'Split': [43.51, 16.44], 'Stara Zagora': [42.43, 25.64],
    'Stavanger': [58.97, 5.73], 'Steinkjer': [64.01, 11.50], 'Stockholm': [59.33, 18.07, 1],
    'Strasbourg': [48.57, 7.75], 'Stuttgart': [48.78, 9.18, 1], 'Subotica': [46.10, 19.67],
    'Suceava': [47.65, 26.26], 'Sundsvall': [62.39, 17.31], 'Suzzara': [44.99, 10.74],
    'Svolvaer': [68.23, 14.57], 'Swansea': [51.62, -3.94], 'Swinoujscie': [53.91, 14.25],
    'Szczecin': [53.43, 14.55], 'Szeged': [46.25, 20.15], 'Szekesfehervar': [47.19, 18.41],
    'Tallinn': [59.44, 24.75, 1], 'Tampere': [61.50, 23.79], 'Taranto': [40.46, 17.24],
    'Targu Mures': [46.54, 24.56], 'Tarragona': [41.12, 1.25], 'Tartu': [58.38, 26.72],
    'Tekirdag': [40.98, 27.51], 'Terni': [42.56, 12.65], 'Ternopil': [49.55, 25.59],
    'Teruel': [40.34, -1.11], 'Thessaloniki': [40.64, 22.94, 1], 'Timisoara': [45.75, 21.23],
    'Tirana': [41.33, 19.82], 'Toledo': [39.86, -4.02], 'Torun': [53.01, 18.60],
    'Toulon': [43.12, 5.93], 'Toulouse': [43.60, 1.44, 1], 'Tours': [47.39, 0.69],
    'Travemunde': [53.96, 10.87], 'Trelleborg': [55.37, 13.16], 'Trento': [46.07, 11.12],
    'Trieste': [45.65, 13.78], 'Tripoli': [37.51, 22.37], 'Tromso': [69.65, 18.96],
    'Trondheim': [63.43, 10.39], 'Tula': [54.19, 37.62], 'Turin': [45.07, 7.69],
    'Turku': [60.45, 22.27], 'Tuzla': [44.54, 18.68], 'Tver': [56.86, 35.90],
    'Udine': [46.06, 13.24], 'Ulm': [48.40, 9.99], 'Umea': [63.83, 20.26],
    'Uppsala': [59.86, 17.64], 'Utrecht': [52.09, 5.12], 'Uzhhorod': [48.62, 22.29],
    'Vaasa': [63.10, 21.62], 'Valence': [44.93, 4.89], 'Valencia': [39.47, -0.38],
    'Valladolid': [41.65, -4.72], 'Valmiera': [57.54, 25.43], 'Vandellos': [40.99, 0.86],
    'Varna': [43.21, 27.91], 'Vasteras': [59.61, 16.55], 'Vaxjo': [56.88, 14.81],
    'Veliko Tarnovo': [43.08, 25.63], 'Veliky Novgorod': [58.52, 31.27], 'Venice': [45.44, 12.32],
    'Ventspils': [57.39, 21.56], 'Verona': [45.44, 10.99], 'Vidin': [43.99, 22.87],
    'Vienna': [48.21, 16.37, 1], 'Vigo': [42.24, -8.72], 'Villa San Giovanni': [38.22, 15.64],
    'Villach': [46.61, 13.85], 'Vilnius': [54.69, 25.28, 1], 'Vinnytsia': [49.23, 28.47],
    'Vitoria': [42.85, -2.67], 'Vitsebsk': [55.19, 30.20], 'Vladimir': [56.13, 40.41],
    'Vlore': [40.47, 19.49], 'Vologda': [59.22, 39.89], 'Volos': [39.36, 22.94],
    'Voronezh': [51.67, 39.21], 'Vyborg': [60.71, 28.75], 'Warsaw': [52.23, 21.01, 1],
    'Wroclaw': [51.11, 17.03], 'Wurzburg': [49.79, 9.94], 'Yaroslavl': [57.63, 39.87],
    'Ystad': [55.43, 13.82], 'Zadar': [44.12, 15.23], 'Zagreb': [45.81, 15.98, 1],
    'Zaragoza': [41.65, -0.88], 'Zenica': [44.20, 17.91], 'Zhytomyr': [50.25, 28.66],
    'Zilina': [49.22, 18.74], 'Zurich': [47.38, 8.54, 1],
  },
  ats: {
    'Aberdeen WA': [46.98, -123.82], 'Abilene': [32.45, -99.73], 'Alamosa': [37.47, -105.87],
    'Albuquerque': [35.08, -106.65, 1], 'Amarillo': [35.22, -101.83], 'Astoria': [46.19, -123.83],
    'Austin': [30.27, -97.74], 'Bakersfield': [35.37, -119.02], 'Barstow': [34.90, -117.02],
    'Beaumont': [30.08, -94.13], 'Bellingham': [48.75, -122.48], 'Bend': [44.06, -121.31],
    'Billings': [45.78, -108.50], 'Bishop': [37.36, -118.40], 'Boise': [43.62, -116.20, 1],
    'Bozeman': [45.68, -111.04], 'Brownsville': [25.90, -97.50], 'Butte': [46.00, -112.53],
    'Cape Girardeau': [37.31, -89.52], 'Carlsbad': [32.42, -104.23],
    'Carson City': [39.16, -119.77], 'Casper': [42.85, -106.32], 'Cedar City': [37.68, -113.06],
    'Cheyenne': [41.14, -104.82], 'Clovis': [34.40, -103.20], 'Cody': [44.53, -109.06],
    'Coeur dAlene': [47.68, -116.78], 'Colorado Springs': [38.83, -104.82],
    'Columbia': [38.95, -92.33], 'Corpus Christi': [27.80, -97.40],
    'Council Bluffs': [41.26, -95.86], 'Craig': [40.52, -107.55], 'Dallas': [32.78, -96.80, 1],
    'Del Rio': [29.36, -100.90], 'Denver': [39.74, -104.99, 1], 'Des Moines': [41.59, -93.62],
    'Dodge City': [37.75, -100.02], 'Durango': [37.27, -107.88], 'El Centro': [32.79, -115.56],
    'El Paso': [31.76, -106.49, 1], 'Elko': [40.83, -115.76], 'Ellensburg': [47.00, -120.55],
    'Ely': [39.25, -114.89], 'Enid': [36.40, -97.88], 'Eugene': [44.05, -123.09],
    'Eureka': [40.80, -124.16], 'Evanston': [41.27, -110.96], 'Everett': [47.98, -122.20],
    'Farmington': [36.73, -108.19], 'Fayetteville': [36.06, -94.16],
    'Flagstaff': [35.20, -111.65], 'Fort Collins': [40.59, -105.08],
    'Fort Smith': [35.39, -94.40], 'Fort Worth': [32.76, -97.33], 'Fresno': [36.74, -119.79],
    'Gallup': [35.53, -108.74], 'Galveston': [29.30, -94.80], 'Garden City': [37.97, -100.87],
    'Gillette': [44.29, -105.50], 'Grand Island': [40.92, -98.34],
    'Grand Junction': [39.06, -108.55], 'Great Falls': [47.51, -111.30],
    'Guymon': [36.68, -101.48], 'Havre': [48.55, -109.68], 'Hays': [38.88, -99.33],
    'Helena': [46.59, -112.04], 'Holbrook': [34.90, -110.16], 'Houston': [29.76, -95.37, 1],
    'Idaho Falls': [43.49, -112.04], 'Jackson': [43.48, -110.76], 'Jonesboro': [35.84, -90.70],
    'Joplin': [37.08, -94.51], 'Kalispell': [48.20, -114.31], 'Kansas City': [39.10, -94.58, 1],
    'Ketchum': [43.68, -114.36], 'Kingman': [35.19, -114.05], 'Klamath Falls': [42.22, -121.78],
    'Laramie': [41.31, -105.59], 'Laredo': [27.51, -99.51], 'Las Cruces': [32.31, -106.78],
    'Las Vegas': [36.17, -115.14, 1], 'Lawton': [34.61, -98.39], 'Lewiston': [46.42, -117.02],
    'Liberal': [37.04, -100.92], 'Limon': [39.26, -103.69], 'Lincoln': [40.81, -96.70],
    'Little Rock': [34.75, -92.29], 'Logan': [41.74, -111.83], 'Long Beach': [33.77, -118.19],
    'Longview': [32.50, -94.74], 'Los Angeles': [34.05, -118.24, 1], 'Lubbock': [33.58, -101.86],
    'McAlester': [34.93, -95.77], 'McAllen': [26.20, -98.23], 'Medford': [42.33, -122.87],
    'Memphis': [35.15, -90.05], 'Merced': [37.30, -120.48], 'Midland': [32.00, -102.08],
    'Miles City': [46.41, -105.84], 'Missoula': [46.87, -113.99], 'Moab': [38.57, -109.55],
    'Modesto': [37.64, -121.00], 'Monterey': [36.60, -121.89], 'Montrose': [38.48, -107.88],
    'Nogales': [31.34, -110.94], 'Norfolk': [42.03, -97.42], 'North Platte': [41.12, -100.77],
    'Oakland': [37.80, -122.27], 'Odessa': [31.85, -102.37], 'Ogden': [41.22, -111.97],
    'Oklahoma City': [35.47, -97.52, 1], 'Olympia': [47.04, -122.90], 'Omaha': [41.26, -95.93],
    'Page': [36.91, -111.46], 'Pahrump': [36.21, -115.98], 'Palm Springs': [33.83, -116.55],
    'Pasco': [46.23, -119.09], 'Paso Robles': [35.63, -120.69], 'Phoenix': [33.45, -112.07, 1],
    'Pine Bluff': [34.23, -92.00], 'Pocatello': [42.87, -112.45],
    'Port Angeles': [48.12, -123.43], 'Portland': [45.52, -122.68, 1],
    'Prescott': [34.54, -112.47], 'Price': [39.60, -110.81], 'Provo': [40.23, -111.66],
    'Pueblo': [38.25, -104.61], 'Raton': [36.90, -104.44], 'Redding': [40.59, -122.39],
    'Reno': [39.53, -119.81, 1], 'Rock Springs': [41.59, -109.20], 'Roswell': [33.39, -104.52],
    'Sacramento': [38.58, -121.49, 1], 'Salem': [44.94, -123.04], 'Salina': [38.84, -97.61],
    'Salt Lake City': [40.76, -111.89, 1], 'San Angelo': [31.46, -100.44],
    'San Antonio': [29.42, -98.49, 1], 'San Diego': [32.72, -117.16, 1],
    'San Francisco': [37.77, -122.42, 1], 'San Jose': [37.34, -121.89],
    'San Luis Obispo': [35.28, -120.66], 'Sandpoint': [48.28, -116.55],
    'Santa Barbara': [34.42, -119.70], 'Santa Cruz': [36.97, -122.03],
    'Santa Fe': [35.69, -105.94], 'Santa Maria': [34.95, -120.44], 'Santa Rosa': [38.44, -122.71],
    'Scottsbluff': [41.87, -103.66], 'Seattle': [47.61, -122.33, 1], 'Sheridan': [44.80, -106.96],
    'Show Low': [34.25, -110.03], 'Shreveport': [32.53, -93.75], 'Sidney': [47.72, -104.16],
    'Sierra Vista': [31.55, -110.30], 'Sioux City': [42.50, -96.40],
    'Sioux Falls': [43.55, -96.70], 'Socorro': [34.06, -106.89], 'Spokane': [47.66, -117.43],
    'Springfield': [37.21, -93.29], 'St George': [37.10, -113.58], 'St Louis': [38.63, -90.20],
    'Sterling': [40.63, -103.21], 'Stockton': [37.96, -121.29], 'Tacoma': [47.25, -122.44],
    'Texarkana': [33.43, -94.05], 'Tonopah': [38.07, -117.23], 'Topeka': [39.05, -95.68],
    'Truckee': [39.33, -120.18], 'Tucson': [32.22, -110.97], 'Tucumcari': [35.17, -103.72],
    'Tulsa': [36.15, -95.99], 'Twin Falls': [42.56, -114.46], 'Tyler': [32.35, -95.30],
    'Ukiah': [39.15, -123.21], 'Vancouver WA': [45.63, -122.66], 'Ventura': [34.27, -119.29],
    'Vernal': [40.46, -109.53], 'Victoria': [28.81, -97.00], 'Visalia': [36.33, -119.29],
    'Waco': [31.55, -97.15], 'Walla Walla': [46.06, -118.34], 'Wichita': [37.69, -97.34],
    'Wichita Falls': [33.91, -98.49], 'Winnemucca': [40.97, -117.74], 'Yakima': [46.60, -120.51],
    'Yreka': [41.73, -122.63], 'Yuma': [32.69, -114.63],
  },
};

/* Fitted against the hand-placed schematic that came before, so calibrations
   saved by earlier versions still land in the right place. */
const SCHEMATIC_FIT = {
  ets2: { kx: 16.039371, bx: 233.4234, ky: -713.604217, by: 972.0218 },
  ats:  { kx: 14.613165, bx: 1880.3941, ky: -835.413402, by: 847.8460 },
};
/* ---------- display names ----------
   Keys stay ASCII so they are safe to store, sort and search; the map, the
   tooltips and the pickers show the name the country actually uses, which is
   what the games print on their own maps. */
const CITY_LABEL = {
  /* German-speaking */
  Munich: 'München', Cologne: 'Köln', Nuremberg: 'Nürnberg', Dusseldorf: 'Düsseldorf',
  Munster: 'Münster', Wurzburg: 'Würzburg', Lubeck: 'Lübeck', Osnabruck: 'Osnabrück',
  Saarbrucken: 'Saarbrücken', Braunschweig: 'Braunschweig', Vienna: 'Wien',
  'Sankt Polten': 'Sankt Pölten', Zurich: 'Zürich', Geneva: 'Genève', Basel: 'Basel',
  Frankfurt: 'Frankfurt am Main', Travemunde: 'Travemünde',
  /* Low Countries & France */
  Brussels: 'Brussel', Antwerp: 'Antwerpen', Ghent: 'Gent', Bruges: 'Brugge',
  Ostend: 'Oostende', Liege: 'Liège', 'Den Haag': 'Den Haag', Orleans: 'Orléans',
  Besancon: 'Besançon', Nimes: 'Nîmes', 'Saint-Etienne': 'Saint-Étienne',
  /* Iberia */
  Lisbon: 'Lisboa', Seville: 'Sevilla', Cordoba: 'Córdoba', Malaga: 'Málaga',
  Almeria: 'Almería', Cadiz: 'Cádiz', Caceres: 'Cáceres', Merida: 'Mérida',
  Leon: 'León', 'A Coruna': 'A Coruña', Gijon: 'Gijón', Logrono: 'Logroño',
  Castellon: 'Castelló', Vandellos: 'Vandellòs', Braganca: 'Bragança',
  Evora: 'Évora', Setubal: 'Setúbal', Olhao: 'Olhão', 'San Sebastian': 'San Sebastián',
  Girona: 'Girona', Teruel: 'Teruel',
  /* Italy */
  Milan: 'Milano', Turin: 'Torino', Genoa: 'Genova', Venice: 'Venezia',
  Florence: 'Firenze', Rome: 'Roma', Naples: 'Napoli', Padova: 'Padova',
  'Reggio Calabria': 'Reggio Calabria',
};
Object.assign(CITY_LABEL, {
  /* Nordics */
  Copenhagen: 'København', Aarhus: 'Århus', Aalborg: 'Ålborg', Helsingor: 'Helsingør',
  Rodbyhavn: 'Rødbyhavn', Gothenburg: 'Göteborg', Malmo: 'Malmö', Jonkoping: 'Jönköping',
  Linkoping: 'Linköping', Norrkoping: 'Norrköping', Orebro: 'Örebro', Vasteras: 'Västerås',
  Vaxjo: 'Växjö', Sodertalje: 'Södertälje', Nynashamn: 'Nynäshamn', Kapellskar: 'Kapellskär',
  Gavle: 'Gävle', Soderhamn: 'Söderhamn', Borlange: 'Borlänge', Ostersund: 'Östersund',
  Ornskoldsvik: 'Örnsköldsvik', Umea: 'Umeå', Skelleftea: 'Skellefteå', Lulea: 'Luleå',
  Gallivare: 'Gällivare', Alesund: 'Ålesund', Bodo: 'Bodø', Tromso: 'Tromsø',
  Svolvaer: 'Svolvær', Honningsvag: 'Honningsvåg', Dombas: 'Dombås',
  Jyvaskyla: 'Jyväskylä', Hameenlinna: 'Hämeenlinna', Sodankyla: 'Sodankylä',
  /* Baltics & Poland & Czechia */
  Parnu: 'Pärnu', Liepaja: 'Liepāja', Rezekne: 'Rēzekne', Klaipeda: 'Klaipėda',
  Panevezys: 'Panevėžys', Siauliai: 'Šiauliai', Warsaw: 'Warszawa', Krakow: 'Kraków',
  Lodz: 'Łódź', Wroclaw: 'Wrocław', Poznan: 'Poznań', Gdansk: 'Gdańsk',
  Torun: 'Toruń', Swinoujscie: 'Świnoujście', Czestochowa: 'Częstochowa',
  Rzeszow: 'Rzeszów', Prague: 'Praha', Plzen: 'Plzeň', 'Ceske Budejovice': 'České Budějovice',
  Kosice: 'Košice', Zilina: 'Žilina', 'Banska Bystrica': 'Banská Bystrica',
  Gyor: 'Győr', Pecs: 'Pécs', Kecskemet: 'Kecskemét', Nyiregyhaza: 'Nyíregyháza',
  Szekesfehervar: 'Székesfehérvár',
  /* Russia, Belarus, Ukraine */
  Moscow: 'Москва', 'Saint Petersburg': 'Санкт-Петербург', Pskov: 'Псков',
  Vyborg: 'Выборг', Luga: 'Луга', 'Sosnovy Bor': 'Сосновый Бор',
  Kaliningrad: 'Калининград', Sovetsk: 'Советск', Chernyakhovsk: 'Черняховск',
  Smolensk: 'Смоленск', Tver: 'Тверь', Yaroslavl: 'Ярославль', Vladimir: 'Владимир',
  'Nizhny Novgorod': 'Нижний Новгород', Ryazan: 'Рязань', Tula: 'Тула',
  Kaluga: 'Калуга', Bryansk: 'Брянск', Voronezh: 'Воронеж', Lipetsk: 'Липецк',
  Kursk: 'Курск', Oryol: 'Орёл', 'Veliky Novgorod': 'Великий Новгород',
  Vologda: 'Вологда', Kostroma: 'Кострома', Ivanovo: 'Иваново',
  Minsk: 'Мінск', Hrodna: 'Гродна', Homel: 'Гомель', Vitsebsk: 'Віцебск',
  Kyiv: 'Київ', Lviv: 'Львів', Odesa: 'Одеса', Kharkiv: 'Харків', Dnipro: 'Дніпро',
  Chernivtsi: 'Чернівці', Uzhhorod: 'Ужгород', Vinnytsia: 'Вінниця',
  Zhytomyr: 'Житомир', Rivne: 'Рівне', Ternopil: 'Тернопіль', Mykolaiv: 'Миколаїв',
  Kherson: 'Херсон', Chisinau: 'Chișinău', Balti: 'Bălți',
});
Object.assign(CITY_LABEL, {
  /* Balkans, Romania, Bulgaria */
  Bucharest: 'București', 'Cluj-Napoca': 'Cluj-Napoca', Constanta: 'Constanța',
  Galati: 'Galați', Iasi: 'Iași', Timisoara: 'Timișoara', Brasov: 'Brașov',
  Pitesti: 'Pitești', 'Targu Mures': 'Târgu Mureș', Bacau: 'Bacău',
  Ploiesti: 'Ploiești', Sofia: 'София', Plovdiv: 'Пловдив', Varna: 'Варна',
  Burgas: 'Бургас', Ruse: 'Русе', Pleven: 'Плевен', 'Veliko Tarnovo': 'Велико Търново',
  Kardzhali: 'Кърджали', Blagoevgrad: 'Благоевград', 'Stara Zagora': 'Стара Загора',
  Vidin: 'Видин', Belgrade: 'Београд', 'Novi Sad': 'Нови Сад', Nis: 'Ниш',
  Subotica: 'Суботица', Kragujevac: 'Крагујевац', Skopje: 'Скопје', Bitola: 'Битола',
  Kumanovo: 'Куманово', Podgorica: 'Подгорица', Niksic: 'Никшић',
  Pristina: 'Prishtinë', Prizren: 'Prizren', Durres: 'Durrës', Vlore: 'Vlorë',
  Shkoder: 'Shkodër', Tirana: 'Tiranë', Sarajevo: 'Сарајево', 'Banja Luka': 'Бања Лука',
  /* Greece & Turkey */
  Athens: 'Αθήνα', Thessaloniki: 'Θεσσαλονίκη', Patra: 'Πάτρα', Kavala: 'Καβάλα',
  Ioannina: 'Ιωάννινα', Lamia: 'Λαμία', Kalamata: 'Καλαμάτα', Heraklion: 'Ηράκλειο',
  Chania: 'Χανιά', Volos: 'Βόλος', Larissa: 'Λάρισα', Corfu: 'Κέρκυρα',
  Rhodes: 'Ρόδος', Chios: 'Χίος', Mytilene: 'Μυτιλήνη',
  Alexandroupoli: 'Αλεξανδρούπολη', Agrinio: 'Αγρίνιο', Tripoli: 'Τρίπολη',
  Igoumenitsa: 'Ηγουμενίτσα', Istanbul: 'İstanbul', Izmit: 'İzmit', Izmir: 'İzmir',
  Tekirdag: 'Tekirdağ', Canakkale: 'Çanakkale',
  /* the American map keeps a couple of tidied keys */
  'Coeur dAlene': "Coeur d'Alene", 'Aberdeen WA': 'Aberdeen', 'Vancouver WA': 'Vancouver',
});
const cityLabel = (name) => CITY_LABEL[name] || name;

/* The other direction, which nothing had until now.

   Telemetry reports a city by the name the game puts on the screen, so a job
   arrives carrying 'Praha' while the road network is keyed on 'Prague' — and
   any lookup of one by the other quietly finds nothing. That is exactly how a
   route highlight ends up drawing no route at all.

   Built once from the same table, so the two can never disagree. Case is
   folded because a name that has been through a save file and back is not
   guaranteed to come out capitalised the way it went in. */
const CITY_KEY = (() => {
  const out = {};
  Object.keys(CITY_LABEL).forEach((k) => { out[String(CITY_LABEL[k]).toLowerCase()] = k; });
  return out;
})();

const cityKey = (name) => {
  if (!name) return null;
  const n = String(name).trim();
  return CITY_KEY[n.toLowerCase()] || n;
};

const geoFor = (game) => CITY_GEO[game === 'ats' ? 'ats' : 'ets2'];
/* a city keeps its label at every zoom only if the table marks it major */
const cityTier = (game, name) => (geoFor(game)[name] || [])[2] || 2;

/* where the map sits before it knows where the truck is */
const MAP_HOME = { ets2: [50.5, 9.0, 5], ats: [38.0, -112.0, 5] };

/* ---------- schematic projection ----------
   The schematic is a Mercator projection of the same lat/lon table, fitted
   to the layout earlier versions drew by hand. Deriving it means a new city
   is one line in CITY_GEO and nothing else has to be kept in step. */
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI / 180) / 2));
const invMercY = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;

function schematicCities(geo, f) {
  const out = {};
  for (const name in geo) {
    const g = geo[name];
    out[name] = [Math.round((f.bx + g[1] * f.kx) * 10) / 10,
                 Math.round((f.by + mercY(g[0]) * f.ky) * 10) / 10];
  }
  return out;
}
/* schematic units back to lat/lon, so distances can be measured for real */
function schematicToGeo(game, x, y) {
  const f = SCHEMATIC_FIT[game === 'ats' ? 'ats' : 'ets2'];
  return [invMercY((y - f.by) / f.ky), (x - f.bx) / f.kx];
}
function haversineKm(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function cityBounds(cities) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n in cities) {
    const [x, y] = cities[n];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}
function gameMap(key, label, short) {
  const cities = schematicCities(CITY_GEO[key], SCHEMATIC_FIT[key]);
  const b = cityBounds(cities);
  return { key, label, short, cities, bounds: b, w: b.x1 - b.x0, h: b.y1 - b.y0 };
}
const MAP_ETS2 = gameMap('ets2', 'Euro Truck Simulator 2', 'ETS2');
const MAP_ATS  = gameMap('ats',  'American Truck Simulator', 'ATS');
const MAPS = { ets2: MAP_ETS2, ats: MAP_ATS };
const mapFor = (key) => MAPS[key] || MAP_ETS2;

function nearestCity(mapKey, mx, mz) {
  const cities = mapFor(mapKey).cities;
  let best = null, bestD = Infinity;
  for (const name in cities) {
    const [cx, cy] = cities[name];
    const d = Math.hypot(cx - mx, cy - mz);
    if (d < bestD) { bestD = d; best = name; }
  }
  if (!best) return null;
  /* measure on the globe, not in schematic units — the projection stretches
     towards the poles, so a fixed km-per-unit would flatter the far north */
  const here = schematicToGeo(mapKey, mx, mz);
  return { city: best, distance: Math.round(haversineKm(here, geoFor(mapKey)[best])) };
}

const ROADS_ETS2 = [
  ['Aberdeen','Edinburgh'],['Edinburgh','Newcastle-upon-Tyne'],
  ['Newcastle-upon-Tyne','Leeds'],['Leeds','Sheffield'],['Sheffield','Nottingham'],
  ['Nottingham','Birmingham'],['Birmingham','London'],['Glasgow','Edinburgh'],
  ['Glasgow','Carlisle'],['Carlisle','Manchester'],['Manchester','Liverpool'],
  ['Manchester','Sheffield'],['Manchester','Birmingham'],['Leeds','Manchester'],
  ['Leeds','Grimsby'],['Birmingham','Bristol'],['Bristol','Cardiff'],['Cardiff','Swansea'],
  ['London','Cambridge'],['Cambridge','Felixstowe'],['London','Dover'],
  ['London','Southampton'],['Southampton','Plymouth'],['Bristol','Southampton'],
  ['Liverpool','Holyhead'],['Dublin','Belfast'],['Dublin','Cork'],['Dublin','Galway'],
  ['Dover','Calais'],['Calais','Dunkerque'],['Dunkerque','Ostend'],['Ostend','Bruges'],
  ['Bruges','Ghent'],['Ghent','Brussels'],['Calais','Lille'],['Lille','Brussels'],
  ['Calais','Amiens'],['Amiens','Paris'],['Le Havre','Rouen'],['Rouen','Paris'],
  ['Cherbourg','Caen'],['Caen','Rouen'],['Brest','Roscoff'],['Brest','Rennes'],
  ['Rennes','Le Mans'],['Le Mans','Paris'],['Rennes','Nantes'],['Nantes','Saint-Nazaire'],
  ['Nantes','Angers'],['Angers','Le Mans'],['Nantes','La Rochelle'],
  ['La Rochelle','Bordeaux'],['Lorient','Rennes'],['Paris','Orleans'],['Orleans','Tours'],
  ['Tours','Poitiers'],['Poitiers','Bordeaux'],['Poitiers','Civaux'],['Civaux','Limoges'],
  ['Paris','Reims'],['Reims','Metz'],['Metz','Nancy'],['Nancy','Strasbourg'],
  ['Strasbourg','Mulhouse'],['Mulhouse','Basel'],['Nancy','Dijon'],['Dijon','Besancon'],
  ['Besancon','Mulhouse'],['Paris','Dijon'],['Dijon','Lyon'],['Paris','Bourges'],
  ['Bourges','Clermont-Ferrand'],['Clermont-Ferrand','Saint-Etienne'],
  ['Saint-Etienne','Lyon'],['Bordeaux','Golfech'],['Golfech','Toulouse'],
  ['Bordeaux','Saint-Laurent'],['Toulouse','Narbonne'],['Narbonne','Montpellier'],
  ['Montpellier','Nimes'],['Nimes','Avignon'],['Avignon','Marseille'],
  ['Toulouse','Andorra la Vella'],['Narbonne','Perpignan'],['Perpignan','Girona'],
  ['Girona','Barcelona'],['Marseille','Toulon'],['Toulon','Nice'],['Nice','Genoa'],
  ['Lyon','Valence'],['Valence','Avignon'],['Lyon','Grenoble'],['Grenoble','Valence'],
  ['Grenoble','Turin'],['Lyon','Annecy'],['Annecy','Geneva'],['Limoges','Clermont-Ferrand'],
  ['Ajaccio','Bastia'],['Amsterdam','Utrecht'],['Utrecht','Rotterdam'],
  ['Rotterdam','Antwerp'],['Antwerp','Brussels'],['Brussels','Charleroi'],
  ['Charleroi','Liege'],['Liege','Aachen'],['Aachen','Cologne'],['Amsterdam','Groningen'],
  ['Groningen','Bremen'],['Utrecht','Eindhoven'],['Eindhoven','Duisburg'],
  ['Den Haag','Rotterdam'],['Rotterdam','Duisburg'],['Brussels','Luxembourg'],
  ['Luxembourg','Metz'],['Luxembourg','Saarbrucken'],['Saarbrucken','Mannheim'],
  ['Duisburg','Essen'],['Essen','Dortmund'],['Dortmund','Munster'],['Munster','Osnabruck'],
  ['Osnabruck','Bremen'],['Bremen','Hamburg'],['Dortmund','Bielefeld'],
  ['Bielefeld','Hannover'],['Hannover','Braunschweig'],['Braunschweig','Magdeburg'],
  ['Magdeburg','Berlin'],['Cologne','Dusseldorf'],['Dusseldorf','Duisburg'],
  ['Cologne','Koblenz'],['Koblenz','Frankfurt'],['Frankfurt','Kassel'],['Kassel','Hannover'],
  ['Frankfurt','Wurzburg'],['Wurzburg','Nuremberg'],['Nuremberg','Regensburg'],
  ['Regensburg','Passau'],['Passau','Linz'],['Linz','Vienna'],['Frankfurt','Mannheim'],
  ['Mannheim','Karlsruhe'],['Karlsruhe','Stuttgart'],['Stuttgart','Ulm'],['Ulm','Augsburg'],
  ['Augsburg','Munich'],['Karlsruhe','Freiburg'],['Freiburg','Basel'],
  ['Stuttgart','Strasbourg'],['Munich','Salzburg'],['Salzburg','Vienna'],
  ['Munich','Innsbruck'],['Innsbruck','Bolzano'],['Bolzano','Trento'],['Trento','Verona'],
  ['Munich','Regensburg'],['Nuremberg','Erfurt'],['Erfurt','Leipzig'],['Leipzig','Berlin'],
  ['Leipzig','Dresden'],['Dresden','Prague'],['Dresden','Chemnitz'],['Chemnitz','Erfurt'],
  ['Berlin','Cottbus'],['Cottbus','Wroclaw'],['Berlin','Hamburg'],['Berlin','Szczecin'],
  ['Hamburg','Lubeck'],['Lubeck','Travemunde'],['Travemunde','Rostock'],
  ['Rostock','Schwerin'],['Schwerin','Hamburg'],['Hamburg','Kiel'],['Bremen','Hannover'],
  ['Kiel','Copenhagen'],['Rostock','Gedser'],['Basel','Zurich'],['Zurich','Chur'],
  ['Chur','Lugano'],['Lugano','Milan'],['Zurich','Bern'],['Bern','Lausanne'],
  ['Lausanne','Geneva'],['Bern','Basel'],['Zurich','Munich'],['Innsbruck','Bregenz'],
  ['Bregenz','Zurich'],['Vienna','Sankt Polten'],['Sankt Polten','Linz'],['Linz','Salzburg'],
  ['Salzburg','Villach'],['Villach','Klagenfurt'],['Klagenfurt','Graz'],['Graz','Vienna'],
  ['Klagenfurt','Ljubljana'],['Villach','Udine'],['Udine','Venice'],['Prague','Plzen'],
  ['Plzen','Nuremberg'],['Prague','Ceske Budejovice'],['Ceske Budejovice','Linz'],
  ['Prague','Liberec'],['Liberec','Wroclaw'],['Prague','Brno'],['Brno','Olomouc'],
  ['Olomouc','Ostrava'],['Ostrava','Katowice'],['Brno','Bratislava'],['Bratislava','Vienna'],
  ['Bratislava','Zilina'],['Zilina','Kosice'],['Bratislava','Nitra'],
  ['Nitra','Banska Bystrica'],['Banska Bystrica','Kosice'],['Kosice','Miskolc'],
  ['Miskolc','Debrecen'],['Warsaw','Lodz'],['Lodz','Wroclaw'],['Wroclaw','Katowice'],
  ['Katowice','Krakow'],['Krakow','Rzeszow'],['Rzeszow','Lublin'],['Lublin','Warsaw'],
  ['Warsaw','Poznan'],['Poznan','Szczecin'],['Szczecin','Swinoujscie'],['Poznan','Wroclaw'],
  ['Warsaw','Torun'],['Torun','Bydgoszcz'],['Bydgoszcz','Gdansk'],['Gdansk','Gdynia'],
  ['Warsaw','Radom'],['Radom','Kielce'],['Kielce','Krakow'],['Warsaw','Bialystok'],
  ['Bialystok','Kaunas'],['Warsaw','Olsztyn'],['Olsztyn','Kaliningrad'],
  ['Katowice','Czestochowa'],['Czestochowa','Lodz'],['Krakow','Ostrava'],['Gdansk','Olsztyn'],
  ['Budapest','Gyor'],['Gyor','Vienna'],['Budapest','Szekesfehervar'],
  ['Szekesfehervar','Pecs'],['Pecs','Osijek'],['Budapest','Kecskemet'],['Kecskemet','Szeged'],
  ['Szeged','Subotica'],['Subotica','Novi Sad'],['Novi Sad','Belgrade'],
  ['Budapest','Debrecen'],['Debrecen','Nyiregyhaza'],['Nyiregyhaza','Uzhhorod'],
  ['Budapest','Miskolc'],['Budapest','Timisoara'],['Timisoara','Arad'],['Arad','Oradea'],
  ['Oradea','Cluj-Napoca'],['Milan','Turin'],['Turin','Aosta'],['Turin','Alessandria'],
  ['Alessandria','Genoa'],['Genoa','Savona'],['Milan','Brescia'],['Brescia','Verona'],
  ['Verona','Padova'],['Padova','Venice'],['Venice','Trieste'],['Trieste','Koper'],
  ['Koper','Ljubljana'],['Milan','Parma'],['Parma','Modena'],['Modena','Bologna'],
  ['Bologna','Florence'],['Florence','Rome'],['Rome','Naples'],['Naples','Salerno'],
  ['Bologna','Rimini'],['Rimini','Ancona'],['Ancona','Pescara'],['Pescara','Bari'],
  ['Bari','Brindisi'],['Brindisi','Lecce'],['Genoa','La Spezia'],['La Spezia','Pisa'],
  ['Pisa','Livorno'],['Livorno','Rome'],['Florence','Perugia'],['Perugia','Terni'],
  ['Terni','Rome'],['Rome','Cassino'],['Cassino','Naples'],['Naples','Foggia'],
  ['Foggia','Bari'],['Bari','Taranto'],['Taranto','Cosenza'],['Naples','Cosenza'],
  ['Cosenza','Catanzaro'],['Catanzaro','Reggio Calabria'],
  ['Reggio Calabria','Villa San Giovanni'],['Villa San Giovanni','Messina'],
  ['Messina','Catania'],['Catania','Palermo'],['Cagliari','Sassari'],['Sassari','Olbia'],
  ['Suzzara','Parma'],['Bari','Durres'],['Ancona','Split'],['Lisbon','Setubal'],
  ['Setubal','Sines'],['Sines','Faro'],['Faro','Olhao'],['Olhao','Huelva'],
  ['Huelva','Seville'],['Lisbon','Coimbra'],['Coimbra','Aveiro'],['Aveiro','Porto'],
  ['Porto','Vigo'],['Vigo','A Coruna'],['Lisbon','Evora'],['Evora','Badajoz'],
  ['Badajoz','Merida'],['Merida','Caceres'],['Caceres','Salamanca'],['Porto','Braganca'],
  ['Braganca','Salamanca'],['Porto','Guarda'],['Guarda','Salamanca'],['Vigo','Ourense'],
  ['Ourense','Leon'],['A Coruna','Gijon'],['Gijon','Santander'],['Santander','Bilbao'],
  ['Bilbao','San Sebastian'],['San Sebastian','Pamplona'],['Leon','Valladolid'],
  ['Valladolid','Madrid'],['Gijon','Leon'],['Madrid','Salamanca'],['Madrid','Burgos'],
  ['Burgos','Vitoria'],['Vitoria','Bilbao'],['Madrid','Logrono'],['Logrono','Pamplona'],
  ['Madrid','Soria'],['Soria','Zaragoza'],['Zaragoza','Lleida'],['Lleida','Barcelona'],
  ['Madrid','Toledo'],['Toledo','Ciudad Real'],['Ciudad Real','Puertollano'],
  ['Puertollano','Cordoba'],['Cordoba','Seville'],['Madrid','Albacete'],
  ['Albacete','Alicante'],['Alicante','Murcia'],['Murcia','Cartagena'],['Madrid','Valencia'],
  ['Valencia','Sagunto'],['Sagunto','Castellon'],['Castellon','Vandellos'],
  ['Vandellos','Tarragona'],['Tarragona','Barcelona'],['Valencia','Teruel'],
  ['Teruel','Zaragoza'],['Barcelona','Andorra la Vella'],['Seville','Cadiz'],
  ['Cadiz','Jerez'],['Jerez','Algeciras'],['Algeciras','Malaga'],['Malaga','Granada'],
  ['Granada','Almeria'],['Almeria','El Ejido'],['El Ejido','Murcia'],['Seville','Malaga'],
  ['Granada','Madrid'],['Zaragoza','Pamplona'],['Copenhagen','Helsingor'],
  ['Helsingor','Helsingborg'],['Helsingborg','Malmo'],['Copenhagen','Malmo'],
  ['Copenhagen','Odense'],['Odense','Kolding'],['Kolding','Esbjerg'],['Kolding','Aarhus'],
  ['Aarhus','Aalborg'],['Aalborg','Hirtshals'],['Aalborg','Frederikshavn'],
  ['Frederikshavn','Gothenburg'],['Copenhagen','Rodbyhavn'],['Rodbyhavn','Gedser'],
  ['Malmo','Trelleborg'],['Trelleborg','Ystad'],['Ystad','Karlskrona'],
  ['Karlskrona','Kalmar'],['Kalmar','Vaxjo'],['Vaxjo','Jonkoping'],['Malmo','Halmstad'],
  ['Halmstad','Falkenberg'],['Falkenberg','Gothenburg'],['Gothenburg','Karlstad'],
  ['Karlstad','Oslo'],['Gothenburg','Jonkoping'],['Jonkoping','Linkoping'],
  ['Linkoping','Norrkoping'],['Norrkoping','Sodertalje'],['Sodertalje','Stockholm'],
  ['Stockholm','Uppsala'],['Uppsala','Gavle'],['Gavle','Soderhamn'],['Soderhamn','Sundsvall'],
  ['Sundsvall','Ornskoldsvik'],['Ornskoldsvik','Umea'],['Umea','Skelleftea'],
  ['Skelleftea','Lulea'],['Lulea','Haparanda'],['Haparanda','Kemi'],['Kemi','Oulu'],
  ['Stockholm','Vasteras'],['Vasteras','Orebro'],['Orebro','Karlstad'],
  ['Stockholm','Kapellskar'],['Stockholm','Nynashamn'],['Orebro','Borlange'],
  ['Borlange','Gavle'],['Oslo','Kristiansand'],['Kristiansand','Stavanger'],
  ['Stavanger','Bergen'],['Oslo','Dombas'],['Dombas','Trondheim'],['Dombas','Alesund'],
  ['Trondheim','Kristiansund'],['Kristiansund','Alesund'],['Trondheim','Ostersund'],
  ['Ostersund','Sundsvall'],['Trondheim','Steinkjer'],['Steinkjer','Mo i Rana'],
  ['Mo i Rana','Bodo'],['Bodo','Svolvaer'],['Svolvaer','Narvik'],['Narvik','Harstad'],
  ['Harstad','Andenes'],['Narvik','Tromso'],['Tromso','Alta'],['Alta','Hammerfest'],
  ['Alta','Honningsvag'],['Narvik','Kiruna'],['Kiruna','Gallivare'],['Gallivare','Lulea'],
  ['Kiruna','Karesuando'],['Karesuando','Ivalo'],['Gallivare','Sodankyla'],
  ['Sodankyla','Ivalo'],['Ostersund','Borlange'],['Helsinki','Turku'],['Turku','Pori'],
  ['Pori','Vaasa'],['Vaasa','Kokkola'],['Kokkola','Oulu'],['Helsinki','Hanko'],
  ['Hanko','Turku'],['Helsinki','Hameenlinna'],['Hameenlinna','Tampere'],
  ['Tampere','Jyvaskyla'],['Jyvaskyla','Kuopio'],['Kuopio','Kajaani'],['Kajaani','Oulu'],
  ['Helsinki','Lahti'],['Lahti','Kouvola'],['Kouvola','Kotka'],['Kotka','Loviisa'],
  ['Kouvola','Lappeenranta'],['Lappeenranta','Vyborg'],['Vyborg','Saint Petersburg'],
  ['Lappeenranta','Savonlinna'],['Savonlinna','Joensuu'],['Joensuu','Kuopio'],
  ['Mikkeli','Lahti'],['Mikkeli','Kuopio'],['Kemi','Rovaniemi'],['Rovaniemi','Sodankyla'],
  ['Tampere','Pori'],['Helsinki','Tallinn'],['Tallinn','Parnu'],['Parnu','Riga'],
  ['Tallinn','Tartu'],['Tartu','Valmiera'],['Valmiera','Riga'],['Tallinn','Narva'],
  ['Narva','Saint Petersburg'],['Tartu','Pskov'],['Riga','Ventspils'],['Ventspils','Liepaja'],
  ['Liepaja','Klaipeda'],['Riga','Siauliai'],['Siauliai','Panevezys'],['Panevezys','Vilnius'],
  ['Riga','Daugavpils'],['Daugavpils','Vilnius'],['Riga','Rezekne'],['Rezekne','Pskov'],
  ['Vilnius','Kaunas'],['Kaunas','Klaipeda'],['Kaunas','Sovetsk'],['Sovetsk','Chernyakhovsk'],
  ['Chernyakhovsk','Kaliningrad'],['Vilnius','Minsk'],['Minsk','Vitsebsk'],
  ['Vitsebsk','Smolensk'],['Smolensk','Moscow'],['Minsk','Hrodna'],['Hrodna','Bialystok'],
  ['Minsk','Homel'],['Homel','Bryansk'],['Saint Petersburg','Sosnovy Bor'],
  ['Saint Petersburg','Luga'],['Luga','Pskov'],['Saint Petersburg','Veliky Novgorod'],
  ['Veliky Novgorod','Tver'],['Tver','Moscow'],['Saint Petersburg','Vologda'],
  ['Vologda','Yaroslavl'],['Yaroslavl','Moscow'],['Moscow','Vladimir'],
  ['Vladimir','Nizhny Novgorod'],['Yaroslavl','Kostroma'],['Kostroma','Ivanovo'],
  ['Ivanovo','Vladimir'],['Moscow','Ryazan'],['Ryazan','Voronezh'],['Voronezh','Lipetsk'],
  ['Moscow','Tula'],['Tula','Oryol'],['Oryol','Kursk'],['Moscow','Kaluga'],
  ['Kaluga','Bryansk'],['Kursk','Kharkiv'],['Voronezh','Kharkiv'],['Kyiv','Zhytomyr'],
  ['Zhytomyr','Rivne'],['Rivne','Lviv'],['Lviv','Uzhhorod'],['Kyiv','Vinnytsia'],
  ['Vinnytsia','Chisinau'],['Chisinau','Balti'],['Kyiv','Kharkiv'],['Kharkiv','Dnipro'],
  ['Kyiv','Mykolaiv'],['Mykolaiv','Kherson'],['Lviv','Ternopil'],['Ternopil','Chernivtsi'],
  ['Chernivtsi','Suceava'],['Suceava','Iasi'],['Odesa','Chisinau'],['Balti','Iasi'],
  ['Odesa','Mykolaiv'],['Iasi','Bacau'],['Bacau','Brasov'],['Brasov','Bucharest'],
  ['Bucharest','Ploiesti'],['Ploiesti','Brasov'],['Brasov','Sibiu'],['Sibiu','Cluj-Napoca'],
  ['Bucharest','Pitesti'],['Pitesti','Craiova'],['Craiova','Calafat'],['Calafat','Vidin'],
  ['Bucharest','Giurgiu'],['Giurgiu','Ruse'],['Ruse','Veliko Tarnovo'],
  ['Veliko Tarnovo','Sofia'],['Bucharest','Constanta'],['Constanta','Mangalia'],
  ['Mangalia','Varna'],['Bucharest','Galati'],['Galati','Iasi'],['Cluj-Napoca','Targu Mures'],
  ['Targu Mures','Brasov'],['Timisoara','Belgrade'],['Sofia','Pleven'],
  ['Pleven','Veliko Tarnovo'],['Veliko Tarnovo','Varna'],['Varna','Burgas'],
  ['Sofia','Plovdiv'],['Plovdiv','Stara Zagora'],['Stara Zagora','Burgas'],
  ['Plovdiv','Kardzhali'],['Kardzhali','Alexandroupoli'],['Sofia','Blagoevgrad'],
  ['Blagoevgrad','Thessaloniki'],['Sofia','Nis'],['Nis','Belgrade'],['Sofia','Vidin'],
  ['Burgas','Istanbul'],['Istanbul','Edirne'],['Edirne','Tekirdag'],['Tekirdag','Canakkale'],
  ['Istanbul','Izmit'],['Izmit','Bursa'],['Bursa','Izmir'],['Istanbul','Ankara'],
  ['Edirne','Alexandroupoli'],['Alexandroupoli','Kavala'],['Kavala','Thessaloniki'],
  ['Thessaloniki','Larissa'],['Larissa','Volos'],['Volos','Lamia'],['Lamia','Athens'],
  ['Thessaloniki','Ioannina'],['Ioannina','Igoumenitsa'],['Igoumenitsa','Corfu'],
  ['Athens','Patra'],['Patra','Agrinio'],['Agrinio','Ioannina'],['Athens','Tripoli'],
  ['Tripoli','Kalamata'],['Athens','Heraklion'],['Heraklion','Chania'],['Athens','Rhodes'],
  ['Izmir','Chios'],['Chios','Mytilene'],['Ljubljana','Zagreb'],['Zagreb','Belgrade'],
  ['Nis','Skopje'],['Skopje','Thessaloniki'],['Ljubljana','Maribor'],['Maribor','Graz'],
  ['Zagreb','Rijeka'],['Rijeka','Zadar'],['Zadar','Split'],['Split','Mostar'],
  ['Mostar','Dubrovnik'],['Zagreb','Novo Mesto'],['Novo Mesto','Ljubljana'],
  ['Zagreb','Osijek'],['Osijek','Novi Sad'],['Belgrade','Kragujevac'],['Kragujevac','Nis'],
  ['Belgrade','Tuzla'],['Tuzla','Zenica'],['Zenica','Sarajevo'],['Sarajevo','Mostar'],
  ['Belgrade','Banja Luka'],['Banja Luka','Zagreb'],['Sarajevo','Split'],['Podgorica','Bar'],
  ['Bar','Dubrovnik'],['Podgorica','Niksic'],['Niksic','Sarajevo'],['Podgorica','Shkoder'],
  ['Shkoder','Tirana'],['Tirana','Durres'],['Durres','Vlore'],['Tirana','Prizren'],
  ['Prizren','Pristina'],['Pristina','Skopje'],['Pristina','Nis'],['Skopje','Kumanovo'],
  ['Kumanovo','Nis'],['Skopje','Bitola'],['Bitola','Thessaloniki'],
];

const ROADS_ATS = [
  ['Bellingham','Everett'],['Everett','Seattle'],['Seattle','Tacoma'],['Tacoma','Olympia'],
  ['Olympia','Vancouver WA'],['Vancouver WA','Portland'],['Seattle','Port Angeles'],
  ['Olympia','Aberdeen WA'],['Portland','Astoria'],['Seattle','Ellensburg'],
  ['Ellensburg','Yakima'],['Yakima','Pasco'],['Pasco','Walla Walla'],
  ['Walla Walla','Lewiston'],['Spokane','Coeur dAlene'],['Coeur dAlene','Sandpoint'],
  ['Spokane','Pasco'],['Spokane','Missoula'],['Portland','Salem'],['Salem','Eugene'],
  ['Eugene','Medford'],['Medford','Yreka'],['Yreka','Redding'],['Redding','Sacramento'],
  ['Eugene','Bend'],['Bend','Klamath Falls'],['Klamath Falls','Medford'],['Bend','Boise'],
  ['Eureka','Ukiah'],['Ukiah','Santa Rosa'],['Santa Rosa','Oakland'],['Redding','Eureka'],
  ['Sacramento','Santa Rosa'],['Sacramento','Truckee'],['Truckee','Reno'],
  ['Sacramento','Stockton'],['Stockton','Modesto'],['Modesto','Merced'],['Merced','Fresno'],
  ['Fresno','Visalia'],['Visalia','Bakersfield'],['Bakersfield','Los Angeles'],
  ['Stockton','Oakland'],['Oakland','San Francisco'],['San Francisco','San Jose'],
  ['San Jose','Santa Cruz'],['Santa Cruz','Monterey'],['Monterey','Paso Robles'],
  ['Paso Robles','San Luis Obispo'],['San Luis Obispo','Santa Maria'],
  ['Santa Maria','Santa Barbara'],['Santa Barbara','Ventura'],['Ventura','Los Angeles'],
  ['Los Angeles','Long Beach'],['Long Beach','San Diego'],['San Diego','El Centro'],
  ['El Centro','Yuma'],['Yuma','Phoenix'],['Los Angeles','Palm Springs'],
  ['Palm Springs','Phoenix'],['Los Angeles','Barstow'],['Barstow','Las Vegas'],
  ['Bakersfield','Bishop'],['Bishop','Tonopah'],['Tonopah','Ely'],['Barstow','Kingman'],
  ['Kingman','Flagstaff'],['Reno','Carson City'],['Reno','Winnemucca'],['Winnemucca','Elko'],
  ['Elko','Salt Lake City'],['Reno','Tonopah'],['Tonopah','Las Vegas'],
  ['Las Vegas','Pahrump'],['Las Vegas','St George'],['St George','Cedar City'],
  ['Cedar City','Provo'],['Salt Lake City','Ogden'],['Ogden','Logan'],['Logan','Pocatello'],
  ['Pocatello','Idaho Falls'],['Idaho Falls','Butte'],['Salt Lake City','Provo'],
  ['Provo','Price'],['Price','Moab'],['Moab','Durango'],['Salt Lake City','Evanston'],
  ['Evanston','Rock Springs'],['Rock Springs','Laramie'],['Laramie','Cheyenne'],
  ['Salt Lake City','Vernal'],['Vernal','Craig'],['Craig','Grand Junction'],
  ['Boise','Twin Falls'],['Twin Falls','Pocatello'],['Boise','Ketchum'],
  ['Ketchum','Idaho Falls'],['Boise','Lewiston'],['Idaho Falls','Jackson'],
  ['Jackson','Rock Springs'],['Missoula','Kalispell'],['Missoula','Butte'],['Butte','Helena'],
  ['Helena','Great Falls'],['Great Falls','Havre'],['Butte','Bozeman'],['Bozeman','Billings'],
  ['Billings','Sheridan'],['Sheridan','Casper'],['Casper','Cheyenne'],
  ['Billings','Miles City'],['Miles City','Sidney'],['Billings','Cody'],['Cody','Jackson'],
  ['Sheridan','Gillette'],['Gillette','Casper'],['Cheyenne','Fort Collins'],
  ['Fort Collins','Denver'],['Denver','Colorado Springs'],['Colorado Springs','Pueblo'],
  ['Pueblo','Raton'],['Raton','Santa Fe'],['Santa Fe','Albuquerque'],
  ['Cheyenne','Scottsbluff'],['Scottsbluff','North Platte'],['North Platte','Grand Island'],
  ['Grand Island','Lincoln'],['Lincoln','Omaha'],['Denver','Limon'],['Limon','Sterling'],
  ['Denver','Grand Junction'],['Grand Junction','Montrose'],['Montrose','Durango'],
  ['Durango','Farmington'],['Pueblo','Alamosa'],['Alamosa','Durango'],
  ['Albuquerque','Gallup'],['Gallup','Holbrook'],['Holbrook','Flagstaff'],
  ['Flagstaff','Prescott'],['Prescott','Phoenix'],['Albuquerque','Socorro'],
  ['Socorro','Las Cruces'],['Las Cruces','El Paso'],['Albuquerque','Tucumcari'],
  ['Tucumcari','Amarillo'],['Albuquerque','Roswell'],['Roswell','Carlsbad'],
  ['Carlsbad','Odessa'],['Flagstaff','Page'],['Phoenix','Show Low'],['Show Low','Holbrook'],
  ['Phoenix','Tucson'],['Tucson','Sierra Vista'],['Sierra Vista','Nogales'],
  ['Tucson','El Paso'],['El Paso','Odessa'],['Odessa','Midland'],['Midland','Abilene'],
  ['Abilene','Fort Worth'],['El Paso','Del Rio'],['Del Rio','San Antonio'],
  ['Clovis','Lubbock'],['Clovis','Amarillo'],['Amarillo','Lubbock'],['Lubbock','Midland'],
  ['Amarillo','Guymon'],['Guymon','Liberal'],['Liberal','Dodge City'],
  ['Dodge City','Garden City'],['Amarillo','Oklahoma City'],['Lubbock','Abilene'],
  ['Oklahoma City','Enid'],['Enid','Wichita'],['Wichita','Salina'],['Salina','Topeka'],
  ['Topeka','Kansas City'],['Oklahoma City','Tulsa'],['Tulsa','Joplin'],
  ['Joplin','Springfield'],['Springfield','Columbia'],['Columbia','St Louis'],
  ['Oklahoma City','Lawton'],['Lawton','Wichita Falls'],['Wichita Falls','Fort Worth'],
  ['Oklahoma City','McAlester'],['McAlester','Fort Smith'],['Kansas City','Council Bluffs'],
  ['Council Bluffs','Omaha'],['Omaha','Sioux City'],['Sioux City','Sioux Falls'],
  ['Kansas City','Des Moines'],['Omaha','Norfolk'],['Wichita','Hays'],['Hays','Salina'],
  ['St Louis','Cape Girardeau'],['Cape Girardeau','Memphis'],['Memphis','Jonesboro'],
  ['Jonesboro','Little Rock'],['Little Rock','Pine Bluff'],['Pine Bluff','Texarkana'],
  ['Texarkana','Shreveport'],['Little Rock','Fort Smith'],['Fort Smith','Fayetteville'],
  ['Fayetteville','Joplin'],['Shreveport','Longview'],['Longview','Tyler'],['Tyler','Dallas'],
  ['Shreveport','Beaumont'],['Beaumont','Houston'],['Dallas','Fort Worth'],
  ['Fort Worth','Waco'],['Waco','Austin'],['Austin','San Antonio'],['San Antonio','Laredo'],
  ['Dallas','Texarkana'],['Austin','Houston'],['Houston','Galveston'],
  ['San Antonio','Victoria'],['Victoria','Corpus Christi'],['Corpus Christi','Brownsville'],
  ['Brownsville','McAllen'],['McAllen','Laredo'],['San Antonio','San Angelo'],
  ['San Angelo','Abilene'],
];
const ROADS = { ets2: ROADS_ETS2, ats: ROADS_ATS };

/* ---------- map regions ----------
   The games ship their world in chunks, and their own map draws the seam
   between them as a coloured line with the region shouted beside it. These
   are those seams: rough dividers in real lat/lon, not political borders,
   and purely a reading aid over the road network. */
const REGIONS = {
  ets2: [
    { name: 'SCANDINAVIA!', color: '#7b4dff', label: [65.2, 3.0],
      line: [[55.4, 7.6], [55.0, 9.4], [54.6, 11.0], [54.3, 12.6], [54.2, 14.3]] },
    { name: 'GOING EAST!', color: '#c9a227', label: [54.6, 16.4],
      line: [[54.6, 18.2], [53.2, 17.4], [52.0, 16.6], [50.9, 16.6], [49.9, 17.6],
             [49.1, 17.2], [48.3, 16.6], [47.2, 16.4], [46.4, 15.6]] },
    { name: 'VIVA LA FRANCE!', color: '#1f9d3a', label: [45.6, -7.0],
      line: [[50.9, 2.1], [49.4, 2.6], [48.2, 3.2], [47.0, 3.6], [45.9, 4.4],
             [45.0, 4.9], [44.2, 5.6], [43.4, 6.4]] },
    { name: 'ITALIA!', color: '#c0392b', label: [40.0, 12.0],
      line: [[44.6, 7.9], [45.1, 9.2], [45.3, 10.6], [45.4, 12.1], [45.6, 13.4]] },
    { name: 'IBERIA!', color: '#e08a2e', label: [39.6, -12.4],
      line: [[43.4, -1.8], [42.9, -0.6], [42.6, 0.7], [42.3, 1.7], [42.4, 3.1]] },
    { name: 'BEYOND THE BALTIC SEA!', color: '#2fb6c9', label: [58.2, 20.6],
      line: [[54.4, 20.9], [54.9, 22.6], [55.6, 24.2], [56.4, 25.6], [57.6, 26.6],
             [58.6, 27.4], [59.4, 28.2]] },
    { name: 'ROAD TO THE BLACK SEA!', color: '#e05252', label: [43.0, 35.4],
      line: [[47.9, 22.2], [46.9, 21.4], [45.8, 21.1], [44.9, 22.4], [44.0, 22.9],
             [43.2, 23.3], [42.3, 23.4], [41.5, 24.6]] },
    { name: 'WEST BALKANS!', color: '#6aa9f5', label: [37.6, 19.2],
      line: [[46.6, 15.9], [46.0, 16.8], [45.5, 18.4], [45.2, 19.6], [44.6, 20.6],
             [43.4, 21.6], [42.4, 21.9], [41.4, 21.4]] },
    { name: 'GREECE!', color: '#3fbfe0', label: [34.2, 24.4],
      line: [[41.3, 20.8], [40.9, 22.0], [41.0, 23.6], [41.2, 25.2], [41.0, 26.4]] },
    { name: 'HEART OF RUSSIA!', color: '#e57373', label: [57.6, 46.2],
      line: [[59.6, 30.9], [58.4, 31.8], [56.9, 32.4], [55.4, 32.6], [54.2, 33.6],
             [52.9, 34.4], [51.6, 36.4]] },
  ],
  ats: [
    { name: 'CALIFORNIA!', color: '#e0a52e', label: [35.4, -125.0],
      line: [[42.0, -120.0], [40.6, -119.9], [39.0, -119.6], [37.6, -118.4],
             [36.0, -116.4], [34.6, -114.6], [32.7, -114.6]] },
    { name: 'PACIFIC NORTHWEST!', color: '#3fbfe0', label: [47.8, -127.0],
      line: [[49.0, -117.0], [47.0, -116.9], [45.0, -117.0], [43.6, -117.0], [42.0, -117.0]] },
    { name: 'MOUNTAIN WEST!', color: '#7b4dff', label: [45.6, -108.2],
      line: [[49.0, -111.0], [46.4, -111.2], [43.6, -111.3], [41.0, -111.1],
             [38.4, -110.4], [36.2, -109.1], [33.4, -109.1]] },
    { name: 'TEXAS!', color: '#c0392b', label: [29.2, -100.2],
      line: [[36.5, -103.0], [34.6, -103.0], [32.4, -103.1], [31.4, -104.5], [29.8, -104.9]] },
    { name: 'THE PLAINS!', color: '#1f9d3a', label: [41.6, -97.4],
      line: [[43.5, -104.0], [41.2, -104.0], [39.0, -103.6], [37.0, -103.0], [35.0, -103.0]] },
  ],
};
const regionsFor = (game) => REGIONS[game === 'ats' ? 'ats' : 'ets2'] || [];

/* the schematic grid has y growing downward; Leaflet's lat grows upward */
const gameLatLng = (xy) => L.latLng(-xy[1], xy[0]);
/* real lat/lon onto the schematic the game map draws in */
function geoToGameLatLng(gameKey, lat, lon) {
  const f = SCHEMATIC_FIT[gameKey === 'ats' ? 'ats' : 'ets2'];
  return gameLatLng([f.bx + lon * f.kx, f.by + mercY(lat) * f.ky]);
}
