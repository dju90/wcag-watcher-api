/******************************************************************************
  Copyright:: 2022- IBM, Inc
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
export declare class ClipPathUtil {
    private static THRESHOLD;
    /**
     * This function is responsible for checking if the node that is visually hidden by css clip-path:
     *
     * Note 1: If either current node or any of the parent nodes are visually hidden then this
     *          function will return true (node is not visually hidden).
     *
     * Note 2: nodes with CSS properties clip-path, the content is not considered hidden to an AT. Text hidden with these methods
     *      can still be reedable by screen readers.
     * Note 3: if a link, form control, or other focusable element is given this style, the element would be focusable but not visible,
     *      keyboard users might be confused.
     *
     * @parm {Node} node The node which should be checked if it is visually hidden or not.
     * @return {bool} true if the node is visually hidden, false otherwise
     *
     * @memberOf VisUtil
     */
    static isNodeVisuallyHiddenByClipPath(node: Node): boolean;
    private static isClippedByInset;
}
