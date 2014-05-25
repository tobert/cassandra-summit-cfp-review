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
 * abstracts.go: Functions for managing abstracts in the Cassandra database.
 *
 */

import (
	"errors"
	"fmt"
	"github.com/gocql/gocql"
	"time"
)

type Tag string
type Email string
type Score float32
type Authors map[Email]string
type Scores map[Email]Score
type Attrs map[string]string
type Comments map[Email]string

type Abstract struct {
	Id       gocql.UUID `json:"id"`
	Title    string     `json:"title"`
	Body     string     `json:"body"`
	Created  time.Time  `json:"created"`
	Authors  Authors    `json:"authors"`
	Tags     []Tag      `json:"tags"`
	Attrs    Attrs      `json:"attributes"`
	Comments Comments   `json:"comments"`

	// 7 slots for scoring, I don't know what these mean and there's
	// no point to encoding that meaning here so the 7 note scale it is
	// examples being tossed around:
	// the weights would be handled in javascript since security isn't
	// an issue and it isn't stored anyways
	// Estimated Skill Level of Speaker — 35% Weight
	// Quality of Abstract —  40% Weight
	// Relevance of Topic — 25% Weight
	ScoresA Scores `json:"scores_a"`
	ScoresB Scores `json:"scores_b"`
	ScoresC Scores `json:"scores_c"`
	ScoresD Scores `json:"scores_d"`
	ScoresE Scores `json:"scores_e"`
	ScoresF Scores `json:"scores_f"`
	ScoresG Scores `json:"scores_g"`

	// allow the client app to set the names and store them here
	// ideally every row will have the same values here and some disk
	// gets wasted but it also means only the javascript/html needs
	// to change for subsequent tweaks to the scoring
	ScoresNames map[string]string `json:"scores_names"`
}

type Abstracts []Abstract

func ListAbstracts(cass *gocql.Session) (Abstracts, error) {
	alist := make(Abstracts, 0)

	iq := cass.Query(`
SELECT id, title, body, created, authors, tags, attributes, comments,
       scores_a, scores_b, scores_c, scores_d,
	   scores_e, scores_f, scores_g, scores_names
FROM abstracts`).Iter()

	for {
		a := Abstract{}

		ok := iq.Scan(
			&a.Id, &a.Title, &a.Body, &a.Created, &a.Authors, &a.Tags,
			&a.Attrs, &a.Comments, &a.ScoresA, &a.ScoresB, &a.ScoresC,
			&a.ScoresD, &a.ScoresE, &a.ScoresF, &a.ScoresG, &a.ScoresNames,
		)

		if ok {
			alist = append(alist, a)
		} else {
			break
		}
	}
	if err := iq.Close(); err != nil {
		return nil, err
	}

	return alist, nil
}

func GetAbstract(cass *gocql.Session, id gocql.UUID) (a Abstract, err error) {
	q := cass.Query(`
SELECT id, title, body, created, authors, tags, attributes, comments,
       scores_a, scores_b, scores_c, scores_d,
	   scores_e, scores_f, scores_g, scores_names
FROM abstracts WHERE id=?`, id)

	err = q.Scan(
		&a.Id, &a.Title, &a.Body, &a.Created, &a.Authors, &a.Tags,
		&a.Attrs, &a.Comments, &a.ScoresA, &a.ScoresB, &a.ScoresC,
		&a.ScoresD, &a.ScoresE, &a.ScoresF, &a.ScoresG, &a.ScoresNames,
	)

	return a, err
}

// Create a new abstract record in the DB. Only the base fields
// are inserted in this call.
func CreateAbstract(cass *gocql.Session, a Abstract) error {
	fmt.Printf("INSERTING: %v\n", a)
	return cass.Query(`
INSERT INTO abstracts (
	id, title, body, created, authors, tags, attributes, comments,
	scores_a, scores_b, scores_c, scores_d,
	scores_e, scores_f, scores_g, scores_names)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		a.Id, a.Title, a.Body, a.Created, a.Authors, a.Tags,
		a.Attrs, a.Comments, a.ScoresA, a.ScoresB, a.ScoresC,
		a.ScoresD, a.ScoresE, a.ScoresF, a.ScoresG, a.ScoresNames,
	).Exec()
}

func SetScore(cass *gocql.Session, id gocql.UUID, score_slot string, email Email, score Score) error {
	var query string // for untaint

	switch score_slot {
	case "scores_a", "scores_b", "scores_c", "scores_d", "scores_e", "scores_f", "scores_g":
		query = fmt.Sprintf("UPDATE abstracts SET %s[?] = ? WHERE id=?", score_slot)
	default:
		return errors.New("Invalid score slot in input.")
	}

	return cass.Query(query, email, score, id).Exec()
}

func SetScores(cass *gocql.Session, id gocql.UUID, score_slot string, scores Scores) error {
	if len(scores) == 0 {
		return nil
	}

	for email, score := range scores {
		err := SetScore(cass, id, score_slot, email, score)
		if err != nil {
			return err
		}
	}
	return nil
}
