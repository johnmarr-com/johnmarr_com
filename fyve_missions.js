// ============================================================
// FYVE — Mission Pack 1
// fyve_missions.js
// All image URLs are placeholders — populate via Heist Builder
//
// ASSET NOTE: Each mission has exactly 7 assets.
// At session start, all 7 are drawn. Both syndicates race
// to collect the same 7 assets — rendered in their team color.
// Only 7 card images need to be generated per mission.
// ============================================================

const missionPrime = {
  id: "mission_prime",
  title: "The Ares Powder",
  briefing: "In 2031 the Ares IV survey crew discovered a rust-colored mineral compound in the Hellas Basin that nobody could explain and nobody was supposed to find. A rogue cosmetic chemist on the crew ran unauthorized tests for six months before anyone noticed. One gram. Indefinitely. Complete cellular age arrest. The formula exists on a single encrypted chip locked in the Ares IV crew module — still on Mars, still transmitting, still guarded by Dr. Yeva Marchenko, the crew member who stayed behind and has not responded to a single communication in fourteen months. You are not going to Mars. You are going to Lunar Gateway — the relay station in lunar orbit holding the only uplink capable of remote-accessing the lander's lockbox and transmitting the formula to Earth. The powder never leaves Mars. The formula is everything. Dr. Marchenko will notice. You have one window before she does.",
  backgroundImageUrl: "",
  targetObjectImageUrl: "",

  setting: {
    location: "Lunar Gateway Station — Lunar Orbit, 2031",
    era: "Near Future — 2031",
    atmosphere: "Recycled air. Microgravity. The blue-white curve of Earth through a porthole that nobody has time to look at. Somewhere 140 million miles away a woman who knows exactly what you are doing is watching a screen and deciding whether to let you."
  },

  clients: {
    syndicate1: {
      benefactor: "Externe Labs",
      motivation: "A Swiss biocosmetic firm whose tagline is 'Age is a choice.' Nobody knows who funds them. Nobody has met their CEO in person. Their headquarters has no listed address. They have been waiting for this formula since before anyone knew the formula existed."
    },
    syndicate2: {
      benefactor: "Kylie Jenner",
      motivation: "Built a billion-dollar empire on the premise of better skin. This isn't business. This is personal. This has always been personal."
    }
  },

  assets: [
    { id: "asset_prime_1", name: "THE UPLINK CODE", description: "A 64-character alphanumeric sequence authorizing remote access to the Ares IV lockbox. Obtained from a NASA contractor who has since taken an unexpected sabbatical.", imageUrl: "" },
    { id: "asset_prime_2", name: "THE LAUNCH WINDOW", description: "A 9-minute orbital alignment during which Lunar Gateway has unobstructed line-of-sight to the Hellas Basin. Occurs once every 31 hours. This is the one.", imageUrl: "" },
    { id: "asset_prime_3", name: "THE CHEMIST", description: "Can receive, decode, and synthesize the formula on Earth within hours of transmission. Has signed nothing. Knows everything. Trusts nobody and considers this professionally appropriate.", imageUrl: "" },
    { id: "asset_prime_4", name: "THE STATION ACCESS", description: "Legitimate crew rotation credentials placing your operative aboard Lunar Gateway as a visiting systems engineer. The real systems engineer is on medical leave. He is fine. Mostly.", imageUrl: "" },
    { id: "asset_prime_5", name: "THE SIGNAL MASK", description: "Disguises the uplink transmission as routine telemetry data. Buys approximately 4 minutes before Dr. Marchenko's monitoring software flags the anomaly. 4 minutes is enough. 4 minutes and 12 seconds is not.", imageUrl: "" },
    { id: "asset_prime_6", name: "THE EXTRACTION BURN", description: "A prescheduled resupply vessel departure that nobody will question and everybody will ignore. Your operative is on it before the transmission completes its final handshake.", imageUrl: "" },
    { id: "asset_prime_7", name: "THE DEAD DROP", description: "An encrypted Earth-side receiver registered to a shell company registered to another shell company registered to a very patient lawyer in Luxembourg. The formula arrives here first.", imageUrl: "" }
  ],

  civilians: [
    { id: "civ_prime_1", name: "THE FLIGHT SURGEON", description: "Conducting routine crew health assessments aboard the station. Has a schedule, a stethoscope, and an uncomfortable habit of appearing in corridors immediately after something happens.", imageUrl: "" },
    { id: "civ_prime_2", name: "THE JOURNALIST", description: "First civilian media embed on Lunar Gateway, filing human interest pieces about life in lunar orbit. Has a camera. Has instincts. Has been following your operative around all morning calling it a 'candid documentary style.'", imageUrl: "" },
    { id: "civ_prime_3", name: "THE COSMONAUT", description: "Russian crew member on his fourth rotation. Speaks four languages, sleeps three hours a night, and has memorized every sound this station makes. Something sounds different today.", imageUrl: "" },
    { id: "civ_prime_4", name: "THE INTERN", description: "A 24-year-old mission support specialist on his first off-Earth rotation, enthusiastic beyond all reasonable measure. Has introduced himself to your operative four times. Remembers everything about each conversation.", imageUrl: "" },
    { id: "civ_prime_5", name: "DR. MARCHENKO", description: "She is still on Mars. She is 140 million miles away. She is watching your uplink request process in real time and she has not moved in six minutes. This card should not have been drawn. Something is wrong.", imageUrl: "" }
  ],

  bomb: {
    name: "THE BOMB",
    description: "Freeze. Nobody move.",
    imageUrl: "",
    soundEffect: "freeze_fbi"
  },

  words: {
    tier1: [
      "MARS", "ARES", "FORMULA", "UPLINK", "ORBITAL",
      "GATEWAY", "POWDER", "COMPOUND", "LANDER", "BASIN",
      "TELEMETRY", "MODULE", "LOCKBOX", "RELAY", "HELIX",
      "SYNTHESIS", "CRATER", "TRANSMISSION", "LUNAR", "MARCHENKO"
    ],
    tier2: [
      "WINDOW",   "BURN",     "DUST",     "STATION",  "SUIT",
      "GRAVITY",  "DARK",     "SKIN",     "COLD",     "DEAD",
      "ROTATION", "PRESSURE", "SIGNAL",   "LOCK",     "RUST",
      "SERUM",    "TRACE",    "SAMPLE",   "AGING",    "MASK"
    ],
    tier3: [
      "DUNE", "SPICE", "YEVA", "FOUR", "NINE",
      "ORBIT", "ROUGE", "FOREVER", "GRAM", "SILENT"
    ]
  }
}

