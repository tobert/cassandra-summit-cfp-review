package main

/*
 * Copyright 2015 Albert P. Tobey <atobey@datastax.com> @AlTobey
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
	"encoding/csv"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/gocql/gocql"
	"io"
	"log"
	"os"
	"time"
)

var fileFlag, cqlFlag string
var writeJsonFlag bool
var fields []string = []string{
	"First",
	"Last",
	"Email",
	"Title",
	"Company",
	"Picture URL",
	"Bio",
	"Presentation Title",
	"Presentation Abstract",
	"Experience Needed",
	"Presentation Partner",
}

func init() {
	flag.StringVar(&fileFlag, "file", "", "input filename to read")
	flag.StringVar(&cqlFlag, "cql", "", "writing to Cassandra instance at addr:port")
	flag.BoolVar(&writeJsonFlag, "json", false, "dump JSON to stdout")
}

func main() {
	flag.Parse()

	fl, err := os.Open(fileFlag)
	if err != nil {
		log.Fatalf("Failed to open file for read '%s': %s\n", fileFlag, err)
	}
	defer fl.Close()

	rdr := csv.NewReader(fl)

	// replace the funky 6-byte apostrophe that is not utf8 or ASCII
	//bad := []byte{0xc3, 0xa2, 0xc2, 0x80, 0xc2, 0x99}
	//data := bytes.Replace(buf, bad, []byte{0x27}, -1)

	// map field names to indices
	f := make(map[string]int)
	for i, d := range fields {
		f[d] = i
	}

	abstracts := make(Abstracts, 0)

	for {
		rec, err := rdr.Read()
		if err == io.EOF {
			break
		} else if err != nil {
			log.Fatalf("Read from file '%s' failed: %s\n", fileFlag, err)
		}

		name := fmt.Sprintf("%s %s", rec[f["First"]], rec[f["Last"]])
		authors := Authors{
			Email(rec[f["Email"]]): name,
		}

		// no sample data to look at so jam it in the key and value for now
		// this way it'll show up in the UI ugly rather than not at all
		if rec[f["Presentation Partner"]] != "" {
			authors[Email(rec[f["Presentation Partner"]])] = rec[f["Presentation Partner"]]
		}

		a := Abstract{
			Id:          gocql.TimeUUID(),
			Title:       rec[f["Presentation Title"]],
			Body:        rec[f["Presentation Abstract"]],
			Authors:     authors,
			Created:     time.Now(),
			PictureLink: rec[f["Picture URL"]],
			Bio:         rec[f["Bio"]],
			JobTitle:    rec[f["Title"]],
			Company:     rec[f["Company"]],
			Audience:    rec[f["Experience Needed"]],
		}

		abstracts = append(abstracts, a)
	}

	if cqlFlag != "" {
		cluster := gocql.NewCluster(cqlFlag)
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
	}

	if writeJsonFlag {
		js, err := json.MarshalIndent(abstracts, "", "  ")
		if err != nil {
			log.Fatalf("Failed to encode sdata as JSON: %s\n", err)
		}
		os.Stdout.Write(js)
	}
}
