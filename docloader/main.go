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
 * A quick program to convert a copy/pasted doc from Google Docs into C*.
 */

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/gocql/gocql"
	"io/ioutil"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

var fields []string = []string{
	"name",
	"email",
	"company name",
	"job title",
	"quick biography",
	"link to current picture",
	"presentation title",
	"presentation abstract",
	"experience needed to understand talk",
	"additional comments or questions",
	"time estimation",
}

func main() {
	fileFlag := flag.String("file", "", "input filename to read")
	writeCassFlag := flag.Bool("cass", false, "enable writing to Cassandra")
	writeJsonFlag := flag.Bool("json", false, "dump JSON to stdout")
	flag.Parse()

	buf, err := ioutil.ReadFile(*fileFlag)
	if err != nil {
		log.Fatalf("Failed to read file '%s': %s\n", *fileFlag, err)
	}

	// replace the funky 6-byte apostrophe that is not utf8 or ASCII
	bad := []byte{0xc3, 0xa2, 0xc2, 0x80, 0xc2, 0x99}
	data := bytes.Replace(buf, bad, []byte{0x27}, -1)

	// track keys seen that don't match the fields list above
	badkeys := make(map[string]string, 4096)

	// track file line number across inner loops for printing on errors
	var fline = 0

	// records are delimited by /^__/ in the document
	records := bytes.Split(data, []byte("\n__"))

	abstracts := Abstracts{}

	for _, r := range records {
		rec := make(map[string]string, 32)
		lines := bytes.Split(r, []byte("\n"))
		for li, l := range lines {
			fline++

			// first line should be the number in the doc, an int
			// but no big deal if it's not, it's not important at all
			if li == 1 {
				n, err := strconv.Atoi(string(l))
				if err == nil {
					rec["ds_index"] = fmt.Sprintf("%d", n)
					continue
				} else {
					log.Printf("Failed to parse number: %s\n", err)
				}
			}

			// skip short lines as irrelevant, usually a single \n or \r\n
			if len(l) < 2 {
				continue
			}

			kv := bytes.SplitN(l, []byte(":"), 2)
			if len(kv) != 2 {
				log.Printf("Possible partial record at line %d '%s'", li, kv)
			}

			// TODO: multi-line values are not supported, but for this pass
			// it doesn't matter
			key := strings.ToLower(string(kv[0]))
			var found bool = false
			for _, f := range fields {
				if f == key {
					rec[f] = strings.TrimSpace(string(kv[1]))
					found = true
				}
			}
			if !found {
				badkeys[string(kv[0])] = fmt.Sprintf("%d", fline)
			}
		}

		if rec["presentation title"] == "" {
			continue
		}

		attr := Attrs{
			"ds_index":      rec["ds_index"],
			"picture_link":  rec["link to current picture"],
			"bio":           rec["quick biography"],
			"jobtitle":      rec["job title"],
			"company":       rec["company name"],
			"audience":      rec["experience needed to understand talk"],
			"notes":         rec["additional comments or questions"],
			"time_estimate": rec["time estimation"],
		}
		a := Abstract{
			Id:      gocql.TimeUUID(),
			Title:   rec["presentation title"],
			Body:    rec["presentation abstract"],
			Authors: Authors{Email(rec["email"]): rec["name"]},
			Created: time.Now(),
			Attrs:   attr,
		}

		abstracts = append(abstracts, a)
	}

	for k, v := range badkeys {
		fmt.Printf("Bad Key at line %s: '%s'\n", v, k)
	}

	if *writeCassFlag {
		cluster := gocql.NewCluster("127.0.0.1")
		cluster.Keyspace = "ccfp"
		cluster.Consistency = gocql.Quorum

		cass, err := cluster.CreateSession()
		if err != nil {
			panic(fmt.Sprintf("Error creating Cassandra session: %v", err))
		}
		defer cass.Close()

		for _, a := range abstracts {
			err = a.Save(cass)
			if err != nil {
				log.Printf("Failed to save record: %s\n", err)
			}
		}
	} else if *writeJsonFlag {
		js, err := json.MarshalIndent(abstracts, "", "  ")
		if err != nil {
			log.Fatalf("Failed to encode sdata as JSON: %s\n", err)
		}
		os.Stdout.Write(js)
	}
}