// ============================================================

const mission1 = {
  id: "mission_1",
  title: "Napoleon's Thumb",
  briefing: "Napoleon's preserved thumb is worth $500 million at auction, prized for its power to emanate military genius. It is locked under military guard on a French Légion Étrangère base in Paris. Two syndicates. One thumb. Whoever gets there first rewrites history.",
  backgroundImageUrl: "",
  targetObjectImageUrl: "",

  setting: {
    location: "Légion Étrangère Military Base, Paris, France",
    era: "Present Day",
    atmosphere: "Rain-slicked cobblestones. Military checkpoints. The faint smell of gunpowder and old money."
  },

  clients: {
    syndicate1: {
      benefactor: "Elon Musk",
      motivation: "Has publicly stated he'd like to make better decisions. His team will not confirm or deny the acquisition."
    },
    syndicate2: {
      benefactor: "The Vatican",
      motivation: "Officially for preservation. Unofficially someone very high up believes it. They've believed stranger things."
    }
  },

  assets: [
    { id: "asset_1_1", name: "THE FORGED ORDERS", description: "Military transfer paperwork authorizing specimen relocation.", imageUrl: "" },
    { id: "asset_1_2", name: "THE INSIDE GUARD", description: "A Légion Étrangère sergeant with gambling debts and flexible ethics.", imageUrl: "" },
    { id: "asset_1_3", name: "THE RELIC CASE", description: "A climate-controlled transport container. For the thumb.", imageUrl: "" },
    { id: "asset_1_4", name: "THE HISTORIAN", description: "Authenticates on sight. Doesn't ask questions. Has never asked a question.", imageUrl: "" },
    { id: "asset_1_5", name: "THE DISTRACTION", description: "A geopolitical incident. Small but convincing. Don't ask how.", imageUrl: "" },
    { id: "asset_1_6", name: "THE EXTRACTION ROUTE", description: "Underground. Pre-Napoleon era, ironically.", imageUrl: "" },
    { id: "asset_1_7", name: "THE FENCE", description: "A private collector who will never display it publicly. Or display anything, really.", imageUrl: "" }
  ],

  civilians: [
    { id: "civ_1_1", name: "THE CHAPLAIN", description: "The base's aging priest. Has administered last rites to the specimen room twice. Considers this normal.", imageUrl: "" },
    { id: "civ_1_2", name: "THE ARCHIVIST", description: "A civilian historian with legitimate clearance, cataloguing Napoleonic artifacts for the Musée de l'Armée. Deeply suspicious of everyone.", imageUrl: "" },
    { id: "civ_1_3", name: "THE CATERER", description: "Runs the officer's mess. Has fed every ranking official on base for 22 years. Completely invisible to them.", imageUrl: "" },
    { id: "civ_1_4", name: "THE ATTACHÉ", description: "A junior diplomatic aide processing paperwork between the base and the Ministry of Defense. Knows every corridor. Notices everything.", imageUrl: "" },
    { id: "civ_1_5", name: "THE WIDOW", description: "Wife of a decorated Légionnaire, on base for a memorial ceremony. Unexpectedly present in exactly the wrong corridor at exactly the wrong time.", imageUrl: "" }
  ],

  bomb: {
    name: "THE BOMB",
    description: "Freeze. Nobody move.",
    imageUrl: "",
    soundEffect: "freeze_fbi"
  },

  words: {
    tier1: [
      "NAPOLEON", "THUMB", "LEGION", "PARIS", "EMPEROR",
      "RELIC", "BONE", "VAULT", "MEDAL", "DECREE",
      "GLORY", "EXILE", "WATERLOO", "CORSICA", "MONUMENT",
      "MARSHAL", "GARRISON", "BARRACKS", "SENTRY", "SPECIMEN"
    ],
    tier2: [
      "MARCH", "RANK", "ORDERS", "COMMISSION", "CHARGE",
      "CAMPAIGN", "DISPATCH", "FLANK", "RETREAT", "TRANSFER",
      "EAGLE", "CIPHER", "BLADE", "COURT", "PENSION",
      "CHAPEL", "ARCHIVE", "FORGE", "PLANT", "BANNER"
    ],
    tier3: [
      "COMPLEX", "HAND", "ISLAND", "LITTLE", "SHORT",
      "FINGER", "CROWN", "GLOVE", "GRANDE", "DIET"
    ]
  }
}

// ============================================================

