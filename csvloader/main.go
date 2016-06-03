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
 * A quick program to import CSV data.
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
	"strconv"
	"strings"
	"time"
)

var fileFlag, cqlFlag string
var writeJsonFlag bool

// 2016 CSV export fields
// Tracks will contain the track
// and the detailed track will be in its column... weird but ok.
var fields []string = []string{
	"SubmissionID", // 0
	"Tracks",       // 1
	"Getting Started: Apache Cassandra for the Relational Developer", // 2
	"Operations", // 3
	"Development: For engineers already familiar with Apache Cassandra", // 4
	"Architecture",                     // 5
	"Internals & Theory",               // 6
	"Global Deployments",               // 7
	"Analytics",                        // 8
	"Use Cases",                        // 9
	"DataStax Enterprise",              // 10
	"If Other, please specify",         // 11
	"First Name",                       // 12
	"Last Name",                        // 13
	"Email",                            // 14
	"Company Name",                     // 15
	"Job Title",                        // 16
	"Quick Biography",                  // 17
	"Presentation Title",               // 18
	"Presentation Abstract",            // 19
	"Will there be another presenter?", // 20
	"Co-Presenter First Name",          // 21
	"Co-Presenter Last Name",           // 22
	"Co-Presenter Email",               // 23
	"Co-Presenter Company Name",        // 24
	"Co-Presenter Job Title",           // 25
	"Co-Presenter Quick Biography",     // 26
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

		// skip the header row if present
		if rec[0] == "SubmissionID" {
			continue
		}

		name := fmt.Sprintf("%s %s", rec[f["First Name"]], rec[f["Last Name"]])
		authors := Authors{
			Email(rec[f["Email"]]): name,
		}
		bio := rec[f["Quick Biography"]]

		copresenter := strings.ToLower(rec[f["Will there be another presenter?"]])
		if strings.HasPrefix(copresenter, "y") {
			cpname := fmt.Sprintf("%s %s", rec[f["Co-Presenter First Name"]], rec[f["Co-Presenter Last Name"]])
			cpemail := Email(rec[f["Co-Presenter Email"]])

			authors[cpemail] = cpname

			bio = bio + "\n\n" + cpname + ": " + rec[f["Co-Presenter Quick Biography"]]
		}

		// collapse the track
		track := rec[f["Tracks"]]
		firstTrackIdx := f["Tracks"] + 1
		lastTrackIdx := f["If Other, please specify"]
		for _, subtrack := range rec[firstTrackIdx : lastTrackIdx+1] {
			if strings.Trim(subtrack, " ,.") != "" {
				track = track + ", " + subtrack
			}
		}

		subidtxt := rec[f["SubmissionID"]]
		subid, err := strconv.Atoi(subidtxt)
		if err != nil {
			fmt.Sprintf("Could not convert %q to int: %s", subidtxt, err)
			panic(err)
		}

		a := Abstract{
			Id:         gocql.TimeUUID(),
			UpstreamId: subid,
			Title:      rec[f["Presentation Title"]],
			Body:       rec[f["Presentation Abstract"]],
			Authors:    authors,
			Created:    time.Now(),
			Bio:        bio, // rec[f["Bio"]],
			JobTitle:   rec[f["Job Title"]],
			Company:    rec[f["Company Name"]],
			Tracks:     track,
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
	} else {
		for _, a := range abstracts {
			fmt.Printf("%+q\n\n", a)
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
