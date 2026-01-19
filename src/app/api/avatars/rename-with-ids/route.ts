import { NextResponse } from 'next/server';
import { readdir, rename } from 'fs/promises';
import { join } from 'path';

// ID mapping for each avatar file (matching avatar-scale-map.ts)
const fileIdMap: Record<string, string> = {
  'gray-fox.json': 'A1B2C3',
  'animal-deer.json': 'D4E5F6',
  'animal-dog.json': 'G7H8I9',
  'pig-face.json': 'J0K1L2',
  'rat-face.json': 'M3N4O5',
  'elephant-face.json': 'P6Q7R8',
  'elephant-face (1).json': 'S9T0U1',
  'animal-elephant.json': 'E8F9G0',
  'hippo-face.json': 'V2W3X4',
  'animal-donkey.json': 'Y5Z6A7',
  'animal-alligator.json': 'B8C9D0',
  'fox-face.json': 'E1F2G3',
  'panther-animal.json': 'H4I5J6',
  'puiguin-face.json': 'K7L8M9',
  'panda-face.json': 'N0O1P2',
  'animal-bulldog.json': 'Q3R4S5',
  'rhinoceros.json': 'T6U7V8',
  'koala.json': 'W9X0Y1',
  'pig.json': 'Z2A3B4',
  'tiger-face.json': 'C5D6E7',
  'nerd-face-cat.json': 'F8G9H0',
  'happy-lion.json': 'I1J2K3',
  'monster-emoji.json': 'L4M5N6',
  'flirty-green-monster.json': 'O7P8Q9',
  'blue-monster.json': 'R0S1T2',
  'yellow-monster-with-horns.json': 'U3V4W5',
  'evil-monster.json': 'X6Y7Z8',
  'cyclops-emoji.json': 'A9B0C1',
  'yuck.json': 'D2E3F4',
  'smiling-face-with-heart-eyes.json': 'G5H6I7',
  'rolling-on-the-floor-laughing.json': 'J8K9L0',
  'smiling-face-with-smiling-eyes.json': 'M1N2O3',
  'stress-emoji.json': 'P4Q5R6',
  'dead-emoji.json': 'S7T8U9',
  'big-smile.json': 'V0W1X2',
  'happy-girl-emoji.json': 'Y3Z4A5',
  'happy-girl-emoji-2).json': 'B6C7D8',
  'happy-man-emoji.json': 'E9F0G1',
  'happy-old-man-emoji.json': 'H2I3J4',
  'flirting-girl.json': 'K5L6M7',
  'girl-listens-to-music.json': 'N8O9P0',
  'joyful-girl.json': 'Q1R2S3',
  'fairy-princess.json': 'T4U5V6',
  'bunny-magic.json': 'W7X8Y9',
  'moon-fairy.json': 'Z0A1B2',
  'mermaid.json': 'C3D4E5',
  'fiery-heart.json': 'F6G7H8',
  'skull.json': 'I9J0K1',
  'dragon.json': 'L2M3N4',
  'rocket.json': 'O5P6Q7',
  'basketball.json': 'R8S9T0',
  'rugby-ball.json': 'U1V2W3',
  'boy-avatar.json': 'X4Y5Z6',
  'man-avatar.json': 'A7B8C9',
  'boy-avatar-1.json': 'D0E1F2',
  'male-avatar.json': 'G3H4I5',
  'female-avatar.json': 'J6K7L8',
  'beautiful-woman-avatar.json': 'M9N0O1',
  'female-avatar-1.json': 'P2Q3R4',
  'young-boy-avatar.json': 'S5T6U7',
  'young-boy-avatar-1.json': 'V8W9X0',
  'old-age-avatar.json': 'Y1Z2A3',
  'female-account.json': 'B4C5D6',
  'girl-profile.json': 'E7F8G9',
  'female-person.json': 'H0I1J2',
  'boy.json': 'K3L4M5',
  'female-assistant.json': 'N6O7P8',
  'woman.json': 'Q9R0S1',
  'old-woman.json': 'T2U3V4',
  'cute-girl.json': 'W5X6Y7',
  'blonde-woman.json': 'Z8A9B0',
  'nurse-avatar.json': 'C1D2E3',
  'police-avatar.json': 'F4G5H6',
  'clown-avatar.json': 'I7J8K9',
  'support-agent-avatar.json': 'L0M1N2',
  'hacker-avatar.json': 'O3P4Q5',
  'architect-avatar.json': 'R6S7T8',
  'chef-avatar.json': 'U9V0W1',
  'fireman-avatar.json': 'X2Y3Z4',
  'surgeon-avatar.json': 'A5B6C7',
  'robot-avatar.json': 'D8E9F0',
  'robot-avatar-1.json': 'G1H2I3',
  'girl-avatar.json': 'J4K5L6',
  'male-avatar-2.json': 'M7N8O9',
  'boy-avatar-2.json': 'P0Q1R2',
  'robot-avatar-2.json': 'S3T4U5',
  'boy-avatar-3.json': 'V6W7X8',
  'robot-avatar-3.json': 'Y9Z0A1',
  'brave-superhero.json': 'B2C3D4',
  'super-hero-women.json': 'E5F6G7',
  'astronaut.json': 'H8I9J0',
  'ghost.json': 'K1L2M3',
  'invader.json': 'N4O5P6',
  'crossed-fingers.json': 'Q7R8S9',
  'crossed-fingers-1.json': 'T0U1V2',
  'crossed-fingers-2.json': 'W3X4Y5',
  'crossed-fingers-3.json': 'Z6A7B8',
  'crossed-fingers-4.json': 'C9D0E1',
  'crossed-fingers-5.json': 'F2G3H4',
};

export async function POST() {
  try {
    const avatarsDir = join(process.cwd(), 'public', 'avatars');
    const files = await readdir(avatarsDir);
    
    const renamedFiles: Array<{ oldName: string; newName: string }> = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      // Skip files that already have IDs
      if (file.includes('~~|~~')) continue;
      
      const avatarId = fileIdMap[file];
      if (!avatarId) {
        errors.push({ file, error: 'No ID mapping found' });
        continue;
      }

      const baseName = file.replace('.json', '');
      const newFileName = `${baseName}~~|~~${avatarId}.json`;
      
      const oldPath = join(avatarsDir, file);
      const newPath = join(avatarsDir, newFileName);

      try {
        await rename(oldPath, newPath);
        renamedFiles.push({ oldName: file, newName: newFileName });
      } catch (error) {
        errors.push({ file, error: `Failed to rename: ${error}` });
      }
    }

    return NextResponse.json({
      success: true,
      renamedCount: renamedFiles.length,
      renamedFiles,
      errors,
      message: `Successfully renamed ${renamedFiles.length} files with IDs`
    });

  } catch (error) {
    console.error('Error renaming avatar files:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to rename avatar files' 
    }, { status: 500 });
  }
} 