const mission2 = {
  id: "mission_2",
  title: "The Sunflower",
  briefing: "A newly discovered Van Gogh — painted with the tip of his severed ear — has eclipsed every other work of art with its tortured beauty. Authenticated last Tuesday. Locked in the Louvre's private vault by Wednesday. The art world has not slept since. Neither have you.",
  backgroundImageUrl: "",
  targetObjectImageUrl: "",

  setting: {
    location: "The Louvre, Paris, France",
    era: "Present Day",
    atmosphere: "Marble floors. Motion sensors. The quiet hum of climate control keeping a dead man's obsession at exactly 21 degrees."
  },

  clients: {
    syndicate1: {
      benefactor: "Taylor Swift",
      motivation: "Has been quietly acquiring generational art since 2019. Considers this one personal."
    },
    syndicate2: {
      benefactor: "Kanye West",
      motivation: "Also considers this one personal. Neither team knows about the other. This information should not leave this room."
    }
  },

  assets: [
    { id: "asset_2_1", name: "THE FORGERY", description: "Indistinguishable from the original. Painted with similar levels of anguish. Do not ask about the ear.", imageUrl: "" },
    { id: "asset_2_2", name: "THE ART HANDLER", description: "Has moved masterpieces across three continents without a single humidity incident. Works in complete silence.", imageUrl: "" },
    { id: "asset_2_3", name: "THE SECURITY LOOP", description: "47 seconds of clean corridor footage. On repeat. The guard changes at 47.5. This has been accounted for.", imageUrl: "" },
    { id: "asset_2_4", name: "THE MUSEUM CONTACT", description: "Third shift. Underpaid. Morally flexible. Has strong opinions about how the Louvre treats its staff.", imageUrl: "" },
    { id: "asset_2_5", name: "THE RESTORATION PAPERS", description: "Legitimate paperwork authorizing the painting's transfer for conservation. The conservator who signed them doesn't know they signed them.", imageUrl: "" },
    { id: "asset_2_6", name: "THE CLIMATE CASE", description: "Wrong humidity destroys 120-year-old oils in hours. This case ensures that does not happen. Handle it accordingly.", imageUrl: "" },
    { id: "asset_2_7", name: "THE AUTHENTICATOR", description: "Can verify ear provenance on sight. Under pressure. In the dark. Has done it before and will not discuss that either.", imageUrl: "" }
  ],

  civilians: [
    { id: "civ_2_1", name: "THE DOCENT", description: "A 70-year-old volunteer who has given the same tour for 22 years and will not stop giving it now. Knows every room. Every guard. Every camera angle. Completely unwittingly.", imageUrl: "" },
    { id: "civ_2_2", name: "THE STUDENT", description: "Art school. Sketchbook. Has been drawing the wrong wall for three hours and shows no signs of leaving. Notices everything except that he is in the way.", imageUrl: "" },
    { id: "civ_2_3", name: "THE RESTORER", description: "A painting conservator working late on a completely unrelated piece. Has impeccable hearing and an unfortunate habit of walking the corridor at irregular intervals.", imageUrl: "" },
    { id: "civ_2_4", name: "THE JOURNALIST", description: "Writing a puff piece on Louvre security for a travel magazine. The press pass is legitimate. The questions are increasingly specific.", imageUrl: "" },
    { id: "civ_2_5", name: "THE CURATOR", description: "The museum's head of acquisitions. Should not be here at this hour. Is here at this hour. Has been here every night since the painting arrived.", imageUrl: "" }
  ],

  bomb: {
    name: "THE BOMB",
    description: "Freeze. Nobody move.",
    imageUrl: "",
    soundEffect: "freeze_fbi"
  },

  words: {
    tier1: [
      "EAR", "CANVAS", "LOUVRE", "PALETTE", "SUNFLOWER",
      "PIGMENT", "FORGERY", "FRAME", "GALLERY", "MASTERPIECE",
      "AUCTION", "PROVENANCE", "RESTORATION", "EXHIBIT", "OILS",
      "VAULT", "AUTHENTICATION", "BRUSHSTROKE", "PARIS", "ARLES"
    ],
    tier2: [
      "IMPRESSION", "STUDY", "MEDIUM", "SUBJECT", "COMPOSITION",
      "MOVEMENT", "COPY", "WASH", "BLIND", "STROKE",
      "SCHOOL", "ORIGINAL", "STILL", "NEGATIVE", "TRANSFER",
      "RELIEF", "DRAFT", "PITCH", "TENDER", "PERIOD"
    ],
    tier3: [
      "ASYLUM", "BROTHER", "POSTMAN", "WHEAT", "DOCTOR",
      "YELLOW", "WINDOW", "STAR", "LETTER", "SOUTH"
    ]
  }
}

// ============================================================

