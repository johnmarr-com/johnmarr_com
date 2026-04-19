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
export { JMAIAvatarView } from "./JMAIAvatarView";
export { default as JMAvatarPicker, type JMAvatarItem, type JMAvatarPickerProps, AVATAR_CATEGORIES } from "./JMAvatarPicker";
export { default as JMAvatarPreviewAndSelection } from "./JMAvatarPreviewAndSelection";
export { JMWelcomeAvatarModal } from "./JMWelcomeAvatarModal";
export { JMCompleteProfileModal } from "./JMCompleteProfileModal";
export { JMImageUpload, type JMImageUploadProps } from "./JMImageUpload";
export { JMVideoUpload, type JMVideoUploadProps } from "./JMVideoUpload";
export { JMAudioUpload, type JMAudioUploadProps } from "./JMAudioUpload";
export { JMFeaturedCarousel, type FeaturedItem } from "./JMFeaturedCarousel";
export { JMContentScroller, type ContentItem } from "./JMContentScroller";
export { JMFeatureRowBanner } from "./JMFeatureRowBanner";
export { JMAuthModal } from "./JMAuthModal";
export { JMEpubReader } from "./JMEpubReader";
export { JMVimeoPlayer, getVimeoId, getVimeoThumbnail, type JMVimeoPlayerProps, type VideoOrientation } from "./JMVimeoPlayer";
export { JMLevelUpPopup } from "./JMLevelUpPopup";
export { JMConfettiOverlay, type JMConfettiOverlayProps } from "./JMConfettiOverlay";
export { JMInviteCodeView } from "./JMInviteCodeView";
export { JMInviteCodeInput } from "./JMInviteCodeInput";
export { JMBannerText, type JMBannerTextProps } from "./JMBannerText";
export { JMChampionPicker, type JMChampionPickerProps, type ChampionOption } from "./JMChampionPicker";
export { JMProButton } from "./JMProButton";
export { JMMyGamesModal } from "./JMMyGamesModal";
export { JMAIBulkImageGen, type GeneratedImage, type JMAIBulkImageGenProps } from "./JMAIBulkImageGen";
export { JMAvatarColorEditor } from "./JMAvatarColorEditor";
export { JMGameScoreboard, type JMGameScoreboardProps } from "./JMGameScoreboard";
export {
  JMTournamentVs,
  JMTournamentVs_DEFAULT_AVATAR_WIDTH,
  type JMTournamentVsProps,
  type JMTournamentVsSide,
  type JMTournamentVsRoleTone,
} from "./JMTournamentVs";
export {
  OneVsAll,
  OneVsAll_DEFAULT_AVATAR_WIDTH,
  type OneVsAllProps,
  type OneVsAllSide,
  type OneVsAllRoleTone,
} from "./JMOneVsAll";
export {
  JMSelectAsset,
  JM_SELECT_ASSET_Z,
  JM_SELECT_ASSET_DETAIL_Z,
  type JMSelectAssetProps,
  type JMSelectAssetTab,
} from "./JMSelectAsset";
export { JMCloseCircleButton, type JMCloseCircleButtonProps } from "./JMCloseCircleButton";
export { JMCard, type JMCardProps } from "./JMCard";
export { JMCardFlip, type JMCardFlipProps } from "./JMCardFlip";
export { BluffPackCover } from "./BluffPackCover";
export { BluffCard } from "./BluffCard";
export {
  JMTruthLieChoice,
  type JMTruthLieChoiceProps,
  type TruthLieChoice,
} from "./JMTruthLieChoice";
export { JMTeamInterstitial, type JMTeamInterstitialProps } from "./JMTeamInterstitial";
export { JMGameResultOverlay, type JMGameResultOverlayProps } from "./JMGameResultOverlay";