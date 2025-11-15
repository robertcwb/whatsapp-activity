/*
 * Postmonger.js   version 0.0.14
 * https://github.com/kevinparkerson/postmonger
 *
 * Copyright (c) 2012-2014 Kevin Parkerson
 * Available via the MIT or new BSD license.
 * Further details and documentation:
 * http://kevinparkerson.github.com/postmonger/
 *
 *///

(function (root, factory) {
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
}(this, function () {
	var Postmonger;

	// Postmonger Constructor
	// @param {Object} e - environment (typically window)
	Postmonger = function (e) {
		this.connections = {};
		this.methods = {};
		this.parent = e || window.parent;
		this.child = null;
		this.events = {};
		this.session = null;

		var self = this;
		var connection = function (event) {
			var source = event.source || event.originalEvent.source;
			var origin = event.origin || event.originalEvent.origin;
			var data = event.data;

			if (typeof data === 'string') {
				try {
					data = JSON.parse(data);
				} catch (e) {
					return false;
				}
			}

			if (!data || !data.key) {
				return false;
			}

			if (self.connections[origin]) {
				if (self.connections[origin].key !== data.key) {
					return false;
				}
			} else {
				self.connections[origin] = {
					key: data.key,
					source: source
				};
			}

			if (data.method) {
				if (self.methods[data.method]) {
					self.methods[data.method].apply(self.methods, data.args);
				}
			} else if (data.event) {
				if (self.events[data.event]) {
					for (var i = 0, len = self.events[data.event].length; i < len; i++) {
						self.events[data.event][i].apply(self, data.args);
					}
				}
			}
		};

		if (window.addEventListener) {
			window.addEventListener('message', connection, false);
		} else if (window.attachEvent) {
			window.attachEvent('onmessage', connection);
		}
	};

	// Session Constructor
	Postmonger.Session = function () {
		return new Postmonger();
	};

	// Postmonger.prototype.trigger
	// @param {String} event - name of event to trigger
	// @param {Mixed} args - arguments to pass to event
	Postmonger.prototype.trigger = function (event) {
		var args = Array.prototype.slice.call(arguments, 1);
		for (var origin in this.connections) {
			if (this.connections.hasOwnProperty(origin)) {
				this.connections[origin].source.postMessage(JSON.stringify({
					event: event,
					args: args,
					key: this.connections[origin].key
				}), origin);
			}
		}
	};

	// Postmonger.prototype.on
	// @param {String} event - name of event to listen for
	// @param {Function} callback - function to execute when event is triggered
	Postmonger.prototype.on = function (event, callback) {
		if (!this.events[event]) {
			this.events[event] = [];
		}
		this.events[event].push(callback);
	};

	// Postmonger.prototype.off
	// @param {String} event - name of event to stop listening for
	Postmonger.prototype.off = function (event) {
		if (this.events[event]) {
			delete this.events[event];
		}
	};

	// Postmonger.prototype.connect
	// @param {String} url - url of child iframe
	// @param {String} key - unique key to identify connection
	Postmonger.prototype.connect = function (url, key) {
		this.child = window.open(url);
		this.connections[url] = {
			key: key,
			source: this.child
		};
	};

	return Postmonger;
}));
