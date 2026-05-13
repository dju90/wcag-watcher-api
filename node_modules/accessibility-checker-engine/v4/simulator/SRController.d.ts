import { SRCursor } from "./SRCursor";
import { NavigationMode, NavigationResult, RenderResult } from "./SRTypes";
/**
 * SRController class for managing screen reader simulation
 * Maintains a point of regard and provides navigation functions
 */
export declare class SRController {
    private rootElement;
    static singleton: any;
    static getController(ctrlDoc?: HTMLDocument): SRController;
    /** The current point of regard */
    private pointOfRegard;
    private mutationObserver;
    private liveListeners;
    private ctrlDoc;
    /**
     * Creates a new SRController
     * @param rootElement The root element to start from (defaults to document.body)
     */
    private constructor();
    disconnect(): void;
    private findAllShadowRoots;
    /**
     * Set up mutation tracking
     *
     * In the event that the point of regard is removed from the DOM, we need to get up to the nearest parent that's not being removed
     */
    private setupMutationTracking;
    addLiveListener(listener: (result: string) => Promise<void>): void;
    removeLiveListener(removeListener: (result: string) => Promise<void>): void;
    /**
     * Get the current point of regard
     * @returns The current SRCursor representing the point of regard
     */
    getPointOfRegard(): SRCursor;
    /**
     * Set the point of regard to a specific DOM node
     * @param node The node to set as the point of regard
     * @returns NavigationResult indicating success or failure
     */
    setPointOfRegard(node: Node): NavigationResult;
    /**
     * Jump to the next element by the specified mode
     * @param mode The navigation mode to use
     * @returns NavigationResult indicating success or failure
     */
    jumpNext(mode: NavigationMode): NavigationResult;
    /**
     * Jump to the previous element by the specified mode
     * @param mode The navigation mode to use
     * @returns NavigationResult indicating success or failure
     */
    jumpPrevious(mode: NavigationMode): NavigationResult;
    /**
     * Determine the different in containers between the two nodes
     * @param newWalker The new node we're navigating to
     * @param oldWalker The previous node we were at
     * @returns Array of container change messages
     */
    static diffContainers(mode: NavigationMode | "focus", newWalker: SRCursor, oldWalker?: SRCursor): {
        leaving: string[];
        entering: string[];
    };
    private static commonParent;
    static renderAll(mode: NavigationMode): string[];
    static renderAllDetail(doc: HTMLDocument, mode: NavigationMode): RenderResult[];
    static renderStructure(doc: HTMLDocument): Array<{
        [key: string]: string;
    }>;
}
