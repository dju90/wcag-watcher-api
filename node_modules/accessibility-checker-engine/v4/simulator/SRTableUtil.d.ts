import { SRCursor } from "./SRCursor";
/**
 * TableUtil namespace provides utility functions for handling HTML tables in the accessibility simulator.
 * These functions help determine cell positions, relationships, and extract header information
 * to simulate how screen readers would announce table navigation.
 */
export declare namespace SRTableUtil {
    /**
     * Represents a table cell with its position and spanning information
     * @property rowIndexStart - The starting row index (0-based)
     * @property colIndexStart - The starting column index (0-based)
     * @property rowspan - Number of rows this cell spans
     * @property colspan - Number of columns this cell spans
     * @property cellCursor - SRCursor pointing to this cell
     */
    type CellModel = {
        rowIndexStart: number;
        colIndexStart: number;
        rowspan: number;
        colspan: number;
        cellCursor: SRCursor;
    };
    /**
     * Represents a row in a table as an array of cell models
     */
    type RowModel = CellModel[];
    /**
     * Represents a complete table as an array of rows
     */
    type TableModel = RowModel[];
    /**
     * Determines if the cursor is pointing to a cell element (TD or TH)
     * or has a cell-related ARIA role
     * @param cursor - The SRCursor to check
     * @returns true if the cursor is on a cell, false otherwise
     */
    function isCursorCellRole(cursor: SRCursor): boolean;
    /**
     * Gets a cursor pointing to the current cell or the parent cell if the cursor
     * is inside a cell's content
     * @param cursor - The SRCursor to check
     * @returns A new SRCursor pointing to the cell or null if not in a cell
     */
    function getCurrentOrParentCellCursor(cursor: SRCursor): SRCursor;
    /**
     * Get the colspan of a cell at a given location
     * @param cursor The cursor to get the colspan from
     * @returns The colspan of the cell at the cursor's location or 0 if not in a column
     */
    function getColSpan(cursor: SRCursor): number;
    /**
     * Get the rowspan of a cell at a given location
     * @param cursor The cursor to get the rowspan from
     * @returns The rowspan of the cell at the cursor's location or 0 if not in a column
     */
    function getRowSpan(cursor: SRCursor): number;
    /**
     * Builds a complete model of a table's structure, accounting for rowspan and colspan
     *
     * This function traverses the entire table and creates a data structure that represents
     * the logical grid of cells, properly handling cells that span multiple rows or columns.
     * The resulting model makes it easier to determine cell relationships and positions.
     *
     * @param inTableCursor - A cursor within the table
     * @returns A TableModel representing the complete table structure, or null if not in a table
     */
    function getTableModel(inTableCursor: SRCursor): TableModel;
    /**
     * Gets the cell model for a specific cell in the table
     *
     * This function finds the CellModel object that represents a specific cell,
     * which contains information about its position and spanning.
     *
     * @param inCellCursor - A cursor pointing to a cell or its contents
     * @param tableModel - Optional pre-built table model (will be created if not provided)
     * @returns The CellModel for the specified cell, or null if not found
     */
    function getCellModel(inCellCursor: SRCursor, tableModel?: TableModel): CellModel;
    /**
     * Checks if a cell spans a specific column
     *
     * @param cellModel - The cell model to check
     * @param colIdx - The column index to check
     * @returns True if the cell contains the specified column
     */
    function cellModelContainsColumn(cellModel: CellModel, colIdx: number): boolean;
    /**
     * Checks if a cell spans a specific row
     *
     * @param cellModel - The cell model to check
     * @param rowIdx - The row index to check
     * @returns True if the cell contains the specified row
     */
    function cellModelContainsRow(cellModel: CellModel, rowIdx: number): boolean;
    /**
     * Gets the row headers associated with a cell
     * First checks for explicit headers attribute, then looks for row headers in the same row
     * @param cursor - The SRCursor pointing to a cell
     * @returns A string containing the concatenated header names
     */
    function getRowHeaders(cursor: SRCursor): string;
    /**
     * Gets the column headers associated with a cell
     * First checks for explicit headers attribute, then looks for column headers in the same column
     * @param cursor - The SRCursor pointing to a cell
     * @returns A string containing the concatenated header names
     */
    function getColumnHeadersForCursor(inCellCursor: SRCursor, tableModel?: TableModel): string;
    /**
     * Gets the row headers associated with a cell
     * First checks for explicit headers attribute, then looks for row headers in the same row
     * @param cursor - The SRCursor pointing to a cell
     * @returns A string containing the concatenated header names
     */
    function getRowHeadersForCursor(inCellCursor: SRCursor, tableModel?: TableModel): string;
    /**
     * Determines if a cell is a data cell (not a header cell)
     *
     * A data cell is one with either:
     * - An explicit ARIA role of "cell"
     * - A TD element without an overriding role attribute
     *
     * @param checkCursor - The cursor to check
     * @returns True if the cursor points to a data cell
     */
    function isDataCell(checkCursor: SRCursor): boolean;
}
