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
 * persona.go: a simple implementation of Mozilla Persona for authentication
 *
 */

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
)

// https://developer.mozilla.org/en-US/Persona/Remote_Verification_API#Return_values
type AuthResp struct {
	Status   string `json:"status"`
	Email    string `json:"email"`
	Audience string `json:"audience"`
	Issuer   string `json:"issuer"`
	Expires  uint64 `json:"expires"`
	Reason   string `json:"reason"`
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	auth, err := verifyAssertion(r.FormValue("assertion"))
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to check auth assertion: %s", err), 500)
	}
	if auth.Status == "okay" {
		// set up an auth session and save it to Cassandra
		sess, _ := store.Get(r, "persona")
		sess.Values["email"] = auth.Email
		sess.Save(r, w)
		jsonOut(w, r, auth)
	} else {
		http.Error(w, fmt.Sprintf("Authenticaiton failed: %s", err), 400)
	}
}

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("Empty logout handler.\n")
}

func verifyAssertion(assertion string) (auth AuthResp, err error) {
	params := url.Values{"assertion": {assertion}, "audience": {audience}}

	resp, err := http.PostForm("https://verifier.login.persona.org/verify", params)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return
	}

	err = json.Unmarshal(body, &auth)

	return
}
