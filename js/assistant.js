// Pawsitive AI assistant (demo).
//
// This is NOT a real AI model. It looks for keywords in the visitor's
// description, picks services from the price list below, and animates the
// reply (typing indicator, word-by-word text) so it feels like a live chat.
// Prices must match SERVICES in server.py; `book` is the service's name there
// (tests/test_server.py checks both).

const SERVICES = {
  meetGreet: { name: 'Free meet-and-greet', price: 0, book: 'Free meet-and-greet' },
  dogBathSmall: { name: 'Bath & brush (small dog)', price: 45, book: 'Dog bath & brush (small, under 25 lb)' },
  dogBathMedium: { name: 'Bath & brush (medium dog)', price: 60, book: 'Dog bath & brush (medium, 25–60 lb)' },
  dogBathLarge: { name: 'Bath & brush (large dog)', price: 75, book: 'Dog bath & brush (large, 60 lb+)' },
  dogFullGroom: { name: 'Full groom (bath, haircut, nails, ears)', price: 70, from: true, book: 'Dog full groom (bath, haircut, nails, ears)' },
  puppyGroom: { name: "Puppy's first groom", price: 35, book: "Puppy's first groom (under 6 months)" },
  catBath: { name: 'Cat bath & brush', price: 55, book: 'Cat bath & brush' },
  lionCut: { name: 'Lion cut', price: 75, book: 'Lion cut' },
  deShed: { name: 'De-shedding treatment', price: 65, book: 'De-shedding treatment' },
  sanitary: { name: 'Sanitary trim', price: 30, book: 'Sanitary trim' },
  calmCat: { name: 'Calm-cat session (extra time & breaks)', price: 15, book: 'Calm-cat session (extra time & breaks)' },
  nailTrim: { name: 'Nail trim', price: 15, book: 'Nail trim' },
  nailGrind: { name: 'Nail grinding', price: 20, book: 'Nail grinding' },
  ears: { name: 'Ear cleaning', price: 12, book: 'Ear cleaning' },
  teeth: { name: 'Teeth brushing', price: 12, book: 'Teeth brushing' },
  dematting: { name: 'De-matting (about 30 min)', price: 30, book: 'De-matting (30 min)' },
  fleaBath: { name: 'Flea & tick bath', price: 20, book: 'Flea & tick bath' },
  dogRabies: { name: 'Rabies vaccine', price: 25, book: 'Dog rabies vaccine' },
  dhpp: { name: 'DHPP vaccine (distemper combo)', price: 35, book: 'DHPP vaccine (distemper combo)' },
  bordetella: { name: 'Bordetella vaccine (kennel cough)', price: 30, book: 'Bordetella vaccine (kennel cough)' },
  lepto: { name: 'Leptospirosis vaccine', price: 30, book: 'Leptospirosis vaccine' },
  catRabies: { name: 'Rabies vaccine', price: 25, book: 'Cat rabies vaccine' },
  fvrcp: { name: 'FVRCP vaccine (feline distemper combo)', price: 30, book: 'FVRCP vaccine (feline distemper combo)' },
  felv: { name: 'FeLV vaccine (feline leukemia)', price: 35, book: 'FeLV vaccine (feline leukemia)' },
};

const SMALL_BREEDS = ['chihuahua', 'yorkie', 'yorkshire', 'pomeranian', 'shih tzu', 'maltese', 'dachshund', 'pug',
  'toy poodle', 'mini', 'miniature', 'papillon', 'havanese', 'bichon', 'jack russell', 'cavalier', 'french bulldog',
  'frenchie', 'boston terrier', 'westie', 'pekingese', 'lhasa'];
const LARGE_BREEDS = ['golden', 'retriever', 'labrador', 'lab', 'german shepherd', 'shepherd', 'husky', 'malamute',
  'great dane', 'rottweiler', 'mastiff', 'bernese', 'newfoundland', 'saint bernard', 'st bernard', 'great pyrenees',
  'doberman', 'standard poodle', 'goldendoodle', 'bernedoodle', 'labradoodle', 'akita', 'boxer', 'weimaraner'];
