/**
 * JMKit - Reusable UI Component Library
 * 
 * A collection of styled, accessible components for the John Marr application.
 * Components are designed to work seamlessly with JMStyle themes.
 * 
 * Usage:
 * ```tsx
 * import { JMAppHeader, JMSimpleButton } from "@/JMKit";
 * ```
 */

export { JMSimpleButton, type JMSimpleButtonProps } from "./JMSimpleButton";
export { JMAppHeader } from "./JMAppHeader";
export { JMBasicMenu, type JMMenuOption } from "./JMBasicMenu";
export { JMAdminDropdown, type AdminFocus } from "./JMAdminDropdown";
export { JMLottieAvatar, type JMLottieAvatarProps } from "./JMLottieAvatar";
export { JMLiquidLoader, type JMLiquidLoaderProps } from "./JMLiquidLoader";
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./JMDialog";
export { Button, buttonVariants, type ButtonProps } from "./JMButton";

// Avatar components
export { default as JMAvatarView } from "./JMAvatarView";
export { default as JMAvatarPicker, type JMAvatarItem, type JMAvatarPickerProps, AVATAR_CATEGORIES } from "./JMAvatarPicker";
export { default as JMAvatarPreviewAndSelection } from "./JMAvatarPreviewAndSelection";
export { JMWelcomeAvatarModal } from "./JMWelcomeAvatarModal";
export { JMImageUpload, type JMImageUploadProps } from "./JMImageUpload";
export { JMFeaturedCarousel, type FeaturedItem } from "./JMFeaturedCarousel";
export { JMContentScroller, type ContentItem } from "./JMContentScroller";