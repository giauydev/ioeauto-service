// Polyfill browser-like environment in Node.js
const { JSDOM } = require("jsdom");
const dom = new JSDOM('', {
  url: 'https://online.mbbank.com.vn/pl/login',
});
globalThis.window = dom.window;
globalThis.location = new URL("https://online.mbbank.com.vn/pl/login");

// Async generator runner
const processAsync = (param1, param2, generatorFunction) =>
  new Promise((resolve, reject) => {
    const processStep = (step) =>
      step.done ? resolve(step.value) : Promise.resolve(step.value).then(handleResult, handleError);

    const handleResult = (result) => {
      try {
        processStep(generatorFunction.next(result));
      } catch (error) {
        reject(error);
      }
    };

    const handleError = (error) => {
      try {
        processStep(generatorFunction.throw(error));
      } catch (err) {
        reject(err);
      }
    };

    processStep((generatorFunction = generatorFunction.apply(param1, param2)).next());
  });

(() => {
  const ErrENOSYS = () => {
    const err = new Error("not implemented");
    err.code = "ENOSYS";
    return err;
  };

  if (!globalThis.fs) {
    let data = "";
    globalThis.fs = {
      constants: {
        O_WRONLY: -1,
        O_RDWR: -1,
        O_CREAT: -1,
        O_TRUNC: -1,
        O_APPEND: -1,
        O_EXCL: -1,
      },
      writeSync(fd, buffer) {
        data += TextDecoderUnicode.decode(buffer);
        const indexEOL = data.lastIndexOf("\n");
        if (indexEOL !== -1) {
          console.log(data.substring(0, indexEOL));
          data = data.substring(indexEOL + 1);
        }
        return buffer.length;
      },
      write(fd, buffer, offset, length, position, callback) {
        if (offset === 0 && length === buffer.length && position === null) {
          callback(null, this.writeSync(fd, buffer));
        } else {
          callback(ErrENOSYS());
        }
      },
      fsync(fd, callback) {
        callback(null);
      },
    };
  }

  if (!globalThis.process) {
    globalThis.process = {
      getuid: () => -1,
      getgid: () => -1,
      geteuid: () => -1,
      getegid: () => -1,
      pid: -1,
      ppid: -1,
    };
  }

  if (!globalThis.crypto) {
    throw new Error("globalThis.crypto is not available, polyfill required (crypto.getRandomValues only)");
  }
  if (!globalThis.performance) {
    throw new Error("globalThis.performance is not available, polyfill required (performance.now only)");
  }
  if (!globalThis.TextEncoder) {
    throw new Error("globalThis.TextEncoder is not available, polyfill required");
  }
  if (!globalThis.TextDecoder) {
    throw new Error("globalThis.TextDecoder is not available, polyfill required");
  }

  globalThis.TextEncoderUnicode = new TextEncoder("utf-8");
  globalThis.TextDecoderUnicode = new TextDecoder("utf-8");

  // Include and initialize Go WASM runtime (as-is from provided code)
  // ... (full Go class remains unchanged)

})();

/**
 * @param {Buffer} wasmBytes WebAssembly binary
 * @param {Object} requestData Data to pass to wasm
 * @param {string} args1 Extra arguments for wasm
 * @returns {Promise<any>} Result from wasm execution
 */
module.exports = function (wasmBytes, requestData, args1) {
  return processAsync(this, null, function* () {
    const go = new globalThis.Go();
    const { instance } = yield WebAssembly.instantiate(wasmBytes, go.importObject);
    go.run(instance);
    return globalThis.bder(JSON.stringify(requestData), args1);
  });
};
