'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent } from './JMDialog';
import { JMSimpleButton } from './JMSimpleButton';
import { getAuth } from '@/lib/auth';
import { Check, X, Loader2 } from 'lucide-react';

interface JMCompleteProfileModalProps {
  isOpen: boolean;
  onComplete: (gamertag: string) => void;
}

const GAMERTAG_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;
const CHECK_DEBOUNCE_MS = 400;

type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function JMCompleteProfileModal({ isOpen, onComplete }: JMCompleteProfileModalProps) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<AvailabilityStatus>('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const checkAvailability = useCallback(async (tag: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('checking');
    try {
      const res = await fetch('/api/user/gamertag/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gamertag: tag }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const data = await res.json();
      if (data.available) {
        setStatus('available');
      } else {
        setStatus(data.reason ? 'invalid' : 'taken');
        if (data.reason) setError(data.reason);
      }
    } catch {
      if (!controller.signal.aborted) setStatus('idle');
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setError(null);

    if (!value.trim()) {
      setStatus('idle');
      return;
    }

    if (!GAMERTAG_REGEX.test(value)) {
      setStatus('invalid');
      setError('3–20 characters: letters, numbers, underscores, or hyphens.');
      return;
    }

    timerRef.current = setTimeout(() => checkAvailability(value), CHECK_DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, checkAvailability]);

  const handleSubmit = async () => {
    if (status !== 'available' || isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      const auth = await getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) { setError('Not authenticated'); setIsSaving(false); return; }

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/user/gamertag', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gamertag: value }),
      });

      if (res.ok) {
        onComplete(value);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save gamertag');
        if (res.status === 409) setStatus('taken');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const statusIcon = (() => {
    switch (status) {
      case 'checking': return <Loader2 size={18} className="animate-spin text-white/40" />;
      case 'available': return <Check size={18} className="text-emerald-400" />;
      case 'taken': return <X size={18} className="text-red-400" />;
      case 'invalid': return <X size={18} className="text-amber-400" />;
      default: return null;
    }
  })();

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md w-[calc(100vw-2rem)] p-0 overflow-hidden bg-gray-900 border-gray-700"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="p-8 flex flex-col items-center text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Pick Your Gamertag</h2>
          <p className="text-gray-400 mb-6">
            Choose a unique name that other players will see.
          </p>

          <div className="w-full max-w-[300px] mb-2">
            <div className="relative">
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/\s/g, ''))}
                placeholder="e.g. ShadowKnight"
                maxLength={20}
                autoFocus
                className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 pr-10 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit();
                }}
              />
              {statusIcon && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {statusIcon}
                </span>
              )}
            </div>

            {status === 'available' && (
              <p className="mt-2 text-sm text-emerald-400 text-left">Available!</p>
            )}
            {status === 'taken' && (
              <p className="mt-2 text-sm text-red-400 text-left">Already taken — try another.</p>
            )}
            {error && status === 'invalid' && (
              <p className="mt-2 text-sm text-amber-400 text-left">{error}</p>
            )}
            {error && status !== 'invalid' && status !== 'taken' && (
              <p className="mt-2 text-sm text-red-400 text-left">{error}</p>
            )}
          </div>

          <p className="text-xs text-gray-500 mb-6">
            You can change it later in your Profile.
          </p>

          <JMSimpleButton
            onClick={handleSubmit}
            disabled={status !== 'available' || isSaving}
            gradient={{ from: '#FF1B6D', to: '#8B35FF', angle: 135 }}
            titleColor="#ffffff"
            className="w-full max-w-[200px]"
          >
            {isSaving ? 'Saving...' : 'Continue'}
          </JMSimpleButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