const LONG_COAT_BREEDS = ['doodle', 'poodle', 'shih tzu', 'maltese', 'yorkie', 'havanese', 'bichon', 'lhasa',
  'schnauzer', 'cocker', 'sheepdog', 'pekingese'];

// words(): matches the start of a word ("shed" finds "sheds"). whole(): whole words only.
const words = (list) => new RegExp(`\\b(?:${list.join('|')})`, 'i');
const whole = (list) => new RegExp(`\\b(?:${list.join('|')})\\b`, 'i');
const RULES = {
  dog: whole(['dogs?', 'pupp(?:y|ies)', 'pups?\\b', 'doggo', 'canine', ...SMALL_BREEDS, ...LARGE_BREEDS, 'doodle', 'terrier', 'beagle', 'spaniel', 'collie', 'corgi', 'schnauzer', 'bulldog', 'pit ?bull']),
  cat: whole(['cats?', 'kitten', 'kitty', 'feline', 'persian', 'maine coon', 'siamese', 'ragdoll', 'sphynx', 'bengal']),
  puppy: words(['pupp(?:y|ies)', 'pups?\\b']),
  kitten: words(['kitten']),
  newOwner: words(['first (?:pet|dog|cat|puppy|kitten|time)', 'new (?:owner|pet|puppy|kitten|to)', 'just (?:adopted|got|brought)', 'adopted', 'rescue', 'never had']),
  urgent: words(['bleed', 'blood', 'limp', 'vomit', 'throw(?:ing)? up', 'diarrh', 'not eating', "won'?t eat", 'letharg', 'seizure', 'wound', 'injur', 'lump', 'broken', "can'?t walk", 'breathing', 'pus\\b']),
  earInfection: /\bears?\b.*\b(?:red|redness|discharge|infect|swollen|yeast|bad smell|smells? bad)|\b(?:red|discharge|infect|swollen|yeast)\w*\b.*\bears?\b/i,
  vaccine: words(['vaccin', 'shots?\\b', 'rabies', 'booster', 'distemper', 'dhpp', 'fvrcp', 'bordetella', 'kennel cough', 'lepto', 'felv', 'feline leukemia']),
  rabiesOnly: /\brabies\b/i,
  boarding: words(['board', 'daycare', 'kennel', 'dog park', 'doggy day']),
  outdoors: words(['hik', 'lake', 'pond', 'farm', 'woods', 'wildlife', 'camping', 'swim']),
  outdoorCat: words(['outdoor', 'goes outside', 'goes out', 'outside cat', 'other cats']),
  matted: words(['matt(?:ed|ing|s)?\\b', 'mats?\\b', 'tangle', 'knot', 'clump']),
  heavyMats: words(['severe', 'bad(?:ly)?\\b', 'all over', 'everywhere', 'pelt', 'really', 'very']),
  shedding: words(['shed', 'fur everywhere', 'hair everywhere', 'undercoat', 'blowing', 'hairball', 'losing (?:fur|hair)']),
  dirty: words(['smell', 'stink', 'odou?r', 'dirty', 'mud', 'rolled in', 'greasy', 'filthy', 'bath', 'gross']),
  haircut: words(['haircut', 'hair ?cut', 'overgrown', 'shaggy', 'long hair', "can'?t see", 'cut (?:his|her|their|its) (?:hair|fur|coat)', 'trim (?:his|her|their|its|the) (?:hair|fur|coat|face)', 'summer cut', 'teddy bear', 'puppy cut', 'full groom', 'groom']),
  lion: words(['lion', 'shave', 'shaved', 'summer', 'too hot', 'overheat']),
  sanitary: words(['sanitary', 'rear end', 'back end', 'bum\\b', 'butt\\b', 'poop', 'dingleberr', 'messy behind']),
  nails: words(['nails?\\b', 'claws?\\b', 'click', 'scratch(?:es|ing)? (?:the )?(?:floor|furniture|me|us)']),
  grind: words(['grind', 'dremel']),
  ears: words(['ears?\\b', 'head shak', 'shak(?:es|ing) (?:his|her|its|their) head']),
  teeth: words(['teeth', 'tooth', 'breath', 'tartar', 'dental', 'gums?\\b']),
  dentalWork: words(['tartar', 'dental', 'rotten', 'gums?\\b']),
  fleas: words(['fleas?\\b', 'ticks?\\b']),
  itchy: words(['itch', 'scratch(?:es|ing)? (?:a lot|constantly|all)', 'dry skin', 'flaky']),
  anxious: words(['anxious', 'anxiety', 'nervous', 'scared', 'fearful', 'afraid', 'skittish', 'hates', 'stress', 'aggressive', 'bites', 'reactive', 'shy', 'freaks out']),
};

