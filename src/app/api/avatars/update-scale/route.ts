import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, rename } from 'fs/promises';
import { join } from 'path';

// Generate a unique 6-character alphanumeric ID
function generateUniqueId(existingIds: Set<string>): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id: string;
  
  do {
    id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (existingIds.has(id));
  
  return id;
}

// Extract existing IDs from avatar-scale-map.ts
async function getExistingIds(fileContent: string): Promise<Set<string>> {
  const existingIds = new Set<string>();
  const idRegex = /'([A-Z0-9]{6})':\s*{/g;
  let match;
  
  while ((match = idRegex.exec(fileContent)) !== null) {
    if (match[1]) {
      existingIds.add(match[1]);
    }
  }
  
  return existingIds;
}

export async function POST(request: NextRequest) {
  try {
    const { avatarId, scale, filename } = await request.json();
    
    if (typeof scale !== 'number') {
      return NextResponse.json({ 
        error: 'Scale is required' 
      }, { status: 400 });
    }

    if (scale <= 0 || scale > 5) {
      return NextResponse.json({ 
        error: 'Scale must be between 0.1 and 5.0' 
      }, { status: 400 });
    }

    // Read the current avatar-scale-map file
    const mapFilePath = join(process.cwd(), 'src', 'lib', 'avatar-scale-map.ts');
    const fileContent = await readFile(mapFilePath, 'utf-8');

    let finalAvatarId = avatarId;
    let newFilename: string | null = null;

    // If no avatarId provided, this is a new avatar that needs an ID
    if (!avatarId && filename) {
      // Generate a new unique ID
      const existingIds = await getExistingIds(fileContent);
      finalAvatarId = generateUniqueId(existingIds);
      
      // Rename the file to include the new ID
      const avatarsDir = join(process.cwd(), 'public', 'avatars');
      const baseName = filename.replace('.json', '');
      newFilename = `${baseName}~~|~~${finalAvatarId}.json`;
      
      const oldPath = join(avatarsDir, filename);
      const newPath = join(avatarsDir, newFilename);
      
      await rename(oldPath, newPath);
    }

    if (!finalAvatarId) {
      return NextResponse.json({ 
        error: 'Avatar ID or filename is required' 
      }, { status: 400 });
    }

    // Check if avatar ID exists in the map
    const avatarRegex = new RegExp(`'${finalAvatarId}':\\s*{\\s*scale:\\s*([0-9.]+)\\s*}`);
    const exists = avatarRegex.test(fileContent);
    
    let updatedContent: string;
    
    if (exists) {
      // Update existing entry
      updatedContent = fileContent.replace(
        new RegExp(`('${finalAvatarId}':\\s*{\\s*scale:\\s*)([0-9.]+)(\\s*})`),
        `$1${scale}$3`
      );
    } else {
      // Add new entry - find the avatarScaleMap object and add before the closing brace
      const mapEndRegex = /(avatarScaleMap:\s*Record<string,\s*AvatarScaleData>\s*=\s*{[\s\S]*?)(\n};)/;
      const match = fileContent.match(mapEndRegex);
      
      if (match) {
        // Add new entry before the closing brace
        const newEntry = `  '${finalAvatarId}': { scale: ${scale} },`;
        updatedContent = fileContent.replace(
          mapEndRegex,
          `$1\n${newEntry}$2`
        );
      } else {
        return NextResponse.json({ 
          error: 'Could not find avatarScaleMap in file' 
        }, { status: 500 });
      }
    }

    // Write the updated content back to the file
    await writeFile(mapFilePath, updatedContent, 'utf-8');

    return NextResponse.json({
      success: true,
      message: newFilename 
        ? `Assigned ID ${finalAvatarId} and set scale to ${scale}`
        : exists 
          ? `Updated scale for avatar ${finalAvatarId} to ${scale}`
          : `Added new avatar ${finalAvatarId} with scale ${scale}`,
      avatarId: finalAvatarId,
      scale,
      newFilename, // Will be set if file was renamed
      isNew: !exists
    });

  } catch (error) {
    console.error('Error updating avatar scale:', error);
    return NextResponse.json({ 
      error: 'Failed to update avatar scale' 
    }, { status: 500 });
  }
} 