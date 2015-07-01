/*
 * Copyright 2015 Albert P. Tobey <atobey@datastax.com> @AlTobey
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * requires: jQuery and login.persona.org/include.js
 */

var userEmail = "";
var authDone = false;

$( document ).ready(function() {
  navigator.id.watch({
    onlogin: function(assertion) {
      $.ajax({
        type: 'POST',
        url: '/login',
        dataType: "json",
        data: {assertion: assertion}
      }).done(function(data, status, xhr) {
          console.log("logged in successfully");
          loggedIn(data["email"])
		  ccfp.run();
      }).fail(function(xhr, status, err) {
          console.log("Login failure: " + err);
          loggedOut();
          navigator.id.logout();
		  ccfp.disable();
	  });
    },
    onlogout: function() {
      $.ajax({
        type: 'POST',
        dataType: "json",
        url: '/logout'
      }).done(function(res, status, xhr) {
          console.log("logged out successfully", navigator);
          loggedOut();
		  ccfp.disable();
      }).fail(function(xhr, status, err) {
          console.log("Logout failure: " + err);
          loggedOut();
		  ccfp.disable();
	  });
    }
  });

  function loggedIn(email) {
    userEmail = email;
    $('#login').removeClass('active');
    $('#logout').addClass('active');
    $('#action-menu').addClass('active');
    $('#username').html("<span>" + email + "</span>");
  }

  function loggedOut() {
    $('#logout').removeClass('active');
    $('#action-menu').removeClass('active');
    $('#login').addClass('active');
    $('#username').html(" ");
  }

  $('#login').on('click', function (e) {
    navigator.id.request({
      siteName: 'Cassandra Summit 2015 CFP Review',
      returnTo: '/',
      oncancel: function() { alert('user refuses to share identity.'); }
    });
  });

  $('#logout').on('click', function (e) {
    console.log("Logging out.");
    navigator.id.logout();
  });
});
