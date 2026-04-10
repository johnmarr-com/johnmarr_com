export interface SecretMessage {
  id: string;
  /** Template with {0}–{14} placeholders. Truncatable at clause boundaries. */
  template: string;
  /** 4–15 elements. First 4 always produce a complete sentence. */
  elements: string[];
  minElements: 4;
}

/**
 * Select a message for the given player count.
 * Trims elements and template to exactly `count` placeholders.
 */
export function pickMessage(playerCount: number): {
  template: string;
  elements: string[];
  sourceId: string;
} {
  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]!;
  const count = Math.max(msg.minElements, Math.min(playerCount, msg.elements.length));
  const elements = msg.elements.slice(0, count);

  const maxPlaceholder = `{${count - 1}}`;
  let template = msg.template;
  const idx = template.indexOf(maxPlaceholder);
  if (idx !== -1) {
    let end = idx + maxPlaceholder.length;
    while (end < template.length && template[end] !== "{") end++;
    template = template.slice(0, end).replace(/[,\s]+$/, "").trimEnd();
    if (!/[.!?]$/.test(template)) template += ".";
  }

  return { template, elements, sourceId: msg.id };
}

const MESSAGES: SecretMessage[] = [
  {
    id: "msg-001",
    template: 'The "{0}" with the "{1}" on his face is meeting "{2}" in the "{3}" at the corner of "{4}" street and "{5}" drive, carrying a "{6}" in a "{7}" briefcase, while wearing a "{8}" on his head, whistling the tune of "{9}", accompanied by a trained "{10}" on a leash, with a tattoo of a "{11}" on his arm, holding a ticket to "{12}", signed under the alias "{13}", and tipping exactly "{14}" dollars.',
    elements: ["Tall Butler", "Curly Mustache", "The Secretary", "Theater", "River", "Pineapple", "Golden Key", "Purple Velvet", "Cowboy Hat", "Happy Birthday", "Penguin", "Anchor", "Paris", "Nightshade", "Thirteen"],
    minElements: 4,
  },
  {
    id: "msg-002",
    template: 'Agent "{0}" will arrive on a "{1}" at the "{2}" near the "{3}", disguised as a "{4}" with a "{5}" pinned to their lapel, exchanging a "{6}" for a "{7}", during the "{8}" festival, while humming "{9}", spotted by a lookout in a "{10}", holding a "{11}" in one hand, near a "{12}" statue, under the codename "{13}", at precisely "{14}" o\'clock.',
    elements: ["Silver Fox", "Red Bicycle", "Lighthouse", "Old Bridge", "Mailman", "Sunflower", "Briefcase of Cash", "Skeleton Key", "Harvest Moon", "Jingle Bells", "Hot Air Balloon", "Magnifying Glass", "Dolphin", "Phantom", "Three"],
    minElements: 4,
  },
  {
    id: "msg-003",
    template: 'The "{0}" is hidden inside a "{1}" at the "{2}" behind the "{3}", guarded by a "{4}" who owns a "{5}", wrapped in "{6}" paper, sealed with a "{7}" stamp, buried under a pile of "{8}", only retrievable during a "{9}", visible from the "{10}", marked with a "{11}" symbol, near the "{12}" fountain, delivered by "{13}", before the stroke of "{14}".',
    elements: ["Diamond Microfilm", "Hollow Book", "Library", "Clock Tower", "One-Eyed Chef", "Parrot", "Newspaper", "Wax Skull", "Pumpkins", "Thunderstorm", "Ferris Wheel", "Crescent Moon", "Mermaid", "The Dentist", "Midnight"],
    minElements: 4,
  },
  {
    id: "msg-004",
    template: 'Our contact "{0}" is posing as a "{1}" at the "{2}" in "{3}", eating a "{4}" with a "{5}" on the side, reading a book about "{6}", seated next to a "{7}", with a "{8}" tattoo on their wrist, scheduled to leave on the "{9}" train, transporting a "{10}" in their suitcase, having previously visited the "{11}", operating under "{12}" protocol, tailed by "{13}", departing at "{14}" sharp.',
    elements: ["Velvet Viper", "Pizza Chef", "Grand Hotel", "Venice", "Giant Pretzel", "Chocolate Milkshake", "Dinosaurs", "Man in a Tuxedo", "Spider Web", "Orient Express", "Snow Globe", "Eiffel Tower", "Cobalt", "The Twins", "Seven"],
    minElements: 4,
  },
  {
    id: "msg-005",
    template: 'A "{0}" containing "{1}" was left at the "{2}" by "{3}", wrapped in a "{4}", smelling of "{5}", addressed to someone called "{6}", tagged with a drawing of a "{7}", to be picked up during the "{8}" parade, by someone wearing "{9}", arriving in a "{10}", followed by a "{11}", next to the "{12}" shop, using passphrase "{13}", exactly "{14}" minutes after sunset.',
    elements: ["Wooden Crate", "Stolen Blueprints", "Train Station", "Madame Noir", "Red Scarf", "Cinnamon", "The Professor", "Octopus", "Winter Carnival", "Cowboy Boots", "Yellow Taxi", "Stray Cat", "Bakery", "Elephant Tango", "Forty-Five"],
    minElements: 4,
  },
  {
    id: "msg-006",
    template: 'The spy known as "{0}" has a "{1}" hidden in their "{2}" at the "{3}", protected by a "{4}" alarm, visible only with "{5}" glasses, next to a photograph of a "{6}", behind a painting of a "{7}", in a room that smells like "{8}", with the window facing the "{9}", above a "{10}" restaurant, across from the "{11}", containing instructions for "{12}", signed by "{13}", effective until "{14}" day.',
    elements: ["Ghost Hawk", "Tiny Camera", "Umbrella Handle", "Embassy", "Laser Grid", "Infrared", "Clown", "Mountain Sunset", "Fresh Roses", "Harbor", "Sushi", "Cathedral", "Operation Iceberg", "Colonel Mustard", "Election"],
    minElements: 4,
  },
  {
    id: "msg-007",
    template: '"{0}" will signal by wearing a "{1}" to the "{2}" at the "{3}", ordering exactly one "{4}" and two "{5}", sitting at table "{6}", facing the "{7}" window, tapping their "{8}" three times, waiting for a response from "{9}", who will be carrying a "{10}", disguised as a "{11}", near the stage playing "{12}", using the drop-box marked "{13}", on the night of the "{14}".',
    elements: ["Crimson Falcon", "Bow Tie", "Masquerade Ball", "Opera House", "Martini", "Breadsticks", "Thirteen", "Stained Glass", "Ring Finger", "Agent Whiskers", "Violin Case", "Waiter", "Swan Lake", "Lost and Found", "Full Moon"],
    minElements: 4,
  },
  {
    id: "msg-008",
    template: 'A "{0}" operative disguised as a "{1}" will board the "{2}" from "{3}", carrying a "{4}" filled with "{5}", wearing a "{6}" in their breast pocket, sitting in car number "{7}", next to a passenger reading about "{8}", alighting at the "{9}" stop, greeted by a "{10}" driver, heading to the "{11}", to deliver a message about "{12}", encrypted with "{13}" cipher, valid for "{14}" hours.',
    elements: ["Rogue Nation", "Nun", "Midnight Ferry", "Istanbul", "Lunch Box", "Microchips", "Red Carnation", "Seven", "Ancient Egypt", "Foggy Pier", "Limousine", "Safe House", "The Missile Codes", "Caesar", "Twenty-Four"],
    minElements: 4,
  },
  {
    id: "msg-009",
    template: 'Intercept "{0}" at the "{1}" near "{2}" before they reach "{3}", identified by their "{4}" and their habit of "{5}", accompanied by a "{6}" who goes by "{7}", last seen purchasing a "{8}" from a street vendor, heading toward the "{9}", reportedly carrying a "{10}", linked to the "{11}" incident, under orders from "{12}", using transport marked with a "{13}", expected to arrive during the "{14}".',
    elements: ["The Chemist", "Flea Market", "Central Park", "The Airport", "Limp", "Whistling Opera", "Bodyguard", "Tiny Tornado", "Snow Cone", "Subway Entrance", "Poison Vial", "Embassy Break-In", "The General", "Skull and Crossbones", "Rush Hour"],
    minElements: 4,
  },
  {
    id: "msg-010",
    template: 'The package from "{0}" contains a "{1}" wrapped in "{2}" hidden at the "{3}", accessible only through the "{4}" entrance, past the "{5}" display, under the "{6}" exhibit, guarded by someone with a "{7}", during the "{8}" celebration, accompanied by music from a "{9}", visible beneath a "{10}", adjacent to the "{11}" hall, decoded using a "{12}", authorized by "{13}", before "{14}" arrives.',
    elements: ["Havana Station", "USB Drive", "Silk Handkerchief", "Museum", "Underground", "Dinosaur Skeleton", "Egyptian Mummy", "Glass Eye", "New Year's Eve", "Jazz Band", "Chandelier", "Ballroom", "Decoder Ring", "The Director", "Sunrise"],
    minElements: 4,
  },
  {
    id: "msg-011",
    template: '"{0}" has been compromised at the "{1}" in "{2}" by "{3}", who was seen wearing a "{4}", holding a "{5}", near the "{6}" stall, speaking in "{7}" to a man with a "{8}", while a "{9}" played in the background, under a banner reading "{10}", beside a "{11}", waiting for a ship called the "{12}", carrying forged "{13}", heading to "{14}".',
    elements: ["Shadowfax", "Casino", "Monte Carlo", "The Contessa", "Feathered Mask", "Champagne Flute", "Roulette", "French", "Monocle", "Saxophone", "Lucky Seven", "Rose Garden", "Black Swan", "Passports", "Buenos Aires"],
    minElements: 4,
  },
  {
    id: "msg-012",
    template: 'Deliver the "{0}" to "{1}" at the "{2}" in "{3}", hidden inside a "{4}", marked with a "{5}" sticker, between the hours of "{6}" and "{7}", while wearing a "{8}", and ordering a "{9}" to signal readiness, near the "{10}" painting, beneath the "{11}" balcony, overseen by "{12}", countersigned by "{13}", before the "{14}" deadline.',
    elements: ["Cipher Disk", "Madame Papillon", "Rooftop Bar", "Hong Kong", "Birthday Cake", "Smiley Face", "Eight", "Eleven", "Hawaiian Shirt", "Coconut Smoothie", "Starry Night", "Penthouse", "The Watchmaker", "Agent Zero", "Thursday"],
    minElements: 4,
  },
  {
    id: "msg-013",
    template: 'A "{0}" will appear at the "{1}" disguised as a "{2}" from "{3}", identifiable by their "{4}", performing a "{5}", to swap a "{6}" for a "{7}", while the "{8}" provides cover, underneath the "{9}" banner, observed by "{10}" from the "{11}", connected to "{12}" intelligence, using handle "{13}", with a window of "{14}" minutes.',
    elements: ["Double Agent", "Charity Gala", "Magician", "Moscow", "Top Hat", "Card Trick", "Music Box", "Encrypted Phone", "Fireworks Show", "Grand Opening", "Satellite Team", "Control Tower", "Eastern Bloc", "Houdini", "Ninety"],
    minElements: 4,
  },
  {
    id: "msg-014",
    template: '"{0}" left a "{1}" at the "{2}" inside a "{3}", recognizable by the "{4}" emblem, stored next to a shelf of "{5}", under a flickering "{6}" light, reachable via the "{7}" staircase, after passing a "{8}" mural, guarded by a "{9}" system, adjacent to the "{10}" office, containing plans for "{11}", verified by "{12}", classified as "{13}", expiring on "{14}".',
    elements: ["The Architect", "Rolled-Up Map", "Antique Shop", "Grandfather Clock", "Compass Rose", "Old Vinyl Records", "Neon", "Spiral", "Dragon", "Fingerprint Scanner", "Harbormaster's", "The Submarine", "Interpol", "Top Secret", "Friday the 13th"],
    minElements: 4,
  },
  {
    id: "msg-015",
    template: 'Our source "{0}" reports a "{1}" being transported by "{2}" through the "{3}", packed in a crate of "{4}", sealed with "{5}" wax, guarded by agents in "{6}" uniforms, traveling along the "{7}" route, stopping at a "{8}" warehouse, near a "{9}" billboard, identified by a "{10}" mark on the door, containing intel on "{11}", linked to "{12}", under protocol "{13}", arriving by "{14}".',
    elements: ["Blue Sparrow", "Nuclear Formula", "The Courier", "Silk Road", "Oranges", "Black", "Postal Service", "Coastal Highway", "Frozen Fish", "Neon Flamingo", "Chalk X", "Satellite Launch", "The Syndicate", "Omega", "Dawn"],
    minElements: 4,
  },
  {
    id: "msg-016",
    template: 'The informant known as "{0}" will meet "{1}" at the "{2}" in "{3}", both wearing "{4}" on their left hand, exchanging a "{5}" for coordinates to the "{6}", written on the back of a "{7}", near a vendor selling "{8}", while a street performer plays "{9}", overlooked by a "{10}" camera, across from a "{11}" sign, part of "{12}" network, codenamed "{13}", at "{14}" hours.',
    elements: ["Canary", "The Banker", "Flower Market", "Amsterdam", "Blue Gloves", "Locket", "Hidden Vault", "Postcard", "Hot Chestnuts", "Accordion Music", "Security", "Windmill", "Underground Railroad", "Tulip", "Fourteen Hundred"],
    minElements: 4,
  },
  {
    id: "msg-017",
    template: '"{0}" intercepted a "{1}" from "{2}" at the "{3}", concealed in a "{4}", decorated with "{5}", found beneath a table of "{6}", beside a "{7}" arrangement, during the "{8}" ceremony, captured on a "{9}" device, reported to "{10}", forwarded through the "{11}" channel, pertaining to "{12}", grade "{13}", timestamped at "{14}".',
    elements: ["Iron Veil", "Voice Recording", "The Ambassador", "Peace Summit", "Hollow Pen", "Gold Leaf", "Champagne Glasses", "Floral", "Award", "Hidden Microphone", "HQ", "Diplomatic Pouch", "Troop Movements", "Alpha One", "Twenty-Three Hundred"],
    minElements: 4,
  },
  {
    id: "msg-018",
    template: 'A "{0}" agent will be stationed at the "{1}" wearing a "{2}" and reading "{3}", seated near the "{4}" fountain, drinking "{5}" from a "{6}" cup, waiting for a signal from a "{7}" on the rooftop, to activate the "{8}" protocol, retrieving a "{9}" from locker "{10}", destined for the "{11}" office, regarding "{12}", cleared by "{13}", no later than "{14}".',
    elements: ["Sleeper Cell", "Botanical Garden", "Trench Coat", "War and Peace", "Koi Fish", "Earl Grey Tea", "Porcelain", "Pigeon", "Blackout", "Hard Drive", "Forty-Two", "Prime Minister's", "Trade Secrets", "Oversight Committee", "Noon"],
    minElements: 4,
  },
  {
    id: "msg-019",
    template: 'The target "{0}" is hosting a "{1}" at their "{2}" in "{3}", with a "{4}" as the centerpiece, surrounded by guests wearing "{5}", entertainment provided by a "{6}", catered with "{7}", while secretly meeting "{8}" in the "{9}" room, exchanging a "{10}" for a "{11}", photographed by "{12}", flagged under "{13}" directive, scheduled for "{14}" night.',
    elements: ["Baron Von Trap", "Dinner Party", "Mansion", "Vienna", "Ice Sculpture Swan", "Venetian Masks", "String Quartet", "Lobster Bisque", "The Fence", "Wine Cellar", "Briefcase", "Fake Passport", "Rooftop Sniper", "Red Flag", "Saturday"],
    minElements: 4,
  },
  {
    id: "msg-020",
    template: '"{0}" must retrieve a "{1}" from the "{2}" on "{3}" island, buried under a "{4}", marked by a "{5}" tree, within sight of the "{6}", only accessible at "{7}" tide, using a "{8}" as a digging tool, watched over by "{9}", who signals with a "{10}", connected to the "{11}" operation, classified under "{12}", expiring at "{13}", with extraction via "{14}".',
    elements: ["Neptune", "Waterproof Canister", "Beach", "Crescent", "Sand Castle", "Palm", "Lighthouse", "Low", "Coconut Shell", "The Fisherman", "Mirror Flash", "Poseidon", "Eyes Only", "Sunset", "Speedboat"],
    minElements: 4,
  },
  {
    id: "msg-021",
    template: 'Control reports "{0}" has gone dark at the "{1}" near "{2}" in "{3}", last seen with a "{4}" and a "{5}", talking to a "{6}" about "{7}", near a "{8}" vendor, under a "{9}" awning, wearing "{10}" shoes, in possession of a "{11}", connected to "{12}", status "{13}", last transmission at "{14}".',
    elements: ["Quicksilver", "Bazaar", "The Golden Gate", "San Francisco", "Leather Satchel", "Pocket Watch", "Street Musician", "Weather Patterns", "Pretzel", "Striped", "Red Canvas", "Coded Journal", "Operation Thunderclap", "Compromised", "Oh-Three-Hundred"],
    minElements: 4,
  },
  {
    id: "msg-022",
    template: 'The "{0}" will be smuggled inside a "{1}" aboard the "{2}" departing "{3}", disguised among "{4}" shipments, labeled as "{5}", handled by a crew member named "{6}", stored in hold "{7}", detectable only by "{8}" scanner, bound for the "{9}" port, received by "{10}", part of the "{11}" ring, worth "{12}" on the black market, insured under "{13}", arriving "{14}".',
    elements: ["Prototype Weapon", "Grand Piano", "Cargo Ship", "Shanghai", "Porcelain Vase", "Fragile Antiques", "One-Arm Pete", "Charlie", "X-Ray", "Marseille", "The Collector", "Ivory", "Ten Million", "Lloyds of London", "Christmas Eve"],
    minElements: 4,
  },
];
