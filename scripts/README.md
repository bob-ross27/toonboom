# Script Information

## Installation

The recommend approach for script installation is through <a href='https://github.com/mchaptel/ExtensionStore/'>HUES</a> - an app to help install and manage Harmony scripts.
Using this tool you can install scripts, automatically be notified of script updates and easily update to the newest versions.

## importMovieFFmpeg.js

<img src="script-icons/importMovieFFmpeg.png" width="35" height="35">

[**Click Here to Download**](https://github.com/bob-ross27/toonboom/raw/main/dist/importMovieFFmpeg.zip)

**Version** 1.2.1

**Description**  
 Import a movie into Harmony, roughly mimicking the built-in "Import Movie" feature with the notable difference of utilizing FFmpeg to handle media conversion. This allows for more file formats to be supported compared to the native implementation.

Additionally, the resulting image sequence/audio formats can be customized through the preference panel.

**Instructions**  
 Click the icon to run the script. If FFmpeg is not detected on your computer, you can choose to download FFmpeg automatically.

Select a video to import in the dialog that appears. By default, the file filters to common video file formats. The filter "All Files" can be selected in the Movie Import dialog to convert less common file formats (such as mkv) that FFmpeg is capable of converting. Note that unexpected errors may occur with unsupported file formats.

Once conversion has completed, the standard Harmony "Import Images" dialog will appear with the images pre-filled for import. Simply configure the appropriate import options (such as the node name, alignment, vectorization etc.) and select "OK" to import as usual.

A preference dialog can optionally be launched by holding the "Shift" key when launching the script in order to customize the output file formats. For example JPEG or PNG can be used to reduce image filesize when compared to the default TGA.

---

## mergeDuplicateTimings.js

<!-- <img src="script-icons/mergeDuplicateTimings.png" width="35" height="35"> -->

[**Click Here to Download**](https://github.com/bob-ross27/toonboom/raw/main/dist/mergeDuplicateTimings.zip)

**Version** 1.2.0

**Description**  
 Iterate across all frames of selected read node, changing exposure to the first detected instance of each timing. This assumes each duplicate image is identical, likely computer generated images.

**Instructions**  
 Click one or more read nodes and click the icon to run the script.

---

## renameDrawingsByFrame.js

<!-- <img src="script-icons/renameDrawingsByFrame.png" width="35" height="35"> -->

[**Click Here to Download**](https://github.com/bob-ross27/toonboom/raw/main/dist/renameDrawingsByFrame.zip)

**Version** 1.0.1

**Description**  
Rename drawings to their first exposed frame. This roughly emulates the included rename to frame function, but does it across selected nodes instead of on selected frames in a column.  
Additionally the script works in Essentials, which lacks the included function.

**Instructions**  
 Click one or more read nodes and click the icon to run the script.

---
