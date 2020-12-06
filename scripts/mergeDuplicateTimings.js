"use strict";

/**
 * Iterate across all frames of selected READ node, changing exposure to
 * the first detected instance of each timing, matching duplicates with their
 * MD5 hash.
 * Software: Harmony 17 Premium.
 * @version 1.2.0
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function mergeDuplicateTimings() {
    /**
     * Create Progress UI.
     * @returns {QWidget} ui object.
     */
    this.createui = function () {
        this.ui = new QWidget();
        this.ui.layout = new QHBoxLayout();

        this.ui.progressbar = new QProgressBar();
        this.ui.layout.addWidget(this.ui.progressbar, 0, 0);
        this.ui.setLayout(this.ui.layout);
        return this.ui;
    };

    /**
     * Check if exposed timing on a given frame matches previously
     * evaluted timings.
     * @param {string} selNode - Path of node to evaluate.
     * @returns {string | boolean} Hash of the file, false if operation failed.
     */
    this.mergeTimings = function (selNode) {
        /**
         * Generate an MD5 hash of the file.
         * @param {string} filePath - Native path to timing.
         * @returns {string} MD5 hash of the file.
         */
        this._getFileHash = function (filePath) {
            this.crypto.reset();
            var inFile = new QFile(filePath);
            if (inFile.exists() && inFile.open(QIODevice.ReadOnly)) {
                this.crypto.addData(inFile.readAll());
                inFile.close();
                var hashResult = new QTextStream(
                    this.crypto.result().toHex()
                ).readAll();
                return hashResult;
            }
            MessageLog.trace("Unable to open file: " + filePath);
            return false;
        };

        /**
         * Find the physical path of the first drawing timing, and isolate
         * the file extension using regex.
         * @param {string} elemId - ID of the element.
         * @param {string} elemCol - Column name of the element.
         * @returns {string | boolean} Extension of the file, false if operation failed.
         */
        this._getExtension = function (elemId, elemCol) {
            var extRe = new RegExp(/^.*(\D{3})$/);
            var drawing = Drawing.filename(
                elemId,
                column.getDrawingTimings(elemCol)[0]
            );

            if (drawing.match(extRe)[1]) {
                return drawing.match(extRe)[1];
            }
            return false;
        };

        var elemId = node.getElementId(selNode);
        var elemCol = node.linkedColumn(selNode, "drawing.element");
        var elemName = element.physicalName(elemId);
        var elemPath = element.completeFolder(elemId);
        var EXT = "." + this._getExtension(elemId, elemCol);

        // Exit if unable to detect an extension.
        if (EXT === ".") {
            MessageLog.trace("Unable to find drawing extension.");
            return false;
        }

        // Exit if node doesn't match expected.
        if (!elemId || !elemCol || !elemName || !elemPath) {
            MessageLog.trace("Invalid node config.");
            return false;
        }

        var timingList = [];
        for (var f = 1; f < frame.numberOf() + 1; f += 1) {
            this.ui.progressbar.value += 1;
            var basePath = elemPath + "/" + elemName + "-";
            var timing = column.getEntry(elemCol, 1, f);
            if (!timing) {
                continue; // No entry on frame, skip.
            }

            var filePath = fileMapper.toNativePath(basePath + timing + EXT);

            var timingObj = {
                path: filePath,
                name: timing,
                hash: this._getFileHash(filePath),
            };

            // Unable to read hash, skip.
            if (!timingObj.hash) {
                continue;
            }

            // Don't change fr 1.
            if (f === 1) {
                timingList.push(timingObj);
                continue;
            }

            // Check for matches in timings that have already been parsed.
            // Set entry for frame to matching instance if detected.
            var hashMatch = timingList.filter(function (x) {
                return x.hash === timingObj.hash;
            });
            if (hashMatch.length) {
                column.setEntry(elemCol, 1, f, hashMatch[0].name);
                continue;
            }

            // Unique instance.
            timingList.push(timingObj);
        }

        this.success += 1;
        return true;
    };

    /**
     * Main
     */

    var readNodes = selection.selectedNodes().filter(function (x) {
        return node.type(x) === "READ";
    });

    // Validate user selection.
    if (!readNodes.length) {
        MessageBox.information("No valid nodes selected.");
        return false;
    }

    // Progressbar UI
    this.ui = this.createui();
    this.ui.progressbar.setMaximum(frame.numberOf() * readNodes.length);
    this.ui.show();

    this.crypto = new QCryptographicHash(QCryptographicHash.Md5);

    scene.beginUndoRedoAccum("Merge duplicate timings");

    this.success = 0;
    readNodes.forEach(this.mergeTimings);

    MessageBox.information(
        "Operation complete on " +
            readNodes.length +
            " " +
            (readNodes.length === 1 ? "item." : "items.")
    );
    this.ui.close();
    scene.endUndoRedoAccum();

    return true;
}
