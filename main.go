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

var privKey []byte
var store *CQLStore
var addrFlag, cqlFlag, ksFlag, sessCookie, audience, keyFlag string
var cass *gocql.Session

func init() {
	flag.StringVar(&addrFlag, "addr", ":8080", "IP:PORT or :PORT address to listen on")
	flag.StringVar(&cqlFlag, "cql", "127.0.0.1", "IP or IP:port of the Cassandra CQL service")
	flag.StringVar(&ksFlag, "ks", "ccfp", "keyspace containing the ccfp schema")
	flag.StringVar(&sessCookie, "cookie", "summitcfp", "the name of the cookie, publicly visible")
	flag.StringVar(&audience, "audience", "localhost:8080", "the domain:port value for 'audience' in Mozilla Persona")
	flag.StringVar(&keyFlag, "key", "INSECURE", "a private key for encrypted session storage")
}

func main() {
	flag.Parse()
	privKey = []byte(keyFlag)

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
	r.HandleFunc("/index.html", RootHandler)
	r.HandleFunc("/admins/", AdminsHandler)
	r.HandleFunc("/abstracts/", AbstractsHandler)
	r.HandleFunc("/comments/", CommentsHandler)
	r.HandleFunc("/comments/{abstract_id:[-a-f0-9]+}", CommentsHandler)
	r.HandleFunc("/updatescores", ScoreUpdateHandler)
	r.HandleFunc("/login", LoginHandler)
	r.HandleFunc("/logout", LogoutHandler)

	abstracts := r.PathPrefix("/abstracts/{id:[-a-f0-9]+}").Subrouter()
	abstracts.Methods("GET").HandlerFunc(GetAbstractHandler)
	abstracts.Methods("DELETE").HandlerFunc(DeleteAbstractHandler)

	fs := http.FileServer(http.Dir("./public/"))
	r.PathPrefix("/js").Handler(fs)
	r.PathPrefix("/css").Handler(fs)
	r.PathPrefix("/fonts").Handler(fs)
	r.PathPrefix("/img").Handler(fs)

	http.Handle("/", r)

	http.ListenAndServe(addrFlag, nil)
}
