import zipfile
import os
import re
from collections import namedtuple
import sys


def get_version(file_path):
    """
    Read the input script and return the current version found
    in the JSDoc structure.
    """
    with open(file_path, "r") as read_file:
        for line in read_file:
            line_search = re.match(r".*@version (\d+\.\d+\.\d+)$", line)
            if line_search:
                return line_search[1]

    return False


def generate_readme(script_data, version):
    """
    Generate a readme.txt for the script, using information from the script
    README.md file, and including additional information such as
    installation instructions and a link to the source repository.
    """

    script_name_text = script_data.js["name"]
    installation_text = (
        "Use the Script Editor's import dialog to install the script, "
        + "and automatically include any ui files, or icons. \n"
        + "See the ToonBoom documentation on importing scripts for more information: "
        + "https://docs.toonboom.com/help/harmony-20/premium/scripting/import-script.html"
    )
    repo_info_text = "https://github.com/bob-ross27/toonboom"
    description_text = "Description: "
    instruction_text = "Usage: "
    script_match = False
    description_found = False
    instruction_found = False

    with open(os.path.abspath("./scripts/README.md"), "r") as read_file:
        for line in read_file:
            if not description_found or not instruction_found:
                if re.match(rf"\#\# {script_name_text}.*", line):
                    script_match = True

                if script_match:
                    if re.match(r"\*\*Description\*\*.*", line):
                        description_text += next(read_file).strip()
                        description_found = True
                    if re.match(r"\*\*Instructions\*\*.*", line):
                        instruction_text += next(read_file).strip()
                        instruction_found = True

    return "\n".join(
        [
            f"{script_name_text} - {version}",
            repo_info_text,
            "",
            description_text,
            "",
            instruction_text,
        ]
    )


def get_paths(script):
    """
    Generate a namedtuple containing names and paths for the script, the compiled
    js file, along with the location for a potential user interface file and script
    icon.
    """
    script_clean = script.replace(".ts", "")
    ScriptData = namedtuple("ScriptData", ["src", "js", "ui", "icon"])

    scripts_dir = os.path.abspath("./scripts")
    src = {"name": script, "path": os.path.join(os.path.abspath("./src"), script)}

    js = {
        "name": f"{script_clean}.js",
        "path": os.path.join(scripts_dir, f"{script_clean}.js"),
    }
    ui = {
        "name": f"{script_clean}.ui",
        "path": os.path.join(scripts_dir, f"{script_clean}.ui"),
    }
    icon = {
        "name": f"{script_clean}.png",
        "path": os.path.join(scripts_dir, "script-icons", f"{script_clean}.png"),
    }

    return ScriptData(src, js, ui, icon)


def write_zip(script_data, file_version, readme_text):
    """
    Create a zip for distribution containing the compiled js, any
    associated components such as ui files or script-icons, and a readme.txt
    """
    dist_dir = os.path.abspath("./dist")
    zip_name = script_data.src["name"].replace("ts", "zip")
    zip_out = os.path.join(dist_dir, zip_name)

    try:
        with zipfile.ZipFile(zip_out, "w") as write_zip:
            write_zip.write(script_data.js["path"], script_data.js["name"])
            if os.path.isfile(script_data.icon["path"]):
                write_zip.write(
                    script_data.icon["path"],
                    script_data.icon["name"],
                )
            if os.path.isfile(script_data.ui["path"]):
                write_zip.write(
                    script_data.ui["path"],
                    script_data.ui["name"],
                )
            write_zip.writestr("readme.txt", readme_text)
        return True
    except IOError:
        return False


if __name__ == "__main__":
    file_list = [file for file in os.listdir("./src") if file.endswith(".ts")]
    for file in file_list:
        file_version = get_version(os.path.join(os.path.abspath("./src"), file))

        script_data = get_paths(file)
        readme_text = generate_readme(script_data, file_version)
        if not readme_text:
            sys.exit(1)

        if not write_zip(script_data, file_version, readme_text):
            sys.exit(1)