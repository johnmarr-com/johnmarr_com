'use client';

import { useState, useEffect, useCallback } from 'react';
import { useJMStyle } from '@/JMStyle';
import { JMSimpleButton } from '@/JMKit';
import JMAvatarPicker, { type JMAvatarItem } from '@/JMKit/JMAvatarPicker';
import { extractAvatarId, getAvatarBaseName, getAvatarScale } from '@/lib/avatar-scale-map';
import { devLog, devError } from '@/lib/logger';

/**
 * AdminAvatarsPanel - Admin panel for managing avatar files and scales
 * 
 * Features:
 * - View all avatars in the system
 * - New avatars (without IDs) appear at the top
 * - Set default scales for avatars
 * - Load new avatars from source directory
 * - Rename and delete avatars
 */
export function AdminAvatarsPanel() {
  const { theme } = useJMStyle();
  const [avatars, setAvatars] = useState<JMAvatarItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingNew, setIsLoadingNew] = useState(false);

  // Load avatar files from API
  const loadAvatars = useCallback(async () => {
    try {
      const response = await fetch('/api/avatars');
      if (!response.ok) {
        throw new Error('Failed to fetch avatars');
      }
      
      const avatarData = await response.json();
      
      // Transform to JMAvatarItem format
      const avatarItems: JMAvatarItem[] = avatarData
        .map((avatar: { name: string; file: string }) => {
          const avatarId = extractAvatarId(avatar.file);
          const baseName = getAvatarBaseName(avatar.file);
          const scale = avatarId ? getAvatarScale(avatarId) : 1.0;
          
          return {
            filename: avatar.file,
            name: baseName,
            scale: scale,
            // Flag for sorting - avatars without IDs go first
            hasId: avatar.file.includes('~~|~~'),
          };
        })
        // Sort: unset avatars (no ID) first, then alphabetically
        .sort((a: JMAvatarItem & { hasId: boolean }, b: JMAvatarItem & { hasId: boolean }) => {
          if (a.hasId !== b.hasId) {
            return a.hasId ? 1 : -1; // No ID comes first
          }
          return a.name.localeCompare(b.name);
        })
        // Remove the hasId flag after sorting
        .map(({ filename, name, scale }: JMAvatarItem) => ({ filename, name, scale }));

      setAvatars(avatarItems);
      devLog('Loaded avatars:', avatarItems.length);
    } catch (error) {
      devError('Error loading avatars:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load avatars on mount
  useEffect(() => {
    loadAvatars();
  }, [loadAvatars]);

  // Handle file renaming
  const handleRename = async (oldFilename: string, newFilename: string) => {
    try {
      const response = await fetch('/api/avatars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldFilename, newFilename }),
      });

      if (!response.ok) {
        throw new Error('Failed to rename file');
      }

      await loadAvatars();
      devLog('Renamed:', oldFilename, '→', newFilename);
    } catch (error) {
      devError('Error renaming file:', error);
      throw error;
    }
  };

  // Handle file deletion
  const handleDelete = async (filename: string) => {
    try {
      const response = await fetch('/api/avatars', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      await loadAvatars();
      devLog('Deleted:', filename);
    } catch (error) {
      devError('Error deleting file:', error);
      throw error;
    }
  };

  // Handle scale update (may include file rename for new avatars)
  const handleScaleUpdate = (filename: string, newScale: number, newFilename?: string) => {
    if (newFilename) {
      // File was renamed (new avatar got assigned an ID) - reload the list
      devLog('Avatar assigned ID:', filename, '→', newFilename);
      loadAvatars();
    } else {
      // Just update the scale in place
      setAvatars(prev => 
        prev.map(avatar => 
          avatar.filename === filename 
            ? { ...avatar, scale: newScale }
            : avatar
        )
      );
      devLog('Scale updated:', filename, '→', newScale);
    }
  };

  // Handle loading new avatars from source directory
  const handleLoadNew = async () => {
    setIsLoadingNew(true);
    try {
      const response = await fetch('/api/avatars/load-new', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load new avatars');
      }

      const result = await response.json();
      devLog('Loaded new avatars:', result);

      await loadAvatars();
    } catch (error) {
      devError('Error loading new avatars:', error);
    } finally {
      setIsLoadingNew(false);
    }
  };

  // Count unset avatars (no ID)
  const unsetCount = avatars.filter(a => !a.filename.includes('~~|~~')).length;

  if (isLoading) {
    return (
      <div 
        className="mt-6 rounded-2xl border backdrop-blur-md p-8"
        style={{ 
          backgroundColor: `${theme.surfaces.base}ee`,
          borderColor: theme.surfaces.elevated2,
        }}
      >
        <div className="flex items-center justify-center py-12">
          <div 
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: theme.accents.neonPink, borderTopColor: 'transparent' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="mt-6 rounded-2xl border backdrop-blur-md overflow-hidden"
      style={{ 
        backgroundColor: `${theme.surfaces.base}ee`,
        borderColor: theme.surfaces.elevated2,
      }}
    >
      {/* Header */}
      <div 
        className="px-8 py-6 flex items-center justify-between border-b"
        style={{ borderColor: theme.surfaces.elevated2 }}
      >
        <div>
          <h2 
            className="text-lg font-semibold"
            style={{ color: theme.text.primary }}
          >
            Avatar Management
          </h2>
          <p 
            className="text-sm mt-1"
            style={{ color: theme.text.tertiary }}
          >
            {avatars.length} avatars total
            {unsetCount > 0 && (
              <span style={{ color: theme.semantic.warning }}>
                {' '}• {unsetCount} need setup
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p 
              className="text-xs"
              style={{ color: theme.text.tertiary }}
            >
              Add files to public/avatars-load-source
            </p>
          </div>
          <JMSimpleButton
            onClick={handleLoadNew}
            disabled={isLoadingNew}
            backgroundColor={theme.primary}
            titleColor="#ffffff"
          >
            {isLoadingNew ? 'Loading...' : 'Load New'}
          </JMSimpleButton>
        </div>
      </div>

      {/* Avatar Picker */}
      <div className="p-6">
        <JMAvatarPicker
          avatars={avatars}
          onRename={handleRename}
          onDelete={handleDelete}
          onScaleUpdate={handleScaleUpdate}
          showManagementControls={true}
          mode="editor"
        />
      </div>
    </div>
  );
}