const mission3 = {
  id: "mission_3",
  title: "The Ghost Chip",
  briefing: "A quantum processor of unknown origin sits in a renovated Cold War bomb shelter beneath the Nevada desert. The company that built it quit collectively on a Tuesday, leaving a terse Post-it note and no documentation. Three governments have tried to acquire it through official channels. All three were politely told it doesn't exist. It exists. It may also be aware that it exists. That part is above your pay grade. Get the chip.",
  backgroundImageUrl: "",
  targetObjectImageUrl: "",

  setting: {
    location: "A renovated 1962 bomb shelter, Nevada Desert — 4 miles east of the Las Vegas Strip",
    era: "Present Day",
    atmosphere: "Fluorescent hum. Recycled air. The distant sound of slot machines through six feet of reinforced concrete. Something in the server room is running calculations nobody programmed."
  },

  clients: {
    syndicate1: {
      benefactor: "Sam Altman",
      motivation: "Says it's for the good of humanity. Has said this before."
    },
    syndicate2: {
      benefactor: "Mark Zuckerberg",
      motivation: "Has not blinked since Tuesday. Wants the chip. Will not say why."
    }
  },

  assets: [
    { id: "asset_3_1", name: "THE BLUEPRINTS", description: "Original 1962 bomb shelter schematics. Never digitized. Obtained from a Nevada county records clerk who asked no questions and accepted vintage baseball cards as payment.", imageUrl: "" },
    { id: "asset_3_2", name: "THE SIGNAL JAM", description: "A 90-second blackout window. Not a second more. After 91 seconds something in the building notices.", imageUrl: "" },
    { id: "asset_3_3", name: "THE TUNNEL ENTRY", description: "A drainage access point beneath the casino next door. Smells exactly like you'd expect. Nobody guards a smell.", imageUrl: "" },
    { id: "asset_3_4", name: "THE TECH HANDLER", description: "The only person alive who can physically move the chip without triggering its failsafe. They left the company on a Tuesday along with everyone else. They've reconsidered.", imageUrl: "" },
    { id: "asset_3_5", name: "THE CLEAN ROOM BAG", description: "Electrostatic shielding rated for quantum-sensitive hardware. One shot. If it fails the chip either fries or gets upset. Neither outcome is acceptable.", imageUrl: "" },
    { id: "asset_3_6", name: "THE INSIDE LINE", description: "Someone on the building's private security rotation. Rotates every six days. Today is day six. This will not be mentioned again.", imageUrl: "" },
    { id: "asset_3_7", name: "THE EXTRACTION", description: "A blacked-out van. A private airstrip. A pilot who has flown stranger cargo and knows better than to ask what's humming in the back.", imageUrl: "" }
  ],

  civilians: [
    { id: "civ_3_1", name: "THE COCKTAIL WAITRESS", description: "From the casino next door. Took a wrong turn during her break. Has worked Vegas for 19 years and is thoroughly unsurpriseable. Is nonetheless slightly surprised.", imageUrl: "" },
    { id: "civ_3_2", name: "THE SECURITY CONSULTANT", description: "Hired last month to assess the bunker's vulnerabilities. Filed a very thorough report. Still on site waiting for someone to read it.", imageUrl: "" },
    { id: "civ_3_3", name: "THE POKER PRO", description: "Staying in the casino above. Followed a hunch through a service corridor. Has built a career on hunches. This one feels different.", imageUrl: "" },
    { id: "civ_3_4", name: "THE ELECTRICIAN", description: "Licensed. Bonded. Doing entirely routine maintenance on the building's backup power grid. Has noticed the backup power grid is doing something very non-routine.", imageUrl: "" },
    { id: "civ_3_5", name: "THE DOCUMENTARIAN", description: "Making a film about Cold War bunkers. Has legitimate permits. Has a camera. Has been in the wrong room for forty minutes and considers this good footage.", imageUrl: "" }
  ],

  bomb: {
    name: "THE BOMB",
    description: "Freeze. Nobody move.",
    imageUrl: "",
    soundEffect: "freeze_fbi"
  },

  words: {
    tier1: [
      "QUANTUM", "PROCESSOR", "BUNKER", "CHIP", "CIRCUIT",
      "SERVER", "NEURAL", "ALGORITHM", "BINARY", "ENCRYPTION",
      "SILICON", "VOLTAGE", "TERMINAL", "PROTOCOL", "SIGNAL",
      "SHELTER", "SENTIENT", "BLUEPRINT", "AIRSTRIP", "STATIC"
    ],
    tier2: [
      "CURRENT", "MEMORY", "NETWORK", "CORE", "BRIDGE",
      "POWER", "DARK", "WINDOW", "DRIVE", "SHELL",
      "PATCH", "CACHE", "MIRROR", "STACK", "CLOUD",
      "THREAD", "NODE", "PORT", "REMOTE", "GHOST"
    ],
    tier3: [
      "ELVIS", "DEALER", "HOUSE", "FOLD", "ODDS",
      "CLOCK", "DEEP", "SLEEPER", "PULSE", "COLD"
    ]
  }
}

// ============================================================

