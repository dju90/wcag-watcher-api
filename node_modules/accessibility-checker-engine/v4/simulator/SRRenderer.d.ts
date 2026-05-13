import { ContainerChanges, NavigationMode, RenderResult } from "./SRTypes";
import { SRCursor } from "./SRCursor";
/**
 * SRRenderer namespace provides functionality for simulating how screen readers
 * announce content to users. It contains rules for rendering different types of
 * elements and ARIA roles in various navigation modes.
 *
 * The renderer uses a rule-based system to determine what text should be announced
 * when navigating to, within, or away from elements based on their roles and properties.
 */
export declare namespace SRRenderer {
    /**
     * Generates the announcement text when entering an element
     *
     * This function looks up the appropriate rule based on the element's role or tag name
     * and applies it to generate the announcement text.
     *
     * @param mode - The current navigation mode
     * @param walker - Cursor at the current position
     * @param oldWalker - Optional cursor at the previous position
     * @returns Announcement text for entering the element, or null if no rule applies
     */
    function renderEnter(mode: NavigationMode | "focus", walker: SRCursor, oldWalker?: SRCursor): string | null;
    /**
     * Generates the announcement text when leaving an element
     *
     * Similar to renderEnter, but applies rules for leaving elements instead.
     *
     * @param mode - The current navigation mode
     * @param walker - Cursor at the current position
     * @param oldWalker - Optional cursor at the previous position
     * @returns Announcement text for leaving the element, or null if no rule applies
     */
    function renderLeave(mode: NavigationMode, walker: SRCursor, oldWalker?: SRCursor): string | null;
    /**
     * Renders the current element and any container changes
     *
     * This function combines announcements for:
     * - Containers being left
     * - Containers being entered
     * - The current element itself
     *
     * @param mode - The current navigation mode
     * @param walker - Cursor at the current position
     * @param containerChanges - Information about containers being entered or left
     * @returns Combined announcement text
     */
    function renderCurrent(mode: NavigationMode, walker: SRCursor, containerChanges: ContainerChanges): RenderResult | null;
    /**
     * Renders a range of elements between two cursors
     *
     * This function traverses the DOM from startOfRender to endOfRender,
     * applying rendering rules to each element and combining the results.
     *
     * @param mode - The current navigation mode
     * @param startOfRender - Cursor at the start of the range
     * @param endOfRender - Cursor at the end of the range
     * @returns Combined announcement text for the entire range
     */
    function renderRange(mode: NavigationMode, startOfRender: SRCursor, endOfRender: SRCursor): string;
}
