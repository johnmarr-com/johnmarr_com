// Utilities
export { cn } from "./utils";

// Avatar utilities
export {
  avatarScaleMap,
  extractAvatarId,
  getAvatarBaseName,
  getAvatarScale,
  updateAvatarScale,
  type AvatarScaleData,
} from "./avatar-scale-map";

// Firebase exports
export { FirebaseProvider, useFirebase } from "./FirebaseProvider";
export { initializeFirebase, getFirebaseApp, getFirebaseAnalytics } from "./firebase";
export { firebaseConfig } from "./firebase-config";

// Auth exports
export { AuthProvider, useAuth } from "./AuthProvider";
export { AuthGate } from "./AuthGate";
export { AdminGate } from "./AdminGate";
export {
  getAuth,
  signInWithGoogle,
  signInWithEmail,
  sendSignInLink,
  completeSignInWithEmailLink,
  isEmailSignInLink,
  signOut,
  saveUserProfile,
  logSourceVisit,
  logSignupAttempt,
  logSignupSuccess,
  logEmailSignupSuccess,
  // Admin role management (client-side)
  grantAdminRole,
  revokeAdminRole,
} from "./auth";

// Content types
export type {
  JMContentType,
  JMContentLevel,
  JMContent,
  JMContentInput,
  JMContentUpdate,
  JMContentWithChildren,
  JMExperience,
  JMExperienceInput,
  JMExperienceUpdate,
  JMExperienceWithContent,
  JMContentCounts,
  JMAlert,
  JMAlertInput,
  JMAlertUpdate,
  JMBrand,
  JMBrandInput,
  JMBrandUpdate,
} from "./content-types";

export {
  JMContentTypeLabels,
  JMContentTypePluralLabels,
  JMContentLevelLabels,
  getContentLevelLabel,
  canHaveChildren,
  isPlayable,
  getValidChildLevels,
  isValidChildLevel,
} from "./content-types";

// Content CRUD operations
export {
  // Content
  createContent,
  getContent,
  updateContent,
  deleteContent,
  getTopLevelContent,
  getContentChildren,
  getContentWithChildren,
  getContentByCreator,
  getContentCounts,
  searchContent,
  // Experiences
  createExperience,
  getExperience,
  updateExperience,
  deleteExperience,
  getExperiences,
  getExperienceWithContent,
  getExperiencesWithContent,
  addContentToExperience,
  removeContentFromExperience,
  reorderExperienceContent,
  // Featured content
  getFeaturedContent,
  getAllFeaturedItems,
  createFeaturedItem,
  updateFeaturedItem,
  deleteFeaturedItem,
  reorderFeaturedItems,
  type JMFeaturedItem,
  type JMFeaturedInput,
  // Alerts
  createAlert,
  getAllAlerts,
  getPublishedAlert,
  updateAlert,
  publishAlert,
  unpublishAlert,
  deleteAlert,
  // Brands
  createBrand,
  getBrand,
  getAllBrands,
  updateBrand,
  deleteBrand,
  uploadBrandLogo,
  getContentByBrand,
} from "./content";
