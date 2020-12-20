"use strict";

/**
 * Rename draiwngs to their first exposed frame. This roughly emulates the
 * included rename to frame function, but does it across selected nodes instead of
 * on selected frames in a column.
 * Additionally the script works in Essentials, which lacks the included function.
 * Software: Harmony 17 Premium.
 * @version 1.0.1
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function renameDrawingsByFrame() {
    /**
     * Rename the drawing to a temporary name, and to the final.
     * @param {string} inNode - Path of the input node.
     * @returns {boolean} true if this.successful, false otherwise.
     */
    this.renameDrawings = function (inNode: string) {
        const NEW_PREFIX = "tmprename_";

        var col: string = node.linkedColumn(inNode, "drawing.element");
        if (!col) {
            MessageLog.trace(`No linked element column for ${inNode}`);
            return false;
        }

        var renamed: string[] = [];
        for (var f = 1; f < frame.numberOf() + 1; f += 1) {
            var drawingName: string = column.getEntry(col, 1, f);

            // No entry on frame.
            if (!drawingName) {
                continue;
            }

            if (
                drawingName !== f.toString() &&
                renamed.indexOf(drawingName) === -1
            ) {
                var drawingNameTemp: string = NEW_PREFIX + f;
                column.renameDrawing(col, drawingName, drawingNameTemp);
                renamed.push(drawingNameTemp);
            }
        }

        // Rename to final
        column.getDrawingTimings(col).forEach(function (x: string) {
            if (x !== x.replace(NEW_PREFIX, "")) {
                column.renameDrawing(col, x, x.replace(NEW_PREFIX, ""));
            }
        });

        this.successful += 1;
        return true;
    };

    /**
     * Main
     */
    var readNodes: string[] = selection
        .selectedNodes()
        .filter((x: string) => node.type(x) === "READ");

    // Invalid selections
    if (!selection.selectedNodes() || !readNodes.length) {
        return false;
    }

    this.successful = 0;
    scene.beginUndoRedoAccum("Rename Drawings by Frame");
    readNodes.forEach(this.renameDrawings);

    var outMessage = "";
    if (this.successful === readNodes.length) {
        outMessage = `this.successfully renamed ${this.successful}${
            this.successful === 1 ? " node." : " nodes."
        }`;
    } else {
        outMessage =
            "One or more nodes did not rename successfully. See the Message Log for more details.";
    }

    scene.endUndoRedoAccum();
    MessageBox.information(outMessage);

    return true;
}
