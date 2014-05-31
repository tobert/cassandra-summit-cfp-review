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
 * comments.go: Functions for managing comments.
 *
 */

import (
	"github.com/gocql/gocql"
	"time"
)

type Comment struct {
	AbsId   gocql.UUID `json:"abstract_id"`
	Id      gocql.UUID `json:"id"`
	Created time.Time  `json:"created"`
	Email   Email      `json:"email"`
	Body    string     `json:"body"`
}

type Comments []Comment

func ListComments(cass *gocql.Session, absId gocql.UUID) (Comments, error) {
	clist := make(Comments, 0)

	query := `SELECT abstract_id, id, email, body FROM comments WHERE abstract_id=?`
	iq := cass.Query(query, absId).Iter()
	for {
		c := Comment{}
		ok := iq.Scan(&c.AbsId, &c.Id, &c.Email, &c.Body)
		if ok {
			c.Created = c.Id.Time()
			clist = append(clist, c)
		} else {
			break
		}
	}
	if err := iq.Close(); err != nil {
		return nil, err
	}

	return clist, nil
}

func (c *Comment) Save(cass *gocql.Session) error {
	query := `INSERT INTO comments (abstract_id, id, email, body) VALUES (?, ?, ?, ?)`
	return cass.Query(query, c.AbsId, c.Id, c.Email, c.Body).Exec()
}
