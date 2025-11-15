define(["postmonger"], function (Postmonger) {
    "use strict";

    var connection = new Postmonger.Session();
    var activity = {};

    connection.trigger("ready");

    connection.on("initActivity", function (payload) {
        activity = payload;
    });

    connection.on("clickedNext", function () {
        connection.trigger("updateActivity", activity);
    });
});
