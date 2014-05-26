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
	"fmt"
	"github.com/gocql/gocql"
	"github.com/gorilla/mux"
	"net/http"
)

var cass *gocql.Session

func main() {
	// connect to Cassandra
	cluster := gocql.NewCluster("127.0.0.1")
	cluster.Keyspace = "ccfp"
	cluster.Consistency = gocql.Quorum

	var err error
	cass, err = cluster.CreateSession()
	if err != nil {
		panic(fmt.Sprintf("Error creating Cassandra session: %v", err))
	}
	defer cass.Close()

	r := mux.NewRouter()

	r.HandleFunc("/", RootHandler)
	r.HandleFunc("/abstracts/", AbstractsHandler)
	r.HandleFunc("/abstracts/{id:[-a-f0-9]+}", AbstractHandler)
	r.PathPrefix("/").Handler(http.FileServer(http.Dir("./public/")))

	http.Handle("/", r)

	http.ListenAndServe(":8080", nil)
}
