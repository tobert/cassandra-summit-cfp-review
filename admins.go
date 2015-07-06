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
 * admins.go: manage the admin list in cassandra
 *
 */

import (
	"errors"
)

type Admins []string

func fetchAdmins() (Admins, error) {
	alist := make(Admins, 0)

	iq := cass.Query(`SELECT email FROM admins`).Iter()

	for {
		admin := ""
		ok := iq.Scan(&admin)

		if ok {
			alist = append(alist, admin)
		} else {
			break
		}
	}
	if err := iq.Close(); err != nil {
		return nil, err
	}

	return alist, nil
}

func checkIfAdmin(email string) (bool, error) {
	if email == "" {
		return false, errors.New("Invalid admin parameter.")
	}

	admins, err := fetchAdmins()
	if err != nil {
		return false, err
	}

	for _, a := range admins {
		if email == a {
			return true, nil
		}
	}

	return false, nil
}
