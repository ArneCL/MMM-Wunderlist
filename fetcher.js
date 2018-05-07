"use strict"

/* Magic Mirror
 * Fetcher
 *
 * By Michael Teeuw http://michaelteeuw.nl edited for Wunderlist by Marcin Bielecki
 * MIT Licensed.
 */

var Wunderlist = require('wunderlist-api');
var moment = require('moment');

/* Fetcher
 * Responsible for requesting an update on the set interval and broadcasting the data.
 *
 * attribute listID string - ID of the Wunderlist list.
 * attribute reloadInterval number - Reload interval in milliseconds.
 */

var Fetcher = function (listID, reloadInterval, accessToken, clientId, language, format) {

  moment.locale(language);

  var self = this;
  if (reloadInterval < 1000) {
    reloadInterval = 1000;
  }

  var reloadTimer = null;
  var items = [];

  var fetchFailedCallback = function () { };
  var itemsReceivedCallback = function () { };

  /* private methods */

  /* fetchTodos()
   * Request the new items.
   */

  var fetchTodos = function () {
    clearTimeout(reloadTimer);
    reloadTimer = null;

    var wunderlist = new Wunderlist({
      accessToken: accessToken,
      clientId: clientId
    });

    wunderlist.getTasks(listID)
      .then(function (response) {
        if (response.statusCode == 200) {
          items = JSON.parse(response.body)
          items = localizeTasks(items)
          self.broadcastItems();
          scheduleTimer();
        } else {
          console.error('Failed to retrieve tasks for ListID:', listID, 'The Server returned: ', response.statusCode, response.statusMessage)
        }
      })
      .catch(function (error) {
        console.error('There was a Wunderlist problem', error);
      });
  };

  /* localizeTasks(tasks)
   * Localize the given array of tasks
   */
  
  var localizeTasks = function (tasks) {
    tasks.forEach(function (task) {
      task.due_date = moment(task.due_date).format(format);
      task.created_at = moment(task.created_at).format(format);
    });
    return tasks;
  }
  
  /* scheduleTimer()
   * Schedule the timer for the next update.
   */

  var scheduleTimer = function () {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(function () {
      fetchTodos();
    }, reloadInterval);
  };

  /* public methods */

  /* setReloadInterval()
   * Update the reload interval, but only if we need to increase the speed.
   *
   * attribute interval number - Interval for the update in milliseconds.
   */
  this.setReloadInterval = function (interval) {
    if (interval > 1000 && interval < reloadInterval) {
      reloadInterval = interval;
    }
  };

  /* startFetch()
   * Initiate fetchTodos();
   */
  this.startFetch = function () {
    fetchTodos();
  };

  /* broadcastItems()
   * Broadcast the exsisting items.
   */
  this.broadcastItems = function () {
    if (items.length <= 0) {
      return;
    }
    itemsReceivedCallback(self);
  };

  this.onReceive = function (callback) {
    itemsReceivedCallback = callback;
  };

  this.onError = function (callback) {
    fetchFailedCallback = callback;
  };

  this.id = function () {
    return listID;
  };

  this.items = function () {
    return items;
  };
};

module.exports = Fetcher;
