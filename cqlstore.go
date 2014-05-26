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
 * cqlstore.go: a quick & dirty Cassandra CQL backend for Gorilla sessions
 *
 */

import (
	"github.com/gocql/gocql"
	"github.com/gorilla/securecookie"
	"github.com/gorilla/sessions"
	"net/http"
	"time"
)

type CQLStore struct {
	Cass    *gocql.Session       // connected gocql cassandra session
	Codecs  []securecookie.Codec // session codecs
	Options *sessions.Options    // default configuration
}

func NewCQLStore(cass *gocql.Session, keyPairs ...[]byte) *CQLStore {
	return &CQLStore{
		Cass:   cass,
		Codecs: securecookie.CodecsFromPairs(keyPairs...),
		Options: &sessions.Options{
			Path:   "/",
			MaxAge: 86400 * 30,
		},
	}
}

func (cs *CQLStore) Get(r *http.Request, name string) (*sessions.Session, error) {
	return sessions.GetRegistry(r).Get(cs, name)
}

func (cs *CQLStore) New(r *http.Request, name string) (sess *sessions.Session, err error) {
	sess = sessions.NewSession(cs, name)
	sess.IsNew = true
	opts := *cs.Options // make a copy
	sess.Options = &opts

	// load the existing cookie (if it exists)
	c, err := r.Cookie(name)
	if err != nil {
		return
	}

	err = securecookie.DecodeMulti(name, c.Value, &sess.ID, cs.Codecs...)
	if err != nil {
		return
	}

	var data []byte
	var email Email
	var created time.Time
	query := `SELECT data, email, created FROM sessions WHERE id=?`
	iq := cs.Cass.Query(query, sess.ID).Iter()
	ok := iq.Scan(&data, &email, &created)
	if ok {
		sess.IsNew = false
		sess.Values["created"] = created
		sess.Values["email"] = email
	} else {
		sess.Values["created"] = time.Now()
		// TODO: figure out how to pass the email around
		fmt.Printf("BUG: hard-coded email address, this field will be nonsense!")
		sess.Values["email"] = "foobar@foobar.com" // BUG: hard coded
	}

	return
}

func (cs *CQLStore) Save(r *http.Request, w http.ResponseWriter, sess *sessions.Session) (err error) {
	now := time.Now()

	// generate a uuid if there isn't an id already
	if sess.ID == "" {
		var id gocql.UUID
		id, err = gocql.RandomUUID()
		if err != nil {
			return
		}
		sess.ID = id.String()
	}

	// serialize the session for storage in cassandra
	blob, err := securecookie.EncodeMulti(sess.Name(), sess.Values, cs.Codecs...)
	if err != nil {
		return
	}

	var created time.Time
	if sess.IsNew {
		created = now
	} else {
		created = sess.Values["created"].(time.Time)
	}

	query := `INSERT INTO sessions (id, data, email, created) VALUES (?, ?, ?, ?)`
	err = cs.Cass.Query(query, sess.ID, blob, created).Exec()
	if err != nil {
		return
	}

	// update the cookie
	cdata, err := securecookie.EncodeMulti(sess.Name(), sess.ID, cs.Codecs...)
	if err != nil {
		return
	}
	http.SetCookie(w, sessions.NewCookie(sess.Name(), cdata, sess.Options))

	return nil
}

func (cs *CQLStore) Delete(r *http.Request, w http.ResponseWriter, sess *sessions.Session) (err error) {
	// overwrite the cookie with a negative max age so the browser expires it immediately
	opts := *sess.Options
	opts.MaxAge = -1
	http.SetCookie(w, sessions.NewCookie(sess.Name(), "", &opts))

	// delete the session from the DB
	err = cs.Cass.Query(`DELETE FROM sessions WHERE id=?`, sess.ID).Exec()
	return
}
