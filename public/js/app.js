/*
 * Copyright 2014 Albert P. Tobey <atobey@datastax.com> @AlTobey
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
 * requires: jQuery, D3, and some plugins, see index.html at the bottom
 *
 * I'm not proud of this but it works. If I had it to do over again I
 * go with a pipline something like Go <-> angular <-> D3 <-> UI so that
 * angular can handle all the reactive / data change complexity, with
 * D3 still doing all the drawing because I like it for building pages
 * procedurally on top of Bootstrap's sensible defaults.
 */
var ccfp = ccfp || {};

ccfp.scores_fields = ["scores_a", "scores_b", "scores_c", "scores_d", "scores_e", "scores_f", "scores_g"];

// needs to match the table structure in index.html
ccfp.table_fields = [
  "authors", "title", "company", "reviews", "scores_a", "scores_b", "scores_c",
  "score-link", "edit-link"
];

// flatten the authors map to a comma-separated list
ccfp.formatAuthors = function (item) {
  var authors = [];
  for (key in item["authors"]) {
    if (item["authors"].hasOwnProperty(key)) {
      authors.push(item["authors"][key]);
    }
  }
  return authors.join(", ");
}

// goes over the raw abstract data and gets some stats useful for displaying
// in the overview table easily with d3
ccfp.computeStats = function (data) {
  var numAbstracts = 0;
  var numScored = 0;
  var absStats = [];

  data.forEach(function (a) {
    var id = a["id"];
    numAbstracts++;
    var curr = {};

    // make sure all table fields are defined so D3 can set up the rows properly
    ccfp.table_fields.map(function (f) {
      curr[f] = null;
    });

    // copy over most fields as-is
    ["id", "title", "attributes", "body", "tags", "scores_names"].forEach(function (f) {
      curr[f] = a[f];
    });

    // if one score is set, assume the user set all scores
    if (a["scores_a"] != null && a["scores_a"].hasOwnProperty(userEmail)) {
      numScored++;
    }

    curr["authors"] = ccfp.formatAuthors(a);
    curr["company"] = a["attributes"]["company"] || "Unknown";

    // count up how many people have already scored this abstract
    curr["reviews"] = 0;
    for (user in a["scores_a"]) {
      if (a["scores_a"].hasOwnProperty(user)) {
        curr["reviews"]++;
      }
    }

    // total all of the score fields across reviewers
    ccfp.scores_fields.forEach(function (field) {
      // track total & count to compute average later
      var total_field = field + "-total";
      var count_field = field + "-count";
      curr[total_field] = 0;
      curr[count_field] = 0;

      for (email in a[field]) { // abstract/scores_a
        if (a[field].hasOwnProperty(email)) { // abstract/scores_a/email
          curr[count_field]++;
          curr[total_field] += a[field][email] || 0;
          if (email == userEmail) {
            curr[field] = a[field][email]; // current user's entry
          }
        }
      }
    });

    // compute averages
    ccfp.scores_fields.forEach(function (field) {
      var total_field = field + "-total";
      var count_field = field + "-count";
      var avg_field = field + "-avg";
      if (curr[count_field] == 0) {
        curr[avg_field] = 0;
      } else {
        curr[avg_field] = Math.floor(curr[total_field] / curr[count_field]);
      }
    });

    absStats.push(curr);
  });

  return {
    total: numAbstracts,
    scored: numScored,
    abstracts: absStats
  };
};