function dogSize(text) {
  const weight = text.match(/(\d{1,3}(?:\.\d)?)\s*(lbs?|pounds?|kg|kilos?)\b/i);
  if (weight) {
    const lb = Number(weight[1]) * (/^k/i.test(weight[2]) ? 2.2 : 1);
    return lb < 25 ? 'small' : lb <= 60 ? 'medium' : 'large';
  }
  const lower = text.toLowerCase();
  if (whole([...SMALL_BREEDS, 'small', 'tiny', 'little', 'toy']).test(lower)) return 'small';
  if (whole([...LARGE_BREEDS, 'big', 'large', 'huge', 'giant']).test(lower)) return 'large';
  return null;
}

// Turns a description into { intro, items, notes, total, hasFrom }.
function analyze(text, species) {
  const t = text.toLowerCase();
  const items = [];
  const findings = [];
  const notes = [];
  const add = (key, reason) => {
    if (!items.some((item) => item.key === key)) items.push({ key, ...SERVICES[key], reason });
  };
  const is = (rule) => RULES[rule].test(t);

  const isDog = species === 'Dog';
  const young = isDog ? is('puppy') : is('kitten');
  const size = isDog ? dogSize(text) : null;
  const longCoat = isDog && words(LONG_COAT_BREEDS).test(t);
  const anxious = is('anxious');

  if (is('urgent')) {
    notes.push('Some of what you described can be a sign of a health problem. We don\'t diagnose or treat illness, so please check in with your vet before booking a groom.');
    findings.push('some possible health concerns');
  }
  const newOwner = is('newOwner');
  if (newOwner) add('meetGreet', 'a relaxed first visit so we can meet your pet and answer all your questions');

  // Coat and grooming
  const matted = is('matted');
  const shedding = is('shedding');
  const dirty = is('dirty');
  const wantsCut = is('haircut');
  const fleas = is('fleas');
  const itchy = is('itchy');
  if (matted) findings.push('matted fur');
  if (shedding) findings.push('heavy shedding');
  if (dirty) findings.push('a coat that needs a good clean');
  if (wantsCut) findings.push('an overgrown coat');
  if (fleas) findings.push('fleas or ticks');
  if (itchy && !fleas) findings.push('itchy skin');

  let base = null;
  if (isDog) {
    const needsCut = wantsCut || (matted && longCoat);
    const needsBath = matted || shedding || dirty || fleas || itchy;
    if (young && (needsCut || needsBath)) base = 'puppyGroom';
    else if (needsCut) base = 'dogFullGroom';
    else if (needsBath) base = { small: 'dogBathSmall', large: 'dogBathLarge' }[size] || 'dogBathMedium';
    if (base === 'dogBathMedium' && !size) notes.push("I've assumed a medium-sized dog (25–60 lb). Let us know if your dog is smaller or bigger and we'll adjust the price.");
  } else if (matted && (is('heavyMats') || is('lion'))) {
    base = 'lionCut';
  } else if (is('lion') && wantsCut) {
    base = 'lionCut';
  } else if (shedding) {
    base = 'deShed';
  } else if (matted || dirty || wantsCut || fleas || itchy) {
    base = 'catBath';
  }
  const baseReasons = {
    puppyGroom: 'a short, gentle first groom to get your puppy used to the routine',
    dogFullGroom: 'a bath, haircut, nail trim and ear cleaning in one visit',
    dogBathSmall: 'a deep clean and full brush-out sized for a small dog',
    dogBathMedium: 'a deep clean and full brush-out',
    dogBathLarge: 'a deep clean and full brush-out sized for a large dog',
    lionCut: 'a short body clip that removes the mats without painful brushing',
    deShed: 'removes the loose undercoat so there is far less fur around the house',
    catBath: 'a cat-safe bath, low-noise dry and full brush-out (nail trim included)',
  };
  if (base) add(base, baseReasons[base]);

  if (matted && base !== 'lionCut') add('dematting', 'to gently work out the mats before they pull on the skin');
  if (fleas) add('fleaBath', 'treats the fleas or ticks on your pet today');
  if (fleas) notes.push('The flea bath treats current fleas only. Ask your vet about ongoing prevention.');
  if (itchy && !fleas) notes.push('If the itching continues after a bath, it\'s worth a check-up with your vet.');

  if (!isDog && is('sanitary')) {
    add('sanitary', 'keeps the back end clean and comfortable');
    findings.push('a messy back end');
  }

  // Nails, ears, teeth
  const nailsIncluded = ['dogFullGroom', 'puppyGroom', 'catBath', 'lionCut', 'deShed'].includes(base);
  if (is('nails')) {
    findings.push('long nails');
    if (!nailsIncluded) add(is('grind') ? 'nailGrind' : 'nailTrim', 'shortens the nails so walking is comfortable again');
  }
  if (RULES.earInfection.test(t)) {
    notes.push('Redness, discharge or a bad smell from the ears can mean an infection. We can\'t treat that, so please see your vet first.');
    findings.push('ears that may need a vet');
  } else if (is('ears')) {
    findings.push('ears that need attention');
    if (base !== 'dogFullGroom' && base !== 'puppyGroom') add('ears', 'cleans out wax and debris');
  }
  if (is('teeth')) {
    findings.push('bad breath or teeth that need care');
    add('teeth', 'freshens breath with pet-safe enzymatic toothpaste');
    if (is('dentalWork')) notes.push('Teeth brushing freshens breath but doesn\'t remove tartar. A full dental cleaning needs a vet.');
  }

  // Vaccines
  if (is('vaccine')) {
    findings.push('vaccines that are due');
    if (isDog) {
      if (is('rabiesOnly') && !/dhpp|distemper|shots|vaccines/.test(t)) {
        add('dogRabies', 'required by law and for grooming');
      } else {
        add('dogRabies', 'required by law and for grooming');
        add('dhpp', 'core protection against distemper and parvo');
      }
      if (is('boarding')) add('bordetella', 'needed for boarding, daycare and dog parks');
      if (is('outdoors')) add('lepto', 'recommended for dogs that spend time near water or wildlife');
    } else {
      add('catRabies', 'required by law and for grooming');
      if (!(is('rabiesOnly') && !/fvrcp|distemper|shots|vaccines/.test(t))) add('fvrcp', 'core protection for every cat');
      if (is('outdoorCat')) add('felv', 'recommended for cats that go outside or live with other cats');
    }
    if (young) notes.push(`${isDog ? 'Puppies' : 'Kittens'} need a series of boosters a few weeks apart. Each dose is priced separately.`);
  }

  // Comfort
  if (anxious) {
    findings.push('some nerves');
    if (!isDog && base) add('calmCat', 'extra time and breaks in a quiet, dog-free room');
    if (isDog) notes.push("We'll take things slowly with your dog and use fear-free handling, with breaks whenever needed.");
  }

  if (!items.length) {
    add('meetGreet', "a free visit so we can see your pet in person and recommend exactly what they need");
    if (!findings.length) notes.push('Tell me a bit more (coat, nails, ears, teeth or vaccines) and I can be more specific.');
  }

  const total = items.reduce((sum, item) => sum + item.price, 0);
  const hasFrom = items.some((item) => item.from);
  const petWords = isDog
    ? (young ? 'puppy' : `${size ? `${size} ` : ''}dog`)
    : (young ? 'kitten' : 'cat');
  const greeting = newOwner ? 'Welcome to pet ownership!' : 'Thanks!';
  let intro;
  if (findings.length) {
    intro = `${greeting} It sounds like you have a ${petWords} with ${listJoin(unique(findings))}. Here's what I'd recommend:`;
  } else if (newOwner) {
    intro = `${greeting} The best first step for your new ${petWords} is a relaxed visit with us:`;
  } else {
    intro = `Thanks for telling me about your ${petWords}! I couldn't spot a specific issue, so here's where I'd start:`;
  }
  return { intro, items, notes, total, hasFrom };
}

