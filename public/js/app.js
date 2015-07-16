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
 * requires: jQuery, D3, and underscore.js, see index.html at the bottom
 *
 * I'm not proud of this but it works. If I had it to do over again I
 * go with a pipline something like Go <-> angular <-> D3 <-> UI so that
 * angular can handle all the reactive / data change complexity, with
 * D3 still doing all the drawing because I like it for building pages
 * procedurally on top of Bootstrap's sensible defaults.
 */
var ccfp = ccfp || {};

// populated from the server in ccfp.run()
// this list is used to display admin functions to admins
// and should absolutely NEVER be used for security
// any security verification belongs in the backend code
ccfp.admins = [];

// only scores_a is being used at the moment, but most of the
// support for b-g is still here (for future use?)
ccfp.scores_fields = ["scores_a", "scores_b", "scores_c", "scores_d", "scores_e", "scores_f", "scores_g"];

// don't change these (or all the data in the DB will no longer match)
ccfp.scores_a_values = { "1": "No", "2": "Maybe", "3": "Yes" };

// needs to match the table structure in index.html
ccfp.table_fields = [ "authors", "title", "company", "scores_a", "rate-link" ];

// nice-looking names
ccfp.header_names = {
	"authors": "Author",
	"title": "Title",
	"company": "Company",
	"scores_a": "My Choice",
	"scores_a-count": "Reviews",
	"scores_a-yes": "Yes",
	"scores_a-maybe": "Maybe",
	"scores_a-no": "No"
};

// fields that are only shown to admins
ccfp.admin_fields = [
  "edit-link", "delete-link", "scores_a-count", "scores_a-yes", "scores_a-maybe", "scores_a-no"
];

ccfp.csv_fields = [
  "id", "names", "emails", "title", "body", "company", "reviews",
  "scores_a-count", "scores_a-yes", "scores_a-maybe", "scores_a-no",
  "jobtitle", "picture_link", "bio", "audience"
];

// TODO: figure out what this was supposed to do.
// persona.js has this after logout, so I think it's supposed to
// make sure any controls like edit buttons are disabled.
ccfp.disable = function () {
	return true;
};

// flatten the authors map to a comma-separated list
ccfp.formatAuthors = function (item, sep) {
  var authors = [];
  var emails = [];
  for (key in item["authors"]) {
    if (item["authors"].hasOwnProperty(key) && item["authors"][key] != "1") {
      authors.push(item["authors"][key]);
      emails.push(key);
    }
  }
  return {
    "names": authors.join(sep),
    "emails": emails.join(sep)
  };
}

// goes over the raw abstract data and gets some stats useful for displaying
// in the overview table easily with d3
ccfp.computeStats = function (data) {
  var numAbstracts = 0;
  var numScored = 0;
  var absStats = [];
  var csvdata = [ccfp.csv_fields];

  data.forEach(function (a) {
    var id = a["id"];
    numAbstracts++;
    var curr = {};

    // make sure all table fields are defined so D3 can set up the rows properly
    ccfp.table_fields.map(function (f) {
      curr[f] = null;
    });

    // copy over most fields as-is
		// required fields
    ["id", "title", "body"].forEach(function (f) {
      curr[f] = a[f];
    });
    // possibly not available
		["company", "jobtitle", "picture_link", "bio", "audience"].forEach(function (key) {
    	curr[key] = a[key] || "N/A";
		});

    // if one score is set, assume the user set all scores
    if (a["scores_a"] != null && a["scores_a"].hasOwnProperty(userEmail)) {
      numScored++;
    }

    var authors = ccfp.formatAuthors(a, ", ");
    curr["authors"] = authors["names"];

    // again but formatted for safe CSV export
    authors = ccfp.formatAuthors(a, ";");
    curr["emails"] = authors["emails"];
    curr["names"] = authors["names"];

    // count up yes/no/maybe's in scores_a (all others are ignored for now)
    curr["scores_a-count"] = 0;
    curr["scores_a-yes"]   = 0;
    curr["scores_a-maybe"] = 0;
    curr["scores_a-no"]    = 0;

    for (email in a["scores_a"]) {
			if (email == userEmail) {
				curr["scores_a"] = a["scores_a"][email];
			}

			if (_.isNumber(a["scores_a"][email])) {
    		curr["scores_a-count"]++;

				// Note: values must match map at the top of this file
 				if (a["scores_a"][email] === 1) {
    			curr["scores_a-no"]++;
				} else if (a["scores_a"][email] === 2) {
    			curr["scores_a-maybe"]++;
				} else if (a["scores_a"][email] === 3) {
    			curr["scores_a-yes"]++;
				}
			}
    }

    absStats.push(curr);

    // create a flat row for CSV export
    var csvrow = [];
    ccfp.csv_fields.forEach(function (field, j) {
      csvrow[j] = curr[field];
    });
    csvdata.push(csvrow);
  });

  ccfp.csv = csvdata;

  return {
    total: numAbstracts,
    scored: numScored,
    abstracts: absStats
  };
};

