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
	"log"
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
	log.Printf("Enter: LoginHandler()\n")
	auth, err := verifyAssertion(r.FormValue("assertion"))
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to check auth assertion: %s", err), 500)
		return
	}

	log.Printf("LoginHandler: auth.Status == '%s'\n", auth.Status)

	if auth.Status == "okay" {
		// set up an auth session and save it to Cassandra
		sess, err := store.Get(r, sessCookie)
		if err != nil {
			log.Printf("Error loading session for email '%s': %s\n", auth.Email, err)
		}
		sess.Values["email"] = auth.Email
		sess.Save(r, w)
		jsonOut(w, r, auth)
	} else {
		http.Error(w, fmt.Sprintf("Authentication failed: %s", err), 400)
		return
	}

	log.Printf("Exit: LoginHandler()\n")
}

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("Enter: LogoutHandler()\n")
	sess, err := store.Get(r, sessCookie)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to read cookie: %s\n", err), 500)
	}
	err = store.Delete(r, w, sess)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to delete session: %s\n", err), 500)
	}

	log.Printf("Exit: LogoutHandler()\n")
}

func verifyAssertion(assertion string) (auth AuthResp, err error) {
	params := url.Values{"assertion": {assertion}, "audience": {audience}}

	resp, err := http.PostForm("https://verifier.login.persona.org/verify", params)
	if err != nil {
		log.Printf("auth request to https://verifier.login.persona.org/verify failed: %s\n", err)
		return
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read POST data: %s\n", err)
		return
	}

	err = json.Unmarshal(body, &auth)
	if err != nil {
		log.Printf("Failed to unmarshal JSON data: %s\n", err)
	}

	log.Printf("Response: %+v\n", auth)

	return
}
