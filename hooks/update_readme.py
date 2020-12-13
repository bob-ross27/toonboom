import zipfile
import os
import re
from collections import namedtuple
import sys


def get_version(file_path):
    """
    Read the input script and return the current version.
    """
    with open(file_path, "r") as read_file:
        for line in read_file:
            line_search = re.match(r".*@version (\d+\.\d+\.\d+)$", line)
            if line_search:
                return line_search[1]

    return False


def update_script_readme(script, version):
    """
    Update the version in the script readme with the script @version tag.
    """
    # Read lines into array, modifying the version of the script with the inputted
    # version.
    with open(os.path.abspath("../scripts/README.md"), "r") as read_file:
        script_match = False
        version_updated = False
        file_read = []
        for line in read_file:
            if not version_updated:
                if re.match(rf"\#\# {script.replace('ts','js')}.*", line):
                    script_match = True

                if script_match:
                    if re.match(r"\*\*Version\*\* (\d+\.\d+\.\d+)$", line):
                        line = re.sub(rf"\d+\.\d+\.\d+", version, line)
                        version_updated = True

            file_read.append(line)

    # Rewrite script readme with updated information.
    try:
        with open(os.path.abspath("../scripts/README.md"), "w") as write_file:
            for line in file_read:
                write_file.writelines(line)

        if not version_updated:
            print(f"Couldn't find version for script {script} in README.md")
            return False
        return True

    # Can't write file.
    except:
        print("Can't open README.md for updating.")
        return False


if __name__ == "__main__":
    for file in os.listdir("../src"):
        file_version = get_version(os.path.join(os.path.abspath("../src"), file))
        if not update_script_readme(file, file_version):
            sys.exit(1)