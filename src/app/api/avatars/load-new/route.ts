import { NextRequest, NextResponse } from 'next/server';
import { readdir, rename, readFile, writeFile } from 'fs/promises';
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
async function getExistingIds(): Promise<Set<string>> {
  try {
    const mapFilePath = join(process.cwd(), 'src', 'lib', 'avatar-scale-map.ts');
    const fileContent = await readFile(mapFilePath, 'utf-8');
    
    const existingIds = new Set<string>();
    const idRegex = /'([A-Z0-9]{6})':\s*{/g;
    let match;
    
    while ((match = idRegex.exec(fileContent)) !== null) {
      if (match[1]) {
        existingIds.add(match[1]);
      }
    }
    
    return existingIds;
  } catch (error) {
    console.error('Error reading existing IDs:', error);
    return new Set();
  }
}

// Add new entries to avatar-scale-map.ts
async function updateScaleMap(newEntries: Array<{ id: string; filename: string }>): Promise<void> {
  try {
    const mapFilePath = join(process.cwd(), 'src', 'lib', 'avatar-scale-map.ts');
    const fileContent = await readFile(mapFilePath, 'utf-8');
    
    // Find the end of the avatarScaleMap object (before the closing brace)
    const insertPoint = fileContent.lastIndexOf('};');
    
    if (insertPoint === -1) {
      throw new Error('Could not find insertion point in avatar-scale-map.ts');
    }
    
    // Create new entries
    const newEntriesText = newEntries.map(({ id, filename }) => 
      `  '${id}': { scale: 1.0 }, // ${filename.replace('.json', '')}`
    ).join('\n');
    
    // Insert new entries before the closing brace
    const updatedContent = 
      fileContent.slice(0, insertPoint) + 
      newEntriesText + '\n' +
      fileContent.slice(insertPoint);
    
    await writeFile(mapFilePath, updatedContent, 'utf-8');
  } catch (error) {
    console.error('Error updating scale map:', error);
    throw error;
  }
}

export async function POST(_request: NextRequest) {
  try {
    const sourceDir = join(process.cwd(), 'public', 'avatars-load-source');
    const targetDir = join(process.cwd(), 'public', 'avatars');
    
    // Check if source directory exists
    let sourceFiles: string[];
    try {
      sourceFiles = await readdir(sourceDir);
    } catch {
      return NextResponse.json({ 
        error: 'Source directory public/avatars-load-source not found' 
      }, { status: 404 });
    }
    
    // Filter for JSON files only
    const jsonFiles = sourceFiles.filter(file => file.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      return NextResponse.json({ 
        message: 'No JSON files found in source directory',
        processedCount: 0
      });
    }
    
    // Get existing IDs to ensure uniqueness
    const existingIds = await getExistingIds();
    
    const processedFiles: Array<{ 
      originalName: string; 
      newName: string; 
      id: string 
    }> = [];
    const newScaleEntries: Array<{ id: string; filename: string }> = [];
    
    // Process each file
    for (const file of jsonFiles) {
      try {
        // Generate unique ID
        const id = generateUniqueId(existingIds);
        existingIds.add(id); // Add to set to avoid duplicates in this batch
        
        // Create new filename with z- prefix and ID
        const baseName = file.replace('.json', '');
        const newFileName = `z-${baseName}~~|~~${id}.json`;
        
        // Move file from source to target directory
        const sourcePath = join(sourceDir, file);
        const targetPath = join(targetDir, newFileName);
        
        await rename(sourcePath, targetPath);
        
        processedFiles.push({
          originalName: file,
          newName: newFileName,
          id
        });
        
        newScaleEntries.push({
          id,
          filename: newFileName
        });
        
      } catch (error) {
        console.error(`Error processing file ${file}:`, error);
      }
    }
    
    // Update the avatar-scale-map.ts file
    if (newScaleEntries.length > 0) {
      await updateScaleMap(newScaleEntries);
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully imported ${processedFiles.length} avatars`,
      processedCount: processedFiles.length,
      processedFiles,
      newIds: processedFiles.map(f => f.id)
    });
    
  } catch (error) {
    console.error('Error in load-new API:', error);
    return NextResponse.json({ 
      error: 'Failed to import new avatars' 
    }, { status: 500 });
  }
} 