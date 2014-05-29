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
 * requires: jQuery and D3
 */

var ccfp = ccfp || {};

ccfp.ScoresFields = ["scores_a", "scores_b", "scores_c", "scores_d", "scores_e", "scores_f", "scores_g"];

// flatten the authors map to a comma-separated list
ccfp.formatAuthors = function(item) {
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

    // copy over most fields as-is
    ["id", "title", "attributes", "body", "tags", "comments", "scores_names"].forEach(function(f) {
      curr[f] = a[f]
    });

    // if one score is set, assume the user set all scores
    if (a["scores_a"].hasOwnProperty(userEmail)) {
      numScored++;
    }

    curr["authors"] = ccfp.formatAuthors(a);

    // total all of the score fields across reviewers
    ccfp.ScoresFields.forEach(function (field) {
      // track total & count to compute average later
      var total_field = field + "-total";
      var count_field = field + "-count";
      curr[total_field] = 0;
      curr[count_field] = 0;

      for (key in a[field]) { // abstract/scores_a
        if (a[field].hasOwnProperty(key)) { // abstract/scores_a/email
          curr[count_field]++;
          curr[total_field] += a[field][key];
          curr[field] = a[field][key]; // current user's entry
        }
      }
    });

    // compute averages
    ccfp.ScoresFields.forEach(function (field) {
      var total_field = field + "-total";
      var count_field = field + "-count";
      var avg_field = field + "-avg";
      curr[avg_field] = curr[total_field] / curr[count_field];
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
  $.ajax({
    url: '/abstracts/',
    dataType: "json"
  }).done(function(data, status, xhr) {
    stats = ccfp.computeStats(data);

    // create a row for each abstract
    var tr = d3.select("#overview-tbody")
      .selectAll("tr")
      .data(stats.abstracts)
      .enter()
      .append("tr")
      .attr("data-id", function(d) { return d["id"]; })
      .attr("data-toggle", "modal")
      .attr("data-target", function(d) { return "#abstract-" + d["id"] + "-modal" });

    // fill in the fields for each abstract
    var td = tr.selectAll("td")
      .data(function (d) {
        return [
          d["authors"], d["title"],
          d["scores_a"], d["scores_b"], d["scores_c"],
          d["scores_a-avg"], d["scores_b-avg"], d["scores_c-avg"]
       ];
      })
      .enter()
      .append("td")
      .text(function(d) { return d; });
  }).fail(function(xhr, status, err) {
    console.log("XHR failed: " + status);
  });
};

ccfp.deleteOverview = function () {
    console.log("gonna remove all rows from overview");
    d3.select("#overview-tbody").selectAll("tr").remove();
};

ccfp.createScoringModals = function (data) {
  var body = d3.select("body");
  var id = "";
  var prevId = "";
  data.forEach(function (a) {
    prevId = id;
    id = a["id"];

    var divId = "abstract-" + id + "-modal";
    var m = body.append("form").attr("id", "score-" + id)
                .append("div")
                .attr("id", divId)
                .attr("role", "dialog")
                .attr("tabindex", "-1")
                .classed({"modal": true, "fade": true});
    var c = m.append("div").classed({"modal-dialog": true, "modal-lg": true})
             .append("div").classed("modal-content", true);
    var h = c.append("div").classed("modal-header", true);
    var b = c.append("div").classed("modal-body", true);
    var f = c.append("div").classed("modal-footer", true);

    h.append("button").classed("close", true).attr("data-dismiss", "modal").html("&times;");
    h.append("h4").classed("modal-title", true).html("<strong>Scoring: </strong>" + a["title"]);

    var mkrow = function (key, value) {
      var r = b.append("div").classed({"row": true, "ccfp-view": true});
          r.append("div").classed("col-sm-3", true).append("strong").html(key);
          r.append("div").classed("col-sm-9", true).html(value);
    };

    mkrow("Author(s)", ccfp.formatAuthors(a));
    mkrow("Company", a["attributes"]["company"]);
    mkrow("Job Title", a["attributes"]["jobtitle"]);
    mkrow("Picture Link",
      '<a href="' + a["attributes"]["picture_link"] + '">' + a["attributes"]["picture_link"] + "</a>");
    mkrow("Intended Audience", a["attributes"]["audience"]);

    mkrow("Author Bio", "");
    b.append("div").classed("row", true)
     .append("div").classed({"col-sm-12": true, "ccfp-view": true})
     .append("textarea").attr("disabled", 1).attr("rows", 8).classed("form-control", true)
     .text(a["attributes"]["bio"]);

    mkrow("Abstract", "");
    b.append("div").classed("row", true)
     .append("div").classed({"col-sm-12": true, "ccfp-view": true})
     .append("textarea").attr("disabled", 1).attr("rows", 8).classed("form-control", true)
     .text(a["body"]);

    var sliders = [];
    var mkslider = function(name, slot) {
      var domid = name.toLowerCase() + "-slider-" + id;
      var value = 50;
      if (a[slot].hasOwnProperty(userEmail)) {
        value = a[slot][userEmail];
      }

      var r = b.append("div").classed({"row": true, "ccfp-view": true})
      r.append("div").classed("col-sm-3", true).append("strong").html(name);
      var v = r.append("div").classed("col-sm-1", true).append("strong").text(value);
      r.append("div").classed("col-sm-8", true)
         .append("input")
           .attr("id", domid).attr("type", "text").style("width", "140px")
           .attr("data-slider-id", domid)
           .attr("data-slider-min", 0)  .attr("data-slider-max", 100)
           .attr("data-slider-step", 1) .attr("data-slider-value", value);

      var s = $("#" + domid).slider().on('slideStop', function() {
        ccfp.updateScores(id, sliders, divId);
      }).data('slider');
      // well this is weird ... it's best to update all scores at once
      // in a single ajax call so the sliders themselves, the cell containing
      // the score value, and the slot name all need to be in an array scoped
      // higher than this function so we can close over it ...
      sliders.push({'slider': s, 'cell': v, 'slot': slot});
    };

    mkslider("Skill", "scores_a");
    mkslider("Quality", "scores_b");
    mkslider("Relevance", "scores_c");
  });
};

ccfp.updateScores = function(id, sliders, divId) {
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
  }).done(function(data, status, xhr) {
    console.log(data);
    // TODO: replace this with close/cancel buttons on the modal!
    // reload the overview when the modal closes
    $("#" + divId).on('hidden.bs.modal', function () {
      ccfp.deleteOverview();
      ccfp.renderOverview();
    });
  });
};

ccfp.newAbstractForm = function () {
  $('#abstract-form-modal').modal()
};

// persona can take a second or two to do its round trip with the
// server, so rather than doing setup with $(document).ready, put
// that code in run() and let the persona setup call it.
ccfp.run = function () {
  // create a modal for each entry for entering scores
  $.ajax({
    url: '/abstracts/',
    dataType: "json"
  }).done(function(data, status, xhr) {
    ccfp.createScoringModals(data);
    // render the overview after the modals are ready
    ccfp.renderOverview();
  }).fail(function(xhr, status, err) {
    console.log("XHR failed: " + status);
  });

  $('#new-abstract-link').on('click', function (e) {
    ccfp.newAbstractForm();
  });
};

ccfp.disable = function () {
    console.log("STUB: disable.");
};
