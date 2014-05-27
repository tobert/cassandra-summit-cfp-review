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

// the server only knows about scores_a, b, etc. and will store a
// ScoresNames field that should always be a copy of this
ccfp.ScoresNames = {
  "scores_a": "Skill Level",
  "scores_b": "Abstract Quality",
  "scores_c": "Relevance"
};
ccfp.ScoresFields = ["scores_a", "scores_b", "scores_c", "scores_d", "scores_e", "scores_f", "scores_g"];

// goes over the raw abstract data and gets some stats useful for displaying
// in the overview table easily with d3
ccfp.computeStats = function (data) {
  var numAbstracts = 0;
  var numScored = 0;
  var absStats = [];

  data.forEach(function (a) {
    var id = a["id"];
    numAbstracts++;
    var curr = { id: id, title: a["title"] };

    // if one score is set, assume the user set all scores
    if (a["scores_a"].hasOwnProperty(userEmail)) {
      numScored++;
    }

    // flatten the authors map to a comma-separated list
    var authors = [];
    for (key in a["authors"]) {
      if (a["authors"].hasOwnProperty(key)) {
        authors.push(a["authors"][key]);
      }
    }
    curr["authors"] = authors.join(", ");

    // total all of the score fields across reviewers
    ccfp.ScoresFields.forEach(function (field) {
      curr[field] = 0;
      for (key in a[field]) {
        if (a[field].hasOwnProperty(key)) {
          curr[field] += a[field][key];
        }
      }
    });

    absStats.push(curr);
  });

  return {
    abstracts: numAbstracts,
    scored: numScored,
    abstracts: absStats
  };
};

ccfp.renderOverview = function (target) {
  $.ajax({
    url: '/abstracts/',
    dataType: "json"
  }).done(function(data, status, xhr) {
    stats = ccfp.computeStats(data);
    console.log("Stats: ", stats);

    var table = d3.select(target).append("table").attr('class', "table table-striped");
    var thead = table.append("thead");
    var tbody = table.append("tbody");

    // table column headers
    cols = ["Author", "Title", ccfp.ScoresNames["scores_a"], ccfp.ScoresNames["scores_b"], ccfp.ScoresNames["scores_c"]];

    // create the headers
    thead.append("tr").selectAll("th").data(cols).enter()
      .append("th").text(function (d) { return d; })

    // create a row for each abstract
    var rows = tbody.selectAll("tr")
      .data(stats.abstracts)
      .enter()
      .append("tr")
      .attr("data-id", function(d) { return d["id"]; })
      .attr("data-toggle", "modal")
      .attr("data-target", "#abstractModal");

    // fill in the fields for each abstract
    var cells = rows.selectAll("td")
      .data(function (d) {
        return [d["authors"], d["title"], d["scores_a"], d["scores_b"], d["scores_c"]];
      })
      .enter()
      .append("td")
      .text(function(d) { return d; });

  }).fail(function(xhr, status, err) {
    console.log("XHR failed: " + status);
  });
};

ccfp.renderReview = function (target) {
  console.log("review");
};

ccfp.renderSubmit = function (target) {
  console.log("submit");
};

$( document ).ready(function() {
  $('#overview-link').on('click', function (e) {
    ccfp.renderOverview("#content-panel");
  });

  $('#review-link').on('click', function (e) {
    ccfp.renderReview("#content-panel");
  });

  $('#submit-link').on('click', function (e) {
    ccfp.renderSubmit("#content-panel");
  });
});