function unique(list) { return [...new Set(list)]; }

function listJoin(list) {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

function money(amount) { return amount === 0 ? 'Free' : `$${amount}`; }

/* ---------- Chat UI ---------- */

const log = document.getElementById('chat-log');
const form = document.getElementById('assistant-form');
const input = document.getElementById('assistant-input');
const chips = document.getElementById('chips');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let pendingDescription = null;
let busy = false;

function addMessage(role) {
  const message = document.createElement('div');
  message.className = `msg ${role}`;
  log.append(message);
  log.scrollTop = log.scrollHeight;
  return message;
}

function addUserMessage(text) {
  const p = document.createElement('p');
  p.textContent = text;
  addMessage('user').append(p);
}

async function typeInto(element, text) {
  const tokens = text.split(/(\s+)/);
  for (const token of tokens) {
    element.textContent += token;
    log.scrollTop = log.scrollHeight;
    if (token.trim()) await sleep(18 + Math.random() * 30);
  }
}

async function thinking() {
  const bubble = addMessage('bot typing');
  bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  await sleep(900 + Math.random() * 900);
  bubble.remove();
}

async function askSpecies(description) {
  pendingDescription = description;
  await thinking();
  const message = addMessage('bot');
  const p = document.createElement('p');
  message.append(p);
  await typeInto(p, 'Happy to help! Just to make sure I recommend the right services, is your pet a dog or a cat?');
  const choices = document.createElement('div');
  choices.className = 'quick-replies';
  ['Dog', 'Cat'].forEach((species) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = species;
    button.addEventListener('click', () => {
      choices.remove();
      respond(`It's a ${species.toLowerCase()}.`, species);
    });
    choices.append(button);
  });
  message.append(choices);
  log.scrollTop = log.scrollHeight;
}

