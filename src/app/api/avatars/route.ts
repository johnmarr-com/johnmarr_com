import { NextRequest, NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    const publicAvatarsDir = join(process.cwd(), 'public', 'avatars');
    const files = await readdir(publicAvatarsDir);
    
    // Filter for JSON files only
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    // Return array of file objects with name and file path
    const avatars = jsonFiles.map(file => ({
      name: file.replace('.json', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      file: file
    }));
    
    return NextResponse.json(avatars);
  } catch (error) {
    console.error('Error reading avatars directory:', error);
    return NextResponse.json({ error: 'Failed to load avatars' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { oldFilename, newFilename } = await request.json();
    
    if (!oldFilename || !newFilename) {
      return NextResponse.json({ error: 'Old and new filenames are required' }, { status: 400 });
    }
    
    // Add .json extension if not present
    const newFilenameWithExt = newFilename.endsWith('.json') ? newFilename : `${newFilename}.json`;
    
    const avatarsDir = join(process.cwd(), 'public', 'avatars');
    const oldPath = join(avatarsDir, oldFilename);
    const newPath = join(avatarsDir, newFilenameWithExt);
    
    // Use dynamic import for fs/promises rename
    const { rename } = await import('fs/promises');
    await rename(oldPath, newPath);
    
    return NextResponse.json({ 
      message: 'File renamed successfully',
      oldFilename,
      newFilename: newFilenameWithExt
    });
  } catch (error) {
    console.error('Error renaming file:', error);
    return NextResponse.json({ error: 'Failed to rename file' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { filename } = await request.json();
    
    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }
    
    const avatarsDir = join(process.cwd(), 'public', 'avatars');
    const filePath = join(avatarsDir, filename);
    
    // Use dynamic import for fs/promises unlink
    const { unlink } = await import('fs/promises');
    await unlink(filePath);
    
    return NextResponse.json({ 
      message: 'File deleted successfully',
      filename
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
} 