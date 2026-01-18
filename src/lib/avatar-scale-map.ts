// Avatar Scale Map - Maps avatar IDs to scale modifiers
// Format: avatarId -> { scale: number }

export interface AvatarScaleData {
  scale: number;
}

export const avatarScaleMap: Record<string, AvatarScaleData> = {
  // Animal faces
  'A1B2C3': { scale: 1.3 }, // gray-fox
  'D4E5F6': { scale: 1.3 }, // animal-deer
  'G7H8I9': { scale: 1.5 }, // animal-dog
  'J0K1L2': { scale: 2 }, // pig-face
  'M3N4O5': { scale: 1.2 }, // rat-face
  'P6Q7R8': { scale: 1.0 }, // elephant-face
  'S9T0U1': { scale: 1.0 }, // elephant-face (1)
  'E8F9G0': { scale: 2 }, // animal-elephant
  'V2W3X4': { scale: 1.5 }, // hippo-face
  'Y5Z6A7': { scale: 1.5 }, // animal-donkey
  'B8C9D0': { scale: 1.0 }, // animal-alligator
  'E1F2G3': { scale: 1.4 }, // fox-face
  'H4I5J6': { scale: 1.4 }, // panther-animal
  'K7L8M9': { scale: 2 }, // puiguin-face
  'N0O1P2': { scale: 2.6 }, // panda-face
  'Q3R4S5': { scale: 1.3 }, // animal-bulldog
  'T6U7V8': { scale: 1.3 }, // rhinoceros
  'W9X0Y1': { scale: 1.5 }, // koala
  'Z2A3B4': { scale: 1.3 }, // pig
  'C5D6E7': { scale: 1.7 }, // tiger-face
  'F8G9H0': { scale: 1.2 }, // nerd-face-cat
  'I1J2K3': { scale: 1.3 }, // happy-lion
  
  // Monsters and emojis
  'L4M5N6': { scale: 1.0 }, // monster-emoji
  'O7P8Q9': { scale: 0.9 }, // flirty-green-monster
  'R0S1T2': { scale: 0.9 }, // blue-monster
  'U3V4W5': { scale: 1.0 }, // yellow-monster-with-horns
  'X6Y7Z8': { scale: 1.4 }, // evil-monster
  'A9B0C1': { scale: 1.0 }, // cyclops-emoji
  'D2E3F4': { scale: 1.0 }, // yuck
  'G5H6I7': { scale: 1.0 }, // smiling-face-with-heart-eyes
  'J8K9L0': { scale: 1.0 }, // rolling-on-the-floor-laughing
  'M1N2O3': { scale: 1.05 }, // smiling-face-with-smiling-eyes
  'P4Q5R6': { scale: 1.1 }, // stress-emoji
  'S7T8U9': { scale: 1.0 }, // dead-emoji
  'V0W1X2': { scale: 1.0 }, // big-smile
  
  // Human avatars
  'Y3Z4A5': { scale: 1.1 }, // happy-girl-emoji
  'B6C7D8': { scale: 1.1 }, // happy-girl-emoji-2)
  'E9F0G1': { scale: 1.1 }, // happy-man-emoji
  'H2I3J4': { scale: 1.1 }, // happy-old-man-emoji
  'K5L6M7': { scale: 1.0 }, // flirting-girl
  'N8O9P0': { scale: 1.0 }, // girl-listens-to-music
  'Q1R2S3': { scale: 1.0 }, // joyful-girl
  'T4U5V6': { scale: 1.4 }, // fairy-princess
  'W7X8Y9': { scale: 1.4 }, // bunny-magic
  'Z0A1B2': { scale: 1.4 }, // moon-fairy
  'C3D4E5': { scale: 1.35 }, // mermaid
  'F6G7H8': { scale: 1.4 }, // fiery-heart
  'I9J0K1': { scale: 1.25 }, // skull
  'L2M3N4': { scale: 1.25 }, // dragon
  'O5P6Q7': { scale: 1.2 }, // rocket
  'R8S9T0': { scale: 1.25 }, // basketball
  'U1V2W3': { scale: 1.2 }, // rugby-ball
  
  // Character avatars
  'X4Y5Z6': { scale: 1.0 }, // boy-avatar
  'A7B8C9': { scale: 1.0 }, // man-avatar
  'D0E1F2': { scale: 1.0 }, // boy-avatar-1
  'G3H4I5': { scale: 1.0 }, // male-avatar
  'J6K7L8': { scale: 1.0 }, // female-avatar
  'M9N0O1': { scale: 1.0 }, // beautiful-woman-avatar
  'P2Q3R4': { scale: 1.0 }, // female-avatar-1
  'S5T6U7': { scale: 1.7 }, // young-boy-avatar
  'V8W9X0': { scale: 1.7 }, // young-boy-avatar-1
  'Y1Z2A3': { scale: 1.7 }, // old-age-avatar
  'B4C5D6': { scale: 1.2 }, // female-account
  'E7F8G9': { scale: 1.0 }, // girl-profile
  'H0I1J2': { scale: 1.0 }, // female-person
  'K3L4M5': { scale: 1.0 }, // boy
  'N6O7P8': { scale: 1.0 }, // female-assistant
  'Q9R0S1': { scale: 1.0 }, // woman
  'T2U3V4': { scale: 1.0 }, // old-woman
  'W5X6Y7': { scale: 1.0 }, // cute-girl
  'Z8A9B0': { scale: 1.0 }, // blonde-woman
  
  // Professional avatars
  'C1D2E3': { scale: 1.0 }, // nurse-avatar
  'F4G5H6': { scale: 1.0 }, // police-avatar
  'I7J8K9': { scale: 1.0 }, // clown-avatar
  'L0M1N2': { scale: 1.0 }, // support-agent-avatar
  'O3P4Q5': { scale: 1.0 }, // hacker-avatar
  'R6S7T8': { scale: 1.0 }, // architect-avatar
  'U9V0W1': { scale: 1.0 }, // chef-avatar
  'X2Y3Z4': { scale: 1.0 }, // fireman-avatar
  'A5B6C7': { scale: 1.0 }, // surgeon-avatar
  
  // Robot and special avatars
  'D8E9F0': { scale: 1.0 }, // robot-avatar
  'G1H2I3': { scale: 1.0 }, // robot-avatar-1
  'J4K5L6': { scale: 1.0 }, // girl-avatar
  'M7N8O9': { scale: 1.0 }, // male-avatar-2
  'P0Q1R2': { scale: 1.0 }, // boy-avatar-2
  'S3T4U5': { scale: 1.0 }, // robot-avatar-2
  'V6W7X8': { scale: 1.0 }, // boy-avatar-3
  'Y9Z0A1': { scale: 1.0 }, // robot-avatar-3
  'B2C3D4': { scale: 1.2 }, // brave-superhero
  'E5F6G7': { scale: 1.2 }, // super-hero-women
  'H8I9J0': { scale: 1.0 }, // astronaut
  'K1L2M3': { scale: 2 }, // ghost
  'N4O5P6': { scale: 2.25 }, // invader
  
  // Hand gestures
  'Q7R8S9': { scale: 1.0 }, // crossed-fingers
  'T0U1V2': { scale: 1.0 }, // crossed-fingers-1
  'W3X4Y5': { scale: 1.0 }, // crossed-fingers-2
  'Z6A7B8': { scale: 1.0 }, // crossed-fingers-3
  'C9D0E1': { scale: 1.0 }, // crossed-fingers-4
  'F2G3H4': { scale: 1.0 }, // crossed-fingers-5
  'LB049H': { scale: 1.0 }, // z-alien-monster~~|~~LB049H
  '985HUB': { scale: 1.35 }, // z-angry-monster~~|~~985HUB
  '139DE7': { scale: 1.0 }, // z-baby-panda~~|~~139DE7
  '7SD965': { scale: 1.0 }, // z-badger~~|~~7SD965
  'C6R4US': { scale: 1.0 }, // z-bee~~|~~C6R4US
  '09C6LX': { scale: 1.0 }, // z-bolt~~|~~09C6LX
  'QUDA8J': { scale: 1.0 }, // z-butterfly~~|~~QUDA8J
  'HJZWW6': { scale: 1.1 }, // z-cat-angle~~|~~HJZWW6
  'CX040J': { scale: 1.0 }, // z-cat-playing-with-fish~~|~~CX040J
  'LIEBCA': { scale: 1.0 }, // z-cat~~|~~LIEBCA
  'J8CBH4': { scale: 1.0 }, // z-cute-potato-fighting~~|~~J8CBH4
  'EJA4DY': { scale: 1.0 }, // z-cyclops~~|~~EJA4DY
  'L88LG7': { scale: 1.0 }, // z-dog~~|~~L88LG7
  'QY08VT': { scale: 1.0 }, // z-elephant~~|~~QY08VT
  'YAJUVG': { scale: 1.2 }, // z-elf-1~~|~~YAJUVG
  'YPHYQC': { scale: 1.7 }, // z-elf~~|~~YPHYQC
  '80J6SJ': { scale: 1.0 }, // z-face-with-monocle~~|~~80J6SJ
  'J6SW2G': { scale: 1.0 }, // z-giraffe~~|~~J6SW2G
  'JQ0D6X': { scale: 1.0 }, // z-green-monster~~|~~JQ0D6X
  'IWQ1G5': { scale: 1.0 }, // z-hacker-anonymous~~|~~IWQ1G5
  '39OC2F': { scale: 1.0 }, // z-jack-o-lantern~~|~~39OC2F
  'J4TEKH': { scale: 1.1 }, // z-karate~~|~~J4TEKH
  'DSB93O': { scale: 1.0 }, // z-koala-1~~|~~DSB93O
  '2PWHRY': { scale: 1.0 }, // z-leopard~~|~~2PWHRY
  'A3UH78': { scale: 1.0 }, // z-lime-monster~~|~~A3UH78
  'GEDH4A': { scale: 1.0 }, // z-lion~~|~~GEDH4A
  'H9P4IB': { scale: 0.9 }, // z-love~~|~~H9P4IB
  'A0TYEO': { scale: 1.0 }, // z-monkey~~|~~A0TYEO
  'E87Q38': { scale: 1.0 }, // z-monster-10~~|~~E87Q38
  'AFSZZD': { scale: 1.0 }, // z-monster-11~~|~~AFSZZD
  '85XGSP': { scale: 1.0 }, // z-monster-12~~|~~85XGSP
  'MX61Q0': { scale: 1.0 }, // z-naruto-grin~~|~~MX61Q0
  'A9ZN1K': { scale: 1.1 }, // z-ninja~~|~~A9ZN1K
  '0E9MJY': { scale: 1.0 }, // z-one-eye-monster~~|~~0E9MJY
  'ERMK11': { scale: 1.0 }, // z-owl~~|~~ERMK11
  'PGN463': { scale: 1.2 }, // z-pirate-flag~~|~~PGN463
  'AWUESR': { scale: 1.1 }, // z-pirate-hat~~|~~AWUESR
  'BWBH33': { scale: 1.2 }, // z-pirate-ship~~|~~BWBH33
  'KCW9T7': { scale: 1.0 }, // z-pirate-sword~~|~~KCW9T7
  'IO8LVS': { scale: 1.3 }, // z-pirate~~|~~IO8LVS
  'S21S1J': { scale: 1.0 }, // z-punk~~|~~S21S1J
  'IL744S': { scale: 1.0 }, // z-purple-monster~~|~~IL744S
  '5414ML': { scale: 1.0 }, // z-red-monster~~|~~5414ML
  '8XPZOO': { scale: 1.2 }, // z-skull-and-crossbones-emoji~~|~~8XPZOO
  'MZ9RNR': { scale: 1.5 }, // z-skull-anim-1~~|~~MZ9RNR
  'E76JBA': { scale: 1.5 }, // z-skull-anim-2~~|~~E76JBA
  '29BDEV': { scale: 1.0 }, // z-space-ship~~|~~29BDEV
  'X3BB5S': { scale: 1.0 }, // z-spider~~|~~X3BB5S
  '9QLBEQ': { scale: 1.0 }, // z-spy-agent~~|~~9QLBEQ
  'D0HWVJ': { scale: 1.0 }, // z-spy-cat~~|~~D0HWVJ
  '7W0RMD': { scale: 1.2 }, // z-sun~~|~~7W0RMD
  '54LBLR': { scale: 1.4 }, // z-surprised-monster~~|~~54LBLR
  'GAMIS5': { scale: 1.0 }, // z-three-eye-monster-1~~|~~GAMIS5
  '196SOW': { scale: 1.0 }, // z-three-eye-monster~~|~~196SOW
  'KPABYK': { scale: 1.0 }, // z-tornado~~|~~KPABYK
  '4APKW4': { scale: 1.5 }, // z-vampire-bat~~|~~4APKW4
  '1F83YD': { scale: 1.2 }, // z-vampire~~|~~1F83YD
  'RSIQ78': { scale: 1.7 }, // z-wings-guitar~~|~~RSIQ78
  '5C5XR0': { scale: 1.1 }, // z-zany-face~~|~~5C5XR0
  '1TCE3W': { scale: 1.1 }, // z-404-dinosaur-error~~|~~1TCE3W
  'HWTBD1': { scale: 1.3 }, // z-baseball-ground~~|~~HWTBD1
  'TIM1Z9': { scale: 1.0 }, // z-bonsai~~|~~TIM1Z9
  'N2XIWC': { scale: 1.0 }, // z-cassette~~|~~N2XIWC
  'E65U3T': { scale: 1.0 }, // z-chess~~|~~E65U3T
  'PSTKY1': { scale: 1.0 }, // z-crocodile (1)~~|~~PSTKY1
  'SHWR52': { scale: 1.0 }, // z-crocodile~~|~~SHWR52
  'WBZ3UT': { scale: 1.0 }, // z-dinosaur~~|~~WBZ3UT
  'HPPII8': { scale: 1.0 }, // z-excalibur~~|~~HPPII8
  'GJYH9Q': { scale: 1.0 }, // z-fire-flame~~|~~GJYH9Q
  '8YC1P8': { scale: 1.0 }, // z-hammer~~|~~8YC1P8
  'LCEV5N': { scale: 1.0 }, // z-hockey~~|~~LCEV5N
  'DGRUTS': { scale: 1.1 }, // z-love-music~~|~~DGRUTS
  'G1T46D': { scale: 1.2 }, // z-quidditch~~|~~G1T46D
  'TEWBBU': { scale: 1.3 }, // z-rainbow~~|~~TEWBBU
  'UZP4FB': { scale: 0.8 }, // z-soccer-ball~~|~~UZP4FB
  '3K7BOD': { scale: 1.0 }, // z-spear~~|~~3K7BOD
  'DFN7H1': { scale: 1.2 }, // z-tree~~|~~DFN7H1
  'QHLKZH': { scale: 1.0 }, // z-viking-man~~|~~QHLKZH
  'OROQIN': { scale: 1.0 }, // z-beer-mug~~|~~OROQIN
  'BD5M9I': { scale: 1.05 }, // z-coffee-cup~~|~~BD5M9I
  'AAA386': { scale: 1.1 }, // z-excalibur (1)~~|~~AAA386
  'VF9E7A': { scale: 1.1 }, // z-pizza~~|~~VF9E7A
  'TCIHO8': { scale: 1.2 }, // z-tea~~|~~TCIHO8
  '5PE1NC': { scale: 1.0 }, // z-Binary hacker~~|~~5PE1NC
  'YYH9UZ': { scale: 1.0 }, // z-bowling~~|~~YYH9UZ
  'ANJM03': { scale: 1.1 }, // z-male-boxer-dong-boxing~~|~~ANJM03
  '8T1061': { scale: 1.0 }, // z-snowflake~~|~~8T1061
  'JADFOD': { scale: 1.2 }, // z-casual-woman~~|~~JADFOD
  'ODGJC8': { scale: 1.0 }, // z-cute-dog (1)~~|~~ODGJC8
  'AUYE80': { scale: 1.0 }, // z-cute-dog~~|~~AUYE80
  'RB5V91': { scale: 1.1 }, // z-dogecoin~~|~~RB5V91
  '2WY7D9': { scale: 1.0 }, // z-dolphin~~|~~2WY7D9
  'EGB5KG': { scale: 1.0 }, // z-dragon (1)~~|~~EGB5KG
  'PKLAQ3': { scale: 1.0 }, // z-eagle~~|~~PKLAQ3
  '276U4P': { scale: 1.0 }, // z-girl-with-a-cat~~|~~276U4P
  'C31JMD': { scale: 1.3 }, // z-happy-avocado~~|~~C31JMD
  'B5DKMG': { scale: 1.1 }, // z-japan-sumo-wrestler~~|~~B5DKMG
  'M5ENYY': { scale: 1.0 }, // z-octopus~~|~~M5ENYY
  'HERHBT': { scale: 1.0 }, // z-panther~~|~~HERHBT
  'F8DP6J': { scale: 1.0 }, // z-puppy-eyes-emoji~~|~~F8DP6J
  '3O1D15': { scale: 1.2 }, // z-red-pepper~~|~~3O1D15
  'W5T0UE': { scale: 1.0 }, // z-tiger~~|~~W5T0UE
  '4WXQ1V': { scale: 1.0 }, // z-kangaroo~~|~~4WXQ1V
  'QC9WE7': { scale: 1.5 }, // z-loading~~|~~QC9WE7
  'ICL8L3': { scale: 1.5 }, // z-parrot~~|~~ICL8L3
  'P2BUYS': { scale: 1.1 }, // z-sunglasses-emoticon~~|~~P2BUYS
  'HYZBGH': { scale: 1.1 }, // z-sunglasses~~|~~HYZBGH
  'C9KFZU': { scale: 1 },
  '87JE4H': { scale: 1.5 },
  '9O56GE': { scale: 1.5 },
  'H4XI5Z': { scale: 1.15 },
  '67FA4F': { scale: 1.15 },
};

// Helper function to extract avatar ID from filename
export function extractAvatarId(filename: string): string | null {
  const parts = filename.split('~~|~~');
  if (parts.length === 2 && parts[1]) {
    return parts[1].replace('.json', '');
  }
  return null;
}

// Helper function to get avatar name without ID
export function getAvatarBaseName(filename: string): string {
  const parts = filename.split('~~|~~');
  return parts[0] ?? filename;
}

// Helper function to get scale for an avatar
export function getAvatarScale(avatarId: string): number {
  return avatarScaleMap[avatarId]?.scale || 1.0;
}

// Helper function to update scale for an avatar
export function updateAvatarScale(avatarId: string, scale: number): void {
  if (avatarScaleMap[avatarId]) {
    avatarScaleMap[avatarId].scale = scale;
  }
} 