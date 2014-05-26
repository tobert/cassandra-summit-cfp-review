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
	"net/http"
	"time"
)

func RootHandler(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "./public/index.html")
}

func AbstractsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		alist, err := ListAbstracts(cass)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to list abstracts: %s", err), 500)
		}
		jsonOut(w, r, alist)
	case "PUT":
		a := Abstract{}
		dec := json.NewDecoder(r.Body)
		err := dec.Decode(&a)

		// TODO: better error code
		if err != nil {
			http.Error(w, fmt.Sprintf("invalid json data: %s", err), 500)
		}

		a.Id = gocql.TimeUUID()
		a.Created = time.Now()
		err = a.Save(cass)
		if err != nil {
			http.Error(w, fmt.Sprintf("persistence failed: %s", err), 500)
		}

		jsonOut(w, r, a)
	default:
		http.Error(w, fmt.Sprintf("method '%s' not implemented", r.Method), 500)
	}
}

func AbstractHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := gocql.ParseUUID(vars["id"])
	if err != nil {
		http.Error(w, fmt.Sprintf("could not parse uuid: '%s'", err), 500)
	}
	a, _ := GetAbstract(cass, id)
	jsonOut(w, r, a)
}

func jsonOut(w http.ResponseWriter, r *http.Request, data interface{}) {
	js, err := json.Marshal(data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(js)
}