ccfp.renderOverview = function () {
  $.ajax({ url: '/abstracts/', dataType: "json" })
    .done(function (data, status, xhr) {
      ccfp.stats = ccfp.computeStats(data);

			// admins have a couple extra columns
			var columns = ccfp.table_fields;
			if (ccfp.isAdmin()) {
				columns = ccfp.table_fields.concat(ccfp.admin_fields);
			}

			var panel = d3.select("#overview-panel").classed("row", true);
			    panel.selectAll("table").remove(); // make sure it's clean

			var table = panel.append("table")
						.classed({"table": true, "table-striped": true})
						.attr("id", "overview-table");

			var thead = table.append("thead").append("tr").classed("ccfp-abstract-header", true);

			thead.selectAll("th")
				.data(columns)
				.enter()
				.append("th")
				.attr("style", "white-space: nowrap;")
				.text(function (d,i) {
					if (ccfp.header_names.hasOwnProperty(d)) {
						return ccfp.header_names[d];
					} else {
						return "";
					}
				});

			var refresh = thead.append("th").append("button")
				.attr("type", "button")
				.attr("id", "overview-refresh-button")
				.classed({"btn": true, "btn-default": true, "btn-xs": true})
				.on("click", ccfp.refreshOverview);

			refresh.append("span")
				.classed({"glyphicon": true, "glyphicon-refresh": true})
				.text("Refresh");

			// add an empty column to the list to go under Refresh
			columns.push("");

			var tbody = table.append("tbody").attr("id", "overview-tbody");

      // create a row for each abstract
      var tr = tbody.selectAll("tr")
        .data(ccfp.stats.abstracts, function (d) { return d["id"]; })
        .enter()
        .append("tr")
        .classed("ccfp-abstract-row", true);

      // fill in the fields for each abstract
      tr.selectAll("td")
        .data(function (d) {
          return columns.map(function (f) {
          	// 0: value, 1: record, 2: field name
           	return [d[f], d, f];
          });
        })
        .enter()
        .append("td")
        .attr("data-field", function (d) { return d[2]; })
        .attr("data-target", function (d) { return "#abstract-" + d[1]["id"] + "-modal"; })
        .attr("data-id", function (d) { return d[1]["id"]; })
        .attr("data-toggle", "modal")
        .html(function (d) {
          if (d[2] == "rate-link") {
            return '<a href="#">rate</a>';
          }
					else if (d[2] == "scores_a") {
						return ccfp.scores_a_values["" + d[0]];
					}
					else {
          	return d[0];
					}
        });

				// enable table sorting using a jquery plugin, but only on the
				// columns that are sortable
				var tsheaders = {};
				columns.forEach(function (d,i) {
					if (d === "" || d.match("/-link$/")) {
						tsheaders[i] = { "sorter": false };
				  }
				});
        $("#overview-table").tablesorter({ "headers": tsheaders });

      // change the edit link to open the editing modal using plain onclick
      // where it's more straightforward to pass the id over

			if (ccfp.isAdmin()) {
			  // only fires if edit-link is already in the table
			  // TODO fix this
        tr.selectAll("td")
          .select(function (d) {
            if (d[2] == "edit-link") {
              return this;
            }
            return null;
          })
          .on('click', function (e) {
            var id = $(this).data('id');
            ccfp.setupEditForm(id);
          })
          .attr("data-target", null).attr("data-toggle", null)
          .append("a").attr("href", "#").text("edit");

        tr.selectAll("td")
					.select(function (d) {
						if (d[2] == "delete-link") {
              return this;
						}
						return null;
					})
          .on('click', function (e) {
            var id = $(this).data('id');
						console.log("clicked delete", id);
						ccfp.confirmDeleteAbstract(id);
          })
          .attr("data-target", null).attr("data-toggle", null)
          .append("a").attr("href", "#").text("delete");
			}

			// remove the loading animation
			d3.select("#loading-animation").remove();
    })
    .fail(function (xhr, status, err) {
      alert("renderOverview XHR failed: please email info@planetcassandra.org: " + status);
      console.log("XHR failed: " + status);
    });
};

