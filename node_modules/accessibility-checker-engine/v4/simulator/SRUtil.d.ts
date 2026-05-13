export declare namespace SRUtil {
    function isModalDialogElement(node: Node): boolean;
    /**
     * Generates a unique CSS selector for a specific HTML element
     * The selector is built using a combination of:
     * 1. Element tag name
     * 2. ID (if available)
     * 3. Classes (if available)
     * 4. Attributes (if needed)
     * 5. nth-child selectors for position in parent
     *
     * @param element The HTML element to generate a selector for
     * @param optimized If true, creates a shorter but possibly less robust selector
     * @return A CSS selector string that uniquely identifies the element
     */
    function getUniqueSelector(element: HTMLElement, optimized?: boolean): string;
}
