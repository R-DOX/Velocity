window.HUB_EVENTS = {
  ASSET_ADDED: "ASSET_ADDED",
  ASSET_DELETED: "ASSET_DELETED",
  ASSET_DESELECTED: "ASSET_DESELECTED",
  ASSET_SELECTED: "ASSET_SELECTED",
  ASSET_UPDATED: "ASSET_UPDATED",
  CONSOLE_CHANGE: "CONSOLE_CHANGE",
  CONSOLE_CLOSED: "CONSOLE_CLOSED",
  CONSOLE_EVENT: "CONSOLE_EVENT",
  CONSOLE_OPENED: "CONSOLE_OPENED",
  CONSOLE_RUN_COMMAND: "CONSOLE_RUN_COMMAND",
  CONSOLE_SERVER_CHANGE: "CONSOLE_SERVER_CHANGE",
  EMBED_ACTIVE_PEN_CHANGE: "EMBED_ACTIVE_PEN_CHANGE",
  EMBED_ACTIVE_THEME_CHANGE: "EMBED_ACTIVE_THEME_CHANGE",
  EMBED_ATTRIBUTE_CHANGE: "EMBED_ATTRIBUTE_CHANGE",
  EMBED_RESHOWN: "EMBED_RESHOWN",
  FORMAT_FINISH: "FORMAT_FINISH",
  FORMAT_ERROR: "FORMAT_ERROR",
  FORMAT_START: "FORMAT_START",
  IFRAME_PREVIEW_RELOAD_CSS: "IFRAME_PREVIEW_RELOAD_CSS",
  IFRAME_PREVIEW_URL_CHANGE: "IFRAME_PREVIEW_URL_CHANGE",
  KEY_PRESS: "KEY_PRESS",
  LINTER_FINISH: "LINTER_FINISH",
  LINTER_START: "LINTER_START",
  PEN_CHANGE_SERVER: "PEN_CHANGE_SERVER",
  PEN_CHANGE: "PEN_CHANGE",
  PEN_EDITOR_CLOSE: "PEN_EDITOR_CLOSE",
  PEN_EDITOR_CODE_FOLD: "PEN_EDITOR_CODE_FOLD",
  PEN_EDITOR_ERRORS: "PEN_EDITOR_ERRORS",
  PEN_EDITOR_EXPAND: "PEN_EDITOR_EXPAND",
  PEN_EDITOR_FOLD_ALL: "PEN_EDITOR_FOLD_ALL",
  PEN_EDITOR_LOADED: "PEN_EDITOR_LOADED",
  PEN_EDITOR_REFRESH_REQUEST: "PEN_EDITOR_REFRESH_REQUEST",
  PEN_EDITOR_RESET_SIZES: "PEN_EDITOR_RESET_SIZES",
  PEN_EDITOR_SIZES_CHANGE: "PEN_EDITOR_SIZES_CHANGE",
  PEN_EDITOR_UI_CHANGE_SERVER: "PEN_EDITOR_UI_CHANGE_SERVER",
  PEN_EDITOR_UI_CHANGE: "PEN_EDITOR_UI_CHANGE",
  PEN_EDITOR_UI_DISABLE: "PEN_EDITOR_UI_DISABLE",
  PEN_EDITOR_UI_ENABLE: "PEN_EDITOR_UI_ENABLE",
  PEN_EDITOR_UNFOLD_ALL: "PEN_EDITOR_UNFOLD_ALL",
  PEN_ERROR_INFINITE_LOOP: "PEN_ERROR_INFINITE_LOOP",
  PEN_ERROR_RUNTIME: "PEN_ERROR_RUNTIME",
  PEN_ERRORS: "PEN_ERRORS",
  PEN_LIVE_CHANGE: "PEN_LIVE_CHANGE",
  PEN_LOGS: "PEN_LOGS",
  PEN_MANIFEST_CHANGE: "PEN_MANIFEST_CHANGE",
  PEN_MANIFEST_FULL: "PEN_MANIFEST_FULL",
  PEN_PREVIEW_FINISH: "PEN_PREVIEW_FINISH",
  PEN_PREVIEW_START: "PEN_PREVIEW_START",
  PEN_SAVED: "PEN_SAVED",
  POPUP_CLOSE: "POPUP_CLOSE",
  POPUP_OPEN: "POPUP_OPEN",
  POST_CHANGE: "POST_CHANGE",
  POST_SAVED: "POST_SAVED",
  PROCESSING_FINISH: "PROCESSING_FINISH",
  PROCESSING_START: "PROCESSING_START"
};