ccfp.refreshOverview = function () {
  ccfp.deleteOverview();
  ccfp.renderOverview();
};

ccfp.deleteOverview = function () {
  d3.select("#overview-tbody")
    .selectAll("tr")
    .remove();
};

/*
 * Creates a modal in the background for each abstract. They aren't
 * visible by default. They can be popped up with Bootstrap modal
 * attributes or functions.
 * This function is way too long.
 */
ccfp.createScoringModals = function (data) {
  var body = d3.select("body");
	var modals = {};

  data.forEach(function (a, i) {
    var id = a["id"];

    if (a["authors"] == null) {
      a["authors"] = {};
    }

    var divId = "abstract-" + id + "-modal";

		// this function returns a map of uuid => domid
		modals[id] = divId;

    var m = body.append("form")
      .attr("id", "score-" + id)
      .append("div").classed({ "modal": true, "fade": true })
      .attr("id", divId)
      .attr("role", "dialog")
      .attr("tabindex", "-1");

		// automatically refresh the overview when a modal closes
		// use the jquery .on() since d3's doesn't seem to work
		$("#" + divId).on('hidden.bs.modal', function () {
			ccfp.deleteOverview();
			ccfp.renderOverview();
		});

    var c = m.append("div")
      .classed({ "modal-dialog": true, "modal-lg": true })
      .append("div")
      .classed("modal-content", true);

    var h = c.append("div").classed("modal-header", true);
    var b = c.append("div").classed("modal-body", true);
    var f = c.append("div").classed("modal-footer", true);

    h.append("button").classed("close", true)
      .attr("data-dismiss", "modal")
      .html("&times;");
    h.append("h4").classed("modal-title", true)
      .html("<strong>Scoring: </strong>" + a["title"]);

    var mkrow = function (key, value) {
      var r = b.append("div").classed({ "row": true, "ccfp-view": true });
      r.append("div")
        .classed("col-sm-3", true)
        .append("strong")
        .html(key);
      r.append("div").classed("col-sm-9", true)
        .html(value);
    };

    var authors = ccfp.formatAuthors(a, ", ");
    mkrow("Author(s)", authors["names"]);
    mkrow("Company", a["company"]);
    mkrow("Job Title", a["jobtitle"]);
    mkrow("Picture Link",
      '<a href="' + a["picture_link"] + '">' + a["picture_link"] + "</a>");
    mkrow("Intended Audience", a["audience"]);

    mkrow("Author Bio", "");
    b.append("div").classed("row", true)
      .append("div").classed({ "col-sm-12": true, "ccfp-view": true })
      .append("textarea").classed({"form-control": true, "ccfp-textarea": true})
      .attr("disabled", true)
      .attr("rows", 4)
      .text(a["bio"]);

    mkrow("Abstract", "");
    b.append("div").classed("row", true)
      .append("div").classed({ "col-sm-12": true, "ccfp-view": true })
      .append("textarea")
      .attr("disabled", true)
      .attr("rows", 8).classed({"form-control": true, "ccfp-textarea": true})
      .text(a["body"]);

    b.append("hr");

    var choice = 0;

    if (a["scores_a"] == null) {
      a["scores_a"] = {};
    }

    if (a["scores_a"].hasOwnProperty(userEmail)) {
      choice = a["scores_a"][userEmail];
    }

    var r = b.append("div").classed({ "row": true, "ccfp-view": true });
    r.append("div").classed("col-sm-3", true)
      .append("strong")
      .html("My Choice");

		var rdiv = r.append("div")
		 .classed({"col-sm-9": true, "btn-group": true})
		 .attr("data-toggle", "buttons");

		rdiv.selectAll("label")
		 .data(_.keys(ccfp.scores_a_values))
		 .enter()
		   .append("label")
		     .classed({"btn": true, "btn-primary": true})
		     .html(function (d) { return ccfp.scores_a_values[d]; })
         .classed("active", function (d) { return choice === d; })
		     .on("click", function (d) {
					 ccfp.updateScores(id, "scores_a", d);
				 })
		   .append("input")
				 .attr("id", "scores_a-" + id)
         .attr("type", "radio")
         .attr("name", "scores_a-" + id)
         .attr("autocomplete", "off") // recommended by bootstrap docs
         .attr("checked", function (d) {
					 if (choice === d) { return "1" }
					 else { return null };
				 });

    b.append("hr");

    mkrow("Comment (optional)", "");
    var cform = b.append("form").classed("form-horizontal", true)
      .attr("role", "form")
      .attr("id", "comment-form-" + id);

    var ctxt = cform.append("div").classed({ "row": true })
      .append("div").classed({ "col-sm-12": true, "ccfp-view": true })
      .append("textarea")
      .attr("id", "new-comment-body-" + id)
      .attr("name", "body")
      .attr("rows", 4).classed({"form-control": true, "ccfp-textarea": true});

    var cbtn = cform.append("button")
      .classed({ "btn": true, "btn-default": true })
      .attr("id", "new-comment-save-" + id)
      .text("Save Comment");

    // TODO: add button to hide comments, hide by default
    var ctbl = b.append("table")
      .classed({ "table": true, "table-striped": true, "table-hover": true, "table-condensed": true });
    ctbl.append("tbody").attr("id", "comment-list-" + id);

    b.append("div").classed({ "row": true, "ccfp-view": true }); // spacer

    // previous / next / done buttons
    // TODO: probably a better way to do this d3-style
    var previous = data[i - 1];
    var pbtn = f.append("button").classed({ "btn": true, "btn-default": true })
      .attr("id", "review-abstract-prev-" + id)
      .attr("data-dismiss", "modal")
      .text("< Previous");

    if (typeof (previous) == "object" && previous.hasOwnProperty("id")) {
      pbtn.attr("data-target", "#abstract-" + previous["id"] + "-modal")
        .attr("data-id", previous["id"])
        .attr("data-toggle", "modal");
    } else {
      pbtn.attr("disabled", true);
    }

    var next = data[i + 1];
    var nbtn = f.append("button").classed({ "btn": true, "btn-default": true })
      .attr("id", "review-abstract-next-" + id)
      .attr("data-dismiss", "modal")
      .text("Next >");

    if (typeof (next) == "object" && next.hasOwnProperty("id")) {
      nbtn.attr("data-target", "#abstract-" + next["id"] + "-modal")
        .attr("data-id", next["id"])
        .attr("data-toggle", "modal");
    } else {
      nbtn.attr("disabled", true);
    }

    f.append("button").classed({ "btn": true, "btn-default": true })
      .attr("id", "review-abstract-done-" + id)
      .attr("data-dismiss", "modal")
      .text("Done");

    // for some reason this func was firing when added with .append('onload')
    var save_comment = function () {
      cbtn.attr("disabled", true);
      ctxt.attr("disabled", true);
      var cb = $("#new-comment-body-" + id);
      var cd = { "abstract_id": id, "body": cb.val(), "email": userEmail };
      var js = JSON.stringify(cd);
      if (cb.val().length == 0) {
        console.log("ignoring event becuase cb.val() is empty:", cb.val());
        return true;
      }
      $.ajax({ url: "/comments/", type: "PUT", data: js, dataType: "json" })
        .done(function (d, status, xhr) {
          console.log("Response from PUT /comments/: ", status, d);
          ccfp.populateComments(id); // reload the comments after writing
          cb.val("");
					// NOTE: these must be force-enabled on every modal display, which
					// is currently wired up in setup using an on display listener
          ctxt.attr("disabled", null);
          cbtn.attr("disabled", null);
        })
        .fail(function (data, status, xhr) {
          alert("XHR failed: please email info@planetcassandra.org");
          console.log("XHR save of abstract form failed.", data, status, xhr);
        });
      return true;
    };

    $("#new-comment-save-" + id).on('click', save_comment);
    $("#review-abstract-done-" + id).on('click', save_comment);
    $("#review-abstract-prev-" + id).on('click', save_comment);
    $("#review-abstract-next-" + id).on('click', save_comment);
  });

	return modals;
};

