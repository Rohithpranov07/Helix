import type { FC } from "react";

export interface StaggeredMenuItem {
  /** Visible label for the menu item. */
  label: string;
  /** Accessible label for the link. */
  ariaLabel?: string;
  /** Destination URL. */
  link: string;
}

export interface StaggeredMenuSocialItem {
  label: string;
  link: string;
}

export interface StaggeredMenuProps {
  /** Anchor position for the menu panel. */
  position?: "left" | "right";
  /** Colors used for the staggered underlay layers. */
  colors?: string[];
  /** Menu items rendered inside the panel. */
  items?: StaggeredMenuItem[];
  /** Social links displayed in the menu panel. */
  socialItems?: StaggeredMenuSocialItem[];
  /** Whether to display the social links section. */
  displaySocials?: boolean;
  /** Whether to show numbering for menu items. */
  displayItemNumbering?: boolean;
  /** Optional extra class names. */
  className?: string;
  /** Color of the menu toggle button when closed. */
  menuButtonColor?: string;
  /** Color of the menu toggle button when open. */
  openMenuButtonColor?: string;
  /** Hover accent color for menu items. */
  accentColor?: string;
  /** Whether to animate the button color when opening/closing. */
  changeMenuColorOnOpen?: boolean;
  /** Render the wrapper as a fixed, full-viewport overlay. */
  isFixed?: boolean;
  /** Whether to close the menu when clicking outside. */
  closeOnClickAway?: boolean;
  /** Called when the menu opens. */
  onMenuOpen?: () => void;
  /** Called when the menu closes. */
  onMenuClose?: () => void;
}

export declare const StaggeredMenu: FC<StaggeredMenuProps>;
export default StaggeredMenu;
