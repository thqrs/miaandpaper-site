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
    }).catch(function (cause) {
      var error;
      if (file.size <= targetBytes) {
        return { file: file, width: 0, height: 0 };
      }
      // Só chega aqui uma foto pesada que o browser não conseguiu descodificar
      // nem recomprimir — HEIC sem suporte, canvas sem memória, ficheiro roto.
      error = new Error("Não foi possível preparar esta foto. Tenta escolhê-la novamente.");
      error.code = cause && cause.message === "decode" ? "descodificacao_falhou" : "recompressao_falhou";
      error.causa = cause && cause.message ? cause.message : "";
      throw error;
    });
  }

  function uploadOrderMediaFile(prepared, kind, operation, config) {
    var formData = new FormData();
    var file = prepared.file;
    formData.append("media[]", file, file.name || (kind === "audio" ? "audio.webm" : "foto"));
    formData.append("kind", kind);
    if (config && config.purpose) {
      formData.append("purpose", String(config.purpose));
    }
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
        var resposta = String(xhr.responseText || "");
        var recusa;
        var parseOk = true;
        var ultimoObjecto;
        try {
          payload = JSON.parse(resposta || "{}");
        } catch (error) {
          // Um `post_max_size` excedido faz o PHP escrever um warning ANTES de
          // o nosso ficheiro correr, e o JSON vem colado a seguir. Sem isto, a
          // recusa mais informativa que temos era a única ilegível.
          ultimoObjecto = resposta.slice(resposta.indexOf("{"));
          try {
            payload = JSON.parse(ultimoObjecto);
          } catch (outro) {
            parseOk = false;
          }
        }
        if (xhr.status < 200 || xhr.status >= 300 || !payload.ok
            || !Array.isArray(payload.uploads) || !payload.uploads[0]) {
          recusa = new Error(payload.message || "Não foi possível enviar o ficheiro.");
          // O `code` do servidor é o que liga este erro ao bloco em
          // private/order-uploads/rejeicoes.log.
          recusa.code = payload.code || (parseOk ? "resposta_inesperada" : "resposta_ilegivel");
          recusa.status = xhr.status;
          recusa.bytesEnviados = file.size || 0;
          if (!parseOk) {
            // Resposta não-JSON: normalmente é o servidor a cortar o pedido
            // (413 do Apache/nginx) ou um erro do PHP em HTML.
            recusa.corpo = resposta.slice(0, 400);
          }
          finish(reject, recusa);
          return;
        }
        finish(resolve, payload.uploads[0]);
      });
      xhr.addEventListener("error", function () {
        var recusa = new Error("Não foi possível enviar o ficheiro.");
        recusa.code = "rede_falhou";
        recusa.status = xhr.status;
        recusa.bytesEnviados = file.size || 0;
        recusa.segundos = Math.round((Date.now() - startedAt) / 100) / 10;
        finish(reject, recusa);
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

  function withOrderUploadTimeout(promise, operation, timeoutMs, message, code) {
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
        var expirou;
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
        expirou = new Error(message);
        expirou.code = code || "tempo_esgotado";
        expirou.limiteSegundos = Math.round(timeoutMs / 1000);
        // Quanto é que chegou a subir antes de desistirmos: distingue uma
        // ligação lenta (percentagem alta) de uma ligação morta (0%).
        if (state.orderUploadProgress && state.orderUploadProgress.operationId === operation.id) {
          expirou.percentagem = Math.round(state.orderUploadProgress.percent || 0);
        }
        settle(reject, expirou);
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
    var escolhidos = Array.prototype.slice.call(files || []);
    var candidates = escolhidos.filter(function (file) {
      return file && Number(file.size) > 0;
    });
    var remaining = isFinite(maxFiles) ? Math.max(0, maxFiles - (config.multiple === true ? existing.length : 0)) : candidates.length;
    var selected = candidates.slice(0, remaining || (config.multiple === true ? 0 : 1));
    var uploads = [];
    var chain = Promise.resolve();
    var naoSuportados;
    var acimaDoLimite;
    var operation;

    // Ficheiros que o browser entregou vazios: pasta do iCloud por descarregar,
    // ficheiro em uso, permissão negada. Desapareciam sem deixar rasto.
    if (candidates.length < escolhidos.length) {
      logOrderUploadRejection("ficheiro_vazio_no_browser", {
        fase: "selecao",
        kind: kind,
        chave: key,
        ficheiros: escolhidos.filter(function (file) {
          return !file || !(Number(file.size) > 0);
        }).map(orderUploadFileInfo)
      });
    }
    if (selected.length < candidates.length) {
      logOrderUploadRejection("acima_do_maximo_de_ficheiros", {
        fase: "selecao",
        kind: kind,
        chave: key,
        maximo: maxFiles,
        jaEnviados: existing.length,
        ficheiros: candidates.slice(selected.length).map(orderUploadFileInfo)
      });
    }

    if (!selected.length) {
      return;
    }
    state.orderUploadError = "";
    state.orderUploadMessage = "";
    state.orderUploadFeedbackKind = kind;
    naoSuportados = (kind === "photo" || kind === "artwork")
      ? selected.filter(function (file) { return !orderPhotoFileIsSupported(file, config.allowPdf === true); })
      : [];
    if (naoSuportados.length) {
      state.orderUploadError = config.allowPdf === true
        ? "Escolhe imagens JPG, PNG, WebP ou HEIC, ou ficheiros PDF."
        : "Escolhe fotos JPG, PNG, WebP ou HEIC.";
      logOrderUploadRejection("tipo_recusado_no_browser", {
        fase: "validacao-local",
        kind: kind,
        chave: key,
        permitePdf: config.allowPdf === true,
        ficheiros: naoSuportados.map(orderUploadFileInfo)
      });
      rerenderProduct(product);
      return;
    }

    // Só trava o que o servidor ia recusar de certeza. O fluxo normal de fotos
    // recomprime antes de subir, por isso aqui só apanha os originais que a
    // personalização envia tal como estão.
    acimaDoLimite = selected.filter(function (file) {
      return Number(file.size) > ORDER_UPLOAD_MAX_BYTES && (kind !== "photo" || config.preserveOriginal === true);
    });
    if (acimaDoLimite.length) {
      state.orderUploadError = "Este ficheiro é demasiado pesado (máximo "
        + Math.round(ORDER_UPLOAD_MAX_BYTES / 1048576) + " MB).";
      logOrderUploadRejection("acima_do_limite_no_browser", {
        fase: "validacao-local",
        kind: kind,
        chave: key,
        limiteBytes: ORDER_UPLOAD_MAX_BYTES,
        ficheiros: acimaDoLimite.map(orderUploadFileInfo)
      });
      rerenderProduct(product);
      return;
    }

    operation = beginOrderUploadOperation("upload", stepId);
    if (kind === "artwork") {
      try {
        trackProductEvent(product, "artwork_upload_started", {
          file_count: selected.length,
          file_kind: selected.some(function (file) { return String(file.type || "").toLowerCase() === "application/pdf" || /\.pdf$/i.test(String(file.name || "")); }) ? "pdf-or-image" : "image"
        });
      } catch (e) {}
    }
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
        operation.currentFile = file;
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
        // A personalização usa preserveOriginal, por isso o ficheiro sobe tal
        // como saiu da câmara — é aqui que os megabytes fazem diferença.
        operation.currentPhase = kind === "photo" && config.preserveOriginal !== true ? "preparacao" : "sem-preparacao";
        preparation = kind === "photo" && config.preserveOriginal !== true
          ? prepareOrderPhoto(file)
          : Promise.resolve({ file: file, width: 0, height: 0 });
        return withOrderUploadTimeout(
          preparation,
          operation,
          45000,
          "A preparação do ficheiro demorou demasiado. Tenta escolhê-lo novamente.",
          "preparacao_demorou_demasiado"
        );
      }).then(function (prepared) {
        if (!orderUploadOperationIsActive(operation)) {
          throw orderUploadCanceledError();
        }
        operation.currentPhase = "envio";
        operation.currentPrepared = prepared.file;
        return withOrderUploadTimeout(
          uploadOrderMediaFile(prepared, kind, operation, config),
          operation,
          90000,
          "O envio demorou demasiado. Confirma a ligação e tenta novamente.",
          "envio_demorou_demasiado"
        ).then(function (upload) {
          if (!orderUploadOperationIsActive(operation)) {
            throw orderUploadCanceledError();
          }
          if (kind === "artwork") {
            upload.quantity = 1;
            upload.feeCents = Math.max(0, parseInt(config.feePerFileCents, 10) || 0);
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
      if (kind === "artwork" && !isCadernosProduct(product)) {
        state.selections.pack_quantity = customArtworkTotalQuantity(product);
      }
      state.invalidFields = state.invalidFields.filter(function (fieldName) { return fieldName !== key; });
      if (kind === "audio") {
        state.orderUploadMessage = uploads.length === 1 ? "Áudio enviado." : uploads.length + " áudios enviados.";
      } else if (kind === "artwork") {
        if (!isArtworkBuilderProduct(product)) {
          state.orderUploadMessage = uploads.length === 1 ? "Design enviado sem alterações." : uploads.length + " designs enviados sem alterações.";
        }
        try {
          trackProductEvent(product, "artwork_upload_completed", {
            file_count: uploads.length,
            artwork_count: customArtworkItems(product).length,
            artwork_total_quantity: customArtworkTotalQuantity(product),
            customization_fee_cents: customArtworkFeeCents(product)
          });
        } catch (e) {}
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
      logOrderUploadRejection((error && error.code) || "envio_falhou", {
        fase: operation.currentPhase || "envio",
        kind: kind,
        chave: key,
        mensagem: state.orderUploadError,
        estadoHttp: error && error.status ? error.status : 0,
        ficheiro: orderUploadFileInfo(operation.currentFile),
        // Só difere do original quando houve recompressão; é o que foi mesmo
        // pela rede acima.
        enviado: operation.currentPrepared && operation.currentPrepared !== operation.currentFile
          ? orderUploadFileInfo(operation.currentPrepared)
          : null,
        ficheiroNumero: operation.fileIndex,
        totalFicheiros: operation.fileCount,
        limiteSegundos: error && error.limiteSegundos ? error.limiteSegundos : 0,
        percentagem: error && typeof error.percentagem === "number" ? error.percentagem : null,
        segundos: error && error.segundos ? error.segundos : 0,
        causa: error && error.causa ? error.causa : "",
        corpo: error && error.corpo ? error.corpo : ""
      });
      if (kind === "artwork") {
        try { trackProductEvent(product, "artwork_upload_failed", { error_code: (error && error.code) || "upload_failed" }); } catch (e) {}
      }
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
    var kind = String(config.purpose || "") === "custom-artwork" || step && step.template === "original-artwork-upload"
      ? "artwork"
      : "photo";
    if (kind === "artwork") {
      config = Object.assign({}, config, customArtworkConfig(product), {
        selectionKey: key,
        multiple: true,
        maxFiles: 10,
        allowPdf: true,
        preserveOriginal: true,
        showQuantity: true,
        purpose: "custom-artwork"
      });
    }
    startOrderMediaUpload(product, config, files || [], kind, step && step.id);
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

  function applyOrderMediaUploadRemoval(product, key, token) {
    state.selections[key] = orderUploadItems(key).filter(function (item) { return item.token !== token; });
    if (key === customArtworkConfig(product).uploadKey) {
      if (!isCadernosProduct(product)) {
        state.selections.pack_quantity = customArtworkTotalQuantity(product);
      }
      try {
        trackProductEvent(product, "artwork_upload_removed", {
          artwork_count: customArtworkItems(product).length,
          artwork_total_quantity: customArtworkTotalQuantity(product),
          customization_fee_cents: customArtworkFeeCents(product)
        });
      } catch (e) {}
    }
    if (key === "quadro_uploads" && !state.selections[key].length) {
      resetQuadrosPhotoColorAnalysis();
    }
    if (orderUploadPreviews[token]) {
      URL.revokeObjectURL(orderUploadPreviews[token]);
      delete orderUploadPreviews[token];
    }
  }

  function editingCartOriginalHasUpload(key, token) {
    var selections = state.editingCartOriginalItem && state.editingCartOriginalItem.selections;
    var items = selections && Array.isArray(selections[key]) ? selections[key] : [];
    return !!state.editingCartItemId && items.some(function (item) {
      return item && item.token === token;
    });
  }

  function removeOrderMediaUpload(product, key, token) {
    var formData = new FormData();
    var operation;
    var requestOptions;
    var request;

    // Um ficheiro já guardado no item do carrinho tem de continuar disponível
    // caso a pessoa cancele a edição. Retiramo-lo apenas do estado de edição;
    // se guardar, o temporário órfão será removido pela limpeza automática.
    if (editingCartOriginalHasUpload(key, token)) {
      state.orderUploadError = "";
      state.orderUploadMessage = "Ficheiro retirado desta edição. Guarda as alterações para confirmar.";
      state.orderUploadFeedbackKind = key === "quadro_audio_uploads" ? "audio" : (key === customArtworkConfig(product).uploadKey ? "artwork" : "photo");
      applyOrderMediaUploadRemoval(product, key, token);
      rerenderProduct(product);
      return;
    }

    formData.append("action", "delete");
    formData.append("token", token);
    operation = beginOrderUploadOperation("delete", currentStep(product) && currentStep(product).id);
    state.orderUploadError = "";
    state.orderUploadMessage = "";
    state.orderUploadFeedbackKind = key === "quadro_audio_uploads" ? "audio" : (key === customArtworkConfig(product).uploadKey ? "artwork" : "photo");
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
      applyOrderMediaUploadRemoval(product, key, token);
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