// the backend supports updating multiple slots in one go, but this
// does not since the current version only needs one
ccfp.updateScores = function (id, slot, value) {
	// the backend refuses to parse "score" as a string! Make sure it's a number before serialization.
	var update = [{ "id": id, "slot": slot, "email": userEmail, "score": +value}];

  $.ajax({
    type: "POST",
    contentType: "application/json; charset=utf-8",
    url: '/updatescores',
    data: JSON.stringify(update),
    dataType: "json"
  });
	// TODO: display an error?
};

ccfp.populateComments = function (id) {
  $.ajax({ url: "/comments/" + id, type: "GET", dataType: "json" })
    .done(function (data, status, xhr) {
      data.reverse();
      var tbody = d3.select("#comment-list-" + id);
      tbody.selectAll("tr").remove(); // clear
      var cmt = tbody.selectAll("tr")
        .data(data)
        .enter()
        .append("tr");

      cmt.append("td").html(function (d) {
          var dt = new Date(d["created"]);
          return d["email"] + "<br/><small>" + dt.toLocaleString() + "</small>";
      });
      cmt.append("td").attr("style", "word-break:break-all;")
        .text(function (d) { return d["body"]; });
    })
    .fail(function (data, status, xhr) {
      alert("XHR failed: please email info@planetcassandra.org");
      console.log("XHR failed.", data, status, xhr);
    });
};

