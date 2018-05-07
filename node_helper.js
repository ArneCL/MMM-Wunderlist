"use strict";

/* Magic Mirror
 * Module: MMM-Wunderlist
 *
 * By Paul-Vincent Roll http://paulvincentroll.com
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const Fetcher = require("./fetcher.js");

var Wunderlist = require('wunderlist-api');

module.exports = NodeHelper.create({
  start: function () {
    this.config = [];
    this.fetchers = {};
    this.started = false;
  },

  getLists: function (callback) {
    this.wunderlist.getLists()
      .then(function (response) {
        if (response.statusCode == 200) {
          callback(JSON.parse(response.body));
        } else {
          console.error('Failed to retrieve Lists. The Server returned: ', response.statusCode, response.statusMessage)
        }

      }).catch(function (error) {
        console.error('There was a Wunderlist problem', error);
      });
  },

  getUsers: function (callback) {
    this.wunderlist.listUsers()
      .then(function (response) {
        var ret = {};
        if (response.statusCode == 200) {
          JSON.parse(response.body).forEach(function (user) {
            ret[user.id] = user.name[0]
          });
          callback(ret);
        } else {
          console.error('Failed to retrieve Users. The Server returned: ', response.statusCode, response.statusMessage)
        }
      })
  },

  createFetcher: function (listID, list, reloadInterval) {

    var fetcher;

    if (typeof this.fetchers[listID] === "undefined") {

      var self = this;

      console.log("Create new todo fetcher for list: " + list + " - Interval: " + reloadInterval);
      fetcher = new Fetcher(listID, reloadInterval, this.config.accessToken, this.config.clientID, this.config.language, this.config.deadlineFormat);

      fetcher.onReceive(function (fetcher) {
        self.broadcastTodos();
      });

      fetcher.onError(function (fetcher, error) {
        self.sendSocketNotification("FETCH_ERROR", {
          url: fetcher.id(),
          error: error
        });
      });

      this.fetchers[listID] = {
        "name": list,
        "instance": fetcher
      };
    }
    else {
      console.log("Use exsisting todo fetcher for list: " + list);
      fetcher = this.fetchers[listID].instance;
      fetcher.setReloadInterval(reloadInterval);
      fetcher.broadcastItems();
    }

    fetcher.startFetch();
  },

  broadcastTodos: function () {
    var todos = {};
    for (var f in this.fetchers) {
      todos[this.fetchers[f].name] = this.fetchers[f].instance.items();
    }
    this.sendSocketNotification("TASKS", todos);
  },

  // Subclass socketNotificationReceived received.
  socketNotificationReceived: function (notification, payload) {
    const self = this
    if (notification === "CONFIG" && this.started == false) {
      this.config = payload

      this.wunderlist = new Wunderlist({
        accessToken: self.config.accessToken,
        clientId: self.config.clientID
      })

      this.getLists(function (data) {
        self.lists = data
        self.sendSocketNotification("STARTED")
      });
      self.started = true
    }
    else if (notification === "addLists") {
      this.lists.forEach(function (currentValue) {
        if (self.config.lists.indexOf(currentValue.title) >= 0) {
          self.createFetcher(currentValue.id, currentValue.title, self.config.interval * 1000);
        }
      })
    }
    else if (notification === "CONNECTED") {
      this.broadcastTodos()
    }
    else if (notification === 'getUsers') {
      console.log(notification);
      this.getUsers(function (data) {
        self.sendSocketNotification("users", data)
      });
    }
  }

});
