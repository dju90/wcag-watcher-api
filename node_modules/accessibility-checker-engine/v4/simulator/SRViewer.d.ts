import { SRController } from "./SRController";
import { NavigationMode, NavigationResult } from "./SRTypes";
/**
 * SROverlay class for creating a UI widget to control screen reader simulation
 * Provides buttons for navigation and displays results
 */
export declare class SROverlay {
    private srViewer;
    /** The container element for the overlay */
    private container;
    /** The results display element */
    private resultsDisplay;
    /** Navigation modes available in the UI */
    private navigationModes;
    /**
     * Creates a new SROverlay
     * @param controller The SRController instance to use for navigation
     */
    constructor(srViewer: SRViewer);
    private createDOMElement;
    /**
     * Creates the overlay UI elements and adds them to the DOM
     */
    private createOverlay;
    /**
     * Display the navigation result in the overlay
     * @param result The navigation result
     * @param mode The navigation mode used
     * @param direction The navigation direction ('next', 'previous', or 'focus')
     */
    displayResult(result: NavigationResult, mode: NavigationMode, direction: 'next' | 'previous' | 'focus'): void;
    displayAll(result: Array<{
        [key: string]: string;
    }>): void;
    /**
     * Remove the overlay from the DOM
     */
    destroy(): void;
}
/**
 * SRViewer class for managing screen reader simulation with UI controls
 */
export declare class SRViewer {
    /** The controller instance */
    private controller;
    /** The overlay UI instance */
    private overlay;
    /** Flag to track if speech is active */
    private isStreaming;
    /** Flag to set if showing all */
    private isShowingAll;
    /** Flag to set if it should be speaking */
    private speechEnabled;
    /** Keyboard event handler */
    private keyboardHandler;
    /** Focus event handler */
    private focusHandler;
    viewerDoc: HTMLDocument;
    /**
     * Creates a new SRViewer
     * @param rootElement The root element to start from (defaults to document.body)
     */
    constructor(rootElement?: Node);
    showAll(bEnableAllMode?: boolean): void;
    toggleSpeech(): void;
    /**
     * Navigate to the next element using the specified mode
     * @param mode The navigation mode to use
     */
    navigateNext(mode: NavigationMode): void;
    /**
     * Navigate to the previous element using the specified mode
     * @param mode The navigation mode to use
     */
    navigatePrevious(mode: NavigationMode): void;
    /**
     * Set up keyboard event handlers for screen reader navigation
     */
    private setupKeyboardHandlers;
    private speakResult;
    /**
     * Stop speech output
     */
    private stopSpeech;
    /**
     * Set up mutation tracking
     */
    private setupMutationTracking;
    /**
     * Set up focus tracking to update the point of regard when focus changes
     */
    private setupFocusTracking;
    /**
     * Activate (click) the element at the current point of regard
     */
    private activateCurrentElement;
    /**
     * Get the controller instance
     * @returns The SRController instance
     */
    getController(): SRController;
    /**
     * Destroy the viewer and clean up resources
     */
    destroy(): void;
}
