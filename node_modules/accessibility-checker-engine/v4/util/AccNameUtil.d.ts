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
export type AccessibleNameResult = {
    name: string;
    nameFrom: "ariaLabel" | "title" | "placeholder" | "label" | "value" | "internal" | "alt" | "text" | "legend" | "summary" | "figcaption" | "caption" | "shadow" | "slot" | "shadow-host" | "content-slot" | "content" | "svglinkTitle" | "svgTitle" | "svgText" | "svgDesc" | "aria-description" | string;
};
export declare class AccNameUtil {
    /**
     * Computes the accessible name for an SVG element according to W3C specification
     * Following the Accessible Name and Description Computation 1.1 algorithm
     * https://www.w3.org/TR/accname-1.1/
     *
     * @param elem The SVG element
     * @returns The accessible name result or null if no accessible name is found
     */
    static computeAccessibleNameForSVGElementW3C(elem: Element): AccessibleNameResult | null;
    static computeAccessibleName(elem: Element): AccessibleNameResult | null;
    static computeAccessibleNameForNativeElement(elem: Element): AccessibleNameResult | null;
    static computeAccessibleNameForSVGElement(elem: Element): AccessibleNameResult | null;
    static computeAccessibleNameFromContent(elem: Element): AccessibleNameResult | null;
    static computeAccessibleNameForCSSPseudoElement(elem: Element, type: string): AccessibleNameResult | null;
    static computeAccessibleNameForShadowHost(elem: Element): AccessibleNameResult | null;
    static computeAccessibleNameForSlotElement(elem: Element): AccessibleNameResult | null;
    static computeAccessibleNameFromChildren(elem: Element): AccessibleNameResult | null;
    static isAccessibleNameIgnorable(elem: Element): boolean;
}
