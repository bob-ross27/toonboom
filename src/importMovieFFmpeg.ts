"use strict";

// TODO: Pull in proper QT / Harmony ts (merge main and rebase)

/**
 * Mimic the built-in movie import with FFmpeg.
 * Software: Harmony 17 Premium.
 * @version 0.1.0
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function importMovieFFmpeg(): boolean {
    /**
     * Return the path to the script resource folder.
     * Create the folder if necessary.
     * @param {boolean} createFolder - Whether to create the folder.
     * @returns {string} Path to the script resource folder.
     */
    this.getScriptResourcePath = function (createFolder: boolean): string {
        var createFolder = createFolder || false;
        var folderName = "importMovieFFmpeg_resources";
        var resourceFolderName: string = fileMapper.toNativePath(
            `${specialFolders.userScripts}/${folderName}`
        );
        var resourceDir = new QDir(resourceFolderName);
        if (!resourceDir.exists() && createFolder) {
            new QDir(specialFolders.userScripts).mkdir(folderName);
        }

        return resourceFolderName;
    };

    /**
     * Return the path to a temporary directory.
     * @returns {string} Path to the temporary directory.
     */
    this.getTempDirectory = function (): string {
        var folderName = QUuid.createUuid();
        var tempFolderName: string = fileMapper.toNativePath(
            `${specialFolders.temp}/${folderName}`
        );
        var resourceDir = new QDir(tempFolderName);
        if (!resourceDir.exists()) {
            new QDir(specialFolders.temp).mkdir(folderName);
        }

        return tempFolderName;
    };

    const CURL_BIN: string = about.isWindowsArch() ? "curl.exe" : "curl";
    const CURL_PATH: string = about.isWindowsArch()
        ? fileMapper.toNativePath(
              `${specialFolders.bin}/bin_3rdParty/${CURL_BIN}`
          )
        : `/usr/bin/${CURL_BIN}`;
    const FFMPEG_BIN: string = about.isWindowsArch() ? "FFmpeg.exe" : "FFmpeg";
    const SCRIPT_RESOURCE_PATH: string = this.getScriptResourcePath();
    const TEMP_DIR: string = this.getTempDirectory();

    /**
     * Convert the input movie using FFmpeg to an image sequence
     * and an audio file.
     * @param {string} ffmpegPath - Path to the FFmpeg binary.
     * @param {string} inputMovie - Path to the user provided movie file.
     * @returns {boolean} true if successful, false otherwise.
     */
    this.convertMovie = function (
        ffmpegPath: string,
        inputMovie: string
    ): boolean {
        /**
         * Find the expected framecount to query by running a
         * dummy FFmpeg session and regexing the output.
         * @param {string} inputMovieFile - Path to the user provided movie.
         * @return {int | boolean} Framecount if successful, false otherwise.
         */
        this._findMovieFrames = function (
            inputMovieFile: string
        ): number | boolean {
            var proc = new QProcess();
            var ffmpegArgs: string[] = [
                "-i",
                `${inputMovieFile.absoluteFilePath()}`,
                "-map",
                "0:v:0",
                "-c",
                "copy",
                "-f",
                "null",
                "-",
            ];
            proc.start(ffmpegPath, ffmpegArgs);

            var procReturn: boolean = proc.waitForFinished(60000);

            // Verify exit code
            if (procReturn) {
                // Fetch stderr output for parsing.
                var outputStdErr = new QTextStream(
                    proc.readAllStandardError()
                ).readAll();
                var framesRe = new RegExp(/.*frame=\s+(\d+)\s?fps=.*/);
                if (outputStdErr.match(framesRe)) {
                    return parseInt(outputStdErr.match(framesRe)[1], 10);
                }
            }
            return false;
        };

        /**
         * Create the QT Progress dialog.
         * @param {int} fileCount - Number of files to create.
         * @returns {QWidget} Progress dialog.
         */
        this._createConvertUI = function (fileCount: number) {
            this.convertUI = new QProgressDialog(
                this,
                "Converting Images with FFmpeg"
            );
            this.convertUI.setWindowFlags(Qt.FramelessWindowHint);
            this.convertUI.minimumDuration = 0;
            this.convertUI.value = 0;
            this.convertUI.maximum = fileCount;
            this.convertUI.setLabelText("\nConverting video using FFmpeg...");
            this.convertUI.setCancelButton(new QPushButton("Cancel"));
            return this.convertUI;
        };

        var inputMovieFile = new QFileInfo(inputMovie);
        var inputMovieBasename: string = inputMovieFile.baseName();

        // Find expected frame count.
        var frameCount: number = this._findMovieFrames(inputMovieFile);
        var fileCount = frameCount + 1; // +1 for audio .wav
        var proc = new QProcess();
        var ffmpegArgs: string[] = [
            "-y",
            "-i",
            `${inputMovieFile.absoluteFilePath()}`,
            fileMapper.toNativePath(
                `${TEMP_DIR}/${inputMovieBasename}-%04d.tga`
            ),
            fileMapper.toNativePath(`${TEMP_DIR}/${inputMovieBasename}.wav`),
        ];

        var convertedFiles = 0;
        var tempDir = new QDir(TEMP_DIR);

        // Create a QTimer to handle checking for converted files and updating the
        // progress dialog without blocking GUI.
        var timer = new QTimer(this);
        timer.timeout.connect(this, function () {
            convertedFiles = tempDir.entryList(
                ["*.tga", "*.wav"],
                QDir.Files,
                QDir.Name
            ).length;
            this.convertUI.setValue(convertedFiles);
        });

        this.convertUI = this._createConvertUI(fileCount);
        this.convertUI.show();
        proc.start(ffmpegPath, ffmpegArgs);
        timer.start(50);

        // eslint-disable-next-line no-constant-condition
        while (true) {
            // Kill ffmpeg process if user cancels conversion.
            if (this.convertUI.wasCanceled) {
                timer.stop();
                proc.kill();
                this.convertUI.close();
                return false;
            }

            // Exit if files are completed.
            if (convertedFiles >= fileCount) {
                timer.stop();
                this.sleepFor(500); // Sleep slightly longer in case FFmpeg is still writing the final file.
                break;
            }
        }

        var procReturn: boolean = proc.exitStatus();

        // Verify exit code
        if (procReturn) {
            return true;
        }

        return false;
    };

    /**
     * Create a TB Dialog to prompt user for selection.
     * @returns {Dialog} Dialog object.
     */
    this.createUI = function () {
        this.ui = new Dialog();
        this.ui.okButtonText = "Download FFmpeg";
        this.ui.cancelButtonText = "Abort";
        this.ui.title = "FFmpeg Not Found";
        this.ui.infoLabel = new Label();
        this.ui.infoLabel.text =
            "FFmpeg was not detected on your system.\nWould you like to download FFmpeg now and continue?";
        this.ui.add(this.ui.infoLabel);
        this.ui.addSpace(15);
        return this.ui;
    };

    /**
     * Sleep for a duration.
     * @param {int} sleepDuration
     */
    this.sleepFor = function (sleepDuration: number) {
        var now = new Date().getTime();
        while (new Date().getTime() < now + sleepDuration) {}
    };

    /**
     * Download FFmpeg to the script resource folder.
     * @returns {string} - Path to the downloaded FFmpeg binary.
     */
    this.downloadFFmpeg = function (): string {
        /**
         * Progress UI for downloading FFmpeg.
         * @returns {QProgressDialog} Created dialog
         */
        this._createDownloadUI = function () {
            this.downloadUI = new QProgressDialog(this, "Downloading FFmpeg");
            this.downloadUI.maximum = 4; // Download > Extract > Clean > Complete
            this.downloadUI.value = 0;
            this.downloadUI.minimumDuration = 0;
            return this.downloadUI;
        };

        /**
         * Return the appropriate platform download url.
         * @returns {string} URL for specific system architecture.
         */
        this._getFFmpegUrl = function (): string {
            var url: string;
            if (about.isWindowsArch()) {
                url =
                    "https://www.gyan.dev/FFmpeg/builds/FFmpeg-release-essentials.7z";
            }

            return url;
        };

        /**
         * Extract the FFmpeg binary using 7-zip, and remove the downloaded archive.
         * @param {string} - Path to the downloaded .7z to extract.
         * @returns {boolean} true if successful, false otherwise.
         */
        this._extractFFmpeg = function (zipPath: string): boolean {
            const ZIP_BIN = about.isWindowsArch() ? "7z.exe" : "7za";
            const ZIP_PATH = fileMapper.toNativePath(
                `${specialFolders.bin}/bin_3rdParty/${ZIP_BIN}`
            );
            var proc = new QProcess();
            var zipArgs: string[] = [
                "e", // Extract
                zipPath, // Archive path
                `-o${SCRIPT_RESOURCE_PATH}`, // Output dir
                FFMPEG_BIN, // Filter only FFmpeg bin
                "-r", // Search recursively
            ];
            proc.start(ZIP_PATH, zipArgs);
            var procReturn: boolean = proc.waitForFinished(60000);

            if (procReturn) {
                this.downloadUI.setLabelText("Cleaning up.");
                this.downloadUI.setValue(3);
                new QFile(zipPath).remove(); // Remove temp downloaded file.
                this.sleepFor(500); // Give time to update dialog.
                return true;
            }

            return false;
        };

        // Show progress UI and set initial state.
        this.downloadUI = this._createDownloadUI();
        this.downloadUI.show();
        this.downloadUI.setLabelText("Downloading archive.");
        this.downloadUI.setValue(1);

        var ffmpegUrl: string = this._getFFmpegUrl();
        var ffmpegDownloadPath: string = fileMapper.toNativePath(
            `${this.getScriptResourcePath(true)}/ffmpeg_download.7z`
        ); // Create resource path if not already present.

        var curlArgs: string[] = [
            ffmpegUrl,
            "-k", // insecure - don't verify ssl cert
            "-L", // Follow redirects
            "--output", // Output to a file instead of stdout
            ffmpegDownloadPath,
        ];
        var proc = new QProcess();
        proc.start(CURL_PATH, curlArgs);

        // Launch proc, wait for finished signal or timeout.
        var procReturn: boolean = proc.waitForFinished(60000);

        // Extract FFmpeg binary from downloaded archive.
        if (procReturn) {
            this.downloadUI.setLabelText("Extracting FFmpeg from archive.");
            this.downloadUI.setValue(2);
            this._extractFFmpeg(ffmpegDownloadPath);
        }

        // Verify operations were successful and FFmpeg now exists in the expected location.
        var ffmpegBin = new QFileInfo(
            fileMapper.toNativePath(`${SCRIPT_RESOURCE_PATH}/${FFMPEG_BIN}`)
        );
        if (ffmpegBin.exists()) {
            this.downloadUI.setValue(4); // Download complete, UI exits automatically.
            return ffmpegBin.absoluteFilePath();
        }

        // Either the download or extraction failed.
        this.downloadUI.close();
        return "";
    };

    /**
     * Attempt to find FFmpeg in the PATH envvar or in the script resource folder.
     * Return path if detected, false if not found.
     * @return {string} Path of the detected or downloaded FFmpeg binary.
     */
    this.getFFmpegPath = function (): string {
        var scriptResourcePath: string[] = [SCRIPT_RESOURCE_PATH];
        var envPaths: string[] = System.getenv("PATH").split(";");
        var paths: string[] = scriptResourcePath.concat(envPaths);
        var ffmpegPath: string[] = paths.filter(function (path) {
            return new QFile(
                fileMapper.toNativePath(`${path}/${FFMPEG_BIN}`)
            ).exists();
        });

        // FFmpeg found in PATH or script resource dir.
        if (ffmpegPath.length) {
            return fileMapper.toNativePath(`${ffmpegPath[0]}/${FFMPEG_BIN}`);
        }

        // FFmpeg not found - prompt the user to download FFmpeg.
        this.ui = this.createUI();
        if (this.ui.exec()) {
            // Download FFmpeg and return path to binary.
            return this.downloadFFmpeg();
        }

        return "";
    };

    /**
     * Import images converted by FFmpeg.
     * Prefill the import image dialog to allow the user
     * to import with specific options, vectorize etc.
     * @return {boolean} true if successful, false if no valid files.
     */
    this.importConvertedImages = function (): boolean {
        var tempPath = new QDir(TEMP_DIR);
        var files: string[] = tempPath.entryList(
            ["*.tga"],
            QDir.Files,
            QDir.Name
        );
        files = files.map(function (x: string) {
            return fileMapper.toNativePath(`${tempPath.absolutePath()}/${x}`);
        });

        // No valid files
        if (!files.length) {
            return false;
        }
        var fileList = files.join(";");

        // Set the preference to autofill the import dialog, and trigger it.
        preferences.setString("IMPORTIMGDLG_IMAGE_LASTIMPORT", fileList);
        Action.perform("onActionImportDrawings()");

        return true;
    };

    /**
     * Import audio converted by FFmpeg.
     * //TODO: Check for column existing and use anonymous column name instead.
     * @return {boolean} true if successful, false if no valid files or unsuccessful import.
     */
    this.importConvertedAudio = function (): boolean {
        var tempPath = new QDir(TEMP_DIR);
        var convertedAudio: string = tempPath.entryList(
            ["*.wav"],
            QDir.Files,
            QDir.Name
        )[0];

        // No valid audio.
        if (!convertedAudio) {
            return false;
        }

        // Create column using the filename and import audio.
        var col = column.add(new QFileInfo(convertedAudio).baseName(), "SOUND");
        var importSound = column.importSound(
            new QFileInfo(convertedAudio).baseName(),
            1,
            fileMapper.toNativePath(
                `${tempPath.absolutePath()}/${convertedAudio}`
            )
        );

        if (importSound) {
            return true;
        }

        return false;
    };

    /**
     * Remove converted media from temp dir, and remove temp dir.
     * Harmony doesn't support QDir.removeRecursively, so it has to be done manually.
     * @returns {boolean} true if successful, false otherwise.
     */
    this.cleanTempDir = function (): boolean {
        var tempDir = new QDir(TEMP_DIR);
        var fileArray = tempDir.entryList(["*.*"], QDir.Files, QDir.Name);
        var removed = fileArray.filter(function (f: string) {
            return new QFile(
                fileMapper.toNativePath(`${TEMP_DIR}/${f}`)
            ).remove();
        });

        // Remove temp dir if all files deleted successfully.
        if (fileArray.length === removed.length) {
            if (new QDir().rmdir(TEMP_DIR)) {
                return true;
            }
        }

        return false;
    };

    /**
     * Main
     */

    // Exit if not Windows.
    // TODO: Remove once mac support is determined.
    if (!about.isWindowsArch()) {
        MessageBox.critical("Currently only Windows is supported.");
        return;
    }

    // Get path to FFmpeg - or prompt user to download if not present.
    const FFMPEG_PATH: string = this.getFFmpegPath();

    // Exit if FFmpeg not found and user exits dialog, or an error occured during download.
    if (!FFMPEG_PATH) {
        MessageLog.trace(
            "A fatal error has occured when downloading FFmpeg. Exiting."
        );
        return;
    }

    scene.beginUndoRedoAccum("Test Importing Images");

    // Get input movie from user.
    // Default to a sensible filter but allow for all files for weird formats.
    var inputMovie: string = FileDialog.getOpenFileName(
        "Video Files (*.mov *.mp4 *.avi);;All files (*.*);;",
        "Select Movie to Import"
    );

    // User cancelled movie input dialog - exit.
    if (!inputMovie) {
        return;
    }

    // Export image sequence and audio using FFmpeg
    var convertMovie = this.convertMovie(FFMPEG_PATH, inputMovie);
    // Conversion failed or user exited prematurely.
    if (!convertMovie) {
        scene.cancelUndoRedoAccum();
        this.cleanTempDir();
        return;
    }

    // Import files into Harmony.
    if (this.importConvertedImages() && this.importConvertedAudio()) {
        MessageLog.trace("All operations complete.");
        this.cleanTempDir();
        scene.endUndoRedoAccum();
    }
}
