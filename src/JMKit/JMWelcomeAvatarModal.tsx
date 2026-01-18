'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from './JMDialog';
import JMAvatarView from './JMAvatarView';
import { JMSimpleButton } from './JMSimpleButton';
import { devLog, devError } from '@/lib/logger';
import { getAuth } from '@/lib/auth';

interface JMWelcomeAvatarModalProps {
  /** Whether the modal should be shown */
  isOpen: boolean;
  /** Callback when modal closes */
  onClose: () => void;
}

/**
 * Welcome modal shown to first-time users.
 * Auto-selects a random animal avatar, saves it, and displays it.
 */
export function JMWelcomeAvatarModal({ isOpen, onClose }: JMWelcomeAvatarModalProps) {
  const [assignedAvatar, setAssignedAvatar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasAssigned = useRef(false);

  // Auto-assign a random avatar on mount (animals only)
  useEffect(() => {
    if (!isOpen || hasAssigned.current) return;

    const assignRandomAvatar = async () => {
      try {
        devLog('🎲 WelcomeAvatar: Fetching avatars for random selection...');
        const response = await fetch('/api/avatars');
        
        if (!response.ok) {
          devError('🎲 WelcomeAvatar: Failed to fetch avatars');
          setIsLoading(false);
          return;
        }

        const avatarData = await response.json();
        
        if (!Array.isArray(avatarData) || avatarData.length === 0) {
          devError('🎲 WelcomeAvatar: No avatars available');
          setIsLoading(false);
          return;
        }

        // Filter to only animal avatars (prefix "animal-")
        const animalAvatars = avatarData.filter(
          (avatar: { file: string }) => avatar.file.startsWith('animal-')
        );
        
        // Pick a random animal avatar (or fallback to any)
        const pool = animalAvatars.length > 0 ? animalAvatars : avatarData;
        const randomIndex = Math.floor(Math.random() * pool.length);
        const randomAvatar = pool[randomIndex];
        const avatarFilename = randomAvatar.file;
        
        devLog('🎲 WelcomeAvatar: Selected avatar:', avatarFilename);

        // Save the avatar to user profile
        const auth = await getAuth();
        const currentUser = auth.currentUser;
        if (currentUser) {
          const idToken = await currentUser.getIdToken();
          const saveResponse = await fetch('/api/user/avatar', {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ avatarName: avatarFilename }),
          });

          if (saveResponse.ok) {
            devLog('🎲 WelcomeAvatar: Avatar saved successfully');
            hasAssigned.current = true;
            setAssignedAvatar(avatarFilename);
          } else {
            devError('🎲 WelcomeAvatar: Failed to save avatar');
          }
        }
      } catch (error) {
        devError('🎲 WelcomeAvatar: Error assigning avatar:', error);
      } finally {
        setIsLoading(false);
      }
    };

    assignRandomAvatar();
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-md w-[calc(100vw-2rem)] p-0 overflow-hidden bg-gray-900 border-gray-700"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="p-8 flex flex-col items-center text-center">
          {/* Welcome text */}
          <h2 className="text-2xl font-bold text-white mb-2">Welcome!</h2>
          <p className="text-gray-400 mb-6">We picked an avatar for you</p>
          
          {/* Avatar display */}
          <div className="mb-6">
            {isLoading ? (
              <div 
                className="rounded-full bg-gray-700 animate-pulse"
                style={{ width: 160, height: 160 }}
              />
            ) : assignedAvatar ? (
              <div className="rounded-full overflow-hidden bg-gray-800">
                <JMAvatarView
                  width={160}
                  avatarName={assignedAvatar}
                  fullFilename={assignedAvatar}
                />
              </div>
            ) : (
              <div 
                className="rounded-full bg-gray-700 flex items-center justify-center text-gray-500"
                style={{ width: 160, height: 160 }}
              >
                No avatar
              </div>
            )}
          </div>
          
          {/* Info text */}
          <p className="text-sm text-gray-500 mb-6">
            You can change it anytime in your Profile
          </p>
          
          {/* Continue button */}
          <JMSimpleButton
            onClick={onClose}
            disabled={isLoading}
            gradient={{ from: '#FF1B6D', to: '#8B35FF', angle: 135 }}
            titleColor="#ffffff"
            className="w-full max-w-[200px]"
          >
            {isLoading ? 'Setting up...' : 'Continue'}
          </JMSimpleButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
