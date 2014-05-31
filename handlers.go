package main

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
 * main.go: http server application for cassandra-summit-cfp-review
 *
 */

import (
	"encoding/json"
	"fmt"
	"github.com/gocql/gocql"
	"github.com/gorilla/mux"
	"log"
	"net/http"
	"time"
)

func RootHandler(w http.ResponseWriter, r *http.Request) {
	// check for auth but ignore the result: this will initialize
	// the cookie on page load
	checkAuth(w, r)
	http.ServeFile(w, r, "./public/index.html")
}

func AbstractsHandler(w http.ResponseWriter, r *http.Request) {
	if !checkAuth(w, r) {
		return
	}

	a := Abstract{}
	dec := json.NewDecoder(r.Body)
	err := dec.Decode(&a)

	switch r.Method {
	case "GET":
		alist, err := ListAbstracts(cass)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to list abstracts: %s", err), 500)
		}
		jsonOut(w, r, alist)
		return
	case "PUT":
		if err != nil {
			http.Error(w, fmt.Sprintf("AbstractsHandler/PUT invalid json data: %s", err), 500)
		}

		a.Id = gocql.TimeUUID()
		a.Created = time.Now()
	case "PATCH":
		if err != nil {
			http.Error(w, fmt.Sprintf("AbstractsHandler/PATCH invalid json data: %s", err), 500)
		}
	default:
		http.Error(w, fmt.Sprintf("method '%s' not implemented", r.Method), 500)
		return
	}

	// bare minimum input checking
	if a.Title == "" || a.Body == "" || len(a.Attrs) == 0 || len(a.Authors) == 0 {
		http.Error(w, "required field missing", 500)
		return
	}

	err = a.Save(cass)
	if err != nil {
		http.Error(w, fmt.Sprintf("AbstractsHandler/PUT a.Save() failed: %s", err), 500)
	}

	jsonOut(w, r, a)
}

func AbstractHandler(w http.ResponseWriter, r *http.Request) {
	if !checkAuth(w, r) {
		return
	}

	vars := mux.Vars(r)
	id, err := gocql.ParseUUID(vars["id"])
	if err != nil {
		http.Error(w, fmt.Sprintf("could not parse uuid: '%s'", err), 500)
	}
	a, _ := GetAbstract(cass, id)
	jsonOut(w, r, a)
}

func ScoreUpdateHandler(w http.ResponseWriter, r *http.Request) {
	if !checkAuth(w, r) {
		return
	}
	scores := make(ScoreUpdates, 7)
	dec := json.NewDecoder(r.Body)
	err := dec.Decode(&scores)
	if err != nil {
		log.Printf("invalid score update json: %s\n", err)
		http.Error(w, fmt.Sprintf("invalid score update json: %s", err), 500)
	}

	err = scores.Save(cass)
	if err != nil {
		log.Printf("score update failed: %s\n", err)
		http.Error(w, fmt.Sprintf("score update failed: %s", err), 500)
	}

	jsonOut(w, r, scores)
}

// returns the email string if authenticated (via persona), it won't
// be there at all if the user didn't authenticate
func checkAuth(w http.ResponseWriter, r *http.Request) bool {
	log.Println("checkAuth()")
	sess, err := store.Get(r, sessCookie)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to read cookie: %s\n", err), 400)
		return false
	}

	if sess.IsNew {
		log.Printf("Saving session ID '%s' to Cassandra.\n", sess.ID)
		sess.Save(r, w)
	}

	if sess.Values["email"] != nil {
		email := sess.Values["email"].(string)
		log.Printf("sess.Values[email]: '%s'\n", sess.Values["email"])
		if email != "" {
			return true
		}
	}

	return false
}