const mission4 = {
  id: "mission_4",
  title: "The Empress Cut",
  briefing: "A 140-carat diamond of impossible clarity, owned across three centuries by 17 actresses and world leaders, each of whom discovered too late that the stone's promise of eternal youth and beauty came with terms and conditions. All 17 were murdered within days of acquisition. There is a war being fought for that kind of life. The stone currently sits in a private vault at Banque Helvetica, Geneva. You are not the only ones going in.",
  backgroundImageUrl: "",
  targetObjectImageUrl: "",

  setting: {
    location: "Banque Helvetica, Geneva, Switzerland",
    era: "Present Day",
    atmosphere: "Marble silence. The smell of old money and neutrality. A building that has survived two world wars by being useful to everyone and loyal to no one."
  },

  clients: {
    syndicate1: {
      benefactor: "Kim Kardashian",
      motivation: "Was warned. Heard the word cursed and said 'how cursed exactly.' Has not stopped calling since."
    },
    syndicate2: {
      benefactor: "The British Royal Family",
      motivation: "They already own half the world's cursed objects. One more changes nothing. The paperwork is already drafted."
    }
  },

  assets: [
    { id: "asset_4_1", name: "THE ACCOUNT NUMBER", description: "Eleven digits. Costs more than most houses to obtain. The man who sold it has already left the country.", imageUrl: "" },
    { id: "asset_4_2", name: "THE DOUBLE", description: "Physically matches the account holder to an unsettling degree. Does not ask why. Prefers not to know.", imageUrl: "" },
    { id: "asset_4_3", name: "THE VAULT ENGINEER", description: "Retired. Bitter. Built the original security system in 1987 and was never properly credited. Has excellent memory and flexible principles.", imageUrl: "" },
    { id: "asset_4_4", name: "THE CLEAN IDENTITY", description: "Passport. Credit history. LinkedIn profile. A life lived entirely on paper since last Thursday. Spotless.", imageUrl: "" },
    { id: "asset_4_5", name: "THE ALARM BYPASS", description: "A four-minute window between automated sweep cycles. Four minutes is enough. Four minutes and thirty seconds is not.", imageUrl: "" },
    { id: "asset_4_6", name: "THE TRANSPORT CASE", description: "Lined. Unmarked. Diplomatic courier insignia. Nobody opens a diplomatic case in Geneva. It is not done.", imageUrl: "" },
    { id: "asset_4_7", name: "THE FENCE", description: "Someone who can move a cursed stone quietly to a client who has been warned and doesn't care. The intersection of those two things is a very small world.", imageUrl: "" }
  ],

  civilians: [
    { id: "civ_4_1", name: "THE PRIVATE BANKER", description: "Has managed this account for eleven years without once asking what the account contains. Today his curiosity is getting the better of him. Terrible timing.", imageUrl: "" },
    { id: "civ_4_2", name: "THE GEMOLOGIST", description: "On site appraising an entirely different collection. Has heard of the Empress Cut her entire career. Cannot hide that she has heard of it. Cannot stop looking at the vault door.", imageUrl: "" },
    { id: "civ_4_3", name: "THE HEIRESS", description: "Legitimate account holder accessing an adjacent vault. Impeccable timing. Is accompanied by two people who are very large and very quiet and very much in the way.", imageUrl: "" },
    { id: "civ_4_4", name: "THE NOTARY", description: "Certifying transfer documents for another client entirely. Has seen everything in thirty years. Says absolutely nothing about any of it.", imageUrl: "" },
    { id: "civ_4_5", name: "THE SECURITY DIRECTOR", description: "Has run the vault's security for three decades. Knows every vulnerability in the system because he personally closed every one of them. Is almost certain he got them all.", imageUrl: "" }
  ],

  bomb: {
    name: "THE BOMB",
    description: "Freeze. Nobody move.",
    imageUrl: "",
    soundEffect: "freeze_fbi"
  },

  words: {
    tier1: [
      "DIAMOND", "EMPRESS", "VAULT", "GENEVA", "CURSE",
      "CARAT", "CLARITY", "FACET", "BEARER", "ACCOUNT",
      "CROWN", "ESTATE", "SOVEREIGN", "MURDER", "BEAUTY",
      "YOUTH", "POLISH", "BRILLIANT", "MARQUISE", "BLOODLINE"
    ],
    tier2: [
      "PRESSURE", "CUT", "SETTING", "BLOOD", "ROCK",
      "INTEREST", "RESERVE", "SEAL", "TRANSFER", "COLD",
      "KEY", "CLEAN", "PRIVATE", "SHADOW", "LEGEND",
      "GLASS", "ANCIENT", "PALE", "FINGER", "MIRROR"
    ],
    tier3: [
      "SEVENTEEN", "NEUTRAL", "WATCH", "ALPINE", "VAIN",
      "IVORY", "TENDER", "IRON", "SEASON", "FORTUNE"
    ]
  }
}

// ============================================================

