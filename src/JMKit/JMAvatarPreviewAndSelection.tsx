'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from './JMDialog';
import JMAvatarView from './JMAvatarView';
import JMAvatarPicker, { type JMAvatarItem, AVATAR_CATEGORIES } from './JMAvatarPicker';
import { JMSimpleButton } from './JMSimpleButton';
import { devLog, devError } from '@/lib/logger';

interface JMAvatarPreviewAndSelectionProps {
  selectedAvatar: string | null;
  onAvatarSelect: (avatar: JMAvatarItem) => void;
  onAvatarRemove: () => void;
  avatarError?: string | null;
  isLoading?: boolean;
  size?: number; // Width and height in pixels
  className?: string;
}

export default function JMAvatarPreviewAndSelection({
  selectedAvatar,
  onAvatarSelect,
  onAvatarRemove,
  avatarError,
  isLoading = false,
  size = 240, // Default to 240px (w-60 h-60)
  className = ''
}: JMAvatarPreviewAndSelectionProps) {
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [availableAvatars, setAvailableAvatars] = useState<JMAvatarItem[]>([]);
  const [loadingAvatars, setLoadingAvatars] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Load available avatars when component mounts
  useEffect(() => {
    const loadAvatars = async () => {
      try {
        devLog('🎮 AvatarPreviewAndSelection: Loading avatars...');
        const response = await window.fetch('/api/avatars');
        
        if (response.ok) {
          const avatarData = await response.json();
          
          if (Array.isArray(avatarData)) {
            const avatarItems: JMAvatarItem[] = avatarData.map((avatarObj: {name: string, file: string}) => {
              const filename = avatarObj.file;
              const baseName = filename.split('~~|~~')[0] || filename.replace('.json', '');
              const scale = 1.0; // Default scale
              
              return {
                filename,
                name: baseName,
                scale
              };
            });
            setAvailableAvatars(avatarItems);
            devLog('🎮 AvatarPreviewAndSelection: Loaded avatars:', avatarItems.length);
          } else {
            devError('🎮 AvatarPreviewAndSelection: Invalid avatar data format');
            setAvailableAvatars([]);
          }
        } else {
          devError('🎮 AvatarPreviewAndSelection: Failed to load avatars:', response.status);
          setAvailableAvatars([]);
        }
      } catch (error) {
        devError('🎮 AvatarPreviewAndSelection: Error loading avatars:', error);
        setAvailableAvatars([]);
      } finally {
        setLoadingAvatars(false);
      }
    };

    loadAvatars();
  }, []);

  const handleAvatarSelect = (avatar: JMAvatarItem) => {
    onAvatarSelect(avatar);
    setShowAvatarPicker(false);
  };

  const handleOpenPicker = () => {
    if (!isLoading && !loadingAvatars) {
      setShowAvatarPicker(true);
    }
  };

  return (
    <>
      <div className={`relative ${className}`}>
        {/* Avatar Display */}
        <div 
          className="mx-auto mb-3 relative bg-gray-700 rounded-full flex items-center justify-center"
          style={{ width: `${size}px`, height: `${size}px` }}
        >
          {selectedAvatar ? (
            <>
              <div className="pointer-events-none">
                <JMAvatarView 
                  width={size}
                  avatarName={selectedAvatar}
                  fullFilename={selectedAvatar}
                />
              </div>
              {/* Remove Avatar Button */}
              <div
                onClick={onAvatarRemove}
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center transition-colors z-10 cursor-pointer"
                style={{ 
                  backgroundColor: '#4a4a4a',
                  pointerEvents: isLoading ? 'none' : 'auto',
                  opacity: isLoading ? 0.5 : 1 
                }}
              >
                <X className="w-3 h-3 text-white" />
              </div>
            </>
          ) : (
            /* Empty Avatar - Tap to Select */
            <div
              onClick={handleOpenPicker}
              className="w-full h-full rounded-full overflow-hidden relative cursor-pointer"
              style={{ 
                pointerEvents: (isLoading || loadingAvatars) ? 'none' : 'auto',
                opacity: (isLoading || loadingAvatars) ? 0.5 : 1 
              }}
            >
              <Image
                alt="Tap to select avatar"
                src="/images/support/SelectAvatar.jpg"
                fill
                className="object-contain hover:scale-105 transition-transform duration-200"
                unoptimized
              />
            </div>
          )}
        </div>

        {avatarError && (
          <p className="text-xs text-red-500 mt-2 text-center">{avatarError}</p>
        )}
      </div>

      {/* Avatar Picker Modal */}
      <Dialog open={showAvatarPicker} onOpenChange={setShowAvatarPicker}>
        <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] max-h-[80vh] p-0 overflow-hidden bg-gray-900 flex flex-col">
          {/* Sticky Header with Title and Category Filters */}
          <div className="sticky top-0 bg-gray-900 p-6 pb-4 z-10 border-b border-gray-700">
            <DialogTitle className="text-white text-xl mb-4">Choose Your Avatar</DialogTitle>
            <div className="flex flex-wrap gap-2">
              {/* All button */}
              <JMSimpleButton
                onClick={() => setSelectedCategory('All')}
                backgroundColor={selectedCategory === 'All' ? '#FF1B6D' : '#374151'}
                titleColor={selectedCategory === 'All' ? '#ffffff' : '#d1d5db'}
                size="sm"
              >
                All
              </JMSimpleButton>
              
              {/* Category buttons */}
              {AVATAR_CATEGORIES.map(category => (
                <JMSimpleButton
                  key={category.name}
                  onClick={() => setSelectedCategory(category.name)}
                  backgroundColor={selectedCategory === category.name ? '#FF1B6D' : '#374151'}
                  titleColor={selectedCategory === category.name ? '#ffffff' : '#d1d5db'}
                  size="sm"
                >
                  {category.name}
                </JMSimpleButton>
              ))}
            </div>
          </div>
          
          {/* Scrollable Avatar Grid */}
          <div className="flex-1 overflow-y-auto p-6 pt-4">
            <JMAvatarPicker
              avatars={availableAvatars}
              mode="selector"
              onSelect={handleAvatarSelect}
              hideCategoryFilter
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
