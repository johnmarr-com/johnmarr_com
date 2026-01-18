import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { avatarId, scale } = await request.json();
    
    if (!avatarId || typeof scale !== 'number') {
      return NextResponse.json({ 
        error: 'Avatar ID and scale are required' 
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

    // Find and replace the scale value for the specific avatar ID
    const avatarRegex = new RegExp(`'${avatarId}':\\s*{\\s*scale:\\s*([0-9.]+)\\s*}`, 'g');
    
    if (!avatarRegex.test(fileContent)) {
      return NextResponse.json({ 
        error: 'Avatar ID not found in scale map' 
      }, { status: 404 });
    }

    // Reset regex and perform replacement
    const updatedContent = fileContent.replace(
      new RegExp(`('${avatarId}':\\s*{\\s*scale:\\s*)([0-9.]+)(\\s*})`),
      `$1${scale}$3`
    );

    // Write the updated content back to the file
    await writeFile(mapFilePath, updatedContent, 'utf-8');

    return NextResponse.json({
      success: true,
      message: `Updated scale for avatar ${avatarId} to ${scale}`,
      avatarId,
      scale
    });

  } catch (error) {
    console.error('Error updating avatar scale:', error);
    return NextResponse.json({ 
      error: 'Failed to update avatar scale' 
    }, { status: 500 });
  }
} 