ccfp.newAbstractForm = function () {
  $('#abstract-form')[0].reset();
  $("#form-abstract-id").val("");
  $('#abstract-form-modal-title').html("New Abstract");
  $('#abstract-form-modal').modal()
};

ccfp.setupEditForm = function (id) {
  $('#abstract-form')[0].reset();

  $.ajax({ url: "/abstracts/" + id, dataType: "json" })
    .done(function (data, status, xhr) {
      $("#form-abstract-id").val(data["id"]);
      $('#abstract-form-modal-title').html("Editing Abtract: " + data["title"]);
      $("#body").val(data["body"]);
      $("#title").val(data["title"]);

			if (data["authors"] == null) {
				data["authors"] = {};
			}

      // the backend supports multiple authors but the frontend work
      // to expose that isn't complete. This code supports getting
      // multiple authors by splitting into arrays that can be joined
      // into the existing fields in the UI
      var authors = [];
      var emails = [];
      for (var a in data["authors"]) {
        if (data["authors"].hasOwnProperty(a) && data["authors"][a] != "") {
          emails.push(a);
          authors.push(data["authors"][a]);
        }
      };

      $("#author0").val(authors.join(", "));
      $("#email0").val(emails.join(", "));

      ["company", "jobtitle", "bio", "picture_link", "audience"].forEach(function (key) {
          $("#" + key).val(data[key]);
      });

      $('#abstract-form-modal-title').html("Edit Abstract " + id);
      $('#abstract-form-modal').modal()
    })
    .fail(function (data, status, xhr) {
      alert("XHR failed: please email info@planetcassandra.org");
      console.log("XHR fetch for abstract form failed.", data, status, xhr);
    });
};

// build a delete modal popup to confirm deletes
// currently rebuilds the modal every time rather than
// reusing one with parameters
ccfp.confirmDeleteAbstract = function (id) {
  var parent_div = d3.select("#index-body");
	parent_div.select("#delete-modal").remove();

	var modal = parent_div.append("div")
		.attr("id", "delete-modal")
		.classed({"modal": true, "fade": true})
	  .append("div").classed("modal-dialog", true)
	    .append("div").classed("modal-content", true);

	var header = modal.append("div").classed("modal-header", true)
	header.append("button")
    .attr("type", "button")
		.attr("data-dismiss", "modal")
		.classed("close", "true")
		.attr("aria-label", "Close")
		.append("span")
		  .attr("aria-hidden", "true")
			.html("&times;");
	header.append("h4")
		.classed("modal-title", true)
		.text("Delete Abstract " + id + "?");

	var footer = modal.append("div").classed("modal-footer", true);
	footer.append("button")
		.classed({"btn": true, "btn-default": true})
	  .attr("data-dismiss", "modal")
		.text("Cancel");

	footer.append("button")
		.classed({"btn": true, "btn-danger": true})
		.text("DELETE")
		.on("click", function () {
			console.log("Deleting ID: ", id);
  		$.ajax({ url: "/abstracts/" + id, type: "DELETE", dataType: "json" });
			// TODO: handle errors?

			$("#delete-modal").modal("toggle");
			parent_div.select("#delete-modal").remove();
			ccfp.refreshOverview();
		});

	// finally, toggle it to be visible
	$("#delete-modal").modal("toggle");
};