ccfp.renderOverview = function () {
  $.ajax({ url: '/abstracts/', dataType: "json" })
    .done(function (data, status, xhr) {
      stats = ccfp.computeStats(data);
      // create a row for each abstract
      var tr = d3.select("#overview-tbody")
        .selectAll("tr")
        .data(stats.abstracts, function (d) { return d["id"]; })
        .enter()
        .append("tr");

      // fill in the fields for each abstract
      tr.selectAll("td")
        .data(function (d) {
          return ccfp.table_fields.map(function (f) {
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
          if (d[2] == "score-link") {
            return '<a href="#">score</a>';
          }
          return d[0];
        });

      // change the edit link to open the editing modal using plain onclick
      // where it's more straightforward to pass the id over
      tr.selectAll("td")
        .select(function (d) {
          if (d[2] == "edit-link") {
            return this;
          }
          return null;
        })
        .attr("data-target", null)
        .attr("data-toggle", null)
        .on('click', function (e) {
          var id = $(this).data('id');
          ccfp.setupEditForm(id);
        })
        .append("a")
        .attr("href", "#")
        .text("edit");

        $("#overview-table").tablesorter();
    })
    .fail(function (xhr, status, err) {
      console.log(err);
      console.log("XHR failed: " + status);
    });
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
  data.forEach(function (a, i) {
    var id = a["id"];

    if (a["attributes"] == null) {
      a["attributes"] = {};
    }
    if (a["authors"] == null) {
      a["authors"] = {};
    }

    var divId = "abstract-" + id + "-modal";

    var m = body.append("form")
      .attr("id", "score-" + id)
      .append("div").classed({ "modal": true, "fade": true })
      .attr("id", divId)
      .attr("role", "dialog")
      .attr("tabindex", "-1");

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

    mkrow("Author(s)", ccfp.formatAuthors(a));
    mkrow("Company", a["attributes"]["company"]);
    mkrow("Job Title", a["attributes"]["jobtitle"]);
    mkrow("Picture Link",
      '<a href="' + a["attributes"]["picture_link"] + '">' + a["attributes"]["picture_link"] + "</a>");
    mkrow("Intended Audience", a["attributes"]["audience"]);

    mkrow("Author Bio", "");
    b.append("div").classed("row", true)
      .append("div").classed({ "col-sm-12": true, "ccfp-view": true })
      .append("textarea").classed("form-control", true)
      .attr("disabled", true)
      .attr("rows", 4)
      .text(a["attributes"]["bio"]);

    mkrow("Abstract", "");
    b.append("div").classed("row", true)
      .append("div").classed({ "col-sm-12": true, "ccfp-view": true })
      .append("textarea")
      .attr("disabled", true)
      .attr("rows", 8).classed("form-control", true)
      .text(a["body"]);

    var sliders = [];
    var mkslider = function (name, domname, slot) {
      var domid = domname + "-slider-" + id;
      var value = 50;

      if (a[slot] == null) {
        a[slot] = {};
      }

      if (a[slot].hasOwnProperty(userEmail)) {
        value = a[slot][userEmail];
      }

      var r = b.append("div").classed({ "row": true, "ccfp-view": true });
      r.append("div").classed("col-sm-3", true)
        .append("strong")
        .html(name);
      var v = r.append("div").classed("col-sm-1", true)
        .append("strong")
        .text(value);
      r.append("div").classed("col-sm-8", true)
        .append("input")
        .attr("id", domid)
        .attr("type", "text")
        .style("width", "140px")
        .attr("data-slider-id", domid)
        .attr("data-slider-min", 0)
        .attr("data-slider-max", 100)
        .attr("data-slider-step", 1)
        .attr("data-slider-value", value);

      var s = $("#" + domid).slider().on('slideStop', function () {
        ccfp.updateScores(id, sliders, divId);
      }).data('slider');

      // well this is weird ... it's best to update all scores at once
      // in a single ajax call so the sliders themselves, the cell containing
      // the score value, and the slot name all need to be in an array scoped
      // higher than this function so we can close over it ...
      sliders.push({ 'slider': s, 'cell': v, 'slot': slot });
    };

    b.append("hr");
    mkslider("Skill of Speaker", "skill", "scores_a");
    mkslider("Quality of Abstract", "quality", "scores_b");
    mkslider("Relevance or Talk", "relevance", "scores_c");
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
      .attr("rows", 4).classed("form-control", true);

    var cbtn = cform.append("button")
      .classed({ "btn": true, "btn-default": true })
      .attr("id", "new-comment-save-" + id)
      .text("Save Comment");

    b.append("div").classed({ "row": true, "ccfp-view": true }); // spacer

    // TODO: add button to hide comments, hide by default
    var ctbl = b.append("table")
      .classed({ "table": true, "table-striped": true, "table-hover": true, "table-condensed": true });
    ctbl.append("tbody").attr("id", "comment-list-" + id);

    // for some reason this func was firing when added with .append('onload')
    $("#new-comment-save-" + id).on('click', function () {
      cbtn.attr("disabled", true);
      ctxt.attr("disabled", true);
      var cb = $("#new-comment-body-" + id);
      var cd = { "abstract_id": id, "body": cb.val(), "email": userEmail };
      var js = JSON.stringify(cd);
      $.ajax({ url: "/comments/", type: "PUT", data: js, dataType: "json" })
        .done(function (d, status, xhr) {
          console.log("Response from PUT /comments/: ", status, d);
          ccfp.populateComments(id);
          cb.val("");
          ctxt.attr("disabled", null);
          cbtn.attr("disabled", null);
        })
        .fail(function (data, status, xhr) {
          console.log("XHR save of abstract form failed.", data, status, xhr);
        });
      return false;
    });

    ccfp.populateComments(id);

    // previous / next / done buttons
    // TODO: probably a better way to do this d3-style
    var previous = data[i - 1];
    var pbtn = f.append("button").classed({ "btn": true, "btn-default": true })
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
      .attr("data-dismiss", "modal")
      .text("Done");
  });
};

ccfp.updateScores = function (id, sliders, divId) {
  var su = [];
  sliders.forEach(function (s) {
    var score = s['slider'].getValue();
    su.push({ "id": id, "slot": s['slot'], "email": userEmail, "score": score });
    s['cell'].text(score);
  });

  $.ajax({
    type: "POST",
    contentType: "application/json; charset=utf-8",
    url: '/updatescores',
    data: JSON.stringify(su),
    dataType: "json"
  })
    .done(function (data, status, xhr) {
      // TODO: replace this with close/cancel buttons on the modal!
      // reload the overview when the modal closes
      $("#" + divId).on('hidden.bs.modal', function () {
        ccfp.deleteOverview();
        ccfp.renderOverview();
      });
    });
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

      ["authors", "attributes"].forEach(function (a) {
        if (data[a] == null) {
          data[a] = {};
        }
      });

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

      // fields that are stored as attributes
      ["company", "jobtitle", "bio", "picture_link", "audience"].forEach(function (key) {
        if (data["attributes"].hasOwnProperty(key)) {
          $("#" + key).val(data["attributes"][key]);
        } else {
          $("#" + key).val("");
        }
      });

      $('#abstract-form-modal-title').html("Edit Abstract " + id);
      $('#abstract-form-modal').modal()
    })
    .fail(function (data, status, xhr) {
      console.log("XHR fetch for abstract form failed.", data, status, xhr);
    });
};

// for now, only support a single author field even though the
// backend supports up to 64k
ccfp.saveAbstractForm = function () {
  var abs = {
    "authors": {},
    "attributes": {
      "company": $("#company").val(),
      "jobtitle": $("#jobtitle").val(),
      "bio": $("#bio").val(),
      "picture_link": $("#picture_link").val(),
      "audience": $("#audience").val()
    },
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
      console.log("XHR save of abstract form failed.", data, status, xhr);
    });
};

// persona can take a second or two to do its round trip with the
// server, so rather than doing setup with $(document).ready, put
// that code in run() and let the persona setup call it.
ccfp.run = function () {
  // create a modal for each entry for entering scores
  $.ajax({ url: '/abstracts/', dataType: "json" })
    .done(function (data, status, xhr) {
      ccfp.createScoringModals(data);
      // render the overview after the modals are ready
      ccfp.renderOverview();
    })
    .fail(function (xhr, status, err) {
      console.log("XHR failed: " + status);
    });

  $('#overview-refresh-button').on('click', function (e) {
      ccfp.deleteOverview();
      ccfp.renderOverview();
  });

  $('#new-abstract-link').on('click', function (e) {
    ccfp.newAbstractForm();
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
