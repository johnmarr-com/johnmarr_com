"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Plus, Trash2, Eye, EyeOff, Pencil, Loader2, X, ImageIcon } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import {
  getAllBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  uploadBrandLogo,
} from "@/lib/content";
import type { JMBrand } from "@/lib/content-types";

export function AdminBrandsPanel() {
  const { theme } = useJMStyle();
  const { user } = useAuth();
  const [brands, setBrands] = useState<JMBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<JMBrand | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLogoFile, setFormLogoFile] = useState<File | null>(null);
  const [formLogoPreview, setFormLogoPreview] = useState<string | null>(null);

  const loadBrands = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedBrands = await getAllBrands(false); // Include drafts
      setBrands(fetchedBrands);
    } catch (err) {
      console.error("Failed to load brands:", err);
      setError("Failed to load brands. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  const openCreateModal = () => {
    setEditingBrand(null);
    setFormName("");
    setFormDescription("");
    setFormLogoFile(null);
    setFormLogoPreview(null);
    setShowModal(true);
  };

  const openEditModal = (brand: JMBrand) => {
    setEditingBrand(brand);
    setFormName(brand.name);
    setFormDescription(brand.description);
    setFormLogoFile(null);
    setFormLogoPreview(brand.logoURL || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBrand(null);
    setFormName("");
    setFormDescription("");
    setFormLogoFile(null);
    setFormLogoPreview(null);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setError("Brand name is required");
      return;
    }
    if (!user?.uid) return;

    setIsSaving(true);
    setError(null);

    try {
      if (editingBrand) {
        // Update existing brand
        let logoURL = editingBrand.logoURL;
        
        if (formLogoFile) {
          logoURL = await uploadBrandLogo(formLogoFile, editingBrand.id);
        }

        await updateBrand(editingBrand.id, {
          name: formName.trim(),
          description: formDescription.trim(),
          logoURL,
        });
      } else {
        // Create new brand
        const tempId = `new-${Date.now()}`;
        let logoURL = "";
        
        if (formLogoFile) {
          logoURL = await uploadBrandLogo(formLogoFile, tempId);
        }

        await createBrand(
          {
            name: formName.trim(),
            description: formDescription.trim(),
            logoURL,
            isPublished: false,
          },
          user.uid
        );
      }

      await loadBrands();
      closeModal();
    } catch (err) {
      console.error("Failed to save brand:", err);
      setError("Failed to save brand. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePublish = async (brand: JMBrand) => {
    try {
      await updateBrand(brand.id, { isPublished: !brand.isPublished });
      await loadBrands();
    } catch (err) {
      console.error("Failed to toggle publish:", err);
      setError("Failed to update brand status.");
    }
  };

  const handleDelete = async (brand: JMBrand) => {
    if (!confirm(`Are you sure you want to delete "${brand.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteBrand(brand.id);
      await loadBrands();
    } catch (err) {
      console.error("Failed to delete brand:", err);
      setError("Failed to delete brand.");
    }
  };

  return (
    <div
      className="mt-6 opacity-0 animate-fade-in-up animation-delay-400 rounded-2xl border backdrop-blur-md"
      style={{
        backgroundColor: `${theme.surfaces.base}ee`,
        borderColor: theme.surfaces.elevated2,
      }}
    >
      {/* Header */}
      <div
        className="px-8 py-6 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${theme.surfaces.elevated2}` }}
      >
        <div>
          <h2
            className="text-lg font-semibold"
            style={{ color: theme.text.primary }}
          >
            Brands
          </h2>
          <p className="text-sm mt-1" style={{ color: theme.text.tertiary }}>
            {isLoading ? "Loading..." : `${brands.length} brand${brands.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
          style={{
            backgroundColor: theme.accents.goldenGlow,
            color: theme.surfaces.base,
          }}
        >
          <Plus size={18} />
          <span className="font-medium">New Brand</span>
        </button>
      </div>

      {/* Content */}
      <div className="p-8">
        {error && (
          <div
            className="mb-4 p-3 rounded-lg text-sm"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              color: "#EF4444",
            }}
          >
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2
              className="h-8 w-8 animate-spin"
              style={{ color: theme.accents.goldenGlow }}
            />
          </div>
        ) : brands.length === 0 ? (
          <div
            className="text-center py-12"
            style={{ color: theme.text.tertiary }}
          >
            <p>No brands yet. Create your first brand to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {brands.map((brand) => (
              <div
                key={brand.id}
                className="rounded-lg border overflow-hidden"
                style={{
                  backgroundColor: theme.surfaces.elevated1,
                  borderColor: theme.surfaces.elevated2,
                }}
              >
                {/* Logo */}
                <div
                  className="aspect-square relative flex items-center justify-center"
                  style={{ backgroundColor: theme.surfaces.elevated2 }}
                >
                  {brand.logoURL ? (
                    <Image
                      src={brand.logoURL}
                      alt={brand.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <ImageIcon
                      size={48}
                      style={{ color: theme.text.tertiary }}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3
                    className="font-semibold truncate"
                    style={{ color: theme.text.primary }}
                  >
                    {brand.name}
                  </h3>
                  {brand.description && (
                    <p
                      className="text-sm mt-1 line-clamp-2"
                      style={{ color: theme.text.secondary }}
                    >
                      {brand.description}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={() => handleTogglePublish(brand)}
                      className="p-2 rounded-lg transition-colors hover:bg-white/10"
                      title={brand.isPublished ? "Unpublish" : "Publish"}
                    >
                      {brand.isPublished ? (
                        <Eye size={18} style={{ color: theme.accents.goldenGlow }} />
                      ) : (
                        <EyeOff size={18} style={{ color: theme.text.tertiary }} />
                      )}
                    </button>
                    <button
                      onClick={() => openEditModal(brand)}
                      className="p-2 rounded-lg transition-colors hover:bg-white/10"
                      title="Edit"
                    >
                      <Pencil size={18} style={{ color: theme.text.secondary }} />
                    </button>
                    <button
                      onClick={() => handleDelete(brand)}
                      className="p-2 rounded-lg transition-colors hover:bg-red-500/20"
                      title="Delete"
                    >
                      <Trash2 size={18} style={{ color: "#EF4444" }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={closeModal}
          />

          {/* Modal */}
          <div
            className="relative w-full max-w-md rounded-2xl shadow-xl"
            style={{
              backgroundColor: theme.surfaces.base,
              border: `1px solid ${theme.surfaces.elevated2}`,
            }}
          >
            {/* Header */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${theme.surfaces.elevated2}` }}
            >
              <h3
                className="text-lg font-semibold"
                style={{ color: theme.text.primary }}
              >
                {editingBrand ? "Edit Brand" : "New Brand"}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg transition-colors hover:bg-white/10"
              >
                <X size={20} style={{ color: theme.text.tertiary }} />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {/* Logo Upload */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: theme.text.secondary }}
                >
                  Logo (1:1 Square)
                </label>
                <div className="flex items-center gap-4">
                  <div
                    className="w-20 h-20 rounded-lg overflow-hidden flex items-center justify-center relative"
                    style={{ backgroundColor: theme.surfaces.elevated2 }}
                  >
                    {formLogoPreview ? (
                      <Image
                        src={formLogoPreview}
                        alt="Logo preview"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <ImageIcon size={24} style={{ color: theme.text.tertiary }} />
                    )}
                  </div>
                  <label
                    className="px-4 py-2 rounded-lg cursor-pointer transition-colors"
                    style={{
                      backgroundColor: theme.surfaces.elevated1,
                      color: theme.text.primary,
                      border: `1px solid ${theme.surfaces.elevated2}`,
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoSelect}
                    />
                    Choose File
                  </label>
                </div>
              </div>

              {/* Name */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: theme.text.secondary }}
                >
                  Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Brand name"
                  className="w-full px-4 py-3 rounded-lg outline-none transition-colors"
                  style={{
                    backgroundColor: theme.surfaces.elevated1,
                    color: theme.text.primary,
                    border: `1px solid ${theme.surfaces.elevated2}`,
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: theme.text.secondary }}
                >
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of this brand"
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg outline-none transition-colors resize-none"
                  style={{
                    backgroundColor: theme.surfaces.elevated1,
                    color: theme.text.primary,
                    border: `1px solid ${theme.surfaces.elevated2}`,
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-6 py-4 flex items-center justify-end gap-3"
              style={{ borderTop: `1px solid ${theme.surfaces.elevated2}` }}
            >
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg transition-colors"
                style={{
                  color: theme.text.secondary,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !formName.trim()}
                className="px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: theme.accents.goldenGlow,
                  color: theme.surfaces.base,
                }}
              >
                {isSaving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  editingBrand ? "Save Changes" : "Create Brand"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