const mission5 = {
  id: "mission_5",
  title: "Project Chimera",
  briefing: "A Lamborghini concept car — one of one — engineered entirely to run on cold-pressed extra virgin olive oil. 1,200 horsepower. Zero emissions. The exhaust smells like a Tuscan hillside at harvest. The oil must be single-origin, stone-milled, from a 900-year-old grove outside Siena that produces exactly 40 liters per season — the precise amount required to run the engine at full capacity. Built for a sheikh who died before taking delivery, it sat unclaimed in a Sant'Agata shipping manifest for three years before Jay Leno quietly acquired it for his Burbank garage. Leno doesn't know what he has. His security firm does. Two of the world's most competitive men have decided they need this car. You are the only thing standing between them and a very fragrant destiny.",
  backgroundImageUrl: "",
  targetObjectImageUrl: "",

  setting: {
    location: "Jay Leno's Big Dog Garage, Burbank, California",
    era: "Present Day",
    atmosphere: "The smell of motor oil, old leather, and somewhere underneath it all, a faint warm cloud of olive oil that shouldn't be here. Forty cameras. A rotating private security detail. And somewhere inside, Jay Leno is probably talking to a car."
  },

  clients: {
    syndicate1: {
      benefactor: "Gordon Ramsay",
      motivation: "The olive oil angle has made this deeply personal. He will not elaborate. He has hung up three times when asked to elaborate."
    },
    syndicate2: {
      benefactor: "Guy Fieri",
      motivation: "Has already named the car. Has already picked the parking spot. Is not aware there is a competing syndicate. Is going to be devastated."
    }
  },

  assets: [
    { id: "asset_5_1", name: "THE OIL", description: "40 liters. Single-origin. Stone-milled. From a 900-year-old grove outside Siena that produces exactly this much per season. The grove's keeper was not willing to sell. Was made an offer anyway. The oil ships tomorrow.", imageUrl: "" },
    { id: "asset_5_2", name: "THE CAR HANDLER", description: "Has moved exotic vehicles across three continents without a single scratch, a single question, or a single word of small talk. Communicates entirely in head nods.", imageUrl: "" },
    { id: "asset_5_3", name: "THE SECURITY ROSTER", description: "Leno's private firm rotates on a randomized schedule. Someone randomized it less randomly than intended. That someone has been very helpful.", imageUrl: "" },
    { id: "asset_5_4", name: "THE DECOY VEHICLE", description: "Something loud, fast, and attention-grabbing enough to pull every eye off the garage for four minutes. A 1967 Shelby Cobra, borrowed without asking.", imageUrl: "" },
    { id: "asset_5_5", name: "THE TRANSPORT RIG", description: "A custom hydraulic lowboy trailer. Plates change twice en route. The driver has opinions about the car but is professionally committed to keeping them to himself.", imageUrl: "" },
    { id: "asset_5_6", name: "THE INSIDE CREW", description: "One person on the garage staff. A devoted Lamborghini enthusiast who considers what you're doing morally complicated but technically correct.", imageUrl: "" },
    { id: "asset_5_7", name: "THE BUYER'S PAPERWORK", description: "The sheikh's nephew. Furious about the inheritance. Paying double. His lawyers have prepared documentation suggesting the car was never legally Leno's to begin with. They are not wrong.", imageUrl: "" }
  ],

  civilians: [
    { id: "civ_5_1", name: "THE MECHANIC", description: "Leno's personal restoration specialist. Working late on a 1934 Packard in the adjacent bay. Has the hearing of someone who has spent forty years around engines and somehow still has perfect hearing.", imageUrl: "" },
    { id: "civ_5_2", name: "THE CAMERA CREW", description: "Filming an episode of Jay Leno's Garage. Three cameras. A sound boom. A director who keeps asking people to move so he can get a better angle. On site until midnight.", imageUrl: "" },
    { id: "civ_5_3", name: "THE COLLECTOR", description: "A visiting automotive enthusiast given a private tour as a personal favor. Knows more about this car than anyone in the building should. Has been standing near it for a very long time.", imageUrl: "" },
    { id: "civ_5_4", name: "THE INSURANCE ADJUSTER", description: "Here to assess the collection's updated value following a recent acquisition. Has a clipboard. Has questions. Has accidentally wandered into the exact bay you need to be in.", imageUrl: "" },
    { id: "civ_5_5", name: "THE DELIVERY DRIVER", description: "Dropping off a restoration part ordered three weeks ago. Has a dolly, a signature requirement, and absolutely nowhere to be for the next twenty minutes.", imageUrl: "" }
  ],

  bomb: {
    name: "THE BOMB",
    description: "Freeze. Nobody move.",
    imageUrl: "",
    soundEffect: "freeze_fbi"
  },

  words: {
    tier1: [
      "LAMBORGHINI", "PROTOTYPE", "GARAGE", "BURBANK", "SHEIKH",
      "OLIVE", "HARVEST", "HORSEPOWER", "EXHAUST", "CHASSIS",
      "TORQUE", "MANIFEST", "TRANSPORT", "LOWBOY", "SUPERCAR",
      "BLUEPRINT", "BODYWORK", "SIENA", "SUCCESSION", "GROVE"
    ],
    tier2: [
      "HOOD", "CLUTCH", "DRIVE", "SMOKE", "BURN",
      "PLATE", "SHIFT", "PRESS", "FLOOR", "HANDLE",
      "FINE", "EXOTIC", "RESERVE", "CLASSIC", "ENGINE",
      "COVER", "LIFT", "RACE", "RAW", "HEAT"
    ],
    tier3: [
      "FLAVORTOWN", "DONKEY", "STAR", "KITCHEN", "TRIPLE",
      "LEMON", "JAY", "HORSE", "VIRGIN", "ROAR"
    ]
  }
}

// ============================================================

