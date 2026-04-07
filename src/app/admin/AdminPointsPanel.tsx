"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Star } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import {
  getAllPointActivities,
  setPointActivity,
  seedDefaultActivities,
  type PointActivity,
} from "@/lib/points";

export function AdminPointsPanel() {
  const { theme } = useJMStyle();
  const [activities, setActivities] = useState<PointActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const fetchActivities = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await seedDefaultActivities();
      const data = await getAllPointActivities();
      setActivities(data);
      const vals: Record<string, number> = {};
      for (const a of data) vals[a.key] = a.points;
      setEditValues(vals);
    } catch (err) {
      console.error("Failed to fetch point activities:", err);
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const handleSave = async (activity: PointActivity) => {
    const newPoints = editValues[activity.key] ?? activity.points;
    if (newPoints === activity.points) return;

    setSavingKey(activity.key);
    try {
      await setPointActivity(activity.key, {
        label: activity.label,
        points: newPoints,
        order: activity.order,
      });
      setActivities((prev) =>
        prev.map((a) => (a.key === activity.key ? { ...a, points: newPoints } : a)),
      );
      setSavedKey(activity.key);
      setTimeout(() => setSavedKey(null), 2000);
    } catch {
      setError("Failed to save.");
    } finally {
      setSavingKey(null);
    }
  };

  const hasChanged = (key: string) => {
    const activity = activities.find((a) => a.key === key);
    if (!activity) return false;
    return (editValues[key] ?? activity.points) !== activity.points;
  };

  return (
    <div className="mt-6 space-y-4">
      {/* Toolbar */}
      <div
        className="rounded-2xl border backdrop-blur-md"
        style={{ backgroundColor: `${theme.surfaces.base}ee`, borderColor: theme.surfaces.elevated2 }}
      >
        <div className="flex items-center gap-4 px-8 py-5">
          <Star size={20} style={{ color: theme.accents.goldenGlow }} />
          <div className="text-sm font-medium" style={{ color: theme.text.secondary }}>
            Set point values for each activity. Points are awarded each time a user completes the action.
          </div>
        </div>
      </div>

      {/* Activities list */}
      <div
        className="overflow-hidden rounded-2xl border backdrop-blur-md"
        style={{ backgroundColor: `${theme.surfaces.base}ee`, borderColor: theme.surfaces.elevated2 }}
      >
        {isLoading ? (
          <div className="px-8 py-12 text-center">
            <div
              className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: theme.accents.goldenGlow, borderTopColor: "transparent" }}
            />
          </div>
        ) : error ? (
          <div className="px-8 py-12 text-center text-sm" style={{ color: theme.semantic.error }}>
            {error}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: theme.surfaces.elevated2 }}>
            {/* Header */}
            <div
              className="flex items-center gap-4 px-6 py-3 text-xs font-medium uppercase tracking-wider"
              style={{ color: theme.text.tertiary }}
            >
              <span className="flex-1">Activity</span>
              <span className="w-28 text-center">Points</span>
              <span className="w-16" />
            </div>

            {activities.map((activity) => (
              <div
                key={activity.key}
                className="flex items-center gap-4 px-6 py-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium" style={{ color: theme.text.primary }}>
                    {activity.label}
                  </p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: theme.text.tertiary }}>
                    {activity.key}
                  </p>
                </div>

                <div className="w-28">
                  <input
                    type="number"
                    min={0}
                    value={editValues[activity.key] ?? 0}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        [activity.key]: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="w-full rounded-lg border px-3 py-2 text-center text-sm tabular-nums focus:outline-none focus:ring-1"
                    style={{
                      borderColor: hasChanged(activity.key) ? theme.accents.goldenGlow : theme.surfaces.elevated2,
                      backgroundColor: theme.surfaces.elevated1,
                      color: theme.text.primary,
                      // @ts-expect-error CSS custom property
                      "--tw-ring-color": theme.accents.neonPink,
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && hasChanged(activity.key)) handleSave(activity);
                    }}
                  />
                </div>

                <div className="w-16 flex justify-center">
                  {savingKey === activity.key ? (
                    <Loader2 size={18} className="animate-spin" style={{ color: theme.text.tertiary }} />
                  ) : savedKey === activity.key ? (
                    <span className="text-xs font-semibold" style={{ color: theme.semantic.success ?? "#22c55e" }}>
                      Saved
                    </span>
                  ) : hasChanged(activity.key) ? (
                    <button
                      onClick={() => handleSave(activity)}
                      className="rounded-lg p-2 transition-all hover:scale-110"
                      style={{ backgroundColor: `${theme.accents.goldenGlow}20`, color: theme.accents.goldenGlow }}
                    >
                      <Save size={16} />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
