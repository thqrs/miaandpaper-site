// js/19-upload-media-pedido.js — parte 19/23 do antigo app.js (codigo intacto, so dividido).
// Os modulos js/*.js partilham TODOS o mesmo escopo global (scripts classicos,
// sem IIFE por ficheiro) e carregam pela ordem dos <script> nos HTML: 01 → 23.
// Conteudo: upload de media do pedido: compressao de fotos, operacoes com timeout/cancelamento, file picker, gravacao de audio, startOrderMediaUpload/removeOrderMediaUpload.
  function compressOrderPhotoCanvas(canvas, targetBytes) {
    var qualities = [0.78, 0.62, 0.48];

    function tryQuality(index) {
      return orderCanvasBlob(canvas, qualities[index]).then(function (blob) {
        if (blob.size <= targetBytes) {
          return { blob: blob, width: canvas.width, height: canvas.height };
        }
        if (index < qualities.length - 1) {
          return tryQuality(index + 1);
        }

        var width = Math.max(1, Math.round(canvas.width * 0.75));
        var height = Math.max(1, Math.round(canvas.height * 0.75));
        if (Math.max(width, height) < 900) {
          throw new Error("encode");
        }
        var smaller = document.createElement("canvas");
        var smallerContext;
        smaller.width = width;
        smaller.height = height;
        smallerContext = smaller.getContext("2d", { alpha: false });
        smallerContext.fillStyle = "#ffffff";
        smallerContext.fillRect(0, 0, width, height);
        smallerContext.drawImage(canvas, 0, 0, width, height);
        canvas.width = 1;
        canvas.height = 1;
        canvas = smaller;
        return tryQuality(0);
      });
    }

    return tryQuality(0);
  }

  function prepareOrderPhoto(file) {
    var targetBytes = Math.floor(1.5 * 1024 * 1024);
    var maxDimension = 3200;

    return loadOrderPhotoImage(file).then(function (loaded) {
      var longest = Math.max(loaded.width, loaded.height);
      if (file.size <= targetBytes && longest <= 4096) {
        URL.revokeObjectURL(loaded.url);
        return { file: file, width: loaded.width, height: loaded.height };
      }

      var scale = Math.min(1, maxDimension / Math.max(1, longest));
      var width = Math.max(1, Math.round(loaded.width * scale));
      var height = Math.max(1, Math.round(loaded.height * scale));
      var canvas = document.createElement("canvas");
      var context;
      var stem = String(file.name || "foto").replace(/\.[^.]+$/, "");

      canvas.width = width;
      canvas.height = height;
      context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(loaded.image, 0, 0, width, height);
      URL.revokeObjectURL(loaded.url);

      return compressOrderPhotoCanvas(canvas, targetBytes).then(function (result) {
        var prepared = new File([result.blob], stem + "-web.webp", { type: "image/webp", lastModified: Date.now() });
        return { file: prepared, width: result.width, height: result.height };
      });
    }).catch(function () {
      if (file.size <= targetBytes) {
        return { file: file, width: 0, height: 0 };
      }
      throw new Error("Não foi possível preparar esta foto. Tenta escolhê-la novamente.");
    });
  }

  function uploadOrderMediaFile(prepared, kind, operation) {
    var formData = new FormData();
    var file = prepared.file;
    formData.append("media[]", file, file.name || (kind === "audio" ? "audio.webm" : "foto"));
    formData.append("kind", kind);
    if (prepared.width) {
      formData.append("width", prepared.width);
      formData.append("height", prepared.height);
    }

    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      var startedAt = Date.now();
      var settled = false;

      function finish(callback, value) {
        if (settled) {
          return;
        }
        settled = true;
        if (operation && operation.xhr === xhr) {
          operation.xhr = null;
        }
        callback(value);
      }

      xhr.open("POST", ORDER_UPLOAD_API, true);
      xhr.withCredentials = true;
      xhr.setRequestHeader("Accept", "application/json");
      if (operation) {
        operation.xhr = xhr;
      }

      xhr.upload.addEventListener("progress", function (event) {
        if (!event.lengthComputable || !operation || !orderUploadOperationIsActive(operation)) {
          return;
        }
        var elapsed = Math.max(0.25, (Date.now() - startedAt) / 1000);
        var speed = event.loaded / elapsed;
        state.orderUploadProgress = {
          operationId: operation.id,
          phase: "upload",
          percent: event.total ? event.loaded / event.total * 100 : 0,
          speed: speed,
          eta: speed > 0 ? Math.max(0, event.total - event.loaded) / speed : 0,
          fileIndex: operation.fileIndex || 1,
          fileCount: operation.fileCount || 1
        };
        updateOrderUploadProgressDom();
      });

      xhr.addEventListener("load", function () {
        var payload = {};
        try {
          payload = JSON.parse(xhr.responseText || "{}");
        } catch (error) {}
        if (xhr.status < 200 || xhr.status >= 300 || !payload.ok
            || !Array.isArray(payload.uploads) || !payload.uploads[0]) {
          finish(reject, new Error(payload.message || "Não foi possível enviar o ficheiro."));
          return;
        }
        finish(resolve, payload.uploads[0]);
      });
      xhr.addEventListener("error", function () {
        finish(reject, new Error("Não foi possível enviar o ficheiro."));
      });
      xhr.addEventListener("abort", function () {
        finish(reject, orderUploadCanceledError());
      });
      xhr.send(formData);
    });
  }

  function syncOrderUploadBusy() {
    state.orderUploadBusy = orderUploadOperations.length > 0;
  }

  function orderUploadOperationIsActive(operation) {
    return !!operation && !operation.finished && orderUploadOperations.indexOf(operation) !== -1;
  }

  function beginOrderUploadOperation(type, stepId) {
    var operation = {
      id: orderUploadNextOperationId,
      type: type || "request",
      stepId: String(stepId || ""),
      controller: typeof window.AbortController === "function" ? new window.AbortController() : null,
      xhr: null,
      timeoutId: 0,
      rejectPending: null,
      canceled: false,
      finished: false
    };

    orderUploadNextOperationId += 1;
    orderUploadOperations.push(operation);
    syncOrderUploadBusy();
    return operation;
  }

  function endOrderUploadOperation(operation) {
    if (!operation || operation.finished) {
      return;
    }

    operation.finished = true;
    if (operation.timeoutId) {
      window.clearTimeout(operation.timeoutId);
      operation.timeoutId = 0;
    }
    operation.rejectPending = null;
    orderUploadOperations = orderUploadOperations.filter(function (candidate) {
      return candidate !== operation;
    });
    syncOrderUploadBusy();
    if (state.orderUploadProgress && state.orderUploadProgress.operationId === operation.id
        && !orderUploadOperations.some(function (candidate) { return candidate.type === "upload"; })) {
      state.orderUploadProgress = null;
    }
  }

  function orderUploadCanceledError() {
    var error = new Error("Operação cancelada.");
    error.name = "AbortError";
    return error;
  }

  function cancelOrderUploadOperation(operation) {
    var rejectPending;

    if (!orderUploadOperationIsActive(operation)) {
      return;
    }

    operation.canceled = true;
    rejectPending = operation.rejectPending;
    if (operation.controller) {
      try {
        operation.controller.abort();
      } catch (error) {}
    }
    if (operation.xhr) {
      try {
        operation.xhr.abort();
      } catch (error) {}
      operation.xhr = null;
    }
    if (rejectPending) {
      rejectPending(orderUploadCanceledError());
    }
    endOrderUploadOperation(operation);
  }

  function cancelOrderUploadOperations(predicate) {
    orderUploadOperations.slice().forEach(function (operation) {
      if (!predicate || predicate(operation)) {
        cancelOrderUploadOperation(operation);
      }
    });
  }

  function withOrderUploadTimeout(promise, operation, timeoutMs, message) {
    if (!orderUploadOperationIsActive(operation)) {
      return Promise.reject(orderUploadCanceledError());
    }

    return new Promise(function (resolve, reject) {
      var settled = false;

      function settle(callback, value) {
        if (settled) {
          return;
        }
        settled = true;
        if (operation.timeoutId) {
          window.clearTimeout(operation.timeoutId);
          operation.timeoutId = 0;
        }
        operation.rejectPending = null;
        callback(value);
      }

      operation.rejectPending = function (error) {
        settle(reject, error || orderUploadCanceledError());
      };
      operation.timeoutId = window.setTimeout(function () {
        if (!orderUploadOperationIsActive(operation)) {
          return;
        }
        if (operation.controller) {
          try {
            operation.controller.abort();
          } catch (error) {}
        }
        if (operation.xhr) {
          try {
            operation.xhr.abort();
          } catch (error) {}
          operation.xhr = null;
        }
        settle(reject, new Error(message));
      }, timeoutMs);

      Promise.resolve(promise).then(function (value) {
        settle(resolve, value);
      }, function (error) {
        settle(reject, error);
      });
    });
  }

  function beginOrderFilePickerSession(input, step) {
    if (orderActiveFilePicker && orderActiveFilePicker.input && orderActiveFilePicker.input !== input) {
      orderActiveFilePicker.input.value = "";
    }

    orderFilePickerRevision += 1;
    if (input) {
      input.value = "";
    }
    orderActiveFilePicker = {
      input: input,
      stepId: String(step && step.id || ""),
      revision: orderFilePickerRevision
    };
    return orderActiveFilePicker;
  }

  function invalidateOrderFilePickerSession(input) {
    orderFilePickerRevision += 1;
    if (orderActiveFilePicker && orderActiveFilePicker.input) {
      orderActiveFilePicker.input.value = "";
    }
    if (input && (!orderActiveFilePicker || orderActiveFilePicker.input !== input)) {
      input.value = "";
    }
    orderActiveFilePicker = null;
  }

  function cancelOrderAudioActivity() {
    var recorder = orderAudioRecorder;

    orderAudioPointerHeld = false;
    orderAudioPendingStart = false;
    orderAudioContext = null;
    state.orderAudioRecording = false;
    orderAudioRecorder = null;
    orderAudioChunks = [];
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch (error) {}
    }
    stopOrderAudioTracks();
  }

  function cancelOrderMediaActivityForStep(step) {
    var stepId = String(step && step.id || "");

    invalidateOrderFilePickerSession();
    cancelOrderUploadOperations(function (operation) {
      return operation.type === "upload" && (!operation.stepId || !stepId || operation.stepId === stepId);
    });
    if (orderStepHasMediaControls(step)) {
      cancelOrderAudioActivity();
    }
  }

  function startOrderMediaUpload(product, config, files, kind, stepId) {
    var key = config.selectionKey || (kind === "audio" ? "quadro_audio_uploads" : "quadro_uploads");
    var maxFiles = orderUploadMaxFiles(config);
    var existing = orderUploadItems(key);
    var candidates = Array.prototype.slice.call(files || []).filter(function (file) {
      return file && Number(file.size) > 0;
    });
    var remaining = isFinite(maxFiles) ? Math.max(0, maxFiles - (config.multiple === true ? existing.length : 0)) : candidates.length;
    var selected = candidates.slice(0, remaining || (config.multiple === true ? 0 : 1));
    var uploads = [];
    var chain = Promise.resolve();
    var operation;

    if (!selected.length) {
      return;
    }
    state.orderUploadError = "";
    state.orderUploadMessage = "";
    state.orderUploadFeedbackKind = kind;
    if (kind === "photo" && selected.some(function (file) { return !orderPhotoFileIsSupported(file); })) {
      state.orderUploadError = "Escolhe fotos JPG, PNG, WebP ou HEIC.";
      rerenderProduct(product);
      return;
    }

    operation = beginOrderUploadOperation("upload", stepId);
    operation.fileCount = selected.length;
    operation.fileIndex = 1;
    state.orderUploadProgress = {
      operationId: operation.id,
      phase: "preparing",
      percent: 0,
      speed: 0,
      eta: 0,
      fileIndex: 1,
      fileCount: selected.length
    };
    state.errors = "";
    rerenderProduct(product);

    selected.forEach(function (file, fileIndex) {
      chain = chain.then(function () {
        var preparation;
        if (!orderUploadOperationIsActive(operation)) {
          throw orderUploadCanceledError();
        }
        operation.fileIndex = fileIndex + 1;
        state.orderUploadProgress = {
          operationId: operation.id,
          phase: "preparing",
          percent: 0,
          speed: 0,
          eta: 0,
          fileIndex: operation.fileIndex,
          fileCount: operation.fileCount
        };
        updateOrderUploadProgressDom();
        preparation = kind === "photo"
          ? prepareOrderPhoto(file)
          : Promise.resolve({ file: file, width: 0, height: 0 });
        return withOrderUploadTimeout(
          preparation,
          operation,
          45000,
          "A preparação do ficheiro demorou demasiado. Tenta escolhê-lo novamente."
        );
      }).then(function (prepared) {
        if (!orderUploadOperationIsActive(operation)) {
          throw orderUploadCanceledError();
        }
        return withOrderUploadTimeout(
          uploadOrderMediaFile(prepared, kind, operation),
          operation,
          90000,
          "O envio demorou demasiado. Confirma a ligação e tenta novamente."
        ).then(function (upload) {
          if (!orderUploadOperationIsActive(operation)) {
            throw orderUploadCanceledError();
          }
          uploads.push(upload);
          orderUploadPreviews[upload.token] = URL.createObjectURL(prepared.file);
        });
      });
    });

    chain.then(function () {
      if (!orderUploadOperationIsActive(operation)) {
        throw orderUploadCanceledError();
      }
      state.selections[key] = config.multiple === true
        ? existing.concat(uploads).slice(0, isFinite(maxFiles) ? maxFiles : existing.length + uploads.length)
        : uploads.slice(0, 1);
      if (config.helpKey) {
        state.selections[config.helpKey] = false;
      }
      if (kind === "photo" && key === "quadro_uploads") {
        resetQuadrosPhotoColorAnalysis();
      }
      state.invalidFields = state.invalidFields.filter(function (fieldName) { return fieldName !== key; });
      if (kind === "audio") {
        state.orderUploadMessage = uploads.length === 1 ? "Áudio enviado." : uploads.length + " áudios enviados.";
      } else {
        state.orderUploadMessage = uploads.length === 1 ? "Foto enviada." : uploads.length + " fotos enviadas.";
      }
    }).catch(function (error) {
      uploads.forEach(function (upload) {
        if (upload && orderUploadPreviews[upload.token]) {
          URL.revokeObjectURL(orderUploadPreviews[upload.token]);
          delete orderUploadPreviews[upload.token];
        }
      });
      if (!orderUploadOperationIsActive(operation) || operation.canceled) {
        return;
      }
      state.orderUploadError = error && error.message ? error.message : "Não foi possível enviar o ficheiro.";
    }).then(function () {
      var shouldRender = orderUploadOperationIsActive(operation);
      endOrderUploadOperation(operation);
      if (shouldRender && state.product === product) {
        rerenderProduct(product);
      }
    });
  }

  function startOrderPhotoUpload(product, step, input, files) {
    var key = input.dataset.orderUploadKey || "quadro_uploads";
    var config = orderMediaConfigForStep(step, key, "photo");
    startOrderMediaUpload(product, config, files || [], "photo", step && step.id);
  }

  function stopOrderAudioTracks() {
    if (orderAudioStream) {
      orderAudioStream.getTracks().forEach(function (track) { track.stop(); });
    }
    orderAudioStream = null;
  }

  function stopOrderAudioRecording() {
    orderAudioPointerHeld = false;
    if (orderAudioRecorder && orderAudioRecorder.state !== "inactive") {
      orderAudioRecorder.stop();
    }
  }

  function startOrderAudioRecording(product, step, button) {
    var key = button.dataset.orderAudioKey || "quadro_audio_uploads";
    var config = orderMediaConfigForStep(step, key, "audio");

    if (state.orderUploadBusy || orderAudioPendingStart || state.orderAudioRecording) {
      return;
    }
    orderAudioPointerHeld = true;
    orderAudioPendingStart = true;
    orderAudioContext = { product: product, config: config, stepId: String(step && step.id || "") };
    state.orderUploadError = "";
    state.orderUploadMessage = "";
    state.orderUploadFeedbackKind = "audio";

    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      var mimeType = mimeTypes.filter(function (type) {
        return !MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(type);
      })[0] || "";

      orderAudioPendingStart = false;
      if (!orderAudioPointerHeld) {
        stream.getTracks().forEach(function (track) { track.stop(); });
        orderAudioContext = null;
        state.orderUploadMessage = "Microfone pronto. Agora mantém o botão premido enquanto falas.";
        state.orderUploadFeedbackKind = "audio";
        rerenderProduct(product);
        return;
      }

      orderAudioStream = stream;
      orderAudioChunks = [];
      orderAudioRecorder = mimeType ? new MediaRecorder(stream, { mimeType: mimeType }) : new MediaRecorder(stream);
      orderAudioRecorder.ondataavailable = function (event) {
        if (event.data && event.data.size) {
          orderAudioChunks.push(event.data);
        }
      };
      orderAudioRecorder.onstop = function () {
        var recorderType = orderAudioRecorder && orderAudioRecorder.mimeType ? orderAudioRecorder.mimeType : "audio/webm";
        var extension = recorderType.indexOf("mp4") !== -1 ? "m4a" : (recorderType.indexOf("ogg") !== -1 ? "ogg" : "webm");
        var blob = new Blob(orderAudioChunks, { type: recorderType });
        var file = new File([blob], "audio-" + Date.now() + "." + extension, { type: recorderType, lastModified: Date.now() });

        state.orderAudioRecording = false;
        orderAudioRecorder = null;
        orderAudioChunks = [];
        stopOrderAudioTracks();
        if (blob.size && orderAudioContext) {
          startOrderMediaUpload(orderAudioContext.product, orderAudioContext.config, [file], "audio", orderAudioContext.stepId);
        } else if (orderAudioContext) {
          rerenderProduct(orderAudioContext.product);
        }
      };
      orderAudioRecorder.start(250);
      state.orderAudioRecording = true;
      button.classList.add("is-recording");
      button.querySelector("strong").textContent = "A gravar…";
      button.querySelector("small").textContent = "Solta para anexar";
      button.setAttribute("aria-label", "A gravar. Solta para anexar");
    }).catch(function () {
      orderAudioPendingStart = false;
      orderAudioPointerHeld = false;
      stopOrderAudioTracks();
      state.orderUploadError = "Não foi possível usar o microfone. Confirma a permissão e tenta novamente.";
      rerenderProduct(product);
    });
  }

  function removeOrderMediaUpload(product, key, token) {
    var formData = new FormData();
    var operation;
    var requestOptions;
    var request;
    formData.append("action", "delete");
    formData.append("token", token);
    operation = beginOrderUploadOperation("delete", currentStep(product) && currentStep(product).id);
    state.orderUploadError = "";
    state.orderUploadMessage = "";
    state.orderUploadFeedbackKind = key === "quadro_audio_uploads" ? "audio" : "photo";
    rerenderProduct(product);

    requestOptions = {
      method: "POST",
      credentials: "same-origin",
      headers: { "Accept": "application/json" },
      body: formData
    };
    if (operation.controller) {
      requestOptions.signal = operation.controller.signal;
    }

    request = fetch(ORDER_UPLOAD_API, requestOptions).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok || !payload.ok) {
          throw new Error(payload.message || "Não foi possível remover o ficheiro.");
        }
      });
    });

    withOrderUploadTimeout(request, operation, 45000, "A remoção demorou demasiado. Tenta novamente.").then(function () {
      if (!orderUploadOperationIsActive(operation)) {
        throw orderUploadCanceledError();
      }
      state.selections[key] = orderUploadItems(key).filter(function (item) { return item.token !== token; });
      if (key === "quadro_uploads" && !state.selections[key].length) {
        resetQuadrosPhotoColorAnalysis();
      }
      if (state.editingCartItemId) {
        var cart = loadCart();
        var cartItem = cart.items.filter(function (item) { return item.id === state.editingCartItemId; })[0];
        if (cartItem && cartItem.selections) {
          cartItem.selections[key] = Array.isArray(cartItem.selections[key])
            ? cartItem.selections[key].filter(function (item) { return item && item.token !== token; })
            : [];
          saveCart(cart);
        }
        if (state.editingCartOriginalItem && state.editingCartOriginalItem.selections) {
          state.editingCartOriginalItem.selections[key] = Array.isArray(state.editingCartOriginalItem.selections[key])
            ? state.editingCartOriginalItem.selections[key].filter(function (item) { return item && item.token !== token; })
            : [];
        }
      }
      if (orderUploadPreviews[token]) {
        URL.revokeObjectURL(orderUploadPreviews[token]);
        delete orderUploadPreviews[token];
      }
    }).catch(function (error) {
      if (!orderUploadOperationIsActive(operation) || operation.canceled) {
        return;
      }
      state.orderUploadError = error && error.message ? error.message : "Não foi possível remover o ficheiro.";
    }).then(function () {
      var shouldRender = orderUploadOperationIsActive(operation);
      endOrderUploadOperation(operation);
      if (shouldRender && state.product === product) {
        rerenderProduct(product);
      }
    });
  }