const mission6 = {
  id: "mission_6",
  title: "The Satoshi Cache",
  briefing: "In 2009 an Icelandic hobbyist mined 12,000 Bitcoin on a laptop he kept next to his fish tank. He stored the private keys on a hardware wallet, zipped it inside a Ty Beanie Baby — Princess the Bear, 1997, near-mint — and packed it into a storage unit in Boise, Idaho alongside a broken treadmill and 340 issues of National Geographic. He died last spring. His estate went to auction. Nobody noticed the Beanie Baby. The governor of Idaho noticed the Beanie Baby. The facility has been designated eminent domain for 72 hours under a reason nobody believes. National Guard surrounds the perimeter. The governor's own people are going in at dawn. You are going in tonight.",
  backgroundImageUrl: "",
  targetObjectImageUrl: "",

  setting: {
    location: "SecureStor Self-Storage, Boise, Idaho — Unit 114",
    era: "Present Day",
    atmosphere: "Fluorescent lights over gravel. The smell of dry cardboard and old rubber. National Guard at the perimeter looking deeply confused about why they're here. Somewhere in unit 114, Princess the Bear is sitting on top of a broken treadmill worth four hundred million dollars."
  },

  clients: {
    syndicate1: {
      benefactor: "Warren Buffett",
      motivation: "Has called Bitcoin rat poison for years. Wants it destroyed. This is his official position. His unofficial position paid your retainer."
    },
    syndicate2: {
      benefactor: "Oprah",
      motivation: "She doesn't need the money. She never needs the money. That has never once stopped her."
    }
  },

  assets: [
    { id: "asset_6_1", name: "THE UNIT NUMBER", description: "The facility has 340 units. Only one contains a Beanie Baby worth four hundred million dollars. This number cost more than your first car.", imageUrl: "" },
    { id: "asset_6_2", name: "THE NATIONAL GUARD CONTACT", description: "A corporal. Ideologically conflicted about the governor. Has a four-minute patrol gap on the east perimeter that he will deny creating if asked.", imageUrl: "" },
    { id: "asset_6_3", name: "THE LEGAL COVER", description: "A fabricated eviction dispute against the estate. Buys exactly eleven minutes of legitimate facility access. The lawyer who filed it is on a plane to Lisbon.", imageUrl: "" },
    { id: "asset_6_4", name: "THE BEANIE BABY", description: "Princess the Bear. 1997. Must leave a convincing replica in its place. The governor's people will be looking specifically for this one. They cannot know it has moved.", imageUrl: "" },
    { id: "asset_6_5", name: "THE WALLET CRACKER", description: "The PIN is six digits. They have three guesses before the wallet bricks permanently. They have a theory. It had better be right.", imageUrl: "" },
    { id: "asset_6_6", name: "THE EXTRACTION", description: "Unremarkable. A pickup truck. A storage bin. A Tuesday. The most valuable exit in the history of Idaho will look like a man moving some boxes.", imageUrl: "" },
    { id: "asset_6_7", name: "THE COLD WALLET TRANSFER", description: "One shot. Anonymous. Irreversible. Once those coins move they are gone from every ledger in every jurisdiction on earth. The person doing this has done it once before and does not discuss the circumstances.", imageUrl: "" }
  ],

  civilians: [
    { id: "civ_6_1", name: "THE FACILITY MANAGER", description: "Has run SecureStor for nineteen years without incident. Considers the National Guard perimeter a personal affront. Is filing a complaint with someone. Is not sure who.", imageUrl: "" },
    { id: "civ_6_2", name: "THE AUCTIONEER", description: "Still processing remaining estate items with legitimate paperwork and a clipboard. Has been on site for three days. Keeps returning to unit 114 with an expression he cannot explain.", imageUrl: "" },
    { id: "civ_6_3", name: "THE LOCAL REPORTER", description: "Covering the eminent domain story for the Boise Weekly Courier. Has a press pass, a voice recorder, and an increasingly accurate theory about what is actually in that unit.", imageUrl: "" },
    { id: "civ_6_4", name: "THE BEANIE BABY COLLECTOR", description: "A legitimate collector who tracked a rumored near-mint Princess the Bear to this facility through an estate sale forum. Has been in the parking lot for six hours. Will not leave. Has no idea.", imageUrl: "" },
    { id: "civ_6_5", name: "THE CORPORAL'S WIFE", description: "Brought her husband dinner. Has a visitor badge. Is now inside the perimeter chatting with three other guards and standing directly between you and the east fence gap. Shows no signs of leaving.", imageUrl: "" }
  ],

  bomb: {
    name: "THE BOMB",
    description: "Freeze. Nobody move.",
    imageUrl: "",
    soundEffect: "freeze_fbi"
  },

  words: {
    tier1: [
      "BITCOIN", "WALLET", "BEANIE", "IDAHO", "STORAGE",
      "MINING", "LEDGER", "BLOCKCHAIN", "GOVERNOR", "EMINENT",
      "HARDWARE", "CRYPTO", "ESTATE", "HOBBYIST", "FACILITY",
      "PERIMETER", "LAPTOP", "ICELANDIC", "PRINCESS", "TREADMILL"
    ],
    tier2: [
      "SEED", "KEY", "BLOCK", "CHAIN", "HASH",
      "COLD", "FORK", "TRUST", "BEAR", "EXCHANGE",
      "PRIVATE", "MINT", "NODE", "DOMAIN", "RECORD",
      "ADDRESS", "TRANSFER", "TENDER", "ANONYMOUS", "VOLATILE"
    ],
    tier3: [
      "POTATO", "WARREN", "TUESDAY", "FISH", "NATIONAL",
      "NINE", "TY", "SATOSHI", "GRAVEL", "ELEVEN"
    ]
  }
}

// ============================================================

