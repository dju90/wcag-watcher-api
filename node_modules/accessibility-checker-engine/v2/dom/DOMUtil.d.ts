/******************************************************************************
     Copyright:: 2020- IBM, Inc

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
 *****************************************************************************/
/**
 * Utility class providing helper methods for DOM manipulation and traversal operations.
 * Used throughout the accessibility checker engine to navigate and analyze DOM structures.
 */
export declare class DOMUtil {
    /**
     * Checks if a given node has an ancestor element with a node name matching any of the provided names.
     * Traverses up the DOM tree from the given node until a match is found or the root is reached.
     *
     * @param node - The starting DOM node to check
     * @param names - Array of node names (tag names) to search for in uppercase (e.g., ['TABLE', 'DIV'])
     * @returns true if an ancestor with a matching name is found, false otherwise
     */
    static hasParent(node: Node, names: string[]): boolean;
    /**
     * Retrieves the first ancestor element that matches any of the provided node names (case-insensitive).
     * Similar to hasParent but returns the actual element reference and performs case-insensitive comparison.
     *
     * @param node - The starting DOM node
     * @param names - Array of lowercase node names to search for (e.g., ['table', 'div'])
     * @returns The matching ancestor element, or null if none found
     */
    static getAncestor(node: Node, names: string[]): Element;
    /**
     * Determines if two nodes are the same node, with fallback strategies for different browser environments.
     * Uses multiple comparison methods for cross-browser compatibility:
     * 1. Strict equality (===)
     * 2. isSameNode() method if available
     * 3. compareDocumentPosition() (returns 0 if same node)
     * 4. Returns true as last resort if no comparison method is available
     *
     * @param a - First node to compare
     * @param b - Second node to compare
     * @returns true if nodes are the same, false otherwise
     */
    static sameNode(a: Node, b: Node): boolean;
    /**
     * Normalizes whitespace in a string by replacing all whitespace characters
     * (spaces, tabs, carriage returns, newlines) with single spaces and collapsing
     * multiple consecutive spaces into one.
     *
     * @param s - The input string to clean
     * @returns The cleaned string with normalized whitespace
     * @example "Hello\n\t  World" → "Hello World"
     */
    static cleanWhitespace(s: string): string;
    /**
     * Collapses multiple consecutive spaces into a single space.
     * Unlike cleanWhitespace, only handles spaces, not other whitespace characters like tabs or newlines.
     *
     * @param s - The input string to clean
     * @returns The string with collapsed spaces
     */
    static cleanSpace(s: string): string;
    /**
     * Determines if two elements (typically table cells) belong to the same table element.
     * Finds the table ancestor for each element and compares them using sameNode().
     *
     * @param element1 - First element to check
     * @param element2 - Second element to check
     * @returns true if both elements share the same table ancestor, false otherwise
     */
    static isInSameTable(element1: any, element2: any): boolean;
    /**
     * Traverses up the DOM tree to find the shadow root (document fragment) that contains the given node.
     * Important for handling Web Components and Shadow DOM structures in accessibility checking.
     *
     * @param node - The starting node
     * @returns The shadow root node (nodeType 11 = DOCUMENT_FRAGMENT_NODE), or null if none found
     */
    static shadowRootNode(node: Node): Node | null;
    /**
     * Creates a deep copy of an object while preserving Node references (doesn't clone Node objects).
     * Useful when copying data structures that contain DOM node references, as you typically want
     * to preserve those references rather than attempting to clone the nodes themselves.
     *
     * Behavior:
     * - Primitive values: Deep copied via JSON serialization
     * - Functions: Returned as-is (reference)
     * - Node objects: Returned as-is (reference, not cloned)
     * - Arrays/Objects: Recursively copied with the same rules
     *
     * @param rhs - The object to copy (right-hand side)
     * @returns A copy of the object with Node references preserved
     */
    static objectCopyWithNodeRefs(rhs: any): any;
    /**
     * Finds the first ancestor element that has a specific attribute with a specific value.
     * Traverses up the DOM tree from the given element until a matching ancestor is found.
     *
     * @param element - The starting element
     * @param attrName - The attribute name to search for
     * @param attrValue - The expected attribute value
     * @returns The matching ancestor element, or null if none found
     * @example Finding an ancestor with aria-hidden="true" or data-testid="container"
     */
    static getAncestorWithAttribute(element: any, attrName: any, attrValue: any): Node;
}