async function showRecommendation(result, species) {
  await thinking();
  const message = addMessage('bot');
  const intro = document.createElement('p');
  message.append(intro);
  await typeInto(intro, result.intro);

  const table = document.createElement('table');
  table.className = 'estimate';
  const tbody = document.createElement('tbody');
  table.append(tbody);
  message.append(table);
  for (const item of result.items) {
    await sleep(220);
    const row = tbody.insertRow();
    const nameCell = row.insertCell();
    const name = document.createElement('strong');
    name.textContent = item.name;
    const reason = document.createElement('span');
    reason.className = 'reason';
    reason.textContent = item.reason;
    nameCell.append(name, reason);
    const priceCell = row.insertCell();
    priceCell.className = 'amount';
    priceCell.textContent = (item.from ? 'from ' : '') + money(item.price);
    log.scrollTop = log.scrollHeight;
  }
  await sleep(250);
  const foot = table.createTFoot().insertRow();
  foot.insertCell().textContent = 'Estimated total';
  const totalCell = foot.insertCell();
  totalCell.className = 'amount';
  totalCell.textContent = (result.hasFrom ? 'from ' : '') + money(result.total);

  for (const note of result.notes) {
    const p = document.createElement('p');
    p.className = 'note';
    message.append(p);
    await typeInto(p, note);
  }

  const params = new URLSearchParams({ pet: species });
  result.items.forEach((item) => params.append('services', item.book));
  const link = document.createElement('a');
  link.className = 'btn';
  link.href = `book.html?${params}`;
  link.textContent = 'Book these services';
  message.append(link);
  log.scrollTop = log.scrollHeight;
}

async function respond(text, speciesAnswer) {
  if (busy) return;
  busy = true;
  chips.hidden = true;
  addUserMessage(text);
  try {
    const description = speciesAnswer ? pendingDescription : text;
    const species = speciesAnswer
      || (RULES.cat.test(description) && !RULES.dog.test(description) ? 'Cat' : null)
      || (RULES.dog.test(description) && !RULES.cat.test(description) ? 'Dog' : null);
    if (!species) {
      await askSpecies(description);
      return;
    }
    pendingDescription = null;
    await showRecommendation(analyze(description, species), species);
  } finally {
    busy = false;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  respond(text);
});

input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

chips.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => respond(chip.textContent.trim()));
});