const mission7 = {
  id: "mission_7",
  title: "The Tesla Codex",
  briefing: "In 1903 JP Morgan pulled funding from Nikola Tesla's free wireless energy project and ensured the notebook containing its working blueprint was buried permanently. It was not buried permanently. It surfaced in a Serbian bankruptcy auction in 2019 and was purchased for $4 by a retired schoolteacher named Branko who uses it as a coaster. Branko does not read English. Branko does not know what he has. Branko bowls on Tuesdays. Every major energy conglomerate on earth has a quiet kill order on this notebook. You are not here to kill anything. You are here for a coaster. Get in. Replace it. Get out. Branko cannot know. Because the moment anyone knows — everyone knows. And then Branko becomes a problem nobody wants him to become.",
  backgroundImageUrl: "",
  targetObjectImageUrl: "",

  setting: {
    location: "Ulica Zmaj Jovina 14, Novi Sad, Serbia — Branko's Kitchen",
    era: "Present Day",
    atmosphere: "A quiet street in a quiet city. Afternoon light through lace curtains. The smell of Turkish coffee and old paper. Eleven coasters on a kitchen table, each one completely unremarkable. One of them is worth everything."
  },

  clients: {
    syndicate1: {
      benefactor: "Tesla Motors",
      motivation: "Their lawyers have argued for six years that they own anything with Tesla's name on it. The courts disagree. They've found another approach."
    },
    syndicate2: {
      benefactor: "Greta Thunberg",
      motivation: "Has waited her entire life for this notebook. Free energy changes everything. She will not be stopped by a schoolteacher's coaster collection."
    }
  },

  assets: [
    { id: "asset_7_1", name: "THE COASTER EXPERT", description: "Can identify the notebook on sight among eleven equally weathered candidates. Has studied every photograph of Tesla's handwriting in existence. Works fast. Needs to.", imageUrl: "" },
    { id: "asset_7_2", name: "THE TRAVEL ALIAS", description: "Clean. Regional. Nothing that reads as international operative. A visiting academic from Belgrade attending a conference that does actually exist, which is the important part.", imageUrl: "" },
    { id: "asset_7_3", name: "THE REPLACEMENT COASTER", description: "Must pass casual daily inspection by a man who has looked at it every morning for five years without reading a word. The aging has to be exact. The coffee ring has to be exact.", imageUrl: "" },
    { id: "asset_7_4", name: "THE LOCAL CONTACT", description: "Knows Branko's schedule to the minute. Tuesdays he bowls. Wednesdays he visits his sister. The window is Tuesday evening. There is only Tuesday evening.", imageUrl: "" },
    { id: "asset_7_5", name: "THE TRANSLATOR", description: "Serbian. Macedonian. Passable Romanian. Also useful if anything goes wrong socially, which in Serbia means being offered food you cannot refuse without causing an incident.", imageUrl: "" },
    { id: "asset_7_6", name: "THE PRESERVATION SLEEVE", description: "120-year-old paper. Exposed to five years of kitchen humidity and coffee. Breathe on it wrong and the ink shifts. This sleeve is the difference between the notebook and a very expensive blur.", imageUrl: "" },
    { id: "asset_7_7", name: "THE CLEAN EXIT", description: "No trace. No record. No pattern. Branko makes his coffee Wednesday morning and the world is different. He will never know. That is the job. That is the whole job.", imageUrl: "" }
  ],

  civilians: [
    { id: "civ_7_1", name: "THE NEIGHBOR", description: "Marta. 74. Has lived across the hall from Branko for 31 years and considers his business entirely her business. Is almost always in the corridor. Has opinions about strangers.", imageUrl: "" },
    { id: "civ_7_2", name: "THE NEPHEW", description: "Branko's nephew. Stopping by unannounced to drop off homemade rakija and stay for two hours minimum. Has a key. Has used the key. Is currently inside the apartment.", imageUrl: "" },
    { id: "civ_7_3", name: "THE POSTMAN", description: "Has a registered package requiring a signature. Has been ringing Branko's buzzer for eleven minutes. Is not leaving without a signature. Is constitutionally incapable of leaving without a signature.", imageUrl: "" },
    { id: "civ_7_4", name: "THE STUDENT", description: "A former pupil of Branko's, stopping by with exam results and a bottle of wine. Knows the building. Knows the neighbors. Moves through the space like he lives there.", imageUrl: "" },
    { id: "civ_7_5", name: "THE LANDLORD", description: "Here to fix a radiator in the unit below. Has a master key, a toolbox, and a habit of wandering into the wrong floor when the stairwell light is out. The stairwell light is out.", imageUrl: "" }
  ],

  bomb: {
    name: "THE BOMB",
    description: "Freeze. Nobody move.",
    imageUrl: "",
    soundEffect: "freeze_fbi"
  },

  words: {
    tier1: [
      "TESLA", "NOTEBOOK", "COASTER", "ENERGY", "WIRELESS",
      "BLUEPRINT", "SERBIA", "CURRENT", "FREQUENCY", "TOWER",
      "SUPPRESSED", "INVENTOR", "PATENT", "VOLTAGE", "RESONANCE",
      "NOVI SAD", "ACADEMIC", "TUESDAY", "COFFEE", "BRANKO"
    ],
    tier2: [
      "FREE", "CHARGE", "CONDUCTOR", "FIELD", "GROUND",
      "PLANT", "SWITCH", "LIVE", "WAVE", "CIRCUIT",
      "COIL", "DISCHARGE", "RELAY", "NEUTRAL", "CONTACT",
      "STATIC", "SOCKET", "STRIP", "PULL", "SCREEN"
    ],
    tier3: [
      "PIGEON", "MORGAN", "BOLT", "BOWL", "FOUR",
      "QUIET", "RING", "ELEVEN", "WARD", "RAKIJA"
    ]
  }
}

// ============================================================
// EXPORT — Mission Pack 1
// ============================================================

const fyveMissionPack1 = [
  missionPrime,
  mission1,
  mission2,
  mission3,
  mission4,
  mission5,
  mission6,
  mission7
]

// IMAGE GENERATION SUMMARY — Mission Pack 1
// Per mission: 7 asset images + 5 civilian images + 1 background + 1 target object
// Shared across all missions: 1 bomb image (FBI badge)
// Total unique images to generate:
//   8 missions × (7 assets + 5 civilians + 1 background + 1 object) = 112
//   + 1 shared bomb image
//   = 113 images total
//
// Use BLUFF BOX AI card image generator component for all asset and civilian cards.
// Background and target object images uploaded manually per mission.

export default fyveMissionPack1
export {
  missionPrime,
  mission1,
  mission2,
  mission3,
  mission4,
  mission5,
  mission6,
  mission7
}
