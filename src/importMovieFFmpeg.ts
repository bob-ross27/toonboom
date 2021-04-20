"use strict";

/**
 * Mimic the built-in movie import function using FFmpeg to support a broader
 * range of formats and codecs.
 * Software: Harmony 17 Premium.
 * @version 1.2.0
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function importMovieFFmpeg(): boolean {
    /**
     * Basic logger.
     * @param {string} logLevel - Level to output the log as.
     *     DEBUG: Detailed info to help with isolating potential problems.
     *     INFO: General messages indicating success or approval largely within private funtions.
     *     WARN: Warning messages that don't trigger dialog output, but indicate something failed.
     *     ERROR: Fatal errors that should trigger an output to the user.
     * @param {string} message - Message to log.
     */
    this.log = function (inputLogLevel: string, message: string) {
        // Exit if no message passed.
        if (!message) {
            return;
        }

        const LOG_LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"];
        var logLevel = inputLogLevel.toUpperCase() || "INFO";

        if (LOG_LEVELS.indexOf(logLevel) === -1) {
            logLevel = "INFO";
        }

        // Output log.
        if (logLevel === "DEBUG") {
            MessageLog.debug(`importMovieFFmpeg::DEBUG: ${message}`);
        } else if (logLevel === "INFO") {
            MessageLog.trace(`importMovieFFmpeg::INFO: ${message}`);
        } else if (logLevel === "WARN") {
            MessageLog.trace(`importMovieFFmpeg::WARNING: ${message}`);
        } else {
            MessageLog.error(`importMovieFFmpeg::ERROR: ${message}`);
        }
    };

    /**
     * Return the path to the script resource folder.
     * Create the folder if the bool createFolder passed.
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
            scriptParent.mkpath(resourceFolderName);
        }

        this.log("debug", `Resource folder: ${resourceFolderName}.`);
        return resourceFolderName;
    };

    /**
     * Create and return the path to a temporary directory.
     * @returns {string} Path to the temporary directory.
     */
    this.getTempDirectory = function (): string {
        var folderName: string = QUuid.createUuid();
        var tempFolderName: string = fileMapper.toNativePath(
            `${specialFolders.temp}/${folderName}`
        );
        var resourceDir = new QDir(tempFolderName);
        if (!resourceDir.exists()) {
            new QDir(specialFolders.temp).mkdir(folderName);
        }

        this.log("debug", `Temp folder: ${tempFolderName}.`);
        return tempFolderName;
    };

    /**
     * Try to get JSON encoded script preferences from
     * the Harmony preferences. Return default values if not found.
     * @returns {Object} Object containing preference values.
     */
    this.getPreferences = function () {
        var defaultPreferences = {
            videoExt: "tga",
            audioExt: "wav",
            lastImportPath: about.isWindowsArch()
                ? System.getenv("HOMEPATH")
                : System.getenv("HOME"),
        };
        var getPreferences: string = preferences.getString(
            "IMPORT_MOVIE_FFMPEG_PREF",
            ""
        );
        // Default values.
        if (!getPreferences) {
            this.log(
                "debug",
                `Loaded default preferences: ${JSON.stringify(
                    defaultPreferences
                )}.`
            );
            return defaultPreferences;
        }

        this.log("debug", `Loaded user preferences: ${getPreferences}.`);
        return JSON.parse(getPreferences);
    };

    /**
     * Save the preferences as a JSON encoded string in the Harmony preferences.
     * @param {Object} userPreferences - Object containing the preferences to store.
     */
    this.setPreferences = function (userPreferences) {
        preferences.setString(
            "IMPORT_MOVIE_FFMPEG_PREF",
            JSON.stringify(userPreferences)
        );
        this.log(
            "debug",
            `preferences saved: ${JSON.stringify(userPreferences)}.`
        );
    };

    /**
     * Create a dialog for setting preferences.
     * Default the audio/video format based on the
     * user preferences.
     * @returns {QWidget} UI object.
     */
    this.createPreferenceDialog = function (): QWidget {
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
     * Search system PATH env var, as well as any (optionally) provided paths for the specific binary.
     * @param {string} bin - Name of the binary to find.
     * @param {string[]} paths - Optional array of paths to include in search.
     * @returns {string} Return path if found, "" otherwise.
     */
    this.getBinPath = function (bin: string, paths: string[]): string {
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
            var binPath = fileMapper.toNativePath(`${searchResults[0]}/${bin}`);
            this.log("debug", `Binary ${bin} found at: ${binPath}`);
            return binPath;
        }

        this.log("debug", `Unable to find path to ${bin}.`);
        return "";
    };

    /**
     * Global consts.
     */
    // Global paths
    const SCRIPT_RESOURCE_PATH: string = this.getScriptResourcePath();
    const TEMP_DIR: string = this.getTempDirectory();

    // Binaries
    const CURL_BIN: string = about.isWindowsArch() ? "curl.exe" : "curl";
    const CURL_PATH: string = this.getBinPath(CURL_BIN, [
        `${specialFolders.bin}/bin_3rdParty/`,
    ]);
    const FFMPEG_BIN: string = about.isWindowsArch() ? "ffmpeg.exe" : "ffmpeg";
    const ZIP_BIN = about.isWindowsArch() ? "7z.exe" : "7za";
    const ZIP_PATH = this.getBinPath(ZIP_BIN, [
        `${specialFolders.bin}/bin_3rdParty/`,
    ]);
    const TAR_PATH = this.getBinPath("tar");

    var userPrefs = this.getPreferences();
    const LAST_IMPORT_PATH = userPrefs.lastImportPath;
    const IMAGE_EXT = userPrefs.videoExt;
    const AUDIO_EXT = userPrefs.audioExt;

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
         * @returns {boolean} true if bin is executable, false otherwise.
         */
        this._setFFmpegExecutable = function (): boolean {
            // This shouldn't be relevant to Windows.
            if (about.isMacArch() || about.isLinuxArch()) {
                var proc = new QProcess();
                proc.start("chmod", ["+x", ffmpegPath]);
                var procStarted = proc.waitForStarted(1500);
                // Chmod unsuccessful.
                if (!procStarted) {
                    this.log(
                        "warn",
                        `Unable to launch process to set FFmpeg as executable.`
                    );
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
                    this.log(
                        "warn",
                        `Unable to set FFmpeg binary as executable.`
                    );
                    return false;
                }
            }

            var proc = new QProcess();
            proc.start(ffmpegPath, ["-version"]);
            var procStarted = proc.waitForStarted(1500);
            var procFinished = proc.waitForFinished(3000);

            if (procStarted && procFinished) {
                this.log(
                    "debug",
                    `FFmpeg binary is executable and launches successfully.`
                );
                return true;
            }

            this.log("warn", `FFmpeg binary not executable.`);
            return false;
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
        this._parseVideoAttributes = function (inputMovieFile: QFileInfo) {
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
            this.parseVideoProc.start(ffmpegPath, ffmpegArgs);
            var procStarted: boolean = this.parseVideoProc.waitForStarted(1500);
            // Process couldn't be started.
            if (!procStarted) {
                this.log(
                    "warn",
                    `Unable to parse video to determine framecount and available streams.`
                );
                return false;
            }

            // Enter event loop
            this.loop.exec();

            // Check if user cancelled dialog.
            if (this.convertUI.wasCanceled) {
                this.parseVideoProc.kill();
                this.convertUI.close();
                this.log("debug", `FFmpeg video parsing cancelled by user.`);
                return false;
            }

            // Fetch stderr output for parsing.
            var outputStdErr = new QTextStream(
                this.parseVideoProc.readAllStandardError()
            ).readAll();

            // Regex
            var framesRe = new RegExp(/.*frame=\s*(\d+)\s?fps=.*/);
            var audioRe = new RegExp(/(Stream #\d:\d(?:\(.*\))?: Audio)/);
            var videoRe = new RegExp(/(Stream #\d:\d(?:\(.*\))?: Video)/);

            var audioStream = outputStdErr.match(audioRe);
            this.log("debug", `Audio stream detected: ${!!audioStream}`);
            var videoStream = outputStdErr.match(videoRe);
            this.log("debug", `Video stream detected: ${!!videoStream}`);
            var frames: number;
            if (outputStdErr.match(framesRe)) {
                frames = parseInt(outputStdErr.match(framesRe)[1], 10);
            }
            this.log("debug", `Video framecount detected: ${frames}`);

            return {
                audio: audioStream,
                video: videoStream,
                frames,
            };
        };

        /**
         * Create the QT Progress dialog.
         * @returns {QProcessDialog} Progress dialog.
         */
        this._createConvertUI = function (): QProcessDialog {
            this.convertUI = new QProgressDialog(
                "\nDetermining Movie Framecount...",
                "Cancel",
                0,
                0,
                this,
                Qt.FramelessWindowHint
            );
            this.convertUI.modal = true;
            this.convertUI.value = 0;
            this.convertUI.minimumDuration = 0;
            return this.convertUI;
        };

        /**
         * Convert Video using FFmpeg.
         * @param {QFileInfo} movieFile - Path to the user provided movie.
         * @returns {boolean} true if proc exits normally, false otherwise.
         */
        this._convertVideo = function (movieFile: QFileInfo): boolean {
            var movieBasename: string = movieFile.baseName();
            var movieOutputName = movieBasename.replace(/-/g, "_");

            // Conversion process
            var ffmpegArgs: string[] = [
                "-y",
                "-i",
                `${movieFile.absoluteFilePath()}`,
                fileMapper.toNativePath(
                    `${TEMP_DIR}/${movieOutputName}-%04d.${IMAGE_EXT}`
                ),
            ];

            this.convertVideoProc.start(ffmpegPath, ffmpegArgs);

            // Verify proc started successfully.
            var procStarted = this.convertVideoProc.waitForStarted(1500);
            if (!procStarted) {
                this.log("warn", `Unable to start FFmpeg to convert video.`);
                return false;
            }

            // Enter event loop
            this.loop.exec();

            // Check if user cancelled dialog.
            if (this.convertUI.wasCanceled) {
                this.timer.stop();
                this.convertVideoProc.kill();
                this.convertUI.close();
                this.log("debug", `FFmpeg video conversion cancelled by user.`);
                return false;
            }

            return this.convertVideoProc.exitStatus();
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
            var ffmpegArgs: string[] = [
                "-y",
                "-i",
                `${movieFile.absoluteFilePath()}`,
                fileMapper.toNativePath(
                    `${TEMP_DIR}/${movieOutputName}.${AUDIO_EXT}`
                ),
            ];

            this.convertAudioProc.start(ffmpegPath, ffmpegArgs);

            // Verify proc started successfully.
            var procStarted = this.convertAudioProc.waitForStarted(1500);
            if (!procStarted) {
                this.log("info", `Update to start FFmpeg to convert audio.`);
                return false;
            }

            // Enter event loop
            this.loop.exec();

            // Check if user cancelled dialog.
            if (this.convertUI.wasCanceled) {
                this.timer.stop();
                this.convertAudioProc.kill();
                this.convertUI.close();
                this.log("warn", `FFmpeg audio conversion cancelled by user.`);
                return false;
            }

            return this.convertAudioProc.exitStatus();
        };

        /**
         * convertMovie - Main
         */
        // If FFmpeg isn't able to launch, exit.
        if (!this._testFFmpegExecutable()) {
            return false;
        }

        var inputMovieFile = new QFileInfo(inputMovie);

        this.loop = new QEventLoop();
        this.parseVideoProc = new QProcess();
        this.convertAudioProc = new QProcess();
        this.convertVideoProc = new QProcess();

        this.parseVideoProc["finished(int,QProcess::ExitStatus)"].connect(
            this,
            function () {
                this.loop.exit();
            }
        );
        this.convertAudioProc["finished(int,QProcess::ExitStatus)"].connect(
            this,
            function () {
                this.loop.exit();
            }
        );
        this.convertVideoProc["finished(int,QProcess::ExitStatus)"].connect(
            this,
            function () {
                this.loop.exit();
            }
        );

        this.convertUI = this._createConvertUI();
        this.convertUI.canceled.connect(this, function () {
            // Exit active event loop, which allows
            // wasCanceled handling to occur in the current running function.
            this.loop.exit();
        });

        this.convertUI.show();

        var movieAttributes = this._parseVideoAttributes(inputMovieFile);
        if (!movieAttributes) {
            return false;
        }

        if (!movieAttributes) {
            return false;
        }

        // If audio stream is present, increment file count.
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
            this.convertUI.setLabelText(
                `\nConverting video using FFmpeg...\n${convertedFiles}/${fileCount}`
            );
        });

        this.timer.start(20);

        // Video conversion stage
        if (movieAttributes.video) {
            this.convertUI.setLabelText("\nConverting video using FFmpeg...");
            var videoConverted = this._convertVideo(inputMovieFile);
            if (!videoConverted) {
                return false;
            }
        }

        // Audio conversion stage
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

        // Final check to ensure all files are included and we didn't
        // exit the event loop between timers.
        convertedFiles = tempDir.entryList(
            [`*.${IMAGE_EXT}`, `*.${AUDIO_EXT}`],
            QDir.Files,
            QDir.Name
        ).length;
        this.convertUI.setValue(convertedFiles);

        // ProgressDialog should automatically close, but formats such as mkv may report slightly lower
        // framecounts during _findMovieFrames than are actually converted.
        if (convertedFiles > fileCount) {
            this.convertUI.close();
            this.convertUI = null;
        }

        // FFmpeg has exited but conversion is not complete.
        if (convertedFiles < fileCount) {
            this.convertUI.close();
            this.log("error", `FFmpeg exited without converting all frames.`);
            return false;
        }
        this.log("debug", `Input movie converted.`);
        return true;
    };

    /**
     * Create a TB Dialog to prompt user for selection.
     * @returns {Dialog} Dialog object.
     */
    this.createDownloadPromptUI = function (): Dialog {
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
        while (new Date().getTime() < now + sleepDuration) {
            /** Do nothing */
        }
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
        this._createDownloadUI = function (): QProcessDialog {
            this.downloadUI = new QProgressDialog(
                "\nDetermining archive size...",
                "Cancel",
                0,
                1,
                this,
                Qt.FramelessWindowHint
            );
            this.downloadUI.modal = true;
            this.downloadUI.value = 0;
            this.downloadUI.minimumDuration = 0;
            return this.downloadUI;
        };

        /**
         * Return the platform-specific download url.
         * @returns {string} Download URL.
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

            this.log("debug", `FFmpeg url: ${url}.`);
            return url;
        };

        /**
         * Clean up download archive and ffmpeg bin when the user
         * cancels operations.
         * @param {string} archive - Path to the downloaded archive.
         */
        this._cleanDownloadedFiles = function (archive: string) {
            this.sleepFor(600); // Sleep to remove potential file locks.
            if (new QFile(archive).exists()) {
                new QFile(archive).remove();
            }

            var ffmpegPath = new QFile(
                fileMapper.toNativePath(`${SCRIPT_RESOURCE_PATH}/${FFMPEG_BIN}`)
            );
            if (ffmpegPath.exists()) {
                ffmpegPath.remove();
            }
            this.log("debug", `FFmpeg download cleaned up.`);
        };

        /**
         * Extract the FFmpeg binary using 7-zip, and remove the downloaded archive.
         * @param {string} archivePath - Path to downloaded archive.
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

            this.downloadUI.maximum = 0;
            this.downloadUI.setValue(0);
            this.downloadProc.setWorkingDirectory(SCRIPT_RESOURCE_PATH);
            this.downloadUI.setLabelText("\nExtracting FFmpeg from archive...");
            this.downloadProc.start(bin, args);
            var procStarted = this.downloadProc.waitForStarted(1500);

            // Unable to launch 7z|7za|tar.
            if (!procStarted) {
                this.log(
                    "warn",
                    `Unable to start ${
                        about.isLinuxArch ? "tar" : "7z"
                    }. to extract FFmpeg.`
                );
                return false;
            }

            // Enter event loop.
            this.loop.exec();

            // Check if user cancelled dialog.
            if (this.downloadUI.wasCanceled) {
                this.downloadProc.kill();
                this.downloadUI.close();
                this._cleanDownloadedFiles(archivePath);
                this.log(
                    "debug",
                    `FFmpeg archive extraction cancelled by user.`
                );
                return false;
            }
            this.downloadUI.close();
            new QFile(archivePath).remove(); // Remove temp downloaded file.
            this.log("debug", `FFmpeg extracted successfully.`);
            return true;
        };

        /**
         * @param {string} url - URL to download FFmpeg from.
         * @returns {int} File size in bytes.
         */
        this._getArchiveSize = function (url: string): number {
            var contentSizeRe = new RegExp(/Content-Length: (\d+)/);

            this.downloadProc.start("curl.exe", ["-k", "-L", "-I", url]);

            // Enter event loop.
            this.loop.exec();

            // Parse returned values for file size.
            var curlHeaders: string = new QTextStream(
                this.downloadProc.readAllStandardOutput()
            ).readAll();
            var downloadSize: number = parseInt(
                curlHeaders.match(contentSizeRe)[1],
                10
            );

            this.log("debug", `FFmpeg archive download size: ${downloadSize}`);
            return downloadSize;
        };

        /**
         * Use curl to download FFmpeg.
         * @param {string} url - URL to download FFmpeg from.
         * @param {string} archivePath - Path to download the archive to.
         * @returns {boolean} true if proc exits normally, false otherwise.
         */
        this._downloadArchive = function (
            url: string,
            archivePath: string
        ): boolean {
            var curlArgs: string[] = [
                url,
                "-k", // insecure - don't verify ssl cert
                "-L", // Follow redirects
                "--output", // Output to a file instead of stdout
                archivePath,
            ];

            this.downloadUI.setLabelText("\nDownloading archive...");
            this.downloadProc.start(CURL_PATH, curlArgs);
            var procStarted = this.downloadProc.waitForStarted(1500);

            // Unable to launch curl.
            if (!procStarted) {
                this.log("warn", `Unable to start curl to download FFmpeg.`);
                return false;
            }

            // Start timer to update dialog with current filesize.
            this.timer.start(20);

            // Enter event loop.
            this.loop.exec();

            // Check if user cancelled dialog.
            if (this.downloadUI.wasCanceled) {
                this.timer.stop();
                this.downloadProc.kill();
                this.downloadUI.close();
                this._cleanDownloadedFiles(archivePath);
                this.log("debug", `FFmpeg archive download cancelled by user.`);
                return false;
            }

            this.timer.stop();

            if (
                new QFile(archivePath).exists() &&
                this.downloadProc.exitStatus()
            ) {
                this.log("debug", `FFmpeg archive downloaded successfully.`);
                return true;
            }
            this.log("debug", `FFmpeg archive download failed.`);
            return false;
        };

        /**
         * downloadFFmpeg Main
         */
        // curl doesn't exist - exit.
        if (!new QFile(CURL_PATH).exists()) {
            this.log(
                "error",
                `curl does not exist or could not be found. Please ensure curl is in the PATH.`
            );
            return "";
        }

        this.timer = new QTimer();
        this.loop = new QEventLoop();
        this.downloadProc = new QProcess();

        this.downloadProc["finished(int,QProcess::ExitStatus)"].connect(
            this,
            function () {
                this.loop.exit();
            }
        );

        this.downloadUI = this._createDownloadUI();
        this.downloadUI.canceled.connect(this, function () {
            // Exit active event loop, which allows
            // wasCanceled handling to occur in the current running function.
            this.loop.exit();
        });

        var ffmpegUrl: string = this._getFFmpegUrl();
        var ffmpegDownloadExt = about.isLinuxArch() ? "xz" : "7z";
        var ffmpegDownloadPath: string = fileMapper.toNativePath(
            `${this.getScriptResourcePath(
                true
            )}/ffmpeg_download.${ffmpegDownloadExt}`
        ); // Create resource path if not already present.

        this.timer.timeout.connect(this, function () {
            var downloadedFile = new QFile(ffmpegDownloadPath);
            if (downloadedFile.exists()) {
                this.downloadUI.setValue(downloadedFile.size());
            }
        });

        this.downloadUI.show();

        // Get download size for use in the progressbar.
        var downloadSize = this._getArchiveSize(ffmpegUrl);
        if (!downloadSize) {
            return "";
        }

        this.downloadUI.maximum = downloadSize + 1; // +1 to avoid closing dialog between stages.

        // Download ffmpeg.
        if (!this._downloadArchive(ffmpegUrl, ffmpegDownloadPath)) {
            return "";
        }

        if (!this._extractFFmpeg(ffmpegDownloadPath)) {
            return "";
        }

        // Verify operations were successful and FFmpeg now exists in the expected location.
        var ffmpegPath = new QFileInfo(
            fileMapper.toNativePath(`${SCRIPT_RESOURCE_PATH}/${FFMPEG_BIN}`)
        );
        if (ffmpegPath.exists()) {
            this.log("info", `FFmpeg download complete.`);
            return ffmpegPath.absoluteFilePath();
        }

        // Either the download or extraction failed.
        this.log("warn", `FFmpeg failed to download.`);
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
        this.ui = this.createDownloadPromptUI();
        if (this.ui.exec()) {
            // Download FFmpeg and return path to binary.
            this.log("debug", `User accepted FFmpeg download prompt.`);
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
            this.log("warn", `No converted images to import.`);
            return false;
        }
        var fileList = files.join(";");
        var backupFilelist = preferences.getString(
            "IMPORTIMGDLG_IMAGE_LASTIMPORT",
            ""
        );
        // Set the preference to autofill the import dialog, and trigger it.
        preferences.setString("IMPORTIMGDLG_IMAGE_LASTIMPORT", fileList);
        Action.perform("onActionImportDrawings()");

        // Restore preference with previously captured value.
        preferences.setString("IMPORTIMGDLG_IMAGE_LASTIMPORT", backupFilelist);

        return true;
    };

    /**
     * Import audio converted by FFmpeg.
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
            this.log("debug", `No converted audio to import.`);
            return false;
        }

        // Create column using the filename and import audio.
        var columnName: string = new QFileInfo(convertedAudio).baseName();
        var inc = 1;
        while (column.getDisplayName(columnName)) {
            columnName = `${columnName}_${inc}`;
            inc += 1;
        }

        column.add(columnName, "SOUND");

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

        this.log("warn", `Unable to clear temp directory.`);
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
                lastImportPath: LAST_IMPORT_PATH,
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
        this.log(
            "error",
            `A fatal error has occured when downloading FFmpeg. See the MessageLog for more details.`
        );
        return;
    }

    // Get input movie from user.
    var inputMovie: string = QFileDialog.getOpenFileName(
        this,
        "Select Video",
        LAST_IMPORT_PATH,
        "Video Files (*.mov *.mp4 *.avi *.mxf *.webm);;All files (*.*);;"
    );

    // User cancelled movie input dialog - exit.
    if (!inputMovie) {
        this.log("warn", `User cancelled input movie dialog.`);
        return;
    }

    // Save last import path to preferences.
    this.setPreferences({
        videoExt: IMAGE_EXT,
        audioExt: AUDIO_EXT,
        lastImportPath: new QFileInfo(inputMovie).path(),
    });

    scene.beginUndoRedoAccum("importMovieFFmpeg");

    // Export image sequence and audio using FFmpeg
    var convertMovie = this.convertMovie(FFMPEG_PATH, inputMovie);
    // Conversion failed or user exited prematurely.
    if (!convertMovie) {
        this.log(
            "error",
            `A fatal error has occured when converting media. See the MessageLog for more details.`
        );
        scene.cancelUndoRedoAccum();
        this.cleanTempDir();
        return;
    }

    // Import files into Harmony.
    this.importConvertedImages();
    this.importConvertedAudio();

    // Clean up before exit.
    this.cleanTempDir();
    scene.endUndoRedoAccum();
    this.log("info", `All operations complete.`);
}
