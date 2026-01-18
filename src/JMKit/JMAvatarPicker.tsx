'use client';

import React, { useState, useRef, useEffect } from 'react';
import { JMSimpleButton } from './JMSimpleButton';
import { Trash2 } from 'lucide-react';
import JMAvatarView from './JMAvatarView';
import { getAvatarBaseName, extractAvatarId } from '@/lib';

export interface JMAvatarItem {
  filename: string;
  name: string;
  scale: number;
}

export interface JMAvatarPickerProps {
  avatars: JMAvatarItem[];
  onRename?: (filename: string, newName: string) => Promise<void>;
  onDelete?: (filename: string) => Promise<void>;
  onScaleUpdate?: (filename: string, newScale: number) => void;
  showManagementControls?: boolean;
  mode?: 'editor' | 'selector';
  onSelect?: (avatar: JMAvatarItem) => void;
  /** When true, hides the built-in category filter (for external control) */
  hideCategoryFilter?: boolean;
  /** Externally controlled selected category */
  selectedCategory?: string;
  /** Callback when category changes (for external control) */
  onCategoryChange?: (category: string) => void;
}

/** Category definitions for avatar filtering */
export const AVATAR_CATEGORIES = [
  { name: 'Animals', prefix: 'animal-' },
  { name: 'Animoji', prefix: 'animoji-' },
  { name: 'Sports', prefix: 'ball-' },
  { name: 'Monsters', prefix: 'boo-' },
  { name: 'Food', prefix: 'food-' },
  { name: 'Hands', prefix: 'hand-' },
  { name: 'Iconic', prefix: 'icon-' },
  { name: 'Professions', prefix: 'job-' },
  { name: 'Fantasy', prefix: 'mystic-' },
  { name: 'Sci Fi', prefix: 'scifi-' },
  { name: 'People', prefix: 'x-' },
];

interface JMAvatarGridItemProps {
  avatar: JMAvatarItem;
  onRename?: ((filename: string, newName: string) => Promise<void>) | undefined;
  onDelete?: ((filename: string) => Promise<void>) | undefined;
  onScaleUpdate?: ((filename: string, newScale: number, newFilename?: string) => void) | undefined;
  showManagementControls?: boolean | undefined;
  mode?: 'editor' | 'selector' | undefined;
  onSelect?: ((avatar: JMAvatarItem) => void) | undefined;
}

