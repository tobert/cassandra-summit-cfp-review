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
	"net/http"
	"time"
)

func main() {
	// connect to Cassandra
	cluster := gocql.NewCluster("127.0.0.1")
	cluster.Keyspace = "ccfp"
	cluster.Consistency = gocql.Quorum

	cass, err := cluster.CreateSession()
	if err != nil {
		panic(fmt.Sprintf("Error creating Cassandra session: %v", err))
	}
	defer cass.Close()

	// serve up static content
	http.Handle("/js/", http.StripPrefix("/js/", http.FileServer(http.Dir("./public/js/"))))
	http.Handle("/css/", http.StripPrefix("/css/", http.FileServer(http.Dir("./public/css/"))))
	http.Handle("/img/", http.StripPrefix("/img/", http.FileServer(http.Dir("./public/img/"))))
	http.Handle("/fonts/", http.StripPrefix("/fonts/", http.FileServer(http.Dir("./public/fonts/"))))

	// front page
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./public/index.html")
	})

	http.HandleFunc("/abstracts/", func(w http.ResponseWriter, r *http.Request) {
		alist, err := ListAbstracts(cass)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to list abstracts: %s", err), 500)
		}
		jsonOut(w, r, alist)
	})

	http.HandleFunc("/abstract/", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "GET":
			id := getId(r, "/abstract/")
			a, _ := GetAbstract(cass, id)
			jsonOut(w, r, a)
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
			err = CreateAbstract(cass, a)
			if err != nil {
				http.Error(w, fmt.Sprintf("persistence failed: %s", err), 500)
			}

			jsonOut(w, r, a)
		default:
			http.Error(w, fmt.Sprintf("method '%s' not implemented", r.Method), 500)
		}
	})

	// start the show
	http.ListenAndServe(":8080", nil)
}

func getId(r *http.Request, prefix string) gocql.UUID {
	idarg := r.URL.Path[len(prefix):]
	id, err := gocql.ParseUUID(idarg)
	if err != nil {
		fmt.Printf("Invalid ID: '%s'\n", idarg)
	}
	return id
}

func jsonOut(w http.ResponseWriter, r *http.Request, data interface{}) {
	js, err := json.Marshal(data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(js)
}
