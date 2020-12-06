# Toonboom Scripts

Scripts and utilities for Toonboom Harmony.

## Installing Scripts

Scripts can be found in the scripts/ directory.
See [Toonboom Documentation - Importing Scripts](https://docs.toonboom.com/help/harmony-20/premium/scripting/import-script.html) for information on importing and using scripts.

## Dev Environment

This repository uses TypeScript for source files, and uses `tsc` to compile down to ECMA5-compliant Javascript for usage with Harmony. This allows for the usage of newer ECMA syntax and strict typing while still remaining compliant with QT Script.

-   Formatting: Prettier
-   Linting: ESlint with the airbnb-typescript-prettier config.

### Harmony Configuration

Configuring the `TOONBOOM_GLOBAL_SCRIPT_LOCATION` environment variable to point to the `scripts/` directory can be used in concert with `tsc -watch` to update scripts for Harmony in real-time as TypeScript source files are edited.

### Dependencies

Install development requirements with `npm install`.

### Compiling to .js

`tsc -watch` can be used for realtime compiling, however final compiling/formatting should be done through the included `pre-commit` hook, located in the hooks directory to ensure whitespace isn't stripped.

### Hooks

Symlink or copy the pre-commit hook to automatically trigger code formating on commit.

`ln -s ../../hooks/pre-commit .git/hooks/pre-commit`

## Contributing

Change requests should be via pull request. See the GitHub documentation on [creating a pull request](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request).
Note the compiling and formatting requirements, and ensure changes originate from the TypeScript src files.

## License

This project uses the following license: [MPL-2.0](https://spdx.org/licenses/MPL-2.0.html).