const JMAvatarGridItem: React.FC<JMAvatarGridItemProps> = ({ 
  avatar, 
  onRename, 
  onDelete, 
  onScaleUpdate,
  showManagementControls = false, 
  mode = 'editor', 
  onSelect 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(avatar.name);
  const [isEditingScale, setIsEditingScale] = useState(false);
  const [editedScale, setEditedScale] = useState(avatar.scale.toString());
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleSave = async () => {
    if (onRename && editedName !== avatar.name) {
      await onRename(avatar.filename, editedName);
    }
    setIsEditing(false);
  };

  const handleScaleSave = async () => {
    const newScale = parseFloat(editedScale);
    if (!isNaN(newScale) && newScale > 0) {
      // Update scale via API
      try {
        const avatarId = extractAvatarId(avatar.filename);
        const isNewAvatar = !avatarId;
        
        const response = await window.fetch('/api/avatars/update-scale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            avatarId: avatarId || undefined, 
            scale: newScale,
            filename: isNewAvatar ? avatar.filename : undefined
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          // Notify parent of scale update (with new filename if file was renamed)
          onScaleUpdate?.(avatar.filename, newScale, result.newFilename || undefined);
        }
      } catch (error) {
        console.error('Error updating scale:', error);
      }
    }
    setIsEditingScale(false);
  };

  const handleDelete = async () => {
    if (onDelete) {
      await onDelete(avatar.filename);
    }
    setShowDeleteModal(false);
  };

  const handleAvatarClick = () => {
    if (mode === 'selector' && onSelect) {
      onSelect(avatar);
    }
  };

  // Check if any edit mode is active
  const isAnyEditActive = isEditing || isEditingScale || showDeleteModal;
  
  // Check if this is a new avatar (no ID assigned yet)
  const isNewAvatar = !avatar.filename.includes('~~|~~');

  return (
    <div 
      className={`bg-gray-800 rounded-lg overflow-hidden relative ${
        mode === 'selector' ? 'cursor-pointer hover:bg-gray-700 transition-colors' : ''
      }`}
      style={{
        border: isNewAvatar && mode === 'editor' ? '3px solid #8B35FF' : undefined,
      }}
      onClick={handleAvatarClick}
    >
      {/* Square Avatar Display */}
      <div className="relative group aspect-square">
        {/* New Avatar Badge */}
        {isNewAvatar && mode === 'editor' && (
          <div 
            className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded text-xs font-bold text-white"
            style={{ backgroundColor: '#8B35FF' }}
          >
            New
          </div>
        )}
        
        <div className="w-full h-full flex items-center justify-center relative">
          <JMAvatarView 
            width={200}
            avatarName={avatar.filename}
            responsive={true}
            fullFilename={avatar.filename}
          />
          
          {/* Management Controls Overlay - Only in editor mode when not editing */}
          {showManagementControls && mode === 'editor' && !isAnyEditActive && (
            <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-20">
                <div className="flex gap-2">
                  <JMSimpleButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                    size="sm"
                    backgroundColor="#8B35FF"
                    titleColor="#ffffff"
                  >
                    Edit
                  </JMSimpleButton>
                  <JMSimpleButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingScale(true);
                    }}
                    size="sm"
                    backgroundColor="#FF1B6D"
                    titleColor="#ffffff"
                  >
                    Scale
                  </JMSimpleButton>
                  <JMSimpleButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteModal(true);
                    }}
                    size="sm"
                    backgroundColor="#4a4a4a"
                    titleColor="#ffffff"
                  >
                    <Trash2 className="w-4 h-4" />
                  </JMSimpleButton>
                </div>
            </div>
          )}

          {/* Inline Edit Name Overlay */}
          {isEditing && showManagementControls && mode === 'editor' && (
            <div 
              className="absolute inset-0 bg-gray-900 bg-opacity-95 flex flex-col items-center justify-center z-30 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-gray-400 text-xs mb-2">Edit Name</p>
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') { setIsEditing(false); setEditedName(avatar.name); }
                }}
                className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white text-sm text-center mb-3"
                autoComplete="off"
                autoFocus
              />
              <div className="flex gap-2">
                <JMSimpleButton onClick={handleSave} size="sm" backgroundColor="#8B35FF" titleColor="#ffffff">
                  Save
                </JMSimpleButton>
                <JMSimpleButton 
                  onClick={() => { setIsEditing(false); setEditedName(avatar.name); }}
                  size="sm"
                  backgroundColor="#374151"
                  titleColor="#d1d5db"
                >
                  ✕
                </JMSimpleButton>
              </div>
            </div>
          )}

          {/* Inline Edit Scale Overlay */}
          {isEditingScale && showManagementControls && mode === 'editor' && (
            <div 
              className="absolute inset-0 bg-gray-900 bg-opacity-95 flex flex-col items-center justify-center z-30 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-gray-400 text-xs mb-2">Edit Scale</p>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="5"
                value={editedScale}
                onChange={(e) => setEditedScale(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleScaleSave();
                  if (e.key === 'Escape') { setIsEditingScale(false); setEditedScale(avatar.scale.toString()); }
                }}
                className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white text-sm text-center mb-3"
                autoComplete="off"
                autoFocus
              />
              <div className="flex gap-2">
                <JMSimpleButton onClick={handleScaleSave} size="sm" backgroundColor="#FF1B6D" titleColor="#ffffff">
                  Save
                </JMSimpleButton>
                <JMSimpleButton 
                  onClick={() => { setIsEditingScale(false); setEditedScale(avatar.scale.toString()); }}
                  size="sm"
                  backgroundColor="#374151"
                  titleColor="#d1d5db"
                >
                  ✕
                </JMSimpleButton>
              </div>
            </div>
          )}

          {/* Inline Delete Confirmation Overlay */}
          {showDeleteModal && showManagementControls && mode === 'editor' && (
            <div 
              className="absolute inset-0 bg-gray-900 bg-opacity-95 flex flex-col items-center justify-center z-30 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-white text-sm font-medium mb-1">Delete?</p>
              <p className="text-gray-400 text-xs mb-3 truncate max-w-full">{avatar.name}</p>
              <div className="flex gap-2">
                <JMSimpleButton onClick={handleDelete} size="sm" backgroundColor="#4a4a4a" titleColor="#ffffff">
                  Delete
                </JMSimpleButton>
                <JMSimpleButton 
                  onClick={() => setShowDeleteModal(false)}
                  size="sm"
                  backgroundColor="#374151"
                  titleColor="#d1d5db"
                >
                  ✕
                </JMSimpleButton>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Info Section Below Lottie - Only in editor mode */}
      {mode === 'editor' && (
        <div className="p-3 text-center">
          <p className="text-white text-sm font-medium truncate mb-1">
            {avatar.name}
          </p>
          <p className="text-gray-400 text-xs">
            {avatar.scale.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
};

export default function JMAvatarPicker({
  avatars,
  onRename,
  onDelete,
  onScaleUpdate,
  showManagementControls = false,
  mode = 'editor',
  onSelect,
  hideCategoryFilter = false,
  selectedCategory: externalSelectedCategory,
  onCategoryChange
}: JMAvatarPickerProps) {
  const [internalSelectedCategory, setInternalSelectedCategory] = useState<string>('All');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [stickyActivationOffset, setStickyActivationOffset] = useState<number | null>(null);
  const stickyRef = useRef<HTMLDivElement>(null);

  // Use external category if provided, otherwise internal state
  const selectedCategory = externalSelectedCategory ?? internalSelectedCategory;
  const setSelectedCategory = onCategoryChange ?? setInternalSelectedCategory;

  // Calculate and store the sticky activation offset
  useEffect(() => {
    const calculateStickyOffset = () => {
      if (stickyRef.current && stickyActivationOffset === null) {
        const element = stickyRef.current;
        const offsetTop = element.offsetTop;
        setStickyActivationOffset(offsetTop);
      }
    };

    // Calculate on mount and after any layout changes
    calculateStickyOffset();
    
    // Recalculate if window resizes
    window.addEventListener('resize', calculateStickyOffset);
    return () => window.removeEventListener('resize', calculateStickyOffset);
  }, [stickyActivationOffset]);

  // Category filtering function with smart scroll transition
  const handleCategorySelect = async (categoryName: string) => {
    if (categoryName === selectedCategory) return;
    
    // Start transition
    setIsTransitioning(true);
    
    // Wait for fade out
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Use stored sticky activation offset
    const currentScrollY = window.scrollY;
    
    if (stickyActivationOffset !== null) {
      // Only reset scroll if we're past the stored activation point
      if (currentScrollY > stickyActivationOffset) {
        // Scroll to the stored activation offset
        window.scrollTo({ top: stickyActivationOffset, behavior: 'instant' as ScrollBehavior });
      }
    }
    
    // Change category
    setSelectedCategory(categoryName);
    
    // Wait a moment then fade back in
    setTimeout(() => {
      setIsTransitioning(false);
    }, 50);
  };

  // Filter avatars based on selected category
  const filteredAvatars = selectedCategory === 'All'
    ? avatars 
    : avatars.filter(avatar => {
        const baseName = getAvatarBaseName(avatar.filename);
        const category = AVATAR_CATEGORIES.find(c => c.name === selectedCategory);
        return category && baseName.startsWith(category.prefix);
      });

  return (
    <div>
      {/* Category Filter Buttons - Sticky at top (only shown if not hidden) */}
      {!hideCategoryFilter && (
        <div ref={stickyRef} className="sticky top-0 bg-gray-900 pb-4 mb-4 z-10 border-b border-gray-700">
          <div className="flex flex-wrap gap-2">
            {/* All button */}
            <JMSimpleButton
              onClick={() => handleCategorySelect('All')}
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
                onClick={() => handleCategorySelect(category.name)}
                backgroundColor={selectedCategory === category.name ? '#FF1B6D' : '#374151'}
                titleColor={selectedCategory === category.name ? '#ffffff' : '#d1d5db'}
                size="sm"
              >
                {category.name}
              </JMSimpleButton>
            ))}
          </div>
        </div>
      )}
      
      {/* Avatar Grid - Responsive columns with fade transition */}
      <div 
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-[30px] relative z-0 transition-opacity duration-150 ${
          isTransitioning ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {filteredAvatars.map((avatar) => (
          <JMAvatarGridItem
            key={avatar.filename}
            avatar={avatar}
            onRename={onRename}
            onDelete={onDelete}
            onScaleUpdate={onScaleUpdate}
            showManagementControls={showManagementControls}
            mode={mode}
            onSelect={onSelect}
          />
        ))}
      </div>
      
      {/* Empty State for Filtered Results */}
      {filteredAvatars.length === 0 && avatars.length > 0 && (
        <div 
          className={`text-center text-gray-400 py-16 transition-opacity duration-150 ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <p>No avatars found for the selected category.</p>
          <p className="text-sm mt-2">
            Try selecting a different category or click &ldquo;All&rdquo; to see all avatars.
          </p>
        </div>
      )}
      
      {/* Empty State for No Avatars */}
      {avatars.length === 0 && (
        <div 
          className={`text-center text-gray-400 py-16 transition-opacity duration-150 ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <p>No avatar files found.</p>
          <p className="text-sm mt-2">
            Place Lottie JSON files in the public/avatars directory.
          </p>
        </div>
      )}
    </div>
  );
}