// for now, only support a single author field even though the
// backend supports up to 64k
ccfp.saveAbstractForm = function () {
  var abs = {
    "authors": {},
    "company": $("#company").val(),
    "jobtitle": $("#jobtitle").val(),
    "bio": $("#bio").val(),
    "picture_link": $("#picture_link").val(),
    "audience": $("#audience").val(),
    "title": $("#title").val(),
    "body": $("#body").val()
  };
  abs["authors"][$("#email0").val()] = $("#author0").val();

  // if the ID is set, that means this is an edit so pass it to the
  // server, otherwise the field must not exist in the JSON or parsing
  // will fail since "" is an invalid uuid
  var method = "PUT";
  var id = $("#form-abstract-id").val();
  if (id.length == 36) {
    abs["id"] = id;
    method = "PATCH";
  }

  $.ajax({ url: "/abstracts/", type: method, data: JSON.stringify(abs), dataType: "json" })
    .done(function (data, status, xhr) {
      ccfp.deleteOverview();
      ccfp.renderOverview();
      console.log("Saved to backend.", data, status, xhr);
    })
    .fail(function (data, status, xhr) {
      alert("XHR failed: please email info@planetcassandra.org");
      console.log("XHR save of abstract form failed.", data, status, xhr);
    });
};

ccfp.enableAdminLinks = function () {
	  var menu = d3.select("#action-menu");

		menu.append("li")
        .append("a")
        .attr("id", "new-abstract-link")
        .attr("href", "#")
        .text("New Abstract");

    $('#new-abstract-link').on('click', function (e) {
      ccfp.newAbstractForm();
    });

		menu.append("li")
        .append("a")
        .attr("download", "abstracts.csv")
        .attr("id", "export-csv-link")
        .attr("href", "#")
        .text("Download CSV");

    $("#export-csv-link").on('click', function () {
      d3.select("#export-csv-link").attr("href",
        "data:text/plain;charset=UTF-8," +
        encodeURIComponent(d3.csv.formatRows(ccfp.csv)));
    });
};

ccfp.isAdmin = function () {
	  return _.contains(ccfp.admins, userEmail);
};

// persona can take a second or two to do its round trip with the
// server, so rather than doing setup with $(document).ready, put
// that code in run() and let the persona setup call it.
ccfp.run = function () {
  $.ajax({ url: '/admins/', dataType: "json" })
    .done(function (data, status, xhr) {
      ccfp.admins = data;

      if (ccfp.isAdmin()) {
        ccfp.enableAdminLinks();
      }
    })
    .fail(function (xhr, status, err) {
      alert("/admins/ XHR failed: please email info@planetcassandra.org");
      console.log("XHR failed: " + status);
    });


  // create a modal for each entry for entering scores
  $.ajax({ url: '/abstracts/', dataType: "json" })
    .done(function (data, status, xhr) {
      var modals = ccfp.createScoringModals(data);

			// add a listener to update comments on display of the modal
			// this makes the page load more quickly and should handle concurrent
			// users adding comments a little more cleanly without having to get fancy
			// keys are uuids, values are dom ids
			_.keys(modals).forEach(function (id) {
				$("#" + modals[id]).on("shown.bs.modal", function () {
					// load comments
					ccfp.populateComments(id);
					// make sure comments are enabled when a modal is displayed since a save
					// ajax call may not have gotten a chance to reenable them
					$("#new-comment-save-" + id).prop("disabled", false);
					$("#new-comment-body-" + id).prop("disabled", false);
				});
			});

      // render the overview after the modals are ready
      ccfp.renderOverview();
    })
    .fail(function (xhr, status, err) {
      alert("/abstracts/ XHR failed: please email info@planetcassandra.org");
      console.log("XHR failed: " + status);
    });

  $('#abstract-form-submit').on('click', function (e) {
    $("#abstract-form").validate({
      submitHandler: ccfp.saveAbstractForm
    });
  });

  jQuery.validator.setDefaults({
    debug: true,
    errorClass: 'has-error',
    validClass: 'has-success',
    ignore: "",
    highlight: function (element, errorClass, validClass) {
      $(element).closest('.form-group').addClass('has-error');
    },
    unhighlight: function (element, errorClass, validClass) {
      $(element).closest('.form-group').removeClass('has-error');
    },
    errorPlacement: function (error, element) {
      $(element).closest('.form-group').find('.help-block').text(error.text());
    }
  });
};
