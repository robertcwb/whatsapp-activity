/*
 * Postmonger.js   version 0.1.0
 * https://github.com/salesforce-marketingcloud/postmonger
 *
 * Copyright (c) 2018 Salesforce
 * Available via the MIT license.
 *
 * THIS IS A MODIFIED VERSION FOR JOURNEY BUILDER CUSTOM ACTIVITY SDK.
 */

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.Postmonger = factory();
    }
}(this, function() {
    'use strict';

    var Postmonger;
    var Config = {
        postMessage: {
            // The origin of the parent window.
            // When in an iframe in Journey Builder, this is typically
            // 'https://jb.exacttarget.com' or 'https://mc.exacttarget.com'
            origin: getParentOrigin(),

            // The origin of this window.
            // When in an iframe in Journey Builder, this is the app's URL
            // (e.g. 'https://example.com')
            host: window.location.origin
        }
    };

    /**
     * @constructor
     * @param {object} e - The window environment.
     * Typically, this is `window`.
     */
    Postmonger = function(e) {
        var env = e || window;

        this.parent = env.parent;
        this.parentOrigin = Config.postMessage.origin;
        this.connection = null;
        this.connected = false;
        this.events = {};
        this.base = this;

        // Listen for messages from the parent window
        this.listener = this.listen.bind(this);
        env.addEventListener('message', this.listener, false);
    };

    /**
     * Renders Postmonger available as a global object.
     * @static
     */
    Postmonger.Session = function() {
        return new Postmonger();
    };

    /**
     * Listens for 'message' events from the parent window.
     * @param {MessageEvent} e - The MessageEvent object.
     * A MessageEvent has 'data', 'origin',
     * and 'source' properties.
     * The 'data' property is the object that
     * the parent window passed.
     * The 'origin' property is the origin of
     * the parent window.
     * The 'source' property is the WindowProxy
     * of the parent window.
     */
    Postmonger.prototype.listen = function(e) {
        // We're only interested in messages from the configured
        // parent origin.
        if (this.parentOrigin.indexOf(e.origin) === -1) {
            return;
        }

        this.connection = e.source;
        this.connected = true;

        var payload = (typeof e.data === 'string' || e.data instanceof String) ? JSON.parse(e.data) : e.data;

        if (!payload || !payload.event) {
            return;
        }

        if (payload.event === 'ready') {
            this.onReady();
        } else if (this.events[payload.event]) {
            this.events[payload.event].forEach(function(callback) {
                callback.call(this.base, payload.data);
            }.bind(this));
        }
    };

    /**
     * Emits a 'ready' event to the parent window.
     * This notifies the parent window that this window
     * is ready to receive messages.
     *
     * This is an internal-only event, and should not be
     * used by consumers.
     *
     * @private
     */
    Postmonger.prototype.onReady = function() {
        this.trigger('ready');
    };

    /**
     * Emits an event to the parent window.
     * @param {string} event - The name of the event to emit.
     * @param {object} [data] - The data to send with the event.
     */
    Postmonger.prototype.trigger = function(event, data) {
        if (this.connected) {
            this.connection.postMessage(JSON.stringify({
                event: event,
                data: data
            }), this.parentOrigin);
        }
    };

    /**
     * Listens for an event from the parent window.
     * @param {string} event - The name of the event to listen for.
     * @param {function} callback - The function to call when the
     * event is received.
     */
    Postmonger.prototype.on = function(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    };

    /**
     * Stops listening for an event from the parent window.
     * @param {string} event - The name of the event to stop
     * listening for.
     */
    Postmonger.prototype.off = function(event) {
        if (this.events[event]) {
            this.events[event] = null;
        }
    };

    /**
     * Get the parent origin.
     *
     * The following is done to prevent sequential calls to this function.
     * We're saving the result to `Config.postMessage.origin` so that
     * subsequent calls will just return the value.
     */
    function getParentOrigin() {
        if (Config.postMessage.origin) {
            return Config.postMessage.origin;
        }

        // Find the parent origin.
        // This is necessary because in some environments,
        // document.referrer is empty.
        var parentOrigin = getQueryString('origin');
        if (parentOrigin) {
            // Ensure the parent origin has a protocol for
            // postMessage to work correctly.
            parentOrigin = parentOrigin.indexOf('://') === -1 ? 'https://' + parentOrigin : parentOrigin;
        }

        // If we found the parent origin, save it.
        if (parentOrigin) {
            Config.postMessage.origin = parentOrigin;
        }

        return parentOrigin;
    }

    /**
     * Helper function to get a query string parameter.
     * @param {string} name - The name of the query string parameter.
     */
    function getQueryString(name) {
        var reg = new RegExp('[?&]' + name + '=([^&]*)');
        var results = reg.exec(window.location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    return Postmonger;
}));
