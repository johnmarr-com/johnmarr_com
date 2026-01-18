"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, ChevronRight } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { getAuth } from "@/lib/auth";
import { UserEditModal } from "./UserEditModal";

interface UserData {
  uid: string;
  displayName: string | null;
  email: string | null;
  tier: string;
  createdAt: string | null;
}

const MIN_SEARCH_LENGTH = 2;

/**
 * AdminUsersPanel - User management panel for admin dashboard
 * 
 * Features:
 * - Total user count
 * - Search by displayName or email (if contains @)
 * - Only fetches users when searching (scalable)
 * - Click user to open edit modal
 */
export function AdminUsersPanel() {
  const { theme } = useJMStyle();
  const [users, setUsers] = useState<UserData[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Fetch user count on mount
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const auth = await getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const idToken = await currentUser.getIdToken();
        const response = await fetch("/api/admin/users?countOnly=true", {
          headers: { "Authorization": `Bearer ${idToken}` },
        });

        if (response.ok) {
          const data = await response.json();
          setTotalCount(data.total);
        }
      } catch (err) {
        console.error("Failed to fetch user count:", err);
      }
    };

    fetchCount();
  }, []);

  // Search users when query changes
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < MIN_SEARCH_LENGTH) {
      setUsers([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const auth = await getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError("Not authenticated");
        setIsLoading(false);
        return;
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}`, {
        headers: { "Authorization": `Bearer ${idToken}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to search users");
      }

      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      console.error("Failed to search users:", err);
      setError(err instanceof Error ? err.message : "Failed to search users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  const showResults = searchQuery.length >= MIN_SEARCH_LENGTH;

  return (
    <div className="mt-6 space-y-4">
      {/* Search toolbar */}
      <div 
        className="rounded-2xl border backdrop-blur-md"
        style={{ 
          backgroundColor: `${theme.surfaces.base}ee`,
          borderColor: theme.surfaces.elevated2,
        }}
      >
        <div className="px-8 py-5 flex items-center justify-between gap-6">
          {/* Left: Total count */}
          <div 
            className="text-sm font-medium whitespace-nowrap"
            style={{ color: theme.text.secondary }}
          >
            Total users:{" "}
            <span style={{ color: theme.text.primary }}>
              {totalCount === null ? "..." : totalCount}
            </span>
          </div>

          {/* Right: Search field */}
          <div className="relative flex-1 max-w-sm">
            <Search 
              size={16} 
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: theme.text.tertiary }}
            />
            <input
              type="text"
              placeholder="Search by name or @email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm transition-all focus:outline-none focus:ring-1"
              style={{
                backgroundColor: theme.surfaces.elevated1,
                borderColor: theme.surfaces.elevated2,
                color: theme.text.primary,
                // @ts-expect-error CSS custom property
                "--tw-ring-color": theme.accents.goldenGlow,
              }}
            />
          </div>
        </div>
      </div>

      {/* Users list */}
      <div 
        className="rounded-2xl border backdrop-blur-md"
        style={{ 
          backgroundColor: `${theme.surfaces.base}ee`,
          borderColor: theme.surfaces.elevated2,
        }}
      >
        {isLoading ? (
          <div className="px-8 py-6 text-center">
            <div 
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: theme.accents.goldenGlow, borderTopColor: 'transparent' }}
            />
          </div>
        ) : error ? (
          <div 
            className="px-8 py-6 text-center text-sm"
            style={{ color: theme.semantic.error }}
          >
            {error}
          </div>
        ) : !showResults ? (
          <div 
            className="px-8 py-6 text-center text-sm"
            style={{ color: theme.text.tertiary }}
          >
            Enter a name or @email to search
          </div>
        ) : users.length === 0 ? (
          <div 
            className="px-8 py-6 text-center text-sm"
            style={{ color: theme.text.tertiary }}
          >
            No users found
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: theme.surfaces.elevated2 }}>
            {users.map((user) => (
              <button
                key={user.uid}
                onClick={() => setSelectedUserId(user.uid)}
                className="w-full px-8 py-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
              >
                <div>
                  <div 
                    className="font-medium"
                    style={{ color: theme.text.primary }}
                  >
                    {user.displayName || "No name"}
                  </div>
                  <div 
                    className="text-sm"
                    style={{ color: theme.text.tertiary }}
                  >
                    {user.email || "No email"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div 
                    className="text-xs px-2 py-1 rounded-full"
                    style={{ 
                      backgroundColor: user.tier === "free" 
                        ? theme.surfaces.elevated2 
                        : `${theme.accents.goldenGlow}30`,
                      color: user.tier === "free" 
                        ? theme.text.tertiary 
                        : theme.accents.goldenGlow,
                    }}
                  >
                    {user.tier}
                  </div>
                  <ChevronRight 
                    size={16} 
                    style={{ color: theme.text.tertiary }}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User edit modal */}
      {selectedUserId && (
        <UserEditModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onSaved={() => {
            // Refresh search results
            searchUsers(searchQuery);
          }}
        />
      )}
    </div>
  );
}
