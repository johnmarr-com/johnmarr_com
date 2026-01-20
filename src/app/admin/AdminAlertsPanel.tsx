"use client";

import { useState, useEffect, useCallback } from "react";
import { useJMStyle } from "@/JMStyle";
import { 
  getAllAlerts,
  createAlert,
  updateAlert,
  publishAlert,
  unpublishAlert,
  deleteAlert,
} from "@/lib/content";
import type { JMAlert } from "@/lib/content-types";
import { 
  Plus, Trash2, Eye, EyeOff, Pencil,
  Loader2, AlertCircle, X, AlertTriangle, Check
} from "lucide-react";

export function AdminAlertsPanel() {
  const { theme } = useJMStyle();
  
  // Alerts state
  const [alerts, setAlerts] = useState<JMAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create/Edit state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState<JMAlert | null>(null);
  const [alertText, setAlertText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load alerts
  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await getAllAlerts();
      setAlerts(items);
    } catch (err) {
      console.error("Failed to load alerts:", err);
      setError("Failed to load alerts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Create new alert
  const handleCreate = async () => {
    if (!alertText.trim()) return;
    
    setIsSaving(true);
    try {
      await createAlert({ text: alertText.trim() });
      setAlertText("");
      setShowCreateModal(false);
      await loadAlerts();
    } catch (err) {
      console.error("Failed to create alert:", err);
      setError("Failed to create alert");
    } finally {
      setIsSaving(false);
    }
  };

  // Update alert text
  const handleUpdate = async () => {
    if (!editingAlert || !alertText.trim()) return;
    
    setIsSaving(true);
    try {
      await updateAlert(editingAlert.id, { text: alertText.trim() });
      setAlertText("");
      setEditingAlert(null);
      await loadAlerts();
    } catch (err) {
      console.error("Failed to update alert:", err);
      setError("Failed to update alert");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle publish status
  const handleTogglePublish = async (alert: JMAlert) => {
    try {
      if (alert.isPublished) {
        await unpublishAlert(alert.id);
      } else {
        await publishAlert(alert.id);
      }
      await loadAlerts();
    } catch (err) {
      console.error("Failed to toggle publish status:", err);
      setError("Failed to update alert");
    }
  };

  // Delete alert
  const handleDelete = async (alert: JMAlert) => {
    if (!confirm(`Delete this alert?\n\n"${alert.text}"`)) return;
    
    try {
      await deleteAlert(alert.id);
      setAlerts(prev => prev.filter(a => a.id !== alert.id));
    } catch (err) {
      console.error("Failed to delete alert:", err);
      setError("Failed to delete alert");
    }
  };

  // Open edit modal
  const openEditModal = (alert: JMAlert) => {
    setEditingAlert(alert);
    setAlertText(alert.text);
  };

  // Close modal
  const closeModal = () => {
    setShowCreateModal(false);
    setEditingAlert(null);
    setAlertText("");
  };

  const publishedAlert = alerts.find(a => a.isPublished);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 
            className="text-2xl font-semibold"
            style={{ color: theme.text.primary }}
          >
            Site Alerts
          </h2>
          <p style={{ color: theme.text.tertiary }} className="text-sm mt-1">
            Create and manage site-wide alert banners. Only one alert can be active at a time.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors"
          style={{ 
            backgroundColor: theme.accents.goldenGlow,
            color: theme.surfaces.base,
          }}
        >
          <Plus className="h-4 w-4" />
          New Alert
        </button>
      </div>

      {/* Currently Published Alert Preview */}
      {publishedAlert && (
        <div className="space-y-2">
          <p 
            className="text-sm font-medium"
            style={{ color: theme.text.secondary }}
          >
            Currently Active Alert:
          </p>
          <div 
            className="rounded-xl px-6 py-4"
            style={{ backgroundColor: theme.accents.goldenGlow }}
          >
            <p 
              className="text-center font-bold whitespace-pre-wrap"
              style={{ color: "#000" }}
            >
              {publishedAlert.text}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div 
          className="flex items-center gap-2 rounded-lg p-3"
          style={{ backgroundColor: `${theme.semantic.error}20`, color: theme.semantic.error }}
        >
          <AlertCircle className="h-4 w-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: theme.accents.goldenGlow }} />
        </div>
      ) : alerts.length === 0 ? (
        /* Empty state */
        <div 
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16"
          style={{ borderColor: theme.surfaces.elevated2, color: theme.text.tertiary }}
        >
          <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No alerts yet</p>
          <p className="text-sm">Create an alert to display a site-wide notification</p>
        </div>
      ) : (
        /* Alerts list */
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-4 rounded-lg p-4 transition-all"
              style={{
                backgroundColor: theme.surfaces.elevated1,
                border: `1px solid ${alert.isPublished ? theme.accents.goldenGlow : theme.surfaces.elevated2}`,
              }}
            >
              {/* Alert text */}
              <div className="flex-1 min-w-0">
                <p 
                  className="whitespace-pre-wrap"
                  style={{ color: theme.text.primary }}
                >
                  {alert.text}
                </p>
                <p 
                  className="text-xs mt-2"
                  style={{ color: theme.text.tertiary }}
                >
                  Created: {alert.createdAt?.toDate?.()?.toLocaleDateString() ?? "Unknown"}
                </p>
              </div>

              {/* Status badge */}
              <div 
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                style={{ 
                  backgroundColor: alert.isPublished 
                    ? `${theme.semantic.success}20` 
                    : `${theme.text.tertiary}20`,
                  color: alert.isPublished 
                    ? theme.semantic.success 
                    : theme.text.tertiary,
                }}
              >
                {alert.isPublished ? (
                  <>
                    <Check className="h-3 w-3" />
                    Active
                  </>
                ) : (
                  "Draft"
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleTogglePublish(alert)}
                  className="p-2 rounded-lg transition-colors hover:bg-white/5"
                  title={alert.isPublished ? "Unpublish" : "Publish"}
                  style={{ color: alert.isPublished ? theme.semantic.success : theme.text.tertiary }}
                >
                  {alert.isPublished ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => openEditModal(alert)}
                  className="p-2 rounded-lg transition-colors hover:bg-white/5"
                  title="Edit"
                  style={{ color: theme.text.secondary }}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(alert)}
                  className="p-2 rounded-lg transition-colors hover:bg-red-500/10"
                  style={{ color: theme.semantic.error }}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingAlert) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
            onClick={closeModal}
          />
          <div 
            className="relative w-full max-w-lg rounded-xl p-6"
            style={{ backgroundColor: theme.surfaces.elevated1 }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between mb-4">
              <h3 
                className="text-xl font-semibold"
                style={{ color: theme.text.primary }}
              >
                {editingAlert ? "Edit Alert" : "Create New Alert"}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg hover:bg-white/10"
                style={{ color: theme.text.tertiary }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Alert text input */}
            <div className="mb-4">
              <label 
                className="block text-sm font-medium mb-2"
                style={{ color: theme.text.secondary }}
              >
                Alert Message
              </label>
              <textarea
                value={alertText}
                onChange={(e) => setAlertText(e.target.value)}
                placeholder="Enter alert message..."
                rows={4}
                className="w-full rounded-lg px-4 py-3 resize-none"
                style={{
                  backgroundColor: theme.surfaces.elevated2,
                  color: theme.text.primary,
                  border: `1px solid ${theme.surfaces.elevated3}`,
                }}
              />
            </div>

            {/* Preview */}
            {alertText.trim() && (
              <div className="mb-4">
                <p 
                  className="text-sm font-medium mb-2"
                  style={{ color: theme.text.secondary }}
                >
                  Preview:
                </p>
                <div 
                  className="rounded-xl px-6 py-4"
                  style={{ backgroundColor: theme.accents.goldenGlow }}
                >
                  <p 
                    className="text-center font-bold whitespace-pre-wrap"
                    style={{ color: "#000" }}
                  >
                    {alertText}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: theme.surfaces.elevated2,
                  color: theme.text.primary,
                }}
              >
                Cancel
              </button>
              <button
                onClick={editingAlert ? handleUpdate : handleCreate}
                disabled={!alertText.trim() || isSaving}
                className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{ 
                  backgroundColor: theme.accents.goldenGlow,
                  color: theme.surfaces.base,
                }}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingAlert ? (
                  "Save Changes"
                ) : (
                  "Create Alert"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
