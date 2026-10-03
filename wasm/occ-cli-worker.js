// Module Web Worker that runs the OCC CLI once per spawn (fresh FS each time).
//
// occjs >= 0.9.2 ships occ.js as an ES module exporting the Emscripten factory
// `createOccCliModule` (the old build was a classic script driven by a global
// `var Module` loaded via importScripts). So this worker is spawned with
// { type: "module" } and imports the factory directly. It must stay in public/ —
// served verbatim, not bundled by Vite — so `import "./occ.js"` resolves to the
// occ.js copied alongside it in /wasm/.
//
// Protocol (unchanged, so the callers in src/backends/occ/wasm/* need no change):
//   in:  postMessage({ args: string[], files: Record<path, Uint8Array|string> })
//   out: { type: "progress", line }  — stdout
//        { type: "stderr",   line }  — stderr
//        { type: "done", exitCode, files: Record<path, ArrayBuffer> }
//        { type: "error", message }
//
// Catalog mode — read occ's preloaded data files without running the CLI:
//   in:  postMessage({ mode: "list-data" })
//   out: { type: "data", basisFiles: string[], dftMethodsJson: string|null }
import createOccCliModule from "./occ.js";

// Recursively read every file under `dir` into transferable ArrayBuffers.
function collectFiles(Module, dir, result) {
  var contents;
  try {
    contents = Module.FS.readdir(dir);
  } catch (e) {
    return;
  }
  for (var i = 0; i < contents.length; i++) {
    var item = contents[i];
    if (item === "." || item === "..") continue;

    var fullPath = dir === "/" ? "/" + item : dir + "/" + item;
    try {
      var stat = Module.FS.stat(fullPath);
      if (Module.FS.isDir(stat.mode)) {
        collectFiles(Module, fullPath, result);
      } else {
        var data = Module.FS.readFile(fullPath);
        // Copy to a transferable ArrayBuffer
        var buf = new ArrayBuffer(data.byteLength);
        new Uint8Array(buf).set(data);
        result[fullPath] = buf;
      }
    } catch (e) {
      // Skip files we can't read
    }
  }
}

self.onmessage = async function (e) {
  var args = e.data.args;
  var files = e.data.files;

  var Module;
  try {
    Module = await createOccCliModule({
      print: function (text) { self.postMessage({ type: "progress", line: text }); },
      printErr: function (text) { self.postMessage({ type: "stderr", line: text }); },
      onAbort: function (msg) { self.postMessage({ type: "error", message: "OCC WASM aborted: " + msg }); },
      // We drive main() ourselves via callMain with the CLI args below.
      noInitialRun: true,
      // occ.wasm / occ.data sit next to this worker in /wasm/.
      locateFile: function (path) { return new URL(path, import.meta.url).href; },
    });
  } catch (error) {
    self.postMessage({ type: "error", message: "Failed to load occ.js: " + ((error && error.message) || String(error)) });
    return;
  }

  // Catalog mode: the occ.data preload package has mounted /basis and
  // /methods by now — report their contents and skip the CLI entirely.
  if (e.data && e.data.mode === "list-data") {
    var basisFiles = [];
    try {
      basisFiles = Module.FS.readdir("/basis").filter(function (n) {
        return n !== "." && n !== "..";
      });
    } catch (err) {
      // No /basis in the bundle — report an empty catalog.
    }
    var dftMethodsJson = null;
    try {
      dftMethodsJson = Module.FS.readFile("/methods/dft_methods.json", { encoding: "utf8" });
    } catch (err) {
      // Absent from the bundle — the caller falls back to its built-in lists.
    }
    self.postMessage({ type: "data", basisFiles: basisFiles, dftMethodsJson: dftMethodsJson });
    return;
  }

  try {
    // Write input files to the virtual filesystem, creating parent dirs.
    if (files) {
      for (var path in files) {
        if (!Object.prototype.hasOwnProperty.call(files, path)) continue;
        var parts = path.split("/").filter(function (p) { return p; });
        var currentPath = "/";
        for (var i = 0; i < parts.length - 1; i++) {
          currentPath += parts[i];
          try {
            Module.FS.mkdir(currentPath);
          } catch (e) {
            // Directory might already exist
          }
          currentPath += "/";
        }
        Module.FS.writeFile(path, files[path]);
      }
    }

    // Call main with the CLI arguments.
    var exitCode = Module.callMain(args);

    // Collect all output files from the filesystem.
    var outputFiles = {};
    collectFiles(Module, "/", outputFiles);
    self.postMessage({ type: "done", exitCode: exitCode || 0, files: outputFiles });
  } catch (error) {
    if (error && error.name === "ExitStatus") {
      // Non-zero exit still throws — collect output files anyway.
      var outputFiles2 = {};
      collectFiles(Module, "/", outputFiles2);
      self.postMessage({ type: "done", exitCode: error.status, files: outputFiles2 });
    } else {
      self.postMessage({ type: "error", message: "Runtime error: " + ((error && error.message) || String(error)) });
    }
  }
};
