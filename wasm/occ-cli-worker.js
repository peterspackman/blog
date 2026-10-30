// Module Web Worker that runs the OCC CLI once per spawn (fresh FS each time).
//
// occjs >= 0.9.2 ships occ.js as an ES module exporting the Emscripten factory
// `createOccCliModule` (the old build was a classic script driven by a global
// `var Module` loaded via importScripts). So this worker is spawned with
// { type: "module" } and imports the factory directly. Hosts serve it verbatim
// (not bundled), with occjs's occ.js / occ.wasm / occ.data copied beside it, so
// `import "./occ.js"` resolves to that copy; see setOccWorkerUrl in runtime.ts.
//
// Protocol (declared for callers in ce-calc's occ/wasm/cli.ts):
//   in:  postMessage({ args: string[], files: Record<path, Uint8Array|string>,
//                      outputs?: string[] })
//        `outputs` lists the files to send back ("/exact" or "*suffix"); when
//        omitted, every readable file is sent, preloaded data included.
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

// The files among `patterns` ("/exact" or "*suffix") in the root directory.
function collectOutputs(Module, patterns, result) {
  var names;
  try {
    names = Module.FS.readdir("/");
  } catch (e) {
    return;
  }
  for (var i = 0; i < names.length; i++) {
    var path = "/" + names[i];
    var wanted = patterns.some(function (p) {
      return p.charAt(0) === "*" ? path.endsWith(p.slice(1)) : path === p;
    });
    if (!wanted) continue;
    try {
      if (Module.FS.isDir(Module.FS.stat(path).mode)) continue;
      var data = Module.FS.readFile(path);
      var buf = new ArrayBuffer(data.byteLength);
      new Uint8Array(buf).set(data);
      result[path] = buf;
    } catch (e) {
      // Skip files we can't read
    }
  }
}

function collect(Module, patterns) {
  var result = {};
  if (patterns) collectOutputs(Module, patterns, result);
  else collectFiles(Module, "/", result);
  return result;
}

self.onmessage = async function (e) {
  var args = e.data.args;
  var files = e.data.files;
  var outputs = e.data.outputs;

  var Module;
  try {
    Module = await createOccCliModule({
      print: function (text) { self.postMessage({ type: "progress", line: text }); },
      printErr: function (text) { self.postMessage({ type: "stderr", line: text }); },
      onAbort: function (msg) { self.postMessage({ type: "error", message: "OCC WASM aborted: " + msg }); },
      // We drive main() ourselves (runOcc, below) with the CLI args.
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

    var exitCode = await runOcc(Module, args);
    self.postMessage({ type: "done", exitCode: exitCode, files: collect(Module, outputs) });
  } catch (error) {
    self.postMessage({ type: "error", message: "Runtime error: " + ((error && error.message) || String(error)) });
  }
};

// Run occ to completion and return its exit status.
//
// occjs after 0.9.4 runs main() on its own thread, so that oneTBB's workers
// can be created while it runs; its runMain resolves once main() returns and
// all output and files are in place (callMain throws there). Earlier builds
// run main() on this thread: callMain blocks, and a non-zero exit arrives as
// a thrown ExitStatus. Drop the callMain branch once the served bundle is
// always the newer build.
async function runOcc(Module, args) {
  if (typeof Module.runMain === "function") return await Module.runMain(args);
  try {
    return Module.callMain(args) || 0;
  } catch (error) {
    if (error && error.name === "ExitStatus") return error.status;
    throw error;
  }
}
