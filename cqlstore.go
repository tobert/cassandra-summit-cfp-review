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
	"bytes"
	"encoding/gob"
	"errors"
	"github.com/gocql/gocql"
	"github.com/gorilla/securecookie"
	"github.com/gorilla/sessions"
	"log"
	"net/http"
	"time"
)

type CQLStore struct {
	Cass    *gocql.Session       // connected gocql cassandra session
	Codecs  []securecookie.Codec // session codecs
	Options *sessions.Options    // default configuration
}

func init() {
	gob.Register(time.Now())
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

	// load the session ID from the cookie (if it exists)
	c, err := r.Cookie(name)
	if err == nil {
		err = securecookie.DecodeMulti(name, c.Value, &sess.ID, cs.Codecs...)
		log.Printf("Got session ID from cookie: '%s'\n", sess.ID)
		if err != nil {
			log.Printf("cqlstore: Cookie decode failed: %s\n", err)
			return
		}

		if cs.load(sess) == nil {
			sess.IsNew = false
		}
		return
	} else {
		log.Printf("No cookie found with name '%s'.\n", name)
	}

	// no cookie or ID found, generate an ID for a new session
	uuid, err := gocql.RandomUUID()
	if err != nil {
		log.Printf("cqlstore: failed to generate a new UUID: %s\n", err)
		return
	}
	sess.ID = uuid.String()

	return
}

func (cs *CQLStore) Save(r *http.Request, w http.ResponseWriter, sess *sessions.Session) (err error) {
	err = cs.save(sess)
	if err != nil {
		log.Printf("cqlstore: Failed to save session to Cassandra: %s\n", err)
		return
	}

	blob, err := securecookie.EncodeMulti(sess.Name(), sess.ID, cs.Codecs...)
	if err != nil {
		log.Printf("cqlstore: Failed to encode session: %s\n", err)
		return err
	}
	http.SetCookie(w, sessions.NewCookie(sess.Name(), blob, sess.Options))

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

// load session data from Cassandra
func (cs *CQLStore) load(sess *sessions.Session) (err error) {
	var data []byte
	var created, modified time.Time
	query := `SELECT data, created, modified FROM sessions WHERE id=?`
	iq := cs.Cass.Query(query, sess.ID).Iter()
	ok := iq.Scan(&data, &created, &modified)
	if ok {
		// expose the created/modified times through the session values
		sess.Values["created"] = created
		sess.Values["modified"] = modified
		sess.IsNew = false
		return
	} else {
		log.Printf("cqlstore: CQL query for session ID '%s' failed.\n", sess.ID)
		return errors.New("CQL query failed.")
	}
	return
}

func (cs *CQLStore) save(sess *sessions.Session) (err error) {
	// save to Cassandra using gobs without encryption
	var vals bytes.Buffer
	enc := gob.NewEncoder(&vals)
	enc.Encode(sess.Values)

	now := time.Now()
	if sess.IsNew {
		query := `INSERT INTO sessions (id, data, created, modified) VALUES (?, ?, ?, ?)`
		err = cs.Cass.Query(query, sess.ID, vals.Bytes(), now, now).Exec()
	} else {
		query := `UPDATE sessions SET data=?, modified=? WHERE id=?`
		err = cs.Cass.Query(query, vals.Bytes(), now, sess.ID).Exec()
	}
	return
}
