"use strict";

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
        if (!new QDir(resourceFolderName).exists() && createFolder) {
            var scriptParent = new QDir(specialFolders.userScripts);
            scriptParent.cdUp();
            scriptParent.mkPath(resourceFolderName);
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

    /**
     * Try to get preferences, return default values if not found.
     * @returns {JSON} Object containing preference values.
     */
    this.getPreferences = function () {
        var prefObj: string = preferences.getString(
            "IMPORT_MOVIE_FFMPEG_PREF",
            ""
        );
        // Default values.
        if (!prefObj) {
            return { videoExt: "tga", audioExt: "wav" };
        }

        return JSON.parse(prefObj);
    };

    /**
     * Save the preferences as a Harmony preference.
     * @param {JSON} prefObj - Object containing the preferences to store.
     */
    this.setPreferences = function (prefObj: JSON) {
        preferences.setString(
            "IMPORT_MOVIE_FFMPEG_PREF",
            JSON.stringify(prefObj)
        );
    };

    /**
     * Create a dialog for setting preferences.
     */
    this.createPreferenceDialog = function () {
        var prefs = this.getPreferences();
        var videoExt: string[] = ["jpeg", "png", "tga"];
        var audioExt: string[] = ["mp3", "wav"];

        // Preference Dialog
        this.prefUI = new QDialog();
        this.prefUI.setWindowTitle("Preferences");
        this.prefUI.minimumWidth = 130;
        this.prefUI.minimumHeight = 150;
        this.prefUI.layout = new QVBoxLayout();

        this.prefUI.descriptionLabel = new QLabel(
            "Set the file format for converted image and audio output.\n"
        );
        this.prefUI.descriptionLabel.wordWrap = true;
        this.prefUI.layout.addWidget(this.prefUI.descriptionLabel, true, true);

        // Video options
        this.prefUI.videoLabel = new QLabel("Video Format");
        this.prefUI.videoCB = new QComboBox();
        videoExt.forEach(function (ext: string) {
            this.prefUI.videoCB.addItem(ext);
        });
        // Set default selection to current prefs.
        this.prefUI.videoCB.setCurrentIndex(
            this.prefUI.videoCB.findText(prefs.videoExt)
        );
        this.prefUI.layout.addWidget(this.prefUI.videoLabel, true, true);
        this.prefUI.layout.addWidget(this.prefUI.videoCB, true, true);

        // Audio options
        this.prefUI.audioLabel = new QLabel("Audio Format");
        this.prefUI.audioCB = new QComboBox();
        audioExt.forEach(function (ext: string) {
            this.prefUI.audioCB.addItem(ext);
        });
        // Set default selection to current prefs.
        this.prefUI.audioCB.setCurrentIndex(
            this.prefUI.audioCB.findText(prefs.audioExt)
        );
        this.prefUI.layout.addWidget(this.prefUI.audioLabel, true, true);
        this.prefUI.layout.addWidget(this.prefUI.audioCB, true, true);

        this.prefUI.acceptBtn = new QPushButton("Save");
        this.prefUI.layout.addWidget(this.prefUI.acceptBtn, true, true);
        this.prefUI.layout.addWidget(
            new QSpacerItem(20, 40, QSizePolicy.Minimum, QSizePolicy.Expanding),
            true,
            true
        );

        this.prefUI.setLayout(this.prefUI.layout);

        return this.prefUI;
    };

    /**
     * Search system PATH env var, as well as any (optional) paths provided for the specific binary.
     * @param {string} bin - Name of the binary to find.
     * @param {string[]} paths - Optional array of paths to include in search.
     * @returns {string} Return path if found, "" otherwise.
     */
    this.getBinPath = function (bin, paths) {
        var paths = paths || [];

        var pathSplit = about.isWindowsArch() ? ";" : ":";
        var envPaths: string[] = System.getenv("PATH").split(pathSplit);
        var searchPaths: string[] = paths.concat(envPaths);
        var searchResults: string[] = searchPaths.filter(function (path) {
            return new QFile(
                fileMapper.toNativePath(`${path}/${bin}`)
            ).exists();
        });

        // bin detected.
        if (searchResults.length) {
            return fileMapper.toNativePath(`${searchResults[0]}/${bin}`);
        }

        return "";
    };

    /**
     * Global consts.
     */
    const CURL_BIN: string = about.isWindowsArch() ? "curl.exe" : "curl";
    const CURL_PATH: string = this.getBinPath(CURL_BIN, [
        `${specialFolders.bin}/bin_3rdParty/`,
    ]);
    const FFMPEG_BIN: string = about.isWindowsArch() ? "ffmpeg.exe" : "ffmpeg";
    const SCRIPT_RESOURCE_PATH: string = this.getScriptResourcePath();
    const TEMP_DIR: string = this.getTempDirectory();
    const IMAGE_EXT = this.getPreferences().videoExt;
    const AUDIO_EXT = this.getPreferences().audioExt;
    const ZIP_BIN = about.isWindowsArch() ? "7z.exe" : "7za";
    const ZIP_PATH = this.getBinPath(ZIP_BIN, [
        `${specialFolders.bin}/bin_3rdParty/`,
    ]);
    const TAR_PATH = this.getBinPath("tar");

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
         * Use chmod to set executible bit.
         */
        this._setFFmpegExecutable = function (): boolean {
            // This shouldn't be relevant to Windows.
            if (about.isMacArch() || about.isLinuxArch()) {
                var proc = new QProcess();
                proc.start("chmod", ["+x", ffmpegPath]);
                var procStarted = proc.waitForStarted(1000);
                // Chmod unsuccessful.
                if (!procStarted) {
                    return false;
                }
                var procReturn = proc.waitForFinished(3000);
                if (procReturn && new QFileInfo(ffmpegPath).isExecutable()) {
                    return true;
                }
            }

            return false;
        };

        /**
         * Test FFmpeg to ensure it's set as executable
         * and can execute basic command.
         */
        this._testFFmpegExecutable = function (): boolean {
            // Not executable, try using chmod.
            if (!new QFileInfo(ffmpegPath).isExecutable()) {
                // Try to make executable.
                if (!this._setFFmpegExecutable()) {
                    return false;
                }
            }

            var proc = new QProcess();
            proc.start(ffmpegPath, ["-version"]);
            var procStarted = proc.waitForStarted(1000);
            var procFinished = proc.waitForStarted(3000);

            return procStarted && procFinished;
        };

        /**
         * Find the expected framecount to query by running a
         * dummy FFmpeg session and regexing the output.
         * Additionally ensure video stream exists, and whether audio stream
         * is present.
         * @param {QFileInfo} inputMovieFile - Path to the user provided movie.
         * @return {object | boolean} Object containing the framecount, and where audio/video streams detected.
         * false otherwise.
         */
        this._parseVideoAttributes = function (inputMovieFile) {
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
            var procStarted: boolean = proc.waitForStarted(1000);
            // Process couldn't be started.
            if (!procStarted) {
                return false;
            }

            var procReturn: boolean = proc.waitForFinished(20000);
            if (!procReturn) {
                // Proc timed out.
                MessageLog.trace(
                    "Error: FFmpeg timed out when detecting movie framecount."
                );
                proc.kill();
                return false;
            }

            // Fetch stderr output for parsing.
            var outputStdErr = new QTextStream(
                proc.readAllStandardError()
            ).readAll();

            // Regex
            var framesRe = new RegExp(/.*frame=\s*(\d+)\s?fps=.*/);
            var audioRe = new RegExp(/(Stream #\d:\d(?:\(.*\))?: Audio)/);
            var videoRe = new RegExp(/(Stream #\d:\d(?:\(.*\))?: Video)/);

            var frames: number;
            if (outputStdErr.match(framesRe)) {
                frames = parseInt(outputStdErr.match(framesRe)[1], 10);
            }

            return {
                audio: outputStdErr.match(audioRe),
                video: outputStdErr.match(videoRe),
                frames,
            };
        };

        /**
         * Create the QT Progress dialog.
         * @returns {QWidget} Progress dialog.
         */
        this._createConvertUI = function () {
            this.convertUI = new QProgressDialog(
                this,
                "Converting Images with FFmpeg"
            );
            this.convertUI.setWindowFlags(Qt.FramelessWindowHint);
            this.convertUI.minimumDuration = 0;
            this.convertUI.value = 0;
            this.convertUI.setLabelText("\nDetermining Movie Framecount...");
            this.convertUI.setCancelButton(new QPushButton("Cancel"));
            return this.convertUI;
        };

        /**
         * Convert Video using FFmpeg.
         * @param {QFileInfo} inputMovieFile - Path to the user provided movie.
         * @returns {boolean} true if proc exits normally, false otherwise.
         */
        this._convertVideo = function (movieFile): boolean {
            var movieBasename: string = movieFile.baseName();
            var movieOutputName = movieBasename.replace(/-/g, "_");

            // Conversion process
            var proc = new QProcess();
            var ffmpegArgs: string[] = [
                "-y",
                "-i",
                `${movieFile.absoluteFilePath()}`,
                fileMapper.toNativePath(
                    `${TEMP_DIR}/${movieOutputName}-%04d.${IMAGE_EXT}`
                ),
            ];

            proc.start(ffmpegPath, ffmpegArgs);

            // Verify proc started successfully.
            var procStarted = proc.waitForStarted(1500);
            if (!procStarted) {
                return false;
            }

            // Run while proc is still active.
            while (proc.state() === QProcess.Running) {
                if (this.convertUI.wasCanceled) {
                    this.timer.stop();
                    proc.kill();
                    this.convertUI.close();
                    return false;
                }
            }

            return proc.exitStatus();
        };

        /**
         * Convert Audio using FFmpeg.
         * @param {QFileInfo} inputMovieFile - Path to the user provided movie.
         * @returns {boolean} true if proc exits normally, false otherwise.
         */
        this._convertAudio = function (movieFile): boolean {
            var movieBasename: string = movieFile.baseName();
            var movieOutputName = movieBasename.replace(/-/g, "_");

            // Conversion process
            var proc = new QProcess();
            var ffmpegArgs: string[] = [
                "-y",
                "-i",
                `${movieFile.absoluteFilePath()}`,
                fileMapper.toNativePath(
                    `${TEMP_DIR}/${movieOutputName}.${AUDIO_EXT}`
                ),
            ];

            proc.start(ffmpegPath, ffmpegArgs);

            // Verify proc started successfully.
            var procStarted = proc.waitForStarted(1500);
            if (!procStarted) {
                return false;
            }

            // Run while proc is still active.
            while (proc.state() === QProcess.Running) {
                if (this.convertUI.wasCanceled) {
                    this.timer.stop();
                    proc.kill();
                    this.convertUI.close();
                    return false;
                }
            }

            return proc.exitStatus();
        };

        // If FFmpeg isn't able to launch, exit.
        if (!this._testFFmpegExecutable()) {
            return false;
        }

        var inputMovieFile = new QFileInfo(inputMovie);

        this.convertUI = this._createConvertUI();
        this.convertUI.show();
        this.convertUI.raise();
        this.convertUI.activateWindow();

        // Find expected frame count.
        var movieAttributes = this._parseVideoAttributes(inputMovieFile);
        if (!movieAttributes) {
            return false;
        }

        var fileCount = movieAttributes.audio
            ? movieAttributes.frames + 1
            : movieAttributes.frames;

        this.convertUI.maximum = fileCount;

        var convertedFiles = 0;
        var tempDir = new QDir(TEMP_DIR);

        // Create a QTimer to handle checking for converted files and updating the
        // progress dialog without blocking GUI.
        this.timer = new QTimer(this);
        this.timer.timeout.connect(this, function () {
            convertedFiles = tempDir.entryList(
                [`*.${IMAGE_EXT}`, `*.${AUDIO_EXT}`],
                QDir.Files,
                QDir.Name
            ).length;
            this.convertUI.setValue(convertedFiles);
        });

        this.timer.start(50);

        if (movieAttributes.video) {
            this.convertUI.setLabelText("\nConverting video using FFmpeg...");
            var videoConverted = this._convertVideo(inputMovieFile);
            if (!videoConverted) {
                return false;
            }
        }

        if (movieAttributes.audio) {
            this.convertUI.setLabelText("\nConverting audio using FFmpeg...");
            var audioConverted = this._convertAudio(inputMovieFile);
            if (!audioConverted) {
                return false;
            }
        }

        // Cancel timer if still active.
        if (this.timer.active) {
            this.timer.stop();
        }

        // ProgressDialog should automatically close, but formats such as mkv may report slightly different
        // framecounts during _findMovieFrames than are actually converted.
        // TODO: Dialog popping up again after import dialog.
        if (convertedFiles > fileCount) {
            this.convertUI.close();
        }

        // FFmpeg has exited but conversion is not complete.
        if (convertedFiles < fileCount) {
            this.convertUI.close();
            MessageBox.information(
                "FFmpeg exited without converting all frames."
            );
            return false;
        }

        return true;
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
            this.downloadUI.setWindowFlags(Qt.FramelessWindowHint);
            this.downloadUI.maximum = 0;
            this.downloadUI.value = 0;
            this.downloadUI.minimumDuration = 0;
            this.downloadUI.setCancelButton(new QPushButton("Cancel"));
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
                    "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.7z";
            } else if (about.isMacArch()) {
                url = "https://evermeet.cx/ffmpeg/getrelease/7z";
            } else {
                url =
                    "https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz";
            }

            return url;
        };

        /**
         * Clean up download archive and ffmpeg bin when the user
         * cancels operations.
         * @param {string} archive - Path to the downloadd archive.
         */
        this._cleanDownloadedFiles = function (archive) {
            var archive = archive || false;
            if (archive && new QFile(archive).exists()) {
                new QFile(archive).remove();
            }

            if (new QFile(FFMPEG_BIN).exists()) {
                new QFile(FFMPEG_BIN).remove();
            }
        };

        /**
         * Use curl to download ffmpeg.
         * @param {string} url - URL to download ffmpeg from.
         * @param {string} archivePath - Path to download the archive to.
         * @returns {boolean} true if proc exits normally, false otherwise.
         */
        this._downloadArchive = function (url, archivePath) {
            var curlArgs: string[] = [
                url,
                "-k", // insecure - don't verify ssl cert
                "-L", // Follow redirects
                "--output", // Output to a file instead of stdout
                archivePath,
            ];
            var proc = new QProcess();
            this.downloadUI.setLabelText("\nDownloading archive...");
            proc.start(CURL_PATH, curlArgs);
            var procStarted = proc.waitForStarted(1000);

            // Unable to launch curl.
            if (!procStarted) {
                return "";
            }

            while (proc.state() === QProcess.Running) {
                if (this.downloadUI.wasCanceled) {
                    proc.kill();
                    this.downloadUI.close();
                    this.sleepFor(600); // Allow time for process to release lock on file.
                    this._cleanDownloadedFiles(archivePath);
                    return "";
                }
            }

            return proc.exitStatus();
        };

        /**
         * Extract the FFmpeg binary using 7-zip, and remove the downloaded archive.
         * @param {string} - Path to the downloaded .7z to extract.
         * @returns {boolean} true if successful, false otherwise.
         */
        this._extractFFmpeg = function (archivePath: string): boolean {
            var bin: string;
            var args: string[];

            // Linux uses tar, Windows/MacOS use 7z.
            if (about.isLinuxArch()) {
                bin = TAR_PATH;
                args = [
                    "-xf", // Extract file
                    archivePath,
                    "--wildcards", // Filter only FFmpeg bin
                    "--no-anchored",
                    "*ffmpeg",
                    "--strip-components", // Don't extract into folder
                    "1",
                ];
            } else {
                bin = ZIP_PATH;
                args = [
                    "e", // Extract
                    archivePath,
                    `-o${SCRIPT_RESOURCE_PATH}`, // Output dir
                    FFMPEG_BIN, // Filter only FFmpeg bin
                    "-r", // Search recursively
                ];
            }

            var proc = new QProcess();
            proc.setWorkingDirectory(SCRIPT_RESOURCE_PATH);
            this.downloadUI.setLabelText("\nExtracting FFmpeg from archive...");
            proc.start(bin, args);
            var procStarted = proc.waitForStarted(1000);

            // Unable to launch 7z|7za|tar.
            if (!procStarted) {
                return false;
            }

            while (proc.state() === QProcess.Running) {
                if (this.downloadUI.wasCanceled) {
                    proc.kill();
                    this.downloadUI.close();
                    this.sleepFor(600); // Allow time for process to release lock on file.
                    this._cleanDownloadedFiles(archivePath);
                    return false;
                }
            }

            if (
                proc.exitStatus() &&
                new QFile(
                    fileMapper.toNativePath(
                        `${SCRIPT_RESOURCE_PATH}/${FFMPEG_BIN}`
                    )
                )
            ) {
                this.downloadUI.setLabelText("\nCleaning up...");
                new QFile(archivePath).remove(); // Remove temp downloaded file.
                this.downloadUI.close();
                return true;
            }

            return false;
        };

        // curl doesn't exist - exit.
        if (!new QFile(CURL_PATH).exists()) {
            return "";
        }

        // Show progress UI and set initial state.
        this.downloadUI = this._createDownloadUI();
        this.downloadUI.show();
        this.downloadUI.raise();
        this.downloadUI.activateWindow();

        var ffmpegUrl: string = this._getFFmpegUrl();
        var ffmpegDownloadExt = about.isLinuxArch() ? "xz" : "7z";
        var ffmpegDownloadPath: string = fileMapper.toNativePath(
            `${this.getScriptResourcePath(
                true
            )}/ffmpeg_download.${ffmpegDownloadExt}`
        ); // Create resource path if not already present.

        // Download and extract ffmpeg.
        var downloaded = this._downloadArchive(ffmpegUrl, ffmpegDownloadPath);
        if (downloaded && new QFile(ffmpegDownloadPath).exists()) {
            this._extractFFmpeg(ffmpegDownloadPath);
        }

        // Verify operations were successful and FFmpeg now exists in the expected location.
        var ffmpegPath = new QFileInfo(
            fileMapper.toNativePath(`${SCRIPT_RESOURCE_PATH}/${FFMPEG_BIN}`)
        );
        if (ffmpegPath.exists()) {
            return ffmpegPath.absoluteFilePath();
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
        var ffmpegPath = this.getBinPath(FFMPEG_BIN, [SCRIPT_RESOURCE_PATH]);
        if (ffmpegPath) {
            return ffmpegPath;
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
            [`*.${IMAGE_EXT}`],
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
            [`*.${AUDIO_EXT}`],
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

    // Preference dialog
    // Open preference dialog to set formats and close without running script.
    if (KeyModifiers.IsShiftPressed()) {
        this.prefUI = this.createPreferenceDialog();
        this.prefUI.acceptBtn.released.connect(this, function () {
            this.setPreferences({
                videoExt: this.prefUI.videoCB.currentText,
                audioExt: this.prefUI.audioCB.currentText,
            });
            this.prefUI.close();
        });
        this.prefUI.exec();
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

    scene.beginUndoRedoAccum("importMovieFFmpeg");

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
    }
    this.cleanTempDir();
    scene.endUndoRedoAccum();
}