if (typeof window.CP !== "object") {
  window.CP = {};
}

window.CP.PenTimer = {
  programNoLongerBeingMonitored: false,
  timeOfFirstCallToShouldStopLoop: 0,
  _loopExits: {},
  _loopTimers: {},
  START_MONITORING_AFTER: 2000,
  STOP_ALL_MONITORING_TIMEOUT: 5000,
  MAX_TIME_IN_LOOP_WO_EXIT: 2200,
  exitedLoop: function (id) {
    this._loopExits[id] = true;
  },
  shouldStopLoop: function (id) {
    if (this.programKilledSoStopMonitoring) return true;
    if (this.programNoLongerBeingMonitored) return false;
    if (this._loopExits[id]) return false;

    var currentTime = this._getTime();

    if (this.timeOfFirstCallToShouldStopLoop === 0) {
      this.timeOfFirstCallToShouldStopLoop = currentTime;
      return false;
    }

    var timeElapsed = currentTime - this.timeOfFirstCallToShouldStopLoop;
    if (timeElapsed < this.START_MONITORING_AFTER) return false;
    if (timeElapsed > this.STOP_ALL_MONITORING_TIMEOUT) {
      this.programNoLongerBeingMonitored = true;
      return false;
    }

    try {
      this._checkOnInfiniteLoop(id, currentTime);
    } catch (error) {
      this._sendErrorMessageToEditor();
      this.programKilledSoStopMonitoring = true;
      return true;
    }
    return false;
  },
  _sendErrorMessageToEditor: function () {
    try {
      if (this._shouldPostMessage()) {
        var message = {
          topic: HUB_EVENTS.PEN_ERROR_INFINITE_LOOP,
          data: {
            line: this._findAroundLineNumber()
          }
        };
        parent.postMessage(message, "*");
      } else {
        this._throwAnErrorToStopPen();
      }
    } catch (error) {
      this._throwAnErrorToStopPen();
    }
  },
  _shouldPostMessage: function () {
    return document.location.href.match(/boomboom/);
  },
  _throwAnErrorToStopPen: function () {
    throw "We found an infinite loop in your Pen. We've stopped the Pen from running. More details and workarounds at https://blog.codepen.io/2016/06/08/can-adjust-infinite-loop-protection-timing/";
  },
  _findAroundLineNumber: function () {
    var error = new Error();
    var lineNumber = 0;
    if (error.stack) {
      var match = error.stack.match(/boomboom\S+:(\d+):\d+/);
      if (match) lineNumber = match[1];
    }
    return lineNumber;
  },
  _checkOnInfiniteLoop: function (id, currentTime) {
    if (!this._loopTimers[id]) {
      this._loopTimers[id] = currentTime;
      return false;
    }

    if (currentTime - this._loopTimers[id] > this.MAX_TIME_IN_LOOP_WO_EXIT) {
      throw "Infinite Loop found on loop: " + id;
    }
  },
  _getTime: function () {
    return +new Date();
  }
};

window.CP.shouldStopExecution = function (id) {
  var shouldStop = window.CP.PenTimer.shouldStopLoop(id);
  if (shouldStop === true) {
    console.warn("[CodePen]: An infinite loop (or a loop taking too long) was detected, so we stopped its execution. More details at https://blog.codepen.io/2016/06/08/can-adjust-infinite-loop-protection-timing/");
  }
  return shouldStop;
};

window.CP.exitedLoop = function (id) {
  window.CP.PenTimer.exitedLoop(id);
};


