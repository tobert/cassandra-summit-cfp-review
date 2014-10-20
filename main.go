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
	"flag"
	"fmt"
	"github.com/gocql/gocql"
	"github.com/gorilla/mux"
	"net/http"
)


const sessCookie string = "cfpeu2014"
const audience string = "localhost:8080"

var privKey []byte = []byte("2213AA86-CEB4-48FA-A65B-4AC37687131E")
var store *CQLStore
var addrFlag, cqlFlag, ksFlag string
var cass *gocql.Session

func init() {
	flag.StringVar(&addrFlag, "addr", ":8080", "IP:PORT or :PORT address to listen on")
	flag.StringVar(&cqlFlag, "cql", "127.0.0.1", "IP or IP:port of the Cassandra CQL service")
	flag.StringVar(&ksFlag, "ks", "ccfp", "keyspace containing the f7u12 schema")
}

func main() {
	flag.Parse()
	// connect to Cassandra
	cluster := gocql.NewCluster(cqlFlag)
	cluster.Keyspace = ksFlag
	cluster.Consistency = gocql.Quorum

	var err error
	cass, err = cluster.CreateSession()
	if err != nil {
		panic(fmt.Sprintf("Error creating Cassandra session: %v", err))
	}
	defer cass.Close()

	store = NewCQLStore(cass, privKey)

	r := mux.NewRouter()

	r.HandleFunc("/", RootHandler)
	r.HandleFunc("/abstracts/", AbstractsHandler)
	r.HandleFunc("/abstracts/{id:[-a-f0-9]+}", AbstractHandler)
	r.HandleFunc("/comments/", CommentsHandler)
	r.HandleFunc("/comments/{abstract_id:[-a-f0-9]+}", CommentsHandler)
	r.HandleFunc("/updatescores", ScoreUpdateHandler)
	r.HandleFunc("/login", LoginHandler)
	r.HandleFunc("/logout", LogoutHandler)

	r.PathPrefix("/").Handler(http.FileServer(http.Dir("./public/")))

	http.Handle("/", r)

	http.ListenAndServe(addrFlag, nil)
